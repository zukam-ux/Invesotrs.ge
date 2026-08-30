// Helpers for reading model responses. The translation and article pipeline
// asks for JSON, but the fallback models answer in several shapes, so these
// live in one place with their own regression test.

export function extractJsonObject(text = "") {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
}

// Reads one Georgian string field out of a model response, accepting the three
// shapes seen in production: valid JSON, JSON cut off by the model's output cap
// mid-string, and a bare Georgian answer with no JSON wrapper at all.
export function extractGeorgianField(text = "", field) {
  const raw = String(text).replace(/```[a-z]*\s*/gi, "").replace(/```/g, "").trim();
  try {
    const value = JSON.parse(extractJsonObject(raw))[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  } catch {
    /* fall through to the recovery shapes below */
  }
  // Georgian is token-heavy, so a long article regularly hits the output cap
  // and arrives as JSON that was cut off mid-string. The article text is still
  // usable, so read the field's value directly instead of discarding it.
  const truncated = raw.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`));
  if (truncated) {
    const recovered = truncated[1]
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
    if (recovered) return recovered;
  }
  if (/[Ⴀ-ჿ]/.test(raw) && !raw.includes(`"${field}"`)) return raw;
  return "";
}
