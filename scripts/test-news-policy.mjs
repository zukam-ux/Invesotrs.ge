import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const collector = await readFile(new URL("./update-news.mjs", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/worker.mjs", import.meta.url), "utf8");
const shared = await readFile(new URL("../shared.js", import.meta.url), "utf8");
const homepage = await readFile(new URL("../index.html", import.meta.url), "utf8");
const newsPage = await readFile(new URL("../news.html", import.meta.url), "utf8");

for (const source of ["Yahoo Finance", "Google Finance", "Nasdaq", "Bloomberg", "MarketWatch"]) {
  assert.ok(collector.includes(`"${source}"`), `${source} must be approved by the collector`);
  assert.ok(worker.includes(source), `${source} must be approved by the live API`);
}
for (const blocked of ["Reuters", "CNBC", "CoinDesk", "Business Insider"]) {
  const policyBlock = collector.slice(collector.indexOf("const trustedSources"), collector.indexOf("const financeTerms"));
  assert.ok(!policyBlock.includes(`"${blocked}"`), `${blocked} must not be in the collector allowlist`);
}
assert.ok(shared.includes('return "tech-ai"'));
assert.ok(shared.includes('return "markets-economy"'));
assert.ok(homepage.includes('data-news-category="tech-ai"'));
assert.ok(homepage.includes('data-news-category="markets-economy"'));
assert.ok(newsPage.includes('id="tech-ai"'));
assert.ok(newsPage.includes('id="markets-economy"'));
assert.ok(collector.includes("conflictNewsTerms"));
assert.ok(worker.includes("conflictNewsTerms.test"));

console.log("News source and category policy checks passed.");
