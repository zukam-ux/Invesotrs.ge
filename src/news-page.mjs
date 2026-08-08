function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function articleTitle(article) {
  return article.title_ka || article.title || "ფინანსური სიახლე";
}

function articleSummary(article) {
  return article.summary_ka || article.title_ka || article.title || "";
}

function formatPublishedAt(value) {
  try {
    return new Intl.DateTimeFormat("ka-GE", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Tbilisi",
    }).format(new Date(value));
  } catch {
    return value || "";
  }
}

function renderArticleBody(value = "") {
  if (value == null) return "";
  const normalized = String(value).trim();
  if (!normalized || ["null", "undefined"].includes(normalized.toLowerCase())) return "";
  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("## ")) {
        return `<h2>${escapeHtml(block.slice(3))}</h2>`;
      }
      return `<p>${escapeHtml(block.replace(/\n+/g, " "))}</p>`;
    })
    .join("");
}

function layout({ title, description, canonical, body, robots = "index,follow" }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);
  return `<!doctype html>
<html lang="ka">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle} | Investors.ge</title>
  <meta name="description" content="${safeDescription}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${safeCanonical}">
  <meta property="og:locale" content="ka_GE">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Investors.ge">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:url" content="${safeCanonical}">
  <meta property="og:image" content="https://investors.ge/social-card.svg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+Georgian:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/shared.css?v=20260727-news-article">
  <style>
    .article-shell{max-width:1000px;margin:auto;padding:42px 24px 80px}
    .article-back{display:inline-flex;align-items:center;min-height:44px;color:var(--green);font-size:12px;font-weight:800;margin-bottom:18px}
    .article-card{padding:clamp(24px,5vw,58px);border-top:5px solid var(--green)}
    .article-category{display:inline-flex;padding:6px 10px;border-radius:999px;background:var(--mint);color:var(--green);font-size:10px;font-weight:800}
    .article-card h1{max-width:850px;font-size:clamp(30px,5vw,54px);line-height:1.2;letter-spacing:-1.5px;margin:20px 0}
    .article-meta{display:flex;flex-wrap:wrap;gap:8px 16px;padding-bottom:24px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11px}
    .article-summary{font-size:clamp(17px,2.4vw,22px);line-height:1.8;margin:30px 0;color:#29473b}
    .article-body{max-width:790px;margin:34px 0;font-size:16px;line-height:1.95;color:#203d31}
    .article-body h2{font-size:clamp(21px,3vw,28px);line-height:1.35;margin:38px 0 12px;color:var(--ink)}
    .article-body p{margin:0 0 22px}
    .article-body p:first-child{font-size:18px;color:#29473b}
    .article-context{padding:20px;border-radius:15px;background:#f0faf5;color:#416355;font-size:12px;line-height:1.8}
    .article-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}
    .article-actions .secondary{border:1px solid #bde1d1}
    .article-disclosure{margin-top:20px;color:var(--muted);font-size:10px;line-height:1.7}
    .related{margin-top:34px}
    .related h2{font-size:22px;margin-bottom:15px}
    .related-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .related-card{padding:19px;transition:transform .18s ease,border-color .18s ease}
    .related-card:hover{transform:translateY(-2px);border-color:#90ceb7}
    .related-card h3{font-size:14px;line-height:1.55;margin:9px 0}
    .related-card small{color:var(--muted);font-size:9px}
    .article-missing{text-align:center;padding:65px 30px}
    .article-missing h1{font-size:34px;margin:10px 0}
    .article-missing p{color:var(--muted);line-height:1.7}
    @media(max-width:720px){.related-grid{grid-template-columns:1fr}.article-card h1{letter-spacing:-.7px}.article-shell{padding-left:16px;padding-right:16px}}
  </style>
</head>
<body>
  <a class="skip-link" href="#main">კონტენტზე გადასვლა</a>
  <header><nav class="nav"><a class="logo" href="/">Investors<span>.ge</span></a><div class="links"><a href="/">დღეს</a><a href="/markets">ბაზრები</a><a class="active" href="/news">სიახლეები</a><a href="/learn">ისწავლე</a><a href="/compare">შედარება</a><a href="/tools">ინსტრუმენტები</a></div><input class="nav-search" aria-label="ძიება" placeholder="კომპანია, აქცია ან კრიპტო…"><button class="lang" disabled>ქარ</button></nav></header>
  ${body}
  <footer class="footer"><div class="footer-in"><div><a class="logo" href="/">Investors<span>.ge</span></a><p>დამოუკიდებელი ფინანსური ინფორმაცია ქართულად.</p></div><div><h4>კატეგორიები</h4><a href="/news#markets-economy">ბაზრები და ეკონომიკა</a><a href="/news#tech-ai">ტექნოლოგიები და AI</a></div><div><h4>პროდუქტი</h4><a href="/markets">ბაზრები</a><a href="/learn">ისწავლე</a></div><div><h4>სტანდარტები</h4><a href="/standards">სარედაქციო და მონაცემთა წესები</a><a href="mailto:info@investors.ge?subject=Correction">შესწორების მოთხოვნა</a></div></div></footer>
  <script src="/shared.js?v=20260727-news-article"></script>
</body>
</html>`;
}

