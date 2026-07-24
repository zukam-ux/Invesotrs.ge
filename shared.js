const tickerMarkup=`
  <span>S&amp;P 500 <b data-live-quote="^GSPC">SPX</b></span>
  <span>NASDAQ-100 ETF <b data-live-quote="QQQ">QQQ</b></span>
  <span>BITCOIN <b data-live="btc">იტვირთება…</b> <i data-live="btc-change" style="font-style:normal"></i></span>
  <span>USD/GEL <b data-live="usd">იტვირთება…</b> <i data-live="usd-date" style="font-style:normal"></i></span>
  <span><i style="font-style:normal;color:#9eb9ac">კრიპტო: CoinGecko · კურსი: NBG</i></span>`;
document.querySelectorAll('[data-ticker]').forEach(el=>el.innerHTML=tickerMarkup);
(() => {
  const style=document.createElement('link');
  style.rel='stylesheet';
  style.href='finance-header.css?v=20260725-proportional-editorial';
  document.head.appendChild(style);

  const header=document.querySelector('header');
  const topline=document.querySelector('.topline');
  if(!header||!topline)return;

  const path=location.pathname.split('/').pop()||'index.html';
  const items=[
    ['index.html','მთავარი'],
    ['markets.html','ბაზრები'],
    ['news.html','სიახლეები'],
    ['learn.html','სწავლა'],
    ['compare.html','შედარება'],
    ['tools.html','ინსტრუმენტები']
  ];
  let sections=document.querySelector('.subnav');
  if(!sections){
    sections=document.createElement('div');
    sections.className='finance-sections';
    header.after(sections);
  }
  sections.innerHTML=`<nav class="${sections.classList.contains('subnav')?'subnav-inner':'finance-sections-inner'}" aria-label="ფინანსური განყოფილებები">${items.map(([href,label])=>`<a href="${href}"${path===href?' class="active"':''}>${label}</a>`).join('')}</nav>`;
  sections.after(topline);
})();
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());

async function sharedFetchJson(url,timeout=7000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('request unavailable');return await response.json()}
  finally{clearTimeout(timer)}
}
async function sharedMarketData(){
  try{
    return await sharedFetchJson('/api/market-data');
  }catch(_){
    const [cryptoResult,fxResult]=await Promise.allSettled([
      sharedFetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'),
      sharedFetchJson('https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/ka/json/')
    ]);
    const crypto=cryptoResult.status==='fulfilled'?cryptoResult.value:{};
    const fx=fxResult.status==='fulfilled'?fxResult.value:[];
    if(!crypto.bitcoin&&!fx.length)throw new Error('all feeds unavailable');
    return {crypto:{bitcoin:crypto.bitcoin},fx:{usd:fx?.[0]?.currencies?.find(c=>c.code==='USD')}};
  }
}
async function updateSharedTicker(){
  try{
    const data=await sharedMarketData(),btc=data.crypto?.bitcoin,usd=data.fx?.usd;
    document.querySelectorAll('[data-live="btc"]').forEach(e=>e.textContent=btc?.usd?'$'+Number(btc.usd).toLocaleString('en-US'):'მიუწვდომელია');
    document.querySelectorAll('[data-live="btc-change"]').forEach(e=>{const v=btc?.usd_24h_change;e.textContent=Number.isFinite(v)?`${v>=0?'+':'−'}${Math.abs(v).toFixed(2)}%`:'';e.className=v>=0?'up':'down'});
    document.querySelectorAll('[data-live="usd"]').forEach(e=>e.textContent=usd?.rate?Number(usd.rate).toFixed(4):'მიუწვდომელია');
    document.querySelectorAll('[data-live="usd-date"]').forEach(e=>e.textContent=usd?.validFromDate?'NBG · '+new Date(usd.validFromDate).toLocaleDateString('ka-GE'):'');
  }catch(_){
    document.querySelectorAll('[data-live="btc"],[data-live="usd"]').forEach(e=>e.textContent='განახლება შეფერხებულია');
  }
}
updateSharedTicker();

