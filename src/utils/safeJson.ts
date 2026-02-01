export type SafeJsonParseResult =
  | { ok: true; value: unknown; raw: string }
  | { ok: false; error: string; raw?: string };

const stripBom = (text: string) => text.replace(/^\uFEFF/, '');

const stripCommonJunk = (text: string) => {
  // Minimal, conservative cleanup to improve parse success.
  // Avoid aggressive transformations that could change meaning.
  return stripBom(text)
    .replace(/^(?:\s|\u200B|\u200C|\u200D|\u2060)+/, '')
    .replace(/(?:\s|\u200B|\u200C|\u200D|\u2060)+$/, '')
    // smart quotes -> regular quotes (common LLM output)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // trailing commas in objects/arrays
    .replace(/,\s*([}\]])/g, '$1');
};

const extractFromCodeFence = (text: string): string | null => {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fence?.[1] ?? null;
};

const extractFirstJsonValue = (text: string): string | null => {
  const s = text;
  const len = s.length;

  const firstBrace = s.search(/[[{]/);
  if (firstBrace === -1) return null;

  const start = firstBrace;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < len; i++) {
    const ch = s[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{' || ch === '[') {
      depth++;
      continue;
    }

    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }

  return null;
};

export const safeJsonParseFromText = (text: string): SafeJsonParseResult => {
  if (!text || !text.trim()) {
    return { ok: false, error: 'Empty response text' };
  }

  const candidates: string[] = [];

  const fence = extractFromCodeFence(text);
  if (fence) candidates.push(fence);

  candidates.push(text);

  for (const candidate of candidates) {
    const cleaned = stripCommonJunk(candidate);

    const extracted = extractFirstJsonValue(cleaned) ?? cleaned;
    const extractedClean = stripCommonJunk(extracted);

    try {
      const value = JSON.parse(extractedClean);
      return { ok: true, value, raw: extractedClean };
    } catch {
      // Try one more time with only extracted JSON substring (if any)
      const fallback = extractFirstJsonValue(cleaned);
      if (fallback && fallback !== extractedClean) {
        const fb = stripCommonJunk(fallback);
        try {
          const value = JSON.parse(fb);
          return { ok: true, value, raw: fb };
        } catch {
          // continue
        }
      }
    }
  }

  return { ok: false, error: 'Failed to parse JSON from response text' };
};