export function renderNewsArticlePage(article, relatedArticles, requestUrl) {
  const title = articleTitle(article);
  const summary = articleSummary(article);
  const canonical = `https://investors.ge/news/${encodeURIComponent(article.id)}`;
  const creditedUrl = article.source_url || article.url;
  const sourceUrl = /^https:\/\//.test(creditedUrl || "") ? creditedUrl : "#";
  const fullBody = renderArticleBody(article.body_ka);
  const related = relatedArticles
    .map(
      (item) => `<a class="panel related-card" href="/news/${encodeURIComponent(item.id)}">
        <span class="badge">${escapeHtml(item.category || "სიახლე")}</span>
        <h3>${escapeHtml(articleTitle(item))}</h3>
        <small>${escapeHtml(item.source)} · ${escapeHtml(formatPublishedAt(item.published_at))}</small>
      </a>`,
    )
    .join("");
  const schema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: title,
      description: summary,
      datePublished: article.published_at,
      inLanguage: "ka-GE",
      mainEntityOfPage: canonical,
      publisher: { "@type": "Organization", name: "Investors.ge", url: "https://investors.ge/" },
      isBasedOn: creditedUrl,
    }).replaceAll("<", "\\u003c");
  const body = `<main id="main" class="article-shell">
    <a class="article-back" href="/news">← ყველა სიახლე</a>
    <article class="panel article-card">
      <span class="article-category">${escapeHtml(article.category || "ფინანსური სიახლე")}</span>
      <h1>${escapeHtml(title)}</h1>
      <div class="article-meta"><strong>Investors.ge</strong><span>${escapeHtml(formatPublishedAt(article.published_at))}</span><span>წყარო: ${escapeHtml(article.source)}</span></div>
      <p class="article-summary">${escapeHtml(summary)}</p>
      ${fullBody ? `<div class="article-context"><strong>Investors.ge-ის ქართული მიმოხილვა:</strong> სტატია დამოუკიდებლადაა დაწერილი მითითებული გამომცემლის ფაქტებზე დაყრდნობით. ეს არ არის წყაროს სრული თარგმანი ან ასლი.</div><div class="article-body">${fullBody}</div>` : `<div class="article-context"><strong>მოკლე ამბავი:</strong> ამ მასალისთვის სრული ქართული მიმოხილვა ჯერ მზად არ არის. Investors.ge აჩვენებს მხოლოდ სათაურის თარგმანსა და მოკლე ფაქტობრივ შეჯამებას.</div>`}
      <div class="article-actions"><a class="button" href="/news">სხვა ქართული ამბები</a><a class="button secondary" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">ორიგინალი წყარო ↗</a></div>
      <p class="article-disclosure">მასალა საინფორმაციო და საგანმანათლებლო მიზნებისთვისაა და არ წარმოადგენს საინვესტიციო რეკომენდაციას. თარგმანის ან ფაქტობრივი უზუსტობის შემთხვევაში მოგვწერეთ შესწორების მოთხოვნა.</p>
    </article>
    ${related ? `<section class="related" aria-labelledby="relatedTitle"><h2 id="relatedTitle">მსგავსი ამბები ქართულად</h2><div class="related-grid">${related}</div></section>` : ""}
    <script type="application/ld+json">${schema}</script>
  </main>`;
  return layout({ title, description: summary, canonical, body });
}

export function renderNewsNotFoundPage(requestUrl) {
  const canonical = new URL(requestUrl).origin + new URL(requestUrl).pathname;
  const body = `<main id="main" class="article-shell"><section class="panel article-missing"><span class="badge">404</span><h1>ეს ამბავი ვერ მოიძებნა</h1><p>ბმული შესაძლოა მოძველებულია ან მასალა აღარ არის ხელმისაწვდომი.</p><a class="button" href="/news">ქართული სიახლეების ნახვა</a></section></main>`;
  return layout({
    title: "ამბავი ვერ მოიძებნა",
    description: "მოთხოვნილი ფინანსური ამბავი ვერ მოიძებნა.",
    canonical,
    body,
    robots: "noindex,follow",
  });
}
