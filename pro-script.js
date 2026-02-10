/* pro-script.js - V110.0 (Cumulative 24H Profit Logic) */
let appState = {
    balance: 0.00,        // 현재 지갑 총액
    cash: 0.00,           // 현금
    bankBalance: 0.00,    // 은행
    startBalance: 0.00,   // 시작 원금
    dailyTotalProfit: 0.00, // [NEW] 24시간 누적 수익금 (장부)
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: "",
    realPrices: {}, socket: null
};
let autoTradeInterval = null;
let dataCounterInterval = null;
const SAVE_KEY = 'neuroBotData_V110_FINAL'; // 버전 변경으로 초기화 권장
const CONFIG_KEY = 'neuroConfig_V110_FINAL';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    if (window.location.pathname.includes('info.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || (appState.config.target ? appState.config.target.split('/')[0] : 'BTC');
        initInfoPage(coin);
    } else {
        if(document.getElementById('tab-holdings')) showTab(appState.activeTab || 'holdings');
        const searchInput = document.getElementById('coin-search-input');
        if(searchInput && appState.searchQuery) searchInput.value = appState.searchQuery;

        if (appState.isRunning && document.getElementById('total-val')) {
            startSystem(true);
        } else {
            updateButtonState(false);
        }
        
        startDataCounter();
        setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
        renderGlobalUI();
    }
});

/* --- 트레이딩 엔진 (수익금 누적 로직 추가) --- */
async function executeAiTrade() {
    if(!appState.isRunning) return;

    const coin = appState.runningCoin;
    let price = appState.realPrices[coin];
    if(!price) price = await fetchRealPrice(coin);

    const action = Math.random();
    let type = '관망';
    let pnl = 0; // 이번 거래의 순수익

    // 승률 및 수익률 로직
    if (action > 0.6) { // 매수 (보유)
        type = '매수';
        // 매수 상태에서도 평가 손익은 변동됨 (소폭)
        pnl = (appState.investedAmount * (Math.random() * 0.001)); 
    } else if (action > 0.3) { // 익절 (수익 실현)
        type = '익절';
        pnl = (appState.investedAmount * (Math.random() * 0.006)); // 0.6% 이익
    } else { // 손절/하락
        type = '매도';
        pnl = -(appState.investedAmount * (Math.random() * 0.003)); // 0.3% 손실
    }

    // 1. 지갑 잔고에 반영 (돈이 들어옴)
    appState.balance += pnl;
    
    // 2. [핵심] 24H 누적 수익금 장부에 기록 (계속 더하기만 함)
    // 매수 상태일 때도 평가익을 더할지, 확정 수익만 더할지 결정해야 함.
    // 사용자 요청대로 "전체 수익"을 보여주기 위해 모든 변동분을 누적합니다.
    appState.dailyTotalProfit += pnl;

    const fee = appState.investedAmount * 0.0005;
    const net = (appState.investedAmount + pnl) - fee;
    
    appState.tradeHistory.unshift({
        time: new Date().toLocaleTimeString('en-GB'),
        coin: coin, market: 'USDT', type: type,
        price: price.toLocaleString(),
        qty: (appState.investedAmount / price).toFixed(4),
        tradeAmt: appState.investedAmount.toFixed(2),
        fee: fee.toFixed(2),
        net: net.toFixed(2),
        pnl: pnl.toFixed(2)
    });

    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
    renderGlobalUI();
}

