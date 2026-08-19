const PASS_BATCH_VERSION = 1;

interface StoredPassBatch {
  version: typeof PASS_BATCH_VERSION;
  tokens: Record<string, string>;
}

function joinPath(token?: string) {
  return token ? `/join/${encodeURIComponent(token)}` : '/join';
}

export function panelistKitJoinUrl(token: string, origin?: string): string {
  const path = joinPath(token);
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return base ? new URL(path, base).toString() : path;
}

export function panelistKitManualJoinUrl(origin?: string): string {
  const path = joinPath();
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return base ? new URL(path, base).toString() : path;
}

export function panelistKitPassStorageKey(productId: string): string {
  return `nfi:panelist-kit-pass-batch:${productId}`;
}

export function serializePanelistKitPassTokens(tokens: Record<string, string>): string {
  return JSON.stringify({ version: PASS_BATCH_VERSION, tokens } satisfies StoredPassBatch);
}

export function parsePanelistKitPassTokens(value: string | null): Record<string, string> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as Partial<StoredPassBatch>;
    if (parsed.version !== PASS_BATCH_VERSION || !parsed.tokens || Array.isArray(parsed.tokens)) return {};

    return Object.fromEntries(
      Object.entries(parsed.tokens).filter(([kitId, token]) => kitId.length > 0 && typeof token === 'string' && token.length > 0),
    );
  } catch {
    return {};
  }
}
