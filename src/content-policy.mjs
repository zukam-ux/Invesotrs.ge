export const NEWS_CATEGORIES = Object.freeze({
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
  if (category === "აქციები" || category === "ETF" || category === "კომპანიები" || category === "ეკონომიკა") {
    return NEWS_CATEGORIES.markets;
  }
  if (category.includes("კრიპტო")) return NEWS_CATEGORIES.crypto;
  if (category.includes("AI")) return NEWS_CATEGORIES.ai;
  if (category.includes("ტექნოლოგი")) return NEWS_CATEGORIES.technology;
  if (category.includes("საქართველ")) return NEWS_CATEGORIES.georgia;
  return NEWS_CATEGORIES.markets;
}