const liveQuoteCache=new Map();
const liveQuotePending=new Set();
function renderLiveQuoteElements(){
  document.querySelectorAll("[data-live-quote]").forEach(element=>{
    const symbol=element.dataset.liveQuote?.toUpperCase(),quote=liveQuoteCache.get(symbol);
    if(!quote||!Number.isFinite(quote.changePercent))return;
    let chip=element.querySelector(":scope > .live-change-chip");
    if(!chip){
      chip=document.createElement("span");
      chip.className="live-change-chip";
      element.appendChild(chip);
    }
    const positive=quote.changePercent>=0;
    chip.textContent=`${positive?"+":"−"}${Math.abs(quote.changePercent).toFixed(2)}%`;
    chip.className=`live-change-chip ${positive?"up":"down"}`;
    chip.title="Yahoo Finance · დღიური ცვლილება";
  });
  document.querySelectorAll("[data-live-price]").forEach(element=>{
    const symbol=element.dataset.livePrice?.toUpperCase(),quote=liveQuoteCache.get(symbol);
    if(!quote||!Number.isFinite(quote.price))return;
    element.textContent=Number(quote.price).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
    element.title=`Yahoo Finance · ${quote.currency||""}`.trim();
  });
}
async function refreshLiveQuotes(root=document){
  const symbols=[...new Set([...root.querySelectorAll("[data-live-quote],[data-live-price]")]
    .map(element=>(element.dataset.liveQuote||element.dataset.livePrice)?.toUpperCase())
    .filter(symbol=>symbol&&!liveQuoteCache.has(symbol)&&!liveQuotePending.has(symbol)))];
  if(!symbols.length){renderLiveQuoteElements();return}
  symbols.forEach(symbol=>liveQuotePending.add(symbol));
  try{
    for(let index=0;index<symbols.length;index+=20){
      const batch=symbols.slice(index,index+20);
      const payload=await sharedFetchJson(`/api/news-quotes?symbols=${encodeURIComponent(batch.join(","))}`);
      Object.entries(payload.quotes||{}).forEach(([symbol,quote])=>liveQuoteCache.set(symbol.toUpperCase(),quote));
    }
  }catch(_){}
  finally{
    symbols.forEach(symbol=>liveQuotePending.delete(symbol));
    renderLiveQuoteElements();
  }
}
window.refreshLiveQuotes=refreshLiveQuotes;
refreshLiveQuotes();

