// The Georgian financial vocabulary the models must use. Left to themselves
// they reach for literal or invented compounds — "stock" became საბაზრო
// საქონელი ("market commodity") rather than აქცია — so the required term is
// stated in every prompt that produces Georgian.
export const GEORGIAN_FINANCE_GLOSSARY = [
  "stock / shares = აქცია (plural აქციები). Never საბაზრო საქონელი or საქონელი.",
  "stock market = საფონდო ბაზარი",
  "earnings / earnings report = ფინანსური შედეგები / ანგარიშგება",
  "quarter = კვარტალი, quarterly = კვარტალური",
  "revenue = შემოსავალი, profit = მოგება, loss = ზარალი",
  "dividend = დივიდენდი, dividend yield = დივიდენდის სარგებელი",
  "bond = ობლიგაცია, yield = სარგებელი",
  "ETF = ETF (leave in Latin), index = ინდექსი",
  "market capitalisation = საბაზრო კაპიტალიზაცია",
  "investor = ინვესტორი, investment = ინვესტიცია",
  "interest rate = საპროცენტო განაკვეთი, inflation = ინფლაცია",
  "buy = ყიდვა, sell = გაყიდვა, to invest = ინვესტირება",
  "crack / break encryption = გატეხვა (not გადაჭრა)",
  "endorse / back an idea = მხარს უჭერს (not ეწერება)",
].join("\n");

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
