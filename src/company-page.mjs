const FACTS = [
  ["revenue", ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues"], "შემოსავალი"],
  ["netIncome", ["NetIncomeLoss", "ProfitLoss"], "წმინდა მოგება"], ["assets", ["Assets"], "აქტივები"],
  ["liabilities", ["Liabilities"], "ვალდებულებები"],
  ["equity", ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], "კაპიტალი"],
  ["operatingIncome", ["OperatingIncomeLoss"], "საოპერაციო მოგება"],
  ["cash", ["CashAndCashEquivalentsAtCarryingValue"], "ფულადი სახსრები"],
  ["eps", ["EarningsPerShareDiluted", "EarningsPerShareBasic"], "მოგება აქციაზე"],
];

export function normalizeStockSymbol(value = "") { const symbol = String(value).trim().toUpperCase(); return /^[A-Z0-9.-]{1,15}$/.test(symbol) ? symbol : ""; }

function latestFact(companyFacts, concepts) {
  for (const concept of concepts) {
    const fact = companyFacts?.facts?.["us-gaap"]?.[concept];
    if (!fact?.units) continue;
    const latest = Object.entries(fact.units).flatMap(([unit, values]) => values.map(row => ({ ...row, unit })))
      .filter(row => ["10-K", "10-Q", "20-F", "40-F"].includes(row.form) && Number.isFinite(Number(row.val)) && row.end && row.filed)
      .sort((a, b) => b.filed.localeCompare(a.filed) || b.end.localeCompare(a.end))[0];
    if (latest) return { concept, label: fact.label, ...latest, val: Number(latest.val) };
  }
  return null;
}
export function extractFundamentals(companyFacts) { return FACTS.map(([key, concepts, label]) => ({ key, label, fact: latestFact(companyFacts, concepts) })).filter(item => item.fact); }
function conceptRows(companyFacts, concepts) {
  for (const concept of concepts) {
    const fact = companyFacts?.facts?.["us-gaap"]?.[concept];
    if (fact?.units) return Object.entries(fact.units).flatMap(([unit, rows]) => rows.map(row => ({ ...row, unit, concept }))).filter(row => Number.isFinite(Number(row.val)) && row.end && row.filed);
  }
  return [];
}
export function extractFinancialHistory(companyFacts) {
  const metrics = FACTS.filter(([key]) => ["revenue", "netIncome", "assets", "eps"].includes(key));
  const build = forms => metrics.map(([key, concepts, label]) => {
    const seen = new Set();
    const rows = conceptRows(companyFacts, concepts).filter(row => forms.includes(row.form)).sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed)).filter(row => !seen.has(row.end) && seen.add(row.end)).slice(0, forms.includes("10-Q") ? 6 : 5).reverse();
    return { key, label, rows };
  }).filter(metric => metric.rows.length);
  return { annual: build(["10-K", "20-F", "40-F"]), quarterly: build(["10-Q", "6-K"]) };
}
export function calculateValuation(companyFacts, fundamentals, quote) {
  if (!quote?.price) return null;
  const shares = Object.values(companyFacts?.facts?.dei?.EntityCommonStockSharesOutstanding?.units || {}).flat().filter(row => Number.isFinite(Number(row.val)) && row.end && row.filed).sort((a, b) => b.filed.localeCompare(a.filed) || b.end.localeCompare(a.end))[0];
  if (!shares) return null;
  const marketCap = Number(shares.val) * quote.price, equity = fundamentals.find(item => item.key === "equity")?.fact;
  return { marketCap, sharesOutstanding: Number(shares.val), sharesAsOf: shares.end, priceToBook: equity?.val > 0 ? marketCap / equity.val : null, equityAsOf: equity?.end || null };
}
export function extractFilings(submissions, limit = 8) {
  const recent = submissions?.filings?.recent || {}, cik = String(submissions.cik || "").replace(/^0+/, "");
  return (recent.accessionNumber || []).map((accessionNumber, index) => ({ accessionNumber, form: recent.form?.[index] || "", filingDate: recent.filingDate?.[index] || "", reportDate: recent.reportDate?.[index] || "", description: recent.primaryDocDescription?.[index] || "", url: cik && recent.primaryDocument?.[index] ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber.replaceAll("-", "")}/${recent.primaryDocument[index]}` : "" })).filter(item => item.form && item.url).slice(0, limit);
}
export function buildCompanyData(asset, submissions, companyFacts, quote, fetchedAt = new Date().toISOString()) {
  const fundamentals = extractFundamentals(companyFacts);
  return { symbol: asset.symbol, name: submissions.name || asset.name, exchange: asset.exchange || submissions.exchanges?.[0] || "", cik: String(asset.cik || submissions.cik || "").padStart(10, "0"), kind: asset.kind || "stock", profile: { sic: submissions.sic || "", industry: submissions.sicDescription || "", fiscalYearEnd: submissions.fiscalYearEnd || "", state: submissions.stateOfIncorporation || "", website: submissions.website || "", investorWebsite: submissions.investorWebsite || "", phone: submissions.phone || "", address: submissions.addresses?.business || null, formerNames: submissions.formerNames || [] }, quote, fundamentals, financialHistory: extractFinancialHistory(companyFacts), valuation: calculateValuation(companyFacts, fundamentals, quote), filings: extractFilings(submissions), sources: { company: "U.S. Securities and Exchange Commission (SEC EDGAR)", quote: quote ? "Yahoo Finance" : null }, fetchedAt, quoteDelay: "provider-dependent" };
}
const esc = (value = "") => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const value = (number, unit) => /shares/.test(unit) ? `$${number.toFixed(2)}` : new Intl.NumberFormat("ka-GE", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(number);

export function renderCompanyPage(company) {
  const q = company.quote, address = company.profile.address;
  const addressText = address ? [address.street1, address.street2, address.city, address.stateOrCountry, address.zipCode].filter(Boolean).join(", ") : "—";
  const facts = company.fundamentals.map(({ label, fact }) => `<article><span>${esc(label)}</span><strong>${value(fact.val, fact.unit)}</strong><small>${esc(fact.form)} · ${esc(fact.end)}</small></article>`).join("");
  const filings = company.filings.map(item => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener"><b>${esc(item.form)}</b><span>${esc(item.description || "SEC დოკუმენტი")}</span><time>${esc(item.filingDate)}</time></a></li>`).join("");
  const stats = q ? [["გახსნა", q.open], ["დღის მაქსიმუმი", q.dayHigh], ["დღის მინიმუმი", q.dayLow], ["წინა დახურვა", q.previousClose]].filter(([, n]) => Number.isFinite(n)).map(([label, n]) => `<div><span>${label}</span><b>${n.toLocaleString("en-US")} ${esc(q.currency || "USD")}</b></div>`).join("") : "";
  const valuation = company.valuation ? `<div class="stats" style="margin-top:20px"><div><span>საბაზრო კაპიტალიზაცია</span><b>${value(company.valuation.marketCap, "USD")}</b><small>ფასი × SEC აქციების რაოდენობა</small></div><div><span>Price / Book</span><b>${Number.isFinite(company.valuation.priceToBook) ? company.valuation.priceToBook.toFixed(2) : "—"}</b><small>კაპიტალი: ${esc(company.valuation.equityAsOf || "—")}</small></div><div><span>გამოშვებული აქციები</span><b>${company.valuation.sharesOutstanding.toLocaleString("en-US")}</b><small>SEC: ${esc(company.valuation.sharesAsOf)}</small></div></div>` : "";
  const historyTable = (metrics, title) => metrics?.length ? `<section class="panel" style="margin-top:20px"><h2>${title}</h2>${metrics.map(metric => `<h3>${esc(metric.label)}</h3><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:9px">პერიოდი</th>${metric.rows.map(row => `<th style="padding:9px">${esc(row.end)}</th>`).join("")}</tr></thead><tbody><tr><th style="text-align:left;padding:9px">მნიშვნელობა</th>${metric.rows.map(row => `<td style="padding:9px;text-align:right">${value(Number(row.val), row.unit)}</td>`).join("")}</tr><tr><th style="text-align:left;padding:9px">ფორმა</th>${metric.rows.map(row => `<td style="padding:9px;text-align:right">${esc(row.form)}</td>`).join("")}</tr></tbody></table></div>`).join("")}<p class="note">წყარო: SEC EDGAR XBRL. ფისკალური პერიოდები შეიძლება კალენდარულ პერიოდებს არ ემთხვეოდეს.</p></section>` : "";
  const relatedNews = company.relatedNews?.length ? `<section class="panel" style="margin-top:20px"><h2>კომპანიის სიახლეები</h2><ul class="list">${company.relatedNews.map(article => `<li><b>${esc(article.source)}</b><a href="${esc(article.url)}">${esc(article.title)}</a><time>${esc(String(article.publishedAt).slice(0, 10))}</time></li>`).join("")}</ul><p class="note">ნაჩვენებია მხოლოდ Investors.ge-ზე უკვე გამოქვეყნებული სტატიები, სადაც კომპანიის ოფიციალური სახელი გვხვდება.</p></section>` : "";
  const schema = JSON.stringify({ "@context": "https://schema.org", "@type": "Corporation", name: company.name, tickerSymbol: company.symbol, url: `https://investors.ge/stocks/${encodeURIComponent(company.symbol)}` }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(company.name)} (${esc(company.symbol)}) — კომპანიის ინფორმაცია | Investors.ge</title><meta name="description" content="${esc(company.name)}: აქციის ფასი, ისტორია, ფინანსური მაჩვენებლები, დივიდენდები და SEC დოკუმენტები ქართულად."><link rel="canonical" href="https://investors.ge/stocks/${encodeURIComponent(company.symbol)}"><script type="application/ld+json">${schema}</script><style>
body{margin:0;background:#f5f8f6;color:#10271e;font-family:Arial,sans-serif}.wrap{max-width:1180px;margin:auto;padding:32px 22px 72px}.nav{display:flex;justify-content:space-between;margin-bottom:28px}.nav a{color:#087852;text-decoration:none;font-weight:800}.hero,.panel{background:#fff;border:1px solid #dbe8e1;border-radius:22px;box-shadow:0 12px 34px rgba(16,39,30,.06);padding:26px}.hero h1{font-size:clamp(30px,5vw,54px);margin:8px 0}.eyebrow{color:#087852;font-weight:800}.muted,small{color:#64776f}.quote{display:flex;gap:16px;align-items:baseline;margin-top:20px}.quote strong{font-size:38px}.up{color:#087852}.down{color:#b33a3a}.grid{display:grid;grid-template-columns:1.45fr .75fr;gap:20px;margin-top:20px}.facts,.profile,.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.facts article,.profile div,.stats div{padding:14px;background:#f7faf8;border-radius:12px}.facts span,.facts strong,.facts small,.profile span,.profile b,.stats span,.stats b{display:block}.facts strong{font-size:21px;margin:5px 0}.chart-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.ranges button{padding:8px 10px;border:1px solid #dbe8e1;border-radius:8px;background:#f7faf8}.ranges button.active{background:#087852;color:#fff}.chart-scale{display:flex;justify-content:space-between}.list{list-style:none;padding:0}.list li,.list a{display:grid;grid-template-columns:80px 1fr 110px;gap:12px;padding:11px 0;border-top:1px solid #e4ece7;color:inherit;text-decoration:none}.note{font-size:13px;line-height:1.6;color:#64776f}@media(max-width:760px){.grid{grid-template-columns:1fr}.facts,.profile,.stats{grid-template-columns:1fr}.list li,.list a{grid-template-columns:70px 1fr}.list time{display:none}}
</style></head><body><main class="wrap"><nav class="nav"><a href="/">INVESTORS.GE</a><span><a href="/stocks/compare">კომპანიების შედარება</a> · <a href="/markets.html">← ბაზრები</a></span></nav>
<section class="hero"><div class="eyebrow">${esc(company.exchange)} · ${esc(company.symbol)}</div><h1>${esc(company.name)}</h1><div class="muted">CIK ${esc(company.cik)} · ${esc(company.profile.industry || "კომპანიის პროფილი")}</div>${q ? `<div class="quote"><strong>${esc(q.currency || "USD")} ${q.price.toLocaleString("en-US")}</strong><b class="${q.changePercent >= 0 ? "up" : "down"}">${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%</b></div><small>ფასი შესაძლოა დაგვიანებული იყოს · ${esc(q.marketTime ? new Date(q.marketTime * 1000).toISOString() : company.fetchedAt)}</small><div class="stats" style="margin-top:20px">${stats}</div>${valuation}` : `<div class="quote"><strong>ფასი დროებით მიუწვდომელია</strong></div>`}</section>
<section class="panel" data-company-chart data-symbol="${esc(company.symbol)}" style="margin-top:20px"><div class="chart-head"><div><h2>ფასის ისტორია <span data-company-change></span></h2><small data-company-chart-state>მონაცემები იტვირთება…</small></div><div class="ranges">${["1d","1m","6m","1y","5y"].map(range => `<button type="button" data-company-range="${range}">${range}</button>`).join("")}</div></div><svg viewBox="0 0 900 300" style="width:100%" role="img"><path data-company-area fill="rgba(8,120,82,.1)"></path><path data-company-line fill="none" stroke="#087852" stroke-width="3"></path></svg><div class="chart-scale"><span data-company-min>—</span><span data-company-max>—</span></div><h3>დივიდენდები და აქციების დაყოფა</h3><ul class="list" data-company-events><li>იტვირთება…</li></ul></section>
<div class="grid"><section class="panel"><h2>ფინანსური მაჩვენებლები</h2><div class="facts">${facts || "SEC-ის სტანდარტიზებული მაჩვენებლები ვერ მოიძებნა."}</div><p class="note">წყარო: SEC EDGAR XBRL. პერიოდი და ფორმა მითითებულია თითოეულ მაჩვენებელთან.</p></section><aside class="panel"><h2>კომპანიის შესახებ</h2><div class="profile"><div><span>ინდუსტრია</span><b>${esc(company.profile.industry || "—")}</b></div><div><span>ფისკალური წელი</span><b>${esc(company.profile.fiscalYearEnd || "—")}</b></div><div><span>რეგისტრაცია</span><b>${esc(company.profile.state || "—")}</b></div><div><span>ტელეფონი</span><b>${esc(company.profile.phone || "—")}</b></div><div><span>მისამართი</span><b>${esc(addressText)}</b></div><div><span>ვებსაიტი</span><b>${company.profile.website ? `<a href="${esc(company.profile.website)}" target="_blank" rel="noopener">ოფიციალური საიტი</a>` : "—"}</b></div></div></aside></div>
${historyTable(company.financialHistory?.annual, "წლიური ფინანსური ისტორია")}${historyTable(company.financialHistory?.quarterly, "კვარტალური ფინანსური ისტორია")}${relatedNews}
<section class="panel" style="margin-top:20px"><h2>ბოლო SEC დოკუმენტები</h2><ul class="list">${filings || "<li>დოკუმენტები ვერ მოიძებნა.</li>"}</ul></section><p class="note">კომპანიის მონაცემები: U.S. SEC EDGAR · ფასი და ისტორია: Yahoo Finance, provider-dependent delay · განახლება: ${esc(company.fetchedAt)}. Investors.ge არ არის საინვესტიციო მრჩეველი.</p></main><script type="module" src="/company-chart.js"></script></body></html>`;
}
export function renderCompanyNotFound(symbol) { return `<!doctype html><html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>კომპანია ვერ მოიძებნა | Investors.ge</title></head><body><main style="max-width:720px;margin:10vh auto;padding:24px;font-family:sans-serif"><a href="/markets.html">← ბაზრები</a><h1>${esc(symbol || "სიმბოლო")} ვერ მოიძებნა</h1><p>შეამოწმეთ ტიკერი ან მოძებნეთ კომპანია ბაზრების გვერდიდან.</p></main></body></html>`; }