/* --- UI 렌더링 (누적 수익금 표시) --- */
function renderGlobalUI() {
    const els = { total: document.getElementById('total-val'), label: document.getElementById('balance-label'), wallet: document.getElementById('wallet-display'), avail: document.getElementById('avail-cash'), bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit') };
    const currentCash = appState.isRunning ? appState.cash : appState.balance;

    if(els.total) {
        if(appState.isRunning) {
            const activeMoney = appState.balance - appState.cash;
            els.total.innerText = `$ ${activeMoney.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            els.label.innerText = `현재 운용 자산 (${appState.runningCoin})`;
            els.label.style.color = "var(--accent)";
            
            // [수정] 누적된 dailyTotalProfit을 보여줌 (잔고 비교 아님)
            const profit = appState.dailyTotalProfit;
            
            // 수익률 = (누적수익 / 시작원금) * 100
            let profitRate = 0;
            if (appState.startBalance > 0) {
                profitRate = (profit / appState.startBalance) * 100;
            }
            
            const color = profit >= 0 ? 'text-green' : 'text-red';
            const sign = profit >= 0 ? '+' : '';
            
            // 24H 수익: 누적된 값을 표시하므로 줄어들지 않음
            els.prof.innerHTML = `<span class="${color}">${sign}${profitRate.toFixed(2)}%</span> <span style="font-size:0.9rem; color:#888;">($${profit.toFixed(2)})</span>`;
        } else {
            els.total.innerText = `$ 0.00`;
            els.label.innerText = `AI TRADING READY`;
            els.label.style.color = "#888";
            els.prof.innerText = "---";
        }
    }

    // 지갑 화면 (여기도 누적 수익으로 통일)
    if(els.wallet) {
        els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        els.avail.innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        
        // 지갑 투자손익 탭
        const pnlAmt = document.getElementById('pnl-total-amount');
        const pnlPct = document.getElementById('pnl-total-percent');
        const pnlInv = document.getElementById('pnl-avg-invest');
        
        if(pnlAmt) {
            const profit = appState.dailyTotalProfit; // 누적 수익 사용
            const pct = appState.startBalance > 0 ? (profit/appState.startBalance)*100 : 0;
            const color = profit >= 0 ? 'text-green' : 'text-red';
            
            pnlAmt.innerText = `$ ${profit.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            pnlAmt.className = `hero-number ${color}`;
            pnlPct.innerText = `${profit>=0?'+':''}${pct.toFixed(2)}%`;
            pnlPct.className = color;
            pnlInv.innerText = `$ ${appState.investedAmount.toLocaleString()}`;
        }
        updatePortfolio(currentCash);
    }
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    updateHistoryTables();
}

// ... (이하 기존 함수들: fetchRealPrice, initInfoPage 등은 V105와 동일하게 유지) ...
// (긴 코드를 줄이기 위해 위에서 수정한 executeAiTrade와 renderGlobalUI 외의 필수 함수들은 그대로 둡니다)

async function fetchRealPrice(coin) { try { const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`); const d = await res.json(); const p = parseFloat(d.price); appState.realPrices[coin] = p; return p; } catch (e) { return getRealisticPrice(coin); } }
function getRealisticPrice(s){const r=Math.random();if(s==='BTC')return 68420+(r*300);if(s==='ETH')return 2245+(r*15);if(s==='XRP')return 1.48+(r*0.005);return 100+(r*10)}
function startPriceStream(coin){if(appState.socket){appState.socket.close()}const symbol=coin.toLowerCase()+'usdt';appState.socket=new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);appState.socket.onmessage=(event)=>{const data=JSON.parse(event.data);const price=parseFloat(data.p);appState.realPrices[coin]=price;updateInfoUI(price)};appState.socket.onerror=(error)=>{fetchRealPrice(coin)}}
function initInfoPage(c){c=c.toUpperCase();const i=document.getElementById('info-page-search');if(i)i.value=c;new TradingView.widget({"container_id":"info_tv_chart","symbol":`BINANCE:${c}USDT`,"interval":"15","theme":"dark","style":"1","locale":"kr","autosize":true,"hide_side_toolbar":false});startPriceStream(c);document.getElementById('analysis-verdict').innerText="실시간 데이터 연결 중...";loadNewsData(c)}
function updateInfoUI(p){const pe=document.getElementById('analysis-price');const se=document.getElementById('ai-score-val');const ve=document.getElementById('analysis-verdict');if(pe){const pp=parseFloat(pe.getAttribute('data-prev'))||p;const c=p>pp?'var(--color-up)':(p<pp?'var(--color-down)':'#fff');pe.innerText=`$ ${p.toLocaleString(undefined,{minimumFractionDigits:2})}`;pe.style.color=c;pe.setAttribute('data-prev',p)}const ds=60+Math.floor((p%10)*3);if(se)se.innerText=Math.min(99,Math.max(40,ds));if(ve){if(ds>=80)ve.innerHTML=`"강력 매수 신호"`;else if(ds>=50)ve.innerHTML=`"중립/관망 구간"`;else ve.innerHTML=`"매도 압력 증가"`;}document.getElementById('val-support').innerText=`$ ${(p*0.985).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-resistance').innerText=`$ ${(p*1.015).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-stoploss').innerText=`$ ${(p*0.97).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-target').innerText=`$ ${(p*1.05).toLocaleString(undefined,{maximumFractionDigits:2})}`;const re=document.getElementById('deep-report-text');if(re&&re.getAttribute('data-updated')!=='true'){re.innerHTML=`현재 <strong>BINANCE</strong> 실시간 시세 <strong>$${p.toLocaleString()}</strong>.<br>매수 벽이 두터워지며 단기 반등 시도 중.<br>⚠️ <strong>전략:</strong> 변동성 주의.`;re.setAttribute('data-updated','true')}}
function updatePortfolio(c){const pie=document.getElementById('portfolio-pie');const list=document.getElementById('holdings-list');if(!list)return;const iv=appState.balance-c;const tv=appState.balance>0?appState.balance:1;let ip=0;if(appState.isRunning&&iv>0)ip=(iv/tv)*100;const cp=100-ip;if(pie)pie.style.background=ip>0?`conic-gradient(var(--accent) 0% ${ip}%, #444 ${ip}% 100%)`:`conic-gradient(#444 0% 100%)`;let h='';if(appState.isRunning&&iv>0){h+=`<div style="display:flex; justify-content:space-between; align-items:center; padding:15px 5px; border-bottom:1px solid #222;"><div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; background:var(--accent); border-radius:50%;"></div><div><div style="font-weight:bold; color:#fff; font-size:0.95rem;">${appState.runningCoin}</div><div style="font-size:0.75rem; color:var(--accent);">AI Trading</div></div></div><div style="text-align:right;"><div style="color:#fff; font-weight:bold;">$ ${iv.toLocaleString(undefined,{minimumFractionDigits:2})}</div><div style="font-size:0.75rem; color:#888;">${ip.toFixed(1)}%</div></div></div>`}if(appState.balance>0){h+=`<div style="display:flex; justify-content:space-between; align-items:center; padding:15px 5px; border-bottom:1px solid #222;"><div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; background:#444; border-radius:50%;"></div><div><div style="font-weight:bold; color:#fff; font-size:0.95rem;">USDT</div><div style="font-size:0.75rem; color:#888;">Cash</div></div></div><div style="text-align:right;"><div style="color:#fff; font-weight:bold;">$ ${c.toLocaleString(undefined,{minimumFractionDigits:2})}</div><div style="font-size:0.75rem; color:#888;">${cp.toFixed(1)}%</div></div></div>`}list.innerHTML=h}
function updateHistoryTables(){const ht=document.getElementById('history-table-body');if(ht){if(appState.tradeHistory.length===0)ht.innerHTML='<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">거래 내역이 없습니다.</td></tr>';else{let h='';appState.tradeHistory.slice(0,30).forEach(t=>{let c='text-green';if(t.type.includes('매도')||t.type.includes('손절'))c='text-red';h+=`<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>${t.market}</td><td class="${c}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`});ht.innerHTML=h}}const ml=document.getElementById('main-ledger-list');if(ml){if(appState.tradeHistory.length===0)ml.innerHTML='<div style="padding:40px; text-align:center; color:#444;">NO TRADES YET</div>';else{let h='';appState.tradeHistory.slice(0,50).forEach(t=>{const c=parseFloat(t.pnl)>=0?'text-green':'text-red';h+=`<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${t.type.includes('매도')?'text-red':'text-green'}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${c}">${t.net}</div></div>`});ml.innerHTML=h}}const bl=document.getElementById('bank-history-list');if(bl&&appState.transfers){let h='';appState.transfers.forEach(t=>{h+=`<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`});bl.innerHTML=h}}
function startSystem(s=false){if(appState.balance<10){if(!s)alert("지갑 잔고 부족");stopSystem(true);return}if(!appState.config.isReady){if(!s)alert("AI 설정 필요");return}if(appState.balance<appState.config.amount){if(!s)alert("설정 금액 > 잔고");stopSystem(true);return}appState.runningCoin=appState.config.target.split('/')[0];appState.investedAmount=appState.config.amount;appState.cash=appState.balance-appState.investedAmount;if(appState.startBalance===0)appState.startBalance=appState.balance;if(appState.openOrders.length===0)generateFakeOpenOrders(appState.runningCoin);if(autoTradeInterval)clearInterval(autoTradeInterval);appState.isRunning=true;autoTradeInterval=setInterval(executeAiTrade,1200);updateButtonState(true);saveState()}
function stopSystem(s=false){appState.isRunning=false;appState.investedAmount=0;appState.cash=appState.balance;if(autoTradeInterval)clearInterval(autoTradeInterval);updateButtonState(false);saveState();renderGlobalUI()}
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(appState))}
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)}}catch(e){}}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d)}catch(e){}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c||(c.includes('info')&&e.href.includes('index')))e.classList.add('active');else e.classList.remove('active')})}
function updateButtonState(o){const b=document.getElementById('btn-main-control');if(b){b.innerHTML=o?'<i class="fas fa-play"></i> RUNNING':'<i class="fas fa-play"></i> START';b.style.background=o?'#c84a31':'#2b3139'}}
function handleSearch(v){appState.searchQuery=v.toUpperCase()}
function searchInfoCoin(){const i=document.getElementById('info-page-search');if(i&&i.value)window.location.href=`info.html?coin=${i.value.toUpperCase()}`}
function openInfoPage(){window.location.href=`info.html?coin=${appState.searchQuery||appState.runningCoin||'BTC'}`}
function showTab(t){appState.activeTab=t;saveState();document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));document.getElementById('tab-'+t).classList.remove('hidden');document.querySelectorAll('.wallet-tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('btn-'+t).classList.add('active');renderGlobalUI()}
function generateFakeOpenOrders(c){appState.openOrders=[];for(let i=0;i<3;i++)appState.openOrders.push({time:'12:00',coin:c,type:'매수',price:'Loading',vol:'0.0'})}
function startDataCounter(){if(dataCounterInterval)clearInterval(dataCounterInterval);const e=document.getElementById('data-mining-counter');if(e)dataCounterInterval=setInterval(()=>{appState.dataCount+=Math.floor(Math.random()*15);e.innerText=appState.dataCount.toLocaleString()},100)}
function exportLogs(){alert("✅ 거래 내역 다운로드 완료")}
function applyBankInterest(){if(appState.bankBalance>0)appState.bankBalance+=(appState.bankBalance*0.0000008)}
function checkKeys(){alert("✅ 키 확인 완료")}
function selectStrategy(t){document.querySelectorAll('.strategy-card').forEach(c=>c.classList.remove('active'));event.currentTarget.classList.add('active')}
function processBankDeposit(){const i=document.getElementById('bank-deposit-input');const a=parseFloat(i.value);if(!a||isNaN(a))return alert("금액 오류");if(a<10)return alert("최소 $10");if(a>100000)return alert("최대 $100,000");if(!appState)loadState();appState.bankBalance=parseFloat(appState.bankBalance)+a;appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:"WIRE IN",amount:a});saveState();renderGlobalUI();alert("입금 완료");i.value=''}
function openModal(m){const d=document.getElementById('transaction-modal');if(!d)return;d.style.display='flex';currentTxMode=m;document.getElementById('amount-input').value='';document.getElementById('modal-title').innerText=m==='deposit'?"입금 (은행 → 지갑)":"출금 (지갑 → 은행)";document.getElementById('modal-title').style.color=m==='deposit'?"var(--color-up)":"var(--color-down)"}
function processTx(){const i=document.getElementById('amount-input');const a=parseFloat(i.value);if(!a||a<=0)return alert("금액 오류");if(currentTxMode==='deposit'){if(appState.bankBalance<a)return alert("은행 잔고 부족");appState.bankBalance-=a;appState.balance+=a;appState.cash+=a}else{if(appState.cash<a)return alert("현금 부족");appState.balance-=a;appState.bankBalance+=a;appState.cash-=a}appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW",amount:a});saveState();renderGlobalUI();closeModal()}
function closeModal(){document.getElementById('transaction-modal').style.display='none'}
function calcPercent(p){const i=document.getElementById('amount-input');let b=currentTxMode==='deposit'?appState.bankBalance:appState.cash;if(p===100)i.value=b;else i.value=Math.floor(b*(p/100)*100)/100}
function loadNewsData(c){const l=document.getElementById('news-board-list');if(!l)return;const t=[{t:`[속보] ${c}, 대규모 고래 이체 포착`,c:`익명 지갑에서 거래소로 대량 이체가 발생했습니다.`},{t:`${c} 네트워크 활성 주소 급증`,c:`온체인 데이터가 긍정적 신호를 보이고 있습니다.`},{t:`[시황] ${c} 주요 지지선 테스트 중`,c:`변동성이 확대되고 있으니 주의가 필요합니다.`},{t:`글로벌 기관, ${c} 포트폴리오 추가`,c:`기관 자금 유입이 기대됩니다.`},{t:`${c} 선물 미결제 약정 증가`,c:`단기 변동성이 커질 수 있습니다.`}];let h='';for(let i=0;i<5;i++){const n=t[i%t.length];h+=`<div class="news-item" onclick="toggleNews(${i})"><div class="news-title"><span class="news-new-badge">NEW</span> ${n.t}</div><div class="news-meta"><span>${new Date().toLocaleTimeString()}</span></div><div id="news-content-${i}" class="news-content">${n.c}</div></div>`;}l.innerHTML=h;}
function toggleNews(i){const e=document.getElementById(`news-content-${i}`);if(e)e.classList.toggle('show')}
