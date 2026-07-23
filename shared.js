const tickerMarkup=`
  <span>S&amp;P 500 <b>TradingView</b></span>
  <span>NASDAQ <b>TradingView</b></span>
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
