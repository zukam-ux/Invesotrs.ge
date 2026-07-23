const tickerMarkup=`
  <span>S&amp;P 500 <b>TradingView</b></span>
  <span>NASDAQ-100 ETF <b>QQQ · TradingView</b></span>
  <span>BITCOIN <b data-live="btc">იტვირთება…</b> <i data-live="btc-change" style="font-style:normal"></i></span>
  <span>USD/GEL <b data-live="usd">იტვირთება…</b> <i data-live="usd-date" style="font-style:normal"></i></span>
  <span><i style="font-style:normal;color:#9eb9ac">კრიპტო: CoinGecko · კურსი: NBG</i></span>`;
document.querySelectorAll('[data-ticker]').forEach(el=>el.innerHTML=tickerMarkup);
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());

async function sharedMarketData(){
  try{
    const response=await fetch('/.netlify/functions/market-data');
    if(!response.ok)throw new Error('server feed unavailable');
    return await response.json();
  }catch(_){
    const [crypto,fx]=await Promise.all([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true').then(r=>r.json()),
      fetch('https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/ka/json/').then(r=>r.json())
    ]);
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

function escapeNews(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function relativeNewsTime(value){
  const hours=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/36e5));
  if(hours<1)return "ბოლო საათში";
  if(hours<24)return `${hours} საათის წინ`;
  return new Date(value).toLocaleDateString("ka-GE");
}
function identifyNewsAsset(article){
  const text=`${article.title||""} ${article.titleKa||""}`.toLowerCase();
  const identities=[
    {match:/pinnacle financial/,symbol:"PNFP",name:"Pinnacle Financial",logo:"https://s3-symbol-logo.tradingview.com/pinnacle-financial-partners--big.svg"},
    {match:/td bank|toronto-dominion/,symbol:"TD",name:"TD Bank",logo:"https://s3-symbol-logo.tradingview.com/toronto-dominion-bank--big.svg"},
    {match:/tesla|tsla/,symbol:"TSLA",name:"Tesla",logo:"https://s3-symbol-logo.tradingview.com/tesla--big.svg"},
    {match:/alphabet|google|googl/,symbol:"GOOGL",name:"Alphabet",logo:"https://s3-symbol-logo.tradingview.com/alphabet--big.svg"},
    {match:/nvidia|nvda/,symbol:"NVDA",name:"NVIDIA",logo:"https://s3-symbol-logo.tradingview.com/nvidia--big.svg"},
    {match:/apple|aapl/,symbol:"AAPL",name:"Apple",logo:"https://s3-symbol-logo.tradingview.com/apple--big.svg"},
    {match:/microsoft|msft/,symbol:"MSFT",name:"Microsoft",logo:"https://s3-symbol-logo.tradingview.com/microsoft--big.svg"},
    {match:/amazon|amzn/,symbol:"AMZN",name:"Amazon",logo:"https://s3-symbol-logo.tradingview.com/amazon--big.svg"},
    {match:/meta platforms|facebook|meta stock/,symbol:"META",name:"Meta",logo:"https://s3-symbol-logo.tradingview.com/meta-platforms--big.svg"},
    {match:/spacex|spcx/,symbol:"SPCX",name:"SpaceX",logo:"https://s3-symbol-logo.tradingview.com/spacex--big.svg"},
    {match:/bitcoin.*ethereum|ethereum.*bitcoin|ბიტკოინ.*ეთერიუმ|ეთერიუმ.*ბიტკოინ/,symbol:"BTC · ETH",name:"Bitcoin & Ethereum",logo:"https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png"},
    {match:/bitcoin|btc|ბიტკოინ/,symbol:"BTC",name:"Bitcoin",logo:"https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png"},
    {match:/ethereum|ether|eth|ეთერიუმ/,symbol:"ETH",name:"Ethereum",logo:"https://coin-images.coingecko.com/coins/images/279/small/ethereum.png"},
    {match:/s&p 500|spx/,symbol:"SPX",name:"S&P 500",logo:"https://s3-symbol-logo.tradingview.com/s-and-p-500--big.svg"},
    {match:/nasdaq/,symbol:"IXIC",name:"Nasdaq",logo:"https://s3-symbol-logo.tradingview.com/nasdaq--big.svg"},
    {match:/oil|crude|ნავთობ/,symbol:"OIL",name:"ნავთობი"},
    {match:/ecb|european central|ევროპის ცენტრალურ/,symbol:"ECB",name:"ევროპის ცენტრალური ბანკი"},
    {match:/mortgage|მორტგაჟ/,symbol:"RATE",name:"საპროცენტო განაკვეთები"},
    {match:/crypto|კრიპტო/,symbol:"CRYPTO",name:"კრიპტო ბაზარი",logo:"https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png"}
  ];
  return identities.find(identity=>identity.match.test(text))||{symbol:article.category==="აქციები"?"STOCK":article.category==="კრიპტო"?"CRYPTO":"NEWS",name:article.category||"ბაზრები"};
}
async function loadGlobalNews(){
  const targets=document.querySelectorAll("[data-global-news]");
  const topStoryTargets=document.querySelectorAll("[data-top-stories]");
  if(!targets.length&&!topStoryTargets.length)return;
  try{
    const response=await fetch(`/data/global-news.json?v=${Math.floor(Date.now()/36e5)}`);
    if(!response.ok)throw new Error("news unavailable");
    const data=await response.json();
    targets.forEach(target=>{
      const limit=Number(target.dataset.limit||9),offset=Number(target.dataset.offset||0),articles=(data.articles||[]).slice(offset,offset+limit);
      target.innerHTML=articles.length?articles.map(article=>{
        const identity=identifyNewsAsset(article);
        return `
        <a class="auto-news-card" href="${escapeNews(article.url)}" target="_blank" rel="noopener">
          <span class="news-identity"><i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i><span><b>${escapeNews(identity.symbol)} · ${escapeNews(identity.name)}</b><small>${relativeNewsTime(article.publishedAt)} · ${escapeNews(article.source)} · ${escapeNews(article.category)}</small></span></span>
          <h3>${escapeNews(article.titleKa)}</h3>
          <p>${escapeNews(article.summaryKa)}</p>
          <span class="meta"><span class="translation-label">AI თარგმანი</span> · პირველწყარო ↗</span>
        </a>`}).join(""):'<div class="news-status">პირველი ავტომატური განახლება მზადდება. გლობალური ამბები საათში ერთხელ განახლდება.</div>';
    });
    topStoryTargets.forEach(target=>{
      const articles=(data.articles||[]).slice(0,5),lead=articles[0];
      if(!lead){
        target.innerHTML='<div class="news-status">პირველი ავტომატური განახლება მზადდება. მთავარი ამბები საათში ერთხელ განახლდება.</div>';
        return;
      }
      const leadIdentity=identifyNewsAsset(lead);
      const identityMarkup=identity=>`<span class="news-identity"><i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i><span><b>${escapeNews(identity.symbol)} · ${escapeNews(identity.name)}</b><small>${escapeNews(lead.category)}</small></span></span>`;
      target.innerHTML=`
        <a class="top-story-lead" data-symbol="${escapeNews(leadIdentity.symbol)}" href="${escapeNews(lead.url)}" target="_blank" rel="noopener">
          <div class="top-story-kicker"><span class="live-label"><span class="live-dot"></span> მთავარი ამბავი</span><span>განახლდება ყოველ საათში</span></div>
          ${identityMarkup(leadIdentity)}
          <h2>${escapeNews(lead.titleKa)}</h2>
          <p>${escapeNews(lead.summaryKa)}</p>
          <span class="top-story-footer"><b>${escapeNews(lead.source)}</b><span>·</span><span>${relativeNewsTime(lead.publishedAt)}</span><span>·</span><span>AI თარგმანი</span><span>↗</span></span>
        </a>
        <aside class="top-story-list">
          <div class="top-story-list-head"><h3>მთავარი ამბები</h3><a href="news.html">ყველა ამბავი →</a></div>
          ${articles.slice(1).map(article=>{
            const identity=identifyNewsAsset(article);
            return `<a class="top-story-row" href="${escapeNews(article.url)}" target="_blank" rel="noopener">
              <i class="news-logo">${escapeNews(identity.symbol.slice(0,4))}${identity.logo?`<img src="${escapeNews(identity.logo)}" alt="" loading="lazy" onerror="this.remove()">`:""}</i>
              <span><h4>${escapeNews(article.titleKa)}</h4><small>${escapeNews(identity.symbol)} · ${escapeNews(article.source)} · ${relativeNewsTime(article.publishedAt)}</small></span>
            </a>`;
          }).join("")}
        </aside>`;
    });
    document.querySelectorAll("[data-news-updated]").forEach(el=>el.textContent=data.updatedAt?`განახლდა ${new Date(data.updatedAt).toLocaleString("ka-GE")}`:"პირველი განახლება მზადდება");
  }catch(_){
    targets.forEach(target=>target.innerHTML='<div class="news-status">გლობალური ამბების განახლება დროებით შეფერხებულია. ბაზრის მონაცემები მუშაობას აგრძელებს.</div>');
    topStoryTargets.forEach(target=>target.innerHTML='<div class="news-status">მთავარი ამბების განახლება დროებით შეფერხებულია.</div>');
  }
}
loadGlobalNews();

document.querySelectorAll(".nav-search:not([data-asset-search])").forEach(input => {
  input.dataset.assetSearch = "";
  input.placeholder = "კომპანია, ტიკერი, კრიპტო…";
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
assetSearchScript.src = "asset-search.js";
document.body.appendChild(assetSearchScript);
