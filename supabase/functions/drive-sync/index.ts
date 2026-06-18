import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// ════════════════════════════════════════════════════════════════════════════
// drive-sync — pull instrument CSVs from a connected Google Drive folder.
//
// Auth flips from per-user OAuth to an app-level service account: the function
// authenticates to Google server-side using GOOGLE_SERVICE_ACCOUNT_JSON, so
// there is no user login / "unverified app" wall. The service account can only
// see files shared with its client_email, so each org shares its folder once.
//
//   mode:'list'   → list CSVs in the org's connected folder (+ alreadyImported)
//   mode:'import' → download selected files, upload to the instrument-imports
//                   bucket, then hand off to process-import (parse/match/email).
// ════════════════════════════════════════════════════════════════════════════

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMPORT_BATCH = 20;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface DriveFile {
  id: string;
  name: string;
  size: number | null;
  modifiedTime: string | null;
  alreadyImported: boolean;
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// PEM (PKCS#8) → DER bytes for crypto.subtle.importKey
function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Mint a Google OAuth2 access token from the service account via a signed JWT.
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
  );
  const claims = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({
      iss: sa.client_email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    })),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${await res.text()}`);
  }
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Google token response had no access_token');
  return data.access_token;
}

async function listFolderCsvs(folderId: string, token: string): Promise<{ id: string; name: string; size: number | null; modifiedTime: string | null }[]> {
  const q = [
    `'${folderId}' in parents`,
    'trashed = false',
    "(mimeType = 'text/csv' or mimeType = 'application/vnd.ms-excel' or name contains '.csv')",
  ].join(' and ');
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', 'files(id,name,modifiedTime,size)');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('orderBy', 'modifiedTime desc');

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Drive list failed (${res.status}). Make sure the folder is shared with the service account.`);
  }
  const data = await res.json() as { files?: { id: string; name: string; modifiedTime?: string; size?: string }[] };
  return (data.files ?? []).map(f => ({
    id: f.id,
    name: f.name,
    size: f.size ? Number(f.size) : null,
    modifiedTime: f.modifiedTime ?? null,
  }));
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers);

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401, headers);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerToken = authHeader.replace(/^Bearer\s+/i, '');
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user: callerUser }, error: authError } = await authClient.auth.getUser(callerToken);
  if (authError || !callerUser) return json({ error: 'Forbidden' }, 403, headers);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // Admin-only: confirm role/status via service role (bypasses RLS recursion).
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role, status')
    .eq('id', callerUser.id)
    .single();
  if (!profile || (profile as { role?: string }).role !== 'admin' || (profile as { status?: string }).status !== 'active') {
    return json({ error: 'Admin access required' }, 403, headers);
  }

  let body: { mode?: string; fileIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, headers);
  }
  const mode = body.mode;
  if (mode !== 'list' && mode !== 'import') {
    return json({ error: "mode must be 'list' or 'import'" }, 400, headers);
  }

  // Folder id is read server-side from the caller's org settings (RLS-pinned via
  // the caller token) — never trusted from the request, so no cross-tenant reads.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  });
  const { data: settings } = await callerClient
    .from('workspace_settings')
    .select('drive_folder_id')
    .maybeSingle();
  const folderId = (settings as { drive_folder_id?: string } | null)?.drive_folder_id ?? null;
  if (!folderId) {
    return json({ error: 'No Google Drive folder is connected for this workspace.' }, 400, headers);
  }

  // Service account credentials
  const saRaw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!saRaw) {
    return json({ error: 'Google Drive is not configured (missing service account).' }, 500, headers);
  }
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(saRaw);
    if (!sa.client_email || !sa.private_key) throw new Error('missing fields');
  } catch {
    return json({ error: 'Service account credentials are malformed.' }, 500, headers);
  }

  let token: string;
  try {
    token = await getAccessToken(sa);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 502, headers);
  }

  // ── Existing Drive file ids already queued for this org (dedup) ──
  const { data: existingRows } = await callerClient
    .from('pending_imports')
    .select('source_file_id')
    .eq('source', 'google_drive')
    .not('source_file_id', 'is', null);
  const importedIds = new Set(
    (existingRows ?? []).map(r => (r as { source_file_id?: string }).source_file_id).filter(Boolean),
  );

  // ─────────────────────────────── list ───────────────────────────────
  if (mode === 'list') {
    let files;
    try {
      files = await listFolderCsvs(folderId, token);
    } catch (err) {
      return json({ error: String(err instanceof Error ? err.message : err) }, 502, headers);
    }
    const result: DriveFile[] = files.map(f => ({
      ...f,
      alreadyImported: importedIds.has(f.id),
    }));
    return json({ serviceAccountEmail: sa.client_email, files: result }, 200, headers);
  }

  // ─────────────────────────────── import ─────────────────────────────
  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  if (fileIds.length === 0) return json({ error: 'fileIds is required' }, 400, headers);
  if (fileIds.length > MAX_IMPORT_BATCH) {
    return json({ error: `Too many files (max ${MAX_IMPORT_BATCH} per sync).` }, 400, headers);
  }

  // Resolve names/sizes once so we can dedup, size-check, and label uploads.
  let folderFiles;
  try {
    folderFiles = await listFolderCsvs(folderId, token);
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 502, headers);
  }
  const byId = new Map(folderFiles.map(f => [f.id, f]));

  let queued = 0;
  let skipped = 0;
  const errors: { name: string; message: string }[] = [];

  for (const fileId of fileIds) {
    const meta = byId.get(fileId);
    const label = meta?.name ?? fileId;
    if (!meta) { errors.push({ name: label, message: 'File not found in the connected folder.' }); continue; }
    if (importedIds.has(fileId)) { skipped++; continue; }
    if (meta.size != null && meta.size > MAX_FILE_SIZE) {
      errors.push({ name: label, message: 'File exceeds the 5 MB limit.' });
      continue;
    }

    try {
      // Download bytes via the service account token
      const dl = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!dl.ok) throw new Error(`Drive download failed (${dl.status}).`);
      const blob = await dl.blob();
      if (blob.size > MAX_FILE_SIZE) throw new Error('File exceeds the 5 MB limit.');

      // Upload into the same bucket/path convention manual uploads use
      const safeName = meta.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const finalName = safeName.toLowerCase().endsWith('.csv') ? safeName : `${safeName}.csv`;
      const storagePath = `${callerUser.id}/${Date.now()}_${finalName}`;
      const { error: uploadError } = await serviceClient.storage
        .from('instrument-imports')
        .upload(storagePath, blob, { contentType: 'text/csv', upsert: false });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // Hand off to the existing pipeline (parse + match + email + insert),
      // forwarding the caller JWT so org_id is stamped correctly.
      const procRes = await fetch(`${supabaseUrl}/functions/v1/process-import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${callerToken}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storagePath }),
      });
      if (!procRes.ok) throw new Error(`Processing failed (${procRes.status}).`);
      const pending = await procRes.json() as { id?: string };

      // Tag provenance so dedup recognises this file on the next sync.
      if (pending.id) {
        await serviceClient
          .from('pending_imports')
          .update({ source: 'google_drive', source_file_id: fileId })
          .eq('id', pending.id);
      }
      importedIds.add(fileId);
      queued++;
    } catch (err) {
      errors.push({ name: label, message: String(err instanceof Error ? err.message : err) });
    }
  }

  return json({ queued, skipped, errors }, 200, headers);
});
