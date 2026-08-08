import assert from "node:assert/strict";
import { buildCompanyData, calculateValuation, extractFilings, extractFinancialHistory, extractFundamentals, normalizeStockSymbol } from "../src/company-page.mjs";
import { renderCompanyPage } from "../src/company-template.mjs";

assert.equal(normalizeStockSymbol(" aapl "), "AAPL");
assert.equal(normalizeStockSymbol("../../bad"), "");

const submissions = {
  cik: "320193", name: "Apple Inc.", tickers: ["AAPL"], sicDescription: "Electronic Computers",
  fiscalYearEnd: "0926", stateOfIncorporation: "CA", website: "https://www.apple.com", phone: "1-408-996-1010",
  filings: { recent: { accessionNumber: ["0000320193-25-000079"], form: ["10-Q"], filingDate: ["2025-08-01"], reportDate: ["2025-06-28"], primaryDocument: ["aapl-20250628.htm"], primaryDocDescription: ["Quarterly report"] } },
};
const facts = { facts: { dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ val: 10, end: "2025-07-25", filed: "2025-08-01" }] } } }, "us-gaap": {
  Assets: { label: "Assets", units: { USD: [{ val: 100, end: "2024-09-28", filed: "2024-11-01", form: "10-K" }, { val: 120, end: "2025-06-28", filed: "2025-08-01", form: "10-Q" }] } },
  EarningsPerShareDiluted: { label: "Diluted EPS", units: { "USD/shares": [{ val: 1.57, end: "2025-06-28", filed: "2025-08-01", form: "10-Q" }] } },
} } };

assert.equal(extractFundamentals(facts).find(item => item.key === "assets").fact.val, 120);
assert.equal(extractFinancialHistory(facts).annual.find(item => item.key === "assets").rows.length, 1);
assert.equal(calculateValuation(facts, extractFundamentals(facts), { price: 20 }).marketCap, 200);
assert.match(extractFilings(submissions)[0].url, /Archives\/edgar\/data\/320193\/000032019325000079\/aapl-20250628\.htm$/);
const company = buildCompanyData({ symbol: "AAPL", name: "Apple", exchange: "Nasdaq", cik: "0000320193" }, submissions, facts, { price: 220, currency: "USD", changePercent: 1.2, marketTime: 1 });
company.relatedNews = [{ id: "1234567890abcdef", title: "Apple-ის სიახლე", source: "Nasdaq", publishedAt: "2025-08-01", url: "/news/1234567890abcdef" }];
const html = renderCompanyPage(company);
assert.match(html, /Apple Inc\./);
assert.match(html, /SEC EDGAR/);
assert.match(html, /provider-dependent delay/);
assert.match(html, /წლიური მაჩვენებლები/);
assert.match(html, /საბაზრო კაპიტალი/);
assert.match(html, /კომპანიის სიახლეები/);
assert.match(html, /href="\/stocks\/compare">შედარება/);
assert.match(html, /rel="canonical" href="https:\/\/investors\.ge\/stocks\/AAPL"/);

console.log("Company page regression tests passed.");
