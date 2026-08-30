import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isApprovedNewsSource } from "../src/content-policy.mjs";

const collector = await readFile(new URL("./update-news.mjs", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/worker.mjs", import.meta.url), "utf8");
const shared = await readFile(new URL("../shared.js", import.meta.url), "utf8");
const homepage = await readFile(new URL("../index.html", import.meta.url), "utf8");
const newsPage = await readFile(new URL("../news.html", import.meta.url), "utf8");
const georgiaPage = await readFile(new URL("../georgia.html", import.meta.url), "utf8");
const standardsPage = await readFile(new URL("../standards.html", import.meta.url), "utf8");
const homeStyles = await readFile(new URL("../home-2026.css", import.meta.url), "utf8");

// Approved publishers are defined once in content-policy.mjs and consumed by
// the collector, the ingest endpoint, and the read paths; these assert the
// shared list itself rather than a copy pasted into each file.
for (const source of ["Yahoo Finance", "Google Finance", "Nasdaq", "Bloomberg", "MarketWatch"]) {
  assert.ok(isApprovedNewsSource(source), `${source} must be approved`);
}
for (const source of ["BM.GE", "Entrepreneur.ge", "Marketer.ge"]) {
  assert.ok(isApprovedNewsSource(source), `${source} must be approved`);
  assert.ok(collector.includes(source), `${source} must be configured by the Georgian collector`);
}
for (const blocked of ["Reuters", "CNBC", "CoinDesk", "Business Insider"]) {
  assert.ok(!isApprovedNewsSource(blocked), `${blocked} must not be approved`);
}
assert.ok(
  collector.includes("APPROVED_NEWS_SOURCES"),
  "the collector must filter feeds with the shared approved-source list",
);
for (const sectionKey of ["stocks", "crypto", "ai", "tech", "economy", "georgia"]) {
  assert.ok(shared.includes(`return "${sectionKey}"`), `shared.js must route the ${sectionKey} section`);
  assert.ok(homepage.includes(`data-news-category="${sectionKey}"`), `homepage must render the ${sectionKey} feed`);
}
for (const sectionId of ["stocks", "crypto", "ai", "tech", "economy", "georgia-news"]) {
  assert.ok(newsPage.includes(`id="${sectionId}"`), `news page must have the ${sectionId} column`);
}
assert.ok(shared.includes("['georgia.html','საქართველო']"));
assert.ok(georgiaPage.includes('data-news-category="georgia"'));
assert.ok(homepage.includes('href="georgia.html">ყველა ქართული ამბავი'));
for (const required of ["AI გვეხმარება, მაგრამ წყარო არ არის", "შეცდომას ხილულად ვასწორებთ", "კომერციული მასალა გამოყოფილია", "რეალურ დროში"]) {
  assert.ok(standardsPage.includes(required), `Standards page must include: ${required}`);
}
assert.ok(collector.includes("conflictNewsTerms"));
assert.ok(worker.includes("conflictNewsTerms.test"));
assert.ok(shared.includes("recentEditorialLead"));
assert.ok(shared.includes("maxAgeHours=4"));
assert.ok(shared.includes("function newestNews"));
assert.ok(shared.includes("latest.filter(article=>article.id!==lead.id)"));
assert.ok(shared.includes("setInterval(refreshRelativeNewsTimes,60000)"));
assert.ok(shared.includes("function editorialPhoto"));
assert.ok(shared.includes("CC BY 4.0"));
assert.ok(shared.includes("CC BY-SA 3.0"));
assert.ok(homepage.includes("shared.js?v=20260830-categories"));
assert.ok(homepage.includes("home-2026.css"));
assert.ok(homeStyles.includes(".photo-credit"));
for (const term of ["ukraine", "gaza", "airstrike", "military attack"]) {
  assert.ok(collector.includes(term), `${term} must be covered by the conflict filter`);
  assert.ok(worker.includes(term), `${term} must be blocked by the live API`);
  assert.ok(shared.includes(term), `${term} must be blocked in browser rendering`);
}

console.log("News source and category policy checks passed.");
