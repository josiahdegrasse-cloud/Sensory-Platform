import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface ProcessImportBody {
  storagePath: string;
}

interface ParsePreview {
  headers: string[];
  recognized: string[];
  ignored: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
}

// Mirrors inferImportMappings from csv-import-mapping.ts
const FIELD_ALIASES: Record<string, string> = {
  sampleid: 'sampleId', sample: 'sampleId', id: 'sampleId', samplecode: 'sampleId',
  samplename: 'sampleName', name: 'sampleName', productname: 'sampleName',
  foodtype: 'foodType', type: 'foodType', producttype: 'foodType',
  category: 'category', subcategory: 'category',
  sourness: 'sourness', sour: 'sourness', acid: 'sourness',
  bitterness: 'bitterness', bitter: 'bitterness',
  saltiness: 'saltiness', salty: 'saltiness',
  umami: 'umami', savory: 'umami', savoury: 'umami',
  sweetness: 'sweetness', sweet: 'sweetness',
  compound: 'compound', compoundname: 'compound', analyte: 'compound',
  concentration: 'concentration', concentrationppm: 'concentration', amount: 'concentration',
  aroma: 'aroma', odour: 'aroma', odor: 'aroma', descriptor: 'aroma',
  threshold: 'threshold', odourthreshold: 'threshold', odorthreshold: 'threshold',
  protein: 'protein', proteinpercent: 'protein',
  fat: 'fat', fatpercent: 'fat',
  moisture: 'moisture', moisturepercent: 'moisture',
  ph: 'pH',
  saltcontent: 'saltContent', saltpercent: 'saltContent',
  calciummg: 'calciumMg', calcium: 'calciumMg',
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function inferColumns(headers: string[]): { recognized: string[]; ignored: string[] } {
  const recognized: string[] = [];
  const ignored: string[] = [];
  for (const header of headers) {
    if (FIELD_ALIASES[normalizeHeader(header)]) recognized.push(header);
    else ignored.push(header);
  }
  return { recognized, ignored };
}

function matchBatch(
  fileName: string,
  batches: { id: string; file_name: string }[],
): string | null {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\.csv$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const normFile = norm(fileName);
  const match = batches.find(b => {
    const normBatch = norm(b.file_name);
    return normFile.includes(normBatch) || normBatch.includes(normFile);
  });
  return match?.id ?? null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerToken = authHeader.replace(/^Bearer\s+/i, '');
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user: callerUser }, error: authError } = await authClient.auth.getUser(callerToken);
  if (authError || !callerUser) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  let body: ProcessImportBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const { storagePath } = body;
  if (!storagePath || typeof storagePath !== 'string') {
    return new Response(JSON.stringify({ error: 'storagePath is required' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const fileName = storagePath.split('/').pop() ?? storagePath;

  // Caller-scoped client — RLS stamps org_id correctly via set_org_id() trigger
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  });

  // Download the file via service role to bypass storage RLS
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: fileBlob, error: downloadError } = await serviceClient.storage
    .from('instrument-imports')
    .download(storagePath);

  if (downloadError || !fileBlob) {
    const { data, error: insertError } = await callerClient
      .from('pending_imports')
      .insert({
        storage_path: storagePath,
        file_name: fileName,
        status: 'failed',
        error_message: `Storage download failed: ${downloadError?.message ?? 'unknown'}`,
        uploaded_by: callerUser.id,
      })
      .select()
      .single();
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(data), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const text = await fileBlob.text();
  const lines = text.split(/\r\n|\r|\n/).filter(l => l.trim().length > 0);

  if (lines.length < 2) {
    const { data, error: insertError } = await callerClient
      .from('pending_imports')
      .insert({
        storage_path: storagePath,
        file_name: fileName,
        status: 'failed',
        error_message: 'File appears empty or contains no data rows.',
        uploaded_by: callerUser.id,
      })
      .select()
      .single();
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(data), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const rawHeaders = parseCSVLine(lines[0]);
  const { recognized, ignored } = inferColumns(rawHeaders);
  const sampleRows: Record<string, string>[] = [];
  for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
    const vals = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    sampleRows.push(row);
  }

  const parsePreview: ParsePreview = {
    headers: rawHeaders,
    recognized,
    ignored,
    rowCount: lines.length - 1,
    sampleRows,
  };

  // Try to match an existing active project by filename similarity
  const { data: batches } = await callerClient
    .from('import_batches')
    .select('id, file_name')
    .eq('status', 'active')
    .limit(100);

  const matchedBatchId = matchBatch(
    fileName,
    (batches ?? []) as { id: string; file_name: string }[],
  );

  const { data: pendingRecord, error: insertError } = await callerClient
    .from('pending_imports')
    .insert({
      storage_path: storagePath,
      file_name: fileName,
      status: matchedBatchId ? 'matched' : 'ambiguous',
      matched_batch_id: matchedBatchId,
      parse_preview: parsePreview,
      uploaded_by: callerUser.id,
    })
    .select()
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  // Notify org admins — fire-and-forget, swallow failures so they don't affect the response
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (resendApiKey) {
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'imports@mail.sensoryanalysis.app';
    try {
      const { data: callerProfile } = await serviceClient
        .from('profiles')
        .select('org_id')
        .eq('id', callerUser.id)
        .single();
      const orgId = (callerProfile as { org_id?: string } | null)?.org_id;
      if (orgId) {
        const { data: admins } = await serviceClient
          .from('profiles')
          .select('email')
          .eq('org_id', orgId)
          .eq('role', 'admin')
          .eq('status', 'active');
        const statusLabel = matchedBatchId ? 'matched to a project' : 'awaiting project match';
        const subject = `Import queued: ${fileName}`;
        const html = `
          <p>A new instrument file has been queued for review.</p>
          <ul>
            <li><strong>File:</strong> ${escapeHtml(fileName)}</li>
            <li><strong>Rows:</strong> ${parsePreview.rowCount}</li>
            <li><strong>Recognised columns:</strong> ${parsePreview.recognized.length}</li>
            <li><strong>Status:</strong> ${statusLabel}</li>
          </ul>
          <p>Open the <strong>Instruments</strong> page to review and confirm the import.</p>
        `.trim();
        await Promise.allSettled(
          (admins ?? [])
            .filter((a): a is { email: string } => typeof (a as { email?: unknown }).email === 'string')
            .map(a => fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: fromEmail, to: a.email, subject, html }),
            })),
        );
      }
    } catch {
      // non-critical
    }
  }

  return new Response(JSON.stringify(pendingRecord), {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
});
