import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  renderNewsArticlePage,
  renderNewsNotFoundPage,
} from "../src/news-page.mjs";

const shared = await readFile(new URL("../shared.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/worker.mjs", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

for (const renderer of [
  "editorial-story-link",
  "editorial-row",
  "auto-news-card",
  "top-story-lead",
  "top-story-row",
]) {
  const line = shared.split("\n").find((row) => row.includes(renderer) && row.includes("href="));
  assert.ok(line?.includes("newsArticleUrl("), `${renderer} must open an Investors.ge article`);
  assert.ok(!line?.includes('target="_blank"'), `${renderer} must stay on Investors.ge`);
}
assert.ok(shared.includes("წაიკითხე ქართულად"));
assert.ok(shared.includes("ორიგინალი წყარო"));
assert.ok(worker.includes('url.pathname.match(/^\\/news\\/([a-f0-9]{16})'));
assert.ok(wrangler.includes('"/news/*"'));

const article = {
  id: "642ddbca2c89f924",
  title: "English source title",
  title_ka: 'ქართული <სათაური> "ტესტი"',
  summary_ka: "ქართული მოკლე შეჯამება.",
  source: "Yahoo Finance",
  url: "https://example.com/original",
  published_at: "2026-07-27T08:00:00.000Z",
  category: "ბაზრები და ეკონომიკა",
};
const related = [
  {
    ...article,
    id: "aaaaaaaaaaaaaaaa",
    title_ka: "მსგავსი ამბავი",
  },
];
const html = renderNewsArticlePage(
  article,
  related,
  "https://investors.ge/news/642ddbca2c89f924",
);
assert.ok(html.includes("ქართული მოკლე შეჯამება."));
assert.ok(html.includes("&lt;სათაური&gt;"));
assert.ok(html.includes('href="https://example.com/original"'));
assert.ok(html.includes('href="/news/aaaaaaaaaaaaaaaa"'));
assert.ok(html.includes('"@type":"NewsArticle"'));
assert.ok(!html.includes("<სათაური>"));

const missing = renderNewsNotFoundPage(
  "https://investors.ge/news/ffffffffffffffff",
);
assert.ok(missing.includes("noindex,follow"));
assert.ok(missing.includes("ეს ამბავი ვერ მოიძებნა"));

console.log("Georgian news article regression checks passed.");
