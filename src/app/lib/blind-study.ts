export interface BlindStudySample {
  id: string;
  code: string;
  label: string;
}

const THREE_DIGIT_CODE = /^\d{3}$/;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function isValidBlindCode(code: string | null | undefined): code is string {
  return THREE_DIGIT_CODE.test(code ?? '');
}

export function generateBlindCode(seed: string, reservedCodes: Iterable<string> = []): string {
  const reserved = new Set(reservedCodes);
  let value = 100 + (hashString(seed) % 900);
  for (let attempts = 0; attempts < 900; attempts += 1) {
    const code = String(value).padStart(3, '0');
    if (!reserved.has(code)) return code;
    value += 1;
    if (value > 999) value = 100;
  }
  throw new Error('Unable to generate a unique blind study code.');
}

export function withBlindSampleCodes(samples: BlindStudySample[], studySeed: string): BlindStudySample[] {
  const used = new Set<string>();
  return samples.map((sample, index) => {
    const trimmedCode = sample.code.trim();
    const code = isValidBlindCode(trimmedCode) && !used.has(trimmedCode)
      ? trimmedCode
      : generateBlindCode(`${studySeed}:${sample.id}:${sample.label}:${index}`, used);
    used.add(code);
    return {
      ...sample,
      code,
      label: sample.label.trim(),
    };
  });
}

export function getPanelistSampleOrder<T extends BlindStudySample>(
  productId: string,
  userId: string,
  samples: T[],
): T[] {
  return samples
    .map((sample, index) => ({
      sample,
      index,
      sortKey: hashString(`${productId}:${userId}:${sample.id}:${sample.code}:${index}`),
    }))
    .sort((a, b) => a.sortKey - b.sortKey || a.index - b.index)
    .map(item => item.sample);
}

export function getBlindStudyDisplayName(product: {
  blinded?: boolean | null;
  blindCode?: string | null;
  isMultiSample?: boolean;
  name: string;
}): string {
  if (!product.blinded) return product.name;
  if (product.isMultiSample) return 'Blind sample comparison';
  return product.blindCode ? `Sample ${product.blindCode}` : 'Coded sample evaluation';
}

export function getBlindStudyCategoryLabel(product: {
  blinded?: boolean | null;
  category: string;
}): string {
  return product.blinded ? 'Category concealed' : product.category;
}
