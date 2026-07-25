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
assert.ok(shared.includes("recentEditorialLead"));
assert.ok(shared.includes("maxAgeHours=4"));
assert.ok(shared.includes("setInterval(refreshRelativeNewsTimes,60000)"));
assert.ok(shared.includes("function editorialPhoto"));
assert.ok(shared.includes("CC BY 4.0"));
assert.ok(shared.includes("CC BY-SA 3.0"));
assert.ok(homepage.includes("editorial-photos"));
assert.ok(homepage.includes(".photo-credit"));
for (const term of ["ukraine", "gaza", "airstrike", "military attack"]) {
  assert.ok(collector.includes(term), `${term} must be covered by the conflict filter`);
  assert.ok(worker.includes(term), `${term} must be blocked by the live API`);
  assert.ok(shared.includes(term), `${term} must be blocked in browser rendering`);
}

console.log("News source and category policy checks passed.");
