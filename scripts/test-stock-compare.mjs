import assert from "node:assert/strict";
import { renderComparison } from "../stock-compare.js";
const companies = ["AAPL", "MSFT"].map((symbol, index) => ({ symbol, name: symbol, quote: { price: 100 + index, currency: "USD", changePercent: index }, valuation: { marketCap: 1000, priceToBook: 2 }, fundamentals: [{ key: "revenue", fact: { val: 500, end: "2025-06-30", form: "10-Q" } }] }));
const html = renderComparison(companies);
assert.match(html, /AAPL/);
assert.match(html, /MSFT/);
assert.match(html, /2025-06-30 · 10-Q/);
assert.match(html, /Price \/ Book/);
console.log("Stock comparison regression tests passed.");
