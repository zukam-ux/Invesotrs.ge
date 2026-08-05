const tickerMarkup=`
  <span>S&amp;P 500 <b data-live-quote="^GSPC">SPX</b></span>
  <span>NASDAQ-100 ETF <b data-live-quote="QQQ">QQQ</b></span>
  <span>BITCOIN <b data-live="btc">იტვირთება…</b> <i data-live="btc-change" style="font-style:normal"></i></span>
  <span>USD/GEL <b data-live="usd">იტვირთება…</b> <i data-live="usd-date" style="font-style:normal"></i></span>
  <span><i style="font-style:normal;color:#9eb9ac">კრიპტო: CoinGecko · კურსი: NBG</i></span>`;
document.querySelectorAll('[data-ticker]').forEach(el=>el.innerHTML=tickerMarkup);
(() => {
  const main=document.querySelector('main');
  if(main&&!main.id)main.id='main-content';
  if(main&&!document.querySelector('.skip-link')){
    const skip=document.createElement('a');
    skip.className='skip-link';
    skip.href=`#${main.id}`;
    skip.textContent='მთავარ შინაარსზე გადასვლა';
    document.body.prepend(skip);
  }
  document.querySelectorAll('.nav-search').forEach((input,index)=>{
    if(!input.id)input.id=`site-search-${index+1}`;
    if(!input.getAttribute('aria-label'))input.setAttribute('aria-label',input.placeholder||'ძიება');
  });
  document.querySelectorAll('.field').forEach((field,index)=>{
    const label=field.querySelector('label');
    const control=field.querySelector('input,select,textarea');
    if(!label||!control)return;
    if(!control.id)control.id=`form-field-${index+1}`;
    label.htmlFor=control.id;
  });
  document.querySelectorAll('.lang').forEach(button=>{
    button.remove();
  });
  document.querySelectorAll('[data-current-date]').forEach(el=>{
    el.textContent=new Intl.DateTimeFormat('ka-GE',{day:'numeric',month:'long',year:'numeric'}).format(new Date())+' · მონაცემები ახლდება';
  });
  document.querySelectorAll('.tool-picker button:not(.active)').forEach(button=>{
    button.disabled=true;
    button.title='ეს ინსტრუმენტი მზადდება';
    button.setAttribute('aria-label',(button.querySelector('b')?.textContent||'ინსტრუმენტი')+' — მზადდება');
  });
})();
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
    ['georgia.html','საქართველო'],
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
function newsArticleUrl(article){
  return `/news/${encodeURIComponent(article.id)}`;
}
function relativeNewsTimeText(value){
  const hours=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/36e5));
  if(hours<1)return "გამოქვეყნდა ბოლო საათში";
  if(hours<24)return `გამოქვეყნდა ${hours} საათის წინ`;
  return `გამოქვეყნდა ${new Date(value).toLocaleDateString("ka-GE")}`;
}
function relativeNewsTime(value){
  return `<time data-relative-news datetime="${escapeNews(value)}">${relativeNewsTimeText(value)}</time>`;
}
function refreshRelativeNewsTimes(){
  document.querySelectorAll("[data-relative-news]").forEach(node=>{
    node.textContent=relativeNewsTimeText(node.getAttribute("datetime"));
  });
}
function polishedNewsText(value=""){
  return String(value)
    .replace(/\bunderpriced\b/gi,"საბაზრო შეფასებაზე იაფად")
    .replace(/\bundervalued\b/gi,"სამართლიან ღირებულებაზე იაფად")
    .replace(/^მივმართავ:\s*/i,"")
    .replace(/^ბირჟის ბაზარი დღეს:\s*/i,"ბაზრები დღეს: ")
    .replace(/ლიზინგისა და ლიზინგის უკან დაბრუნების შეთანხმება/gi,"გაყიდვა-უკუიჯარის შეთანხმება")
    .replace(/ნავთობის მილსადენის ქსელისთვის/gi,"ნავთობსადენების ქსელისთვის")
    .replace(/\bAI hyperscaler\b/gi,"AI ინფრასტრუქტურის მსხვილი ოპერატორი")
    .replace(/\bhyperscaler\b/gi,"მსხვილი ღრუბლოვანი ოპერატორი")
    .replace(/\s+/g," ")
    .trim();
}
function headlineFor(article){
  return polishedNewsText(article.titleKa||article.title||"");
}
function summaryFor(article){
  return polishedNewsText(article.summaryKa||"");
}
function translationNote(article){
  return article.translationNotice?'<span class="translation-note">ქართული მოკლე თარგმანი</span>':"";
}
function newsSectionKey(article){
  const text=`${article.title||""} ${article.titleKa||""} ${article.summaryKa||""} ${article.category||""}`.toLowerCase();
  if(article.category==="საქართველო"||["BM.GE","Entrepreneur.ge","Marketer.ge"].includes(article.source))return "georgia";
  if(/\b(ai|artificial intelligence|technology|tech|chip|semiconductor|software|cloud|robot|openai|anthropic|nvidia|amd|intel)\b|ხელოვნურ ინტელექტ|ტექნოლოგ|ჩიპ|ნახევარგამტარ|პროგრამულ|ღრუბლოვან/.test(text))return "tech-ai";
  return "markets-economy";
}
function newsSectionLabel(article){
  if(newsSectionKey(article)==="georgia")return "საქართველო";
  return newsSectionKey(article)==="tech-ai"?"ტექნოლოგიები და AI":"ბაზრები და ეკონომიკა";
}
function editorialScore(article){
  const sourceWeights={Reuters:90,"Associated Press":85,Bloomberg:80,Barrons:72,"Barron's":72,CNBC:65,CoinDesk:62,MarketWatch:58,"Yahoo Finance":35};
  const text=`${article.title||""} ${article.titleKa||""}`.toLowerCase();
  let score=sourceWeights[article.source]||45;
  const ageHours=Math.max(0,(Date.now()-new Date(article.publishedAt).getTime())/36e5);
  score+=Math.max(0,36-ageHours);
  if(/^\s*\d+\s|stocks? to buy|best stocks?|undervalued|could soar|millionaire|no-brainer|should you buy|watch right now/i.test(text))score-=70;
  if(/federal reserve|inflation|oil|earnings|regulation|tariff|central bank|market|economy|ნავთობ|ინფლაცი|განაკვეთ|ბაზრ|ეკონომიკ/i.test(text))score+=18;
  return score;
}
const conflictNewsTerms=/\b(ukraine|ukrainian|russia|russian|gaza|hamas|hezbollah|drone strike|airstrike|air strike|missile attack|military attack|battlefield|invasion|bombing|troop deployment|war in ukraine|israel.{0,20}(war|attack|strike)|iran.{0,20}(war|attack|strike|missile))\b/i;
function isConflictNews(article){
  return conflictNewsTerms.test(`${article.title||""} ${article.titleKa||""} ${article.summaryKa||""}`);
}
function curatedNews(articles){
  return [...articles].filter(article=>!isConflictNews(article)).sort((a,b)=>editorialScore(b)-editorialScore(a));
}
function newestNews(articles){
  return [...articles]
    .filter(article=>!isConflictNews(article))
    .sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
}
function recentEditorialLead(articles,maxAgeHours=4){
  const eligible=curatedNews(articles);
  const recent=eligible.filter(article=>(Date.now()-new Date(article.publishedAt).getTime())<=maxAgeHours*36e5);
  return (recent.length?recent:eligible)[0];
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
function editorialPhoto(article){
  const text=`${article.title||""} ${article.titleKa||""} ${article.summaryKa||""} ${article.category||""}`.toLowerCase();
  const photos=[
    {
      match:/\b(ai|artificial intelligence|technology|tech|chip|semiconductor|software|cloud|nvidia|amd|intel)\b|ხელოვნურ ინტელექტ|ტექნოლოგ|ჩიპ|ნახევარგამტარ/,
      url:"https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Facebook_Data_Center_Server_Board.jpg/1280px-Facebook_Data_Center_Server_Board.jpg",
      alt:"მონაცემთა ცენტრის სერვერის დაფა",
      credit:"Intel Free Press · CC BY 2.0",
      source:"https://commons.wikimedia.org/w/index.php?curid=28084741"
    },
    {
      match:/\b(oil|crude|energy|opec|pumpjack)\b|ნავთობ|ენერგეტიკ/,
      url:"https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Oil_pumpjack_in_the_Permian_Basin.jpg/1280px-Oil_pumpjack_in_the_Permian_Basin.jpg",
      alt:"ნავთობის სატუმბი დანადგარი პერმის აუზში",
      credit:"Quintin Soloviev · CC BY 4.0",
      source:"https://commons.wikimedia.org/w/index.php?curid=185565863"
    }
  ];
  return photos.find(photo=>photo.match.test(text))||{
    url:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/NYSE_Advanced_Trading_Floor.jpg/1280px-NYSE_Advanced_Trading_Floor.jpg",
    alt:"ნიუ-იორკის საფონდო ბირჟის სავაჭრო დარბაზი",
    credit:"Asy arch · CC BY-SA 3.0",
    source:"https://commons.wikimedia.org/w/index.php?curid=3263404"
  };
}
function editorialMedia(article,eager=false){
  const photo=editorialPhoto(article);
  return `<figure class="editorial-media">
    <img src="${escapeNews(photo.url)}" alt="${escapeNews(photo.alt)}" loading="${eager?"eager":"lazy"}" referrerpolicy="no-referrer">
    <a class="photo-credit" href="${escapeNews(photo.source)}" target="_blank" rel="noopener">${escapeNews(photo.credit)} ↗</a>
  </figure>`;
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
  const eligible=curatedNews(articles),latest=newestNews(articles),lead=recentEditorialLead(eligible),selected=lead?[lead,...latest.filter(article=>article.id!==lead.id)].slice(0,8):[],features=selected.slice(1,3),rail=selected.slice(3,8);
  if(!lead){
    target.innerHTML='<div class="news-status">მთავარი ამბების პირველი განახლება მზადდება.</div>';
    return;
  }
  const leadIdentity=identifyNewsAsset(lead);
  target.innerHTML=`
    <article class="editorial-lead">
      ${editorialMedia(lead,true)}
      <a class="editorial-story-link" href="${newsArticleUrl(lead)}">
      <span class="editorial-lead-body">
        <span class="editorial-label">მთავარი ამბავი</span>
        ${editorialIdentity(leadIdentity,lead)}
        <h2>${escapeNews(headlineFor(lead))}</h2>
        <p>${escapeNews(summaryFor(lead))}</p>
        <span class="editorial-meta"><b>${escapeNews(lead.source)}</b><span>·</span><span>${relativeNewsTime(lead.publishedAt)}</span><span>·</span><span>${escapeNews(lead.category)}</span>${translationNote(lead)}<span>↗</span></span>
      </span>
      </a>
    </article>
    ${features.map((article,index)=>{
      const identity=identifyNewsAsset(article);
      return `<article class="editorial-feature">
        ${editorialMedia(article)}
        <a class="editorial-story-link" href="${newsArticleUrl(article)}">
        <span class="editorial-feature-body">
          ${editorialIdentity(identity,article)}
          <h3>${escapeNews(headlineFor(article))}</h3>
          <span class="editorial-feature-source">${escapeNews(article.source)} · ${relativeNewsTime(article.publishedAt)}</span>
        </span>
        </a>
      </article>`;
    }).join("")}
    <aside class="editorial-rail">
      <div class="editorial-rail-head"><h3>ბოლო ამბები</h3><a href="news.html">ყველა →</a></div>
      <div class="editorial-rail-list">
        ${rail.map(article=>{
          const identity=identifyNewsAsset(article);
          return `<a class="editorial-row" href="${newsArticleUrl(article)}">
            <i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i>
            <span><h4>${escapeNews(headlineFor(article))} ${newsQuoteBadge(identity)}</h4><small>${escapeNews(article.source)} · ${relativeNewsTime(article.publishedAt)}</small></span>
          </a>`;
        }).join("")}
      </div>
    </aside>`;
}
async function loadGlobalNews(){
  const targets=document.querySelectorAll("[data-global-news]");
  const topStoryTargets=document.querySelectorAll("[data-top-stories]");
  const editorialTargets=document.querySelectorAll("[data-editorial-home]");
  const thesisTargets=document.querySelectorAll("[data-daily-thesis]");
  if(!targets.length&&!topStoryTargets.length&&!editorialTargets.length&&!thesisTargets.length)return;
  try{
    const response=await fetch(`/data/global-news.json?v=${Math.floor(Date.now()/36e5)}`);
    if(!response.ok)throw new Error("news unavailable");
    const data=await response.json();
    await loadNewsQuotes(data.articles||[]);
    const safeArticles=(data.articles||[]).filter(article=>!isConflictNews(article));
    const thesis=recentEditorialLead(safeArticles);
    if(thesis){
      const identity=identifyNewsAsset(thesis);
      thesisTargets.forEach(target=>target.innerHTML=`
        <div class="daily-thesis-copy">
          <span class="daily-thesis-label">დღის მთავარი თემა</span>
          <h2 id="dailyBriefTitle">${escapeNews(headlineFor(thesis))}</h2>
          <p>${escapeNews(summaryFor(thesis))}</p>
          <span class="daily-thesis-meta">${escapeNews(thesis.source)} · ${relativeNewsTime(thesis.publishedAt)} · ${escapeNews(identity.name)} ${translationNote(thesis)}</span>
        </div>
        <span class="daily-thesis-actions"><a href="${newsArticleUrl(thesis)}">წაიკითხე ქართულად →</a><a href="${escapeNews(thesis.url)}" target="_blank" rel="noopener">ორიგინალი წყარო ↗</a></span>`);
    }
    editorialTargets.forEach(target=>renderEditorialHome(target,safeArticles));
    targets.forEach(target=>{
      const pageSize=Number(target.dataset.limit||9);
      const category=target.dataset.newsCategory;
      const matchingArticles=category?safeArticles.filter(article=>newsSectionKey(article)===category):safeArticles;
      const allArticles=matchingArticles.slice(Number(target.dataset.offset||0));
      let visibleCount=Math.min(pageSize,allArticles.length);
      const renderArchive=()=>{
        const articles=allArticles.slice(0,visibleCount);
        target.innerHTML=articles.length?articles.map(article=>{
          const identity=identifyNewsAsset(article);
          return `
          <a class="auto-news-card" href="${newsArticleUrl(article)}">
            <span class="news-identity"><i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i><span><b>${escapeNews(identity.symbol)} · ${escapeNews(identity.name)} ${newsQuoteBadge(identity)}</b><small>${relativeNewsTime(article.publishedAt)} · ${escapeNews(article.source)} · ${escapeNews(newsSectionLabel(article))}</small></span></span>
            <h3>${escapeNews(headlineFor(article))}</h3>
            <p>${escapeNews(summaryFor(article))}</p>
            <span class="meta">წაიკითხე ქართულად →</span>
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
      const articles=safeArticles.slice(0,5),lead=articles[0];
      if(!lead){
        target.innerHTML='<div class="news-status">პირველი ავტომატური განახლება მზადდება. მთავარი ამბები საათში ერთხელ განახლდება.</div>';
        return;
      }
      const leadIdentity=identifyNewsAsset(lead);
      const identityMarkup=identity=>`<span class="news-identity"><i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i><span><b>${escapeNews(identity.symbol)} · ${escapeNews(identity.name)} ${newsQuoteBadge(identity)}</b><small>${escapeNews(lead.category)}</small></span></span>`;
      target.innerHTML=`
        <a class="top-story-lead" data-symbol="${escapeNews(leadIdentity.symbol)}" href="${newsArticleUrl(lead)}">
          <div class="top-story-kicker"><span class="live-label"><span class="live-dot"></span> მთავარი ამბავი</span><span>განახლდება ყოველ საათში</span></div>
          ${identityMarkup(leadIdentity)}
          <h2>${escapeNews(headlineFor(lead))}</h2>
          <p>${escapeNews(summaryFor(lead))}</p>
          <span class="top-story-footer"><b>${escapeNews(lead.source)}</b><span>·</span><span>${relativeNewsTime(lead.publishedAt)}</span><span>↗</span></span>
        </a>
        <aside class="top-story-list">
          <div class="top-story-list-head"><h3>მთავარი ამბები</h3><a href="news.html">ყველა ამბავი →</a></div>
          ${articles.slice(1).map(article=>{
            const identity=identifyNewsAsset(article);
            return `<a class="top-story-row" href="${newsArticleUrl(article)}">
              <i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i>
              <span><h4>${escapeNews(headlineFor(article))} ${newsQuoteBadge(identity)}</h4><small>${escapeNews(identity.symbol)} · ${escapeNews(article.source)} · ${relativeNewsTime(article.publishedAt)}</small></span>
            </a>`;
          }).join("")}
        </aside>`;
    });
    refreshRelativeNewsTimes();
    document.querySelectorAll("[data-news-updated]").forEach(el=>el.textContent=data.updatedAt?`განახლდა ${new Date(data.updatedAt).toLocaleString("ka-GE")}`:"პირველი განახლება მზადდება");
  }catch(_){
    targets.forEach(target=>target.innerHTML='<div class="news-status">გლობალური ამბების განახლება დროებით შეფერხებულია. ბაზრის მონაცემები მუშაობას აგრძელებს.</div>');
    topStoryTargets.forEach(target=>target.innerHTML='<div class="news-status">მთავარი ამბების განახლება დროებით შეფერხებულია.</div>');
    editorialTargets.forEach(target=>target.innerHTML='<div class="news-status">მთავარი ამბების განახლება დროებით შეფერხებულია.</div>');
    thesisTargets.forEach(target=>target.innerHTML='<div class="news-status">დღის მთავარი თემის განახლება დროებით შეფერხებულია.</div>');
  }
}
loadGlobalNews();
setInterval(refreshRelativeNewsTimes,60000);

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
assetSearchScript.type = "module";
assetSearchScript.src = "asset-search.js?v=20260725-search-quality";
document.body.appendChild(assetSearchScript);
