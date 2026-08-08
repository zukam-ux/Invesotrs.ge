import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderEditorialDashboard, renderEditorialLogin } from "../src/editorial-page.mjs";

const worker = await readFile(new URL("../src/worker.mjs", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/0003_georgian_editorial_review.sql", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/review-georgian-news.yml", import.meta.url), "utf8");
const snapshotMigration = await readFile(new URL("../migrations/0004_editorial_revision_snapshots.sql", import.meta.url), "utf8");
const editorialPage = await readFile(new URL("../src/editorial-page.mjs", import.meta.url), "utf8");

for (const field of ["editorial_status", "reviewed_by", "reviewed_at", "revision"]) {
  assert.ok(migration.includes(field), `Migration must add ${field}`);
}
assert.ok(migration.includes("editorial_reviews"));
assert.ok(worker.includes("CASE WHEN ? = 'საქართველო' THEN 'pending' ELSE 'published' END"));
for (const keyword of ["ბირჟაზე", "ბაზარი", "ინვესტიციები", "ინვესტიცია", "ობლიგაციები"]) {
  assert.ok(worker.includes(`title LIKE '%${keyword}%'`), `Public policy must include ${keyword}`);
}
assert.ok(worker.includes('reviewerRole: "Investors.ge Editor"'));
assert.ok(worker.includes('!["approve", "reject"].includes(action)'));
assert.ok(workflow.includes("Review Georgian news"));
assert.ok(workflow.includes("EDITORIAL_REVIEW_TOKEN"));
assert.ok(worker.includes("env.EDITORIAL_REVIEW_TOKEN"));
assert.ok(worker.includes("env.EDITORIAL_ADMIN_PASSWORD"));
assert.ok(worker.includes("env.EDITORIAL_SESSION_SECRET"));
assert.ok(worker.includes("HttpOnly; Secure; SameSite=Strict"));
assert.ok(worker.includes("isSameOrigin(request)"));
assert.ok(worker.includes("editorial_revision_snapshots"));
assert.ok(snapshotMigration.includes("UNIQUE(article_id, revision)"));
assert.ok(editorialPage.includes("ქართული ამბების რედაქტორი"));
assert.ok(editorialPage.includes("დამტკიცება და გამოქვეყნება"));
assert.ok(editorialPage.includes("უარყოფა"));
for (const page of [renderEditorialLogin(), renderEditorialDashboard()]) {
  for (const script of [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])) {
    assert.doesNotThrow(() => new Function(script), "Inline editorial script must parse");
  }
}

console.log("Georgian editorial review checks passed.");
