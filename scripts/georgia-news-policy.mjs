export const GEORGIAN_NEWS_SOURCES = new Set([
  "National Bank of Georgia",
  "Georgian Stock Exchange",
  "Ministry of Finance of Georgia",
  "GeoStat",
  "BM.GE",
  "Entrepreneur.ge",
  "Marketer.ge",
]);
export const GEORGIAN_NEWS_KEYWORDS = /ინვესტიციები|ობლიგაციები|ფასიანი\s+ქაღალდები|კაპიტალის\s+ბაზარი|მონეტარული\s+პოლიტიკა|საპროცენტო\s+განაკვეთი|ინფლაცია|დეპოზიტები|სახაზინო|აუქციონი|პენსი|პირდაპირი\s+უცხოური\s+ინვესტიცი|investment|bond|securit|capital\s+market|monetary\s+policy|interest\s+rate|inflation|deposit|treasury|auction|pension|FDI/i;

export function normalizeGeorgianSource(source = "", url = "") {
  const value = `${source} ${url}`.toLowerCase();
  if (value.includes("nbg.gov.ge") || value.includes("national bank of georgia")) return "National Bank of Georgia";
  if (value.includes("gse.ge") || value.includes("georgian stock exchange")) return "Georgian Stock Exchange";
  if (value.includes("mof.ge") || value.includes("ministry of finance of georgia")) return "Ministry of Finance of Georgia";
  if (value.includes("geostat.ge") || value.includes("geostat")) return "GeoStat";
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
