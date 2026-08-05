export const GEORGIAN_NEWS_SOURCES = new Set(["BM.GE", "Entrepreneur.ge", "Marketer.ge"]);
export const GEORGIAN_NEWS_KEYWORDS = /ინვესტიციები|ობლიგაციები|ფასიანი\s+ქაღალდები/i;

export function normalizeGeorgianSource(source = "", url = "") {
  const value = `${source} ${url}`.toLowerCase();
  if (value.includes("bm.ge")) return "BM.GE";
  if (value.includes("entrepreneur.ge") || value.includes("entrepreneur.com/ka") || value.includes("entrepreneur")) return "Entrepreneur.ge";
  if (value.includes("marketer.ge") || value.includes("marketer")) return "Marketer.ge";
  return "";
}

export function isEligibleGeorgianStory(article = {}) {
  const source = normalizeGeorgianSource(article.source, article.url);
  const searchable = `${article.title || ""} ${article.description || ""}`;
  return GEORGIAN_NEWS_SOURCES.has(source) && GEORGIAN_NEWS_KEYWORDS.test(searchable);
}

export function georgianSummary(article = {}) {
  const description = String(article.description || "")
    .replace(/The post[\s\S]*?first appeared on[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (description && description !== article.title) return description.slice(0, 360);
  return `მასალა ეხება თემას: ${article.title || "ინვესტიციები და კაპიტალის ბაზარი"}.`;
}
