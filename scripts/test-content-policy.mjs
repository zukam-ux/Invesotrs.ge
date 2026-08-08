import assert from "node:assert/strict";
import { NEWS_CATEGORIES, normalizeNewsCategory } from "../src/content-policy.mjs";

assert.equal(normalizeNewsCategory("აქციები"), NEWS_CATEGORIES.markets);
assert.equal(normalizeNewsCategory("ETF"), NEWS_CATEGORIES.markets);
assert.equal(normalizeNewsCategory("ტექნოლოგიები და AI", "OpenAI launches a new model"), NEWS_CATEGORIES.ai);
assert.equal(normalizeNewsCategory("ტექნოლოგიები და AI", "Cloud software company reports earnings"), NEWS_CATEGORIES.technology);
assert.equal(normalizeNewsCategory("ბაზრები და ეკონომიკა | კრიპტო"), NEWS_CATEGORIES.crypto);
assert.equal(normalizeNewsCategory("უცნობი"), NEWS_CATEGORIES.markets);

console.log("Content taxonomy policy checks passed.");