function escapeNews(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function relativeNewsTime(value){
  const hours=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/36e5));
  if(hours<1)return "გამოქვეყნდა ბოლო საათში";
  if(hours<24)return `გამოქვეყნდა ${hours} საათის წინ`;
  return `გამოქვეყნდა ${new Date(value).toLocaleDateString("ka-GE")}`;
}
function identifyNewsAsset(article){
  const text=`${article.title||""} ${article.titleKa||""}`.toLowerCase();
  const explicitTicker=(article.title||"").match(/\b(?:NASDAQ|NYSE|AMEX):([A-Z][A-Z0-9.-]{0,7})\b/i)?.[1]?.toUpperCase();
  if(explicitTicker)return {symbol:explicitTicker,name:explicitTicker,quoteSymbol:explicitTicker};
  const identities=[
    {match:/pinnacle financial/,symbol:"PNFP",name:"Pinnacle Financial",quoteSymbol:"PNFP",logo:"https://s3-symbol-logo.tradingview.com/pinnacle-financial-partners--big.svg"},
    {match:/td bank|toronto-dominion/,symbol:"TD",name:"TD Bank",quoteSymbol:"TD",logo:"https://s3-symbol-logo.tradingview.com/toronto-dominion-bank--big.svg"},
    {match:/tesla|tsla/,symbol:"TSLA",name:"Tesla",quoteSymbol:"TSLA",logo:"https://s3-symbol-logo.tradingview.com/tesla--big.svg"},
    {match:/alphabet|google|googl/,symbol:"GOOGL",name:"Alphabet",quoteSymbol:"GOOGL",logo:"https://s3-symbol-logo.tradingview.com/alphabet--big.svg"},
    {match:/nvidia|nvda/,symbol:"NVDA",name:"NVIDIA",quoteSymbol:"NVDA",logo:"https://s3-symbol-logo.tradingview.com/nvidia--big.svg"},
    {match:/apple|aapl/,symbol:"AAPL",name:"Apple",quoteSymbol:"AAPL",logo:"https://s3-symbol-logo.tradingview.com/apple--big.svg"},
    {match:/microsoft|msft/,symbol:"MSFT",name:"Microsoft",quoteSymbol:"MSFT",logo:"https://s3-symbol-logo.tradingview.com/microsoft--big.svg"},
    {match:/amazon|amzn/,symbol:"AMZN",name:"Amazon",quoteSymbol:"AMZN",logo:"https://s3-symbol-logo.tradingview.com/amazon--big.svg"},
    {match:/meta platforms|facebook|meta stock/,symbol:"META",name:"Meta",quoteSymbol:"META",logo:"https://s3-symbol-logo.tradingview.com/meta-platforms--big.svg"},
    {match:/stifel/,symbol:"SF",name:"Stifel",quoteSymbol:"SF"},
    {match:/amgen|amgn/,symbol:"AMGN",name:"Amgen",quoteSymbol:"AMGN"},
    {match:/morgan stanley/,symbol:"MS",name:"Morgan Stanley",quoteSymbol:"MS"},
    {match:/goldman sachs/,symbol:"GS",name:"Goldman Sachs",quoteSymbol:"GS"},
    {match:/spacex|spcx/,symbol:"SPCX",name:"SpaceX",logo:"https://s3-symbol-logo.tradingview.com/spacex--big.svg"},
    {match:/bitcoin.*ethereum|ethereum.*bitcoin|ბიტკოინ.*ეთერიუმ|ეთერიუმ.*ბიტკოინ/,symbol:"BTC · ETH",name:"Bitcoin & Ethereum",quoteSymbol:"BTC-USD",logo:"https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png"},
    {match:/bitcoin|btc|ბიტკოინ/,symbol:"BTC",name:"Bitcoin",quoteSymbol:"BTC-USD",logo:"https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png"},
    {match:/ethereum|ether|eth|ეთერიუმ/,symbol:"ETH",name:"Ethereum",quoteSymbol:"ETH-USD",logo:"https://coin-images.coingecko.com/coins/images/279/small/ethereum.png"},
    {match:/s&p 500|spx/,symbol:"SPX",name:"S&P 500",quoteSymbol:"^GSPC",logo:"https://s3-symbol-logo.tradingview.com/s-and-p-500--big.svg"},
    {match:/nasdaq/,symbol:"IXIC",name:"Nasdaq",quoteSymbol:"^IXIC",logo:"https://s3-symbol-logo.tradingview.com/nasdaq--big.svg"},
    {match:/oil|crude|ნავთობ/,symbol:"OIL",name:"ნავთობი",quoteSymbol:"CL=F"},
    {match:/ecb|european central|ევროპის ცენტრალურ/,symbol:"ECB",name:"ევროპის ცენტრალური ბანკი"},
    {match:/mortgage|მორტგაჟ/,symbol:"RATE",name:"საპროცენტო განაკვეთები"},
    {match:/crypto|კრიპტო/,symbol:"CRYPTO",name:"კრიპტო ბაზარი",logo:"https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png"}
  ];
  return identities.find(identity=>identity.match.test(text))||{symbol:article.category==="აქციები"?"STOCK":article.category==="კრიპტო"?"CRYPTO":"NEWS",name:article.category||"ბაზრები"};
}
function newsPhoto(article,index=0){
  const text=`${article.title||""} ${article.titleKa||""} ${article.category||""}`.toLowerCase();
  const photos=[
    {match:/tesla|electric|auto|vehicle/,url:"https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1400&q=82"},
    {match:/google|alphabet|technology|tech|ai |chip|nvidia|intel|amd/,url:"https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=82"},
    {match:/bitcoin|ethereum|crypto|cardano|blockchain/,url:"https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=1400&q=82"},
    {match:/oil|crude|energy|opec/,url:"https://images.unsplash.com/photo-1629540946404-ebe133e99f49?auto=format&fit=crop&w=1400&q=82"},
    {match:/bank|treasury|yield|rate|ecb|fed|mortgage/,url:"https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=82"},
    {match:/europe|dax|ftse|euro/,url:"https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=82"},
    {match:/asia|china|japan|nikkei|hang seng/,url:"https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=1400&q=82"},
    {match:/stock|market|s&p|nasdaq|dow|shares|earnings/,url:"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1400&q=82"}
  ];
  const fallbacks=[
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=82",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=82",
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1400&q=82"
  ];
  return photos.find(photo=>photo.match.test(text))?.url||fallbacks[index%fallbacks.length];
}
let newsQuotes={};
function newsQuoteBadge(identity){
  const quote=identity.quoteSymbol?newsQuotes[identity.quoteSymbol]:null;
  if(!quote||!Number.isFinite(quote.changePercent))return "";
  const positive=quote.changePercent>=0;
  return `<span class="news-quote-chip ${positive?"up":"down"}">${positive?"+":""}${quote.changePercent.toFixed(2)}%</span>`;
}
async function loadNewsQuotes(articles){
  const symbols=[...new Set(articles.map(article=>identifyNewsAsset(article).quoteSymbol).filter(Boolean))].slice(0,20);
  if(!symbols.length)return;
  try{
    const payload=await sharedFetchJson(`/api/news-quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
    newsQuotes=payload.quotes||{};
  }catch(_){}
}
function editorialIdentity(identity,article){
  return `<span class="news-identity"><i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i><span><b>${escapeNews(identity.symbol)} · ${escapeNews(identity.name)} ${newsQuoteBadge(identity)}</b><small>${relativeNewsTime(article.publishedAt)} · ${escapeNews(article.source)}</small></span></span>`;
}
function renderEditorialHome(target,articles){
  const selected=articles.slice(0,8),lead=selected[0],features=selected.slice(1,3),rail=selected.slice(3,8);
  if(!lead){
    target.innerHTML='<div class="news-status">მთავარი ამბების პირველი განახლება მზადდება.</div>';
    return;
  }
  const leadIdentity=identifyNewsAsset(lead);
  target.innerHTML=`
    <a class="editorial-lead" href="${escapeNews(lead.url)}" target="_blank" rel="noopener">
      <img src="${escapeNews(newsPhoto(lead,0))}" alt="" fetchpriority="high">
      <span class="editorial-lead-body">
        <span class="editorial-label">● LIVE · მთავარი ამბავი</span>
        <h2>${escapeNews(lead.titleKa)}</h2>
        <p>${escapeNews(lead.summaryKa)}</p>
        <span class="editorial-meta"><b>${escapeNews(lead.source)}</b><span>·</span><span>${relativeNewsTime(lead.publishedAt)}</span><span>·</span><span>${escapeNews(lead.category)}</span><span>↗</span></span>
      </span>
    </a>
    ${features.map((article,index)=>{
      const identity=identifyNewsAsset(article);
      return `<a class="editorial-feature" href="${escapeNews(article.url)}" target="_blank" rel="noopener">
        <img src="${escapeNews(newsPhoto(article,index+1))}" alt="" loading="lazy">
        <span class="editorial-feature-body">
          ${editorialIdentity(identity,article)}
          <h3>${escapeNews(article.titleKa)}</h3>
        </span>
      </a>`;
    }).join("")}
    <aside class="editorial-rail">
      <div class="editorial-rail-head"><h3>პოპულარული</h3><a href="news.html">ყველა ამბავი →</a></div>
      <div class="editorial-rail-list">
        ${rail.map(article=>{
          const identity=identifyNewsAsset(article);
          return `<a class="editorial-row" href="${escapeNews(article.url)}" target="_blank" rel="noopener">
            <i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i>
            <span><h4>${escapeNews(article.titleKa)} ${newsQuoteBadge(identity)}</h4><small>${escapeNews(article.source)} · ${relativeNewsTime(article.publishedAt)}</small></span>
          </a>`;
        }).join("")}
      </div>
    </aside>`;
}
async function loadGlobalNews(){
  const targets=document.querySelectorAll("[data-global-news]");
  const topStoryTargets=document.querySelectorAll("[data-top-stories]");
  const editorialTargets=document.querySelectorAll("[data-editorial-home]");
  if(!targets.length&&!topStoryTargets.length&&!editorialTargets.length)return;
  try{
    const response=await fetch(`/data/global-news.json?v=${Math.floor(Date.now()/36e5)}`);
    if(!response.ok)throw new Error("news unavailable");
    const data=await response.json();
    await loadNewsQuotes(data.articles||[]);
    editorialTargets.forEach(target=>renderEditorialHome(target,data.articles||[]));
    targets.forEach(target=>{
      const pageSize=Number(target.dataset.limit||9);
      const allArticles=(data.articles||[]).slice(Number(target.dataset.offset||0));
      let visibleCount=Math.min(pageSize,allArticles.length);
      const renderArchive=()=>{
        const articles=allArticles.slice(0,visibleCount);
        target.innerHTML=articles.length?articles.map(article=>{
          const identity=identifyNewsAsset(article);
          return `
          <a class="auto-news-card" href="${escapeNews(article.url)}" target="_blank" rel="noopener">
            <span class="news-identity"><i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i><span><b>${escapeNews(identity.symbol)} · ${escapeNews(identity.name)} ${newsQuoteBadge(identity)}</b><small>${relativeNewsTime(article.publishedAt)} · ${escapeNews(article.source)} · ${escapeNews(article.category)}</small></span></span>
            <h3>${escapeNews(article.titleKa)}</h3>
            <p>${escapeNews(article.summaryKa)}</p>
            <span class="meta">პირველწყარო ↗</span>
          </a>`}).join(""):'<div class="news-status">პირველი ავტომატური განახლება მზადდება. გლობალური ამბები საათში ერთხელ განახლდება.</div>';
        if(visibleCount<allArticles.length){
          const more=document.createElement("button");
          more.type="button";
          more.className="news-load-more";
          more.innerHTML=`<span>აჩვენე მეტი</span><span class="count">${allArticles.length-visibleCount}</span><span class="arrow" aria-hidden="true">↓</span>`;
          more.addEventListener("click",()=>{
            visibleCount=Math.min(visibleCount+pageSize,allArticles.length);
            renderArchive();
          });
          target.appendChild(more);
        }
      };
      renderArchive();
    });
    topStoryTargets.forEach(target=>{
      const articles=(data.articles||[]).slice(0,5),lead=articles[0];
      if(!lead){
        target.innerHTML='<div class="news-status">პირველი ავტომატური განახლება მზადდება. მთავარი ამბები საათში ერთხელ განახლდება.</div>';
        return;
      }
      const leadIdentity=identifyNewsAsset(lead);
      const identityMarkup=identity=>`<span class="news-identity"><i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i><span><b>${escapeNews(identity.symbol)} · ${escapeNews(identity.name)} ${newsQuoteBadge(identity)}</b><small>${escapeNews(lead.category)}</small></span></span>`;
      target.innerHTML=`
        <a class="top-story-lead" data-symbol="${escapeNews(leadIdentity.symbol)}" href="${escapeNews(lead.url)}" target="_blank" rel="noopener">
          <div class="top-story-kicker"><span class="live-label"><span class="live-dot"></span> მთავარი ამბავი</span><span>განახლდება ყოველ საათში</span></div>
          ${identityMarkup(leadIdentity)}
          <h2>${escapeNews(lead.titleKa)}</h2>
          <p>${escapeNews(lead.summaryKa)}</p>
          <span class="top-story-footer"><b>${escapeNews(lead.source)}</b><span>·</span><span>${relativeNewsTime(lead.publishedAt)}</span><span>↗</span></span>
        </a>
        <aside class="top-story-list">
          <div class="top-story-list-head"><h3>მთავარი ამბები</h3><a href="news.html">ყველა ამბავი →</a></div>
          ${articles.slice(1).map(article=>{
            const identity=identifyNewsAsset(article);
            return `<a class="top-story-row" href="${escapeNews(article.url)}" target="_blank" rel="noopener">
              <i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i>
              <span><h4>${escapeNews(article.titleKa)} ${newsQuoteBadge(identity)}</h4><small>${escapeNews(identity.symbol)} · ${escapeNews(article.source)} · ${relativeNewsTime(article.publishedAt)}</small></span>
            </a>`;
          }).join("")}
        </aside>`;
    });
    document.querySelectorAll("[data-news-updated]").forEach(el=>el.textContent=data.updatedAt?`განახლდა ${new Date(data.updatedAt).toLocaleString("ka-GE")}`:"პირველი განახლება მზადდება");
  }catch(_){
    targets.forEach(target=>target.innerHTML='<div class="news-status">გლობალური ამბების განახლება დროებით შეფერხებულია. ბაზრის მონაცემები მუშაობას აგრძელებს.</div>');
    topStoryTargets.forEach(target=>target.innerHTML='<div class="news-status">მთავარი ამბების განახლება დროებით შეფერხებულია.</div>');
    editorialTargets.forEach(target=>target.innerHTML='<div class="news-status">მთავარი ამბების განახლება დროებით შეფერხებულია.</div>');
  }
}
loadGlobalNews();

document.querySelectorAll(".nav-search:not([data-asset-search])").forEach(input => {
  input.dataset.assetSearch = "";
  input.placeholder = "კომპანია, აქცია ან კრიპტო…";
  if (!input.closest(".asset-search")) {
    const wrapper = document.createElement("label");
    wrapper.className = "asset-search";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const results = document.createElement("div");
    results.className = "asset-search-results";
    wrapper.appendChild(results);
  }
});
const assetSearchScript = document.createElement("script");
assetSearchScript.src = "asset-search.js?v=20260724-live-quotes";
document.body.appendChild(assetSearchScript);
