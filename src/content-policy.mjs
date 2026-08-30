// The publishers Investors.ge will show a story from. This is the single
// definition: the collector filters incoming feeds with it, the ingest endpoint
// refuses anything else, and the read paths use it to decide what is
// publishable — so an article can never exist in the archive without also being
// viewable on the site.
export const APPROVED_NEWS_SOURCES = Object.freeze([
  "Yahoo Finance",
  "Google Finance",
  "Nasdaq",
  "Bloomberg",
  "Bloomberg.com",
  "MarketWatch",
  "National Bank of Georgia",
  "Georgian Stock Exchange",
  "Ministry of Finance of Georgia",
  "GeoStat",
  "BM.GE",
  "Entrepreneur.ge",
  "Marketer.ge",
]);

// Georgian publishers are collected through their own feeds and editorial
// review rather than the global market queries.
export const GEORGIAN_PUBLISHERS = new Set([
  "National Bank of Georgia",
  "Georgian Stock Exchange",
  "Ministry of Finance of Georgia",
  "GeoStat",
  "BM.GE",
  "Entrepreneur.ge",
  "Marketer.ge",
]);

const approvedSourceSet = new Set(APPROVED_NEWS_SOURCES);

export function isApprovedNewsSource(source) {
  return approvedSourceSet.has(String(source || "").trim());
}

// Renders the approved list as a SQL fragment for the news queries.
export function approvedNewsSourcesSql(column = "source") {
  return `${column} IN (${APPROVED_NEWS_SOURCES.map((name) => `'${name.replace(/'/g, "''")}'`).join(", ")})`;
}

export const NEWS_CATEGORIES = Object.freeze({
  stocks: "აქციები",
  markets: "ბაზრები და ეკონომიკა",
  technology: "ტექნოლოგიები",
  ai: "AI",
  crypto: "კრიპტო",
  georgia: "საქართველო",
});

const allowedCategories = new Set(Object.values(NEWS_CATEGORIES));

export function normalizeNewsCategory(value = "", context = "") {
  const category = String(value).trim();
  if (allowedCategories.has(category)) return category;
  if (category === "ტექნოლოგიები და AI") {
    return /\bAI\b|artificial intelligence|machine learning|OpenAI|Anthropic/i.test(context)
      ? NEWS_CATEGORIES.ai
      : NEWS_CATEGORIES.technology;
  }
  if (category === "ETF" || category === "კომპანიები") {
    return NEWS_CATEGORIES.stocks;
  }
  if (category === "ეკონომიკა") {
    return NEWS_CATEGORIES.markets;
  }
  if (category.includes("კრიპტო")) return NEWS_CATEGORIES.crypto;
  if (category.includes("AI")) return NEWS_CATEGORIES.ai;
  if (category.includes("ტექნოლოგი")) return NEWS_CATEGORIES.technology;
  if (category.includes("საქართველ")) return NEWS_CATEGORIES.georgia;
  return NEWS_CATEGORIES.markets;
}

