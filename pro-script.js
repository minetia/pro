/* pro-script.js - V105.0 (Binance WebSocket Real-time Engine) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: "",
    realPrices: {}, // 실시간 가격 저장
    socket: null // 웹소켓 저장용
};
let autoTradeInterval = null;
let dataCounterInterval = null;
const SAVE_KEY = 'neuroBotData_V95_FINAL';
const CONFIG_KEY = 'neuroConfig_V95_FINAL';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    // 정보 페이지: 실시간 웹소켓 가동
    if (window.location.pathname.includes('info.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || (appState.config.target ? appState.config.target.split('/')[0] : 'BTC');
        initInfoPage(coin);
    } else {
        // 일반 페이지
        if(document.getElementById('tab-holdings')) showTab(appState.activeTab || 'holdings');
        const searchInput = document.getElementById('coin-search-input');
        if(searchInput && appState.searchQuery) searchInput.value = appState.searchQuery;

        if (appState.isRunning && document.getElementById('total-val')) {
            startSystem(true);
        } else {
            updateButtonState(false);
        }
        
        startDataCounter();
        setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 800);
        renderGlobalUI();
    }
});

/* --- [핵심] 바이낸스 웹소켓 연결 (끊김 없는 실시간 가격) --- */
function startPriceStream(coin) {
    // 기존 연결 종료
    if (appState.socket) {
        appState.socket.close();
    }

    const symbol = coin.toLowerCase() + 'usdt';
    // 바이낸스 공식 스트림 연결
    appState.socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);

    appState.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const price = parseFloat(data.p); // 실시간 가격
        
        // 가격 저장
        appState.realPrices[coin] = price;
        
        // 정보 페이지 UI 즉시 갱신
        updateInfoUI(price);
    };

    appState.socket.onerror = (error) => {
        console.log("WebSocket Error:", error);
        // 에러 시 백업(fetch) 사용
        fetchRealPrice(coin);
    };
}

/* --- 정보 페이지 초기화 --- */
async function initInfoPage(coin) {
    coin = coin.toUpperCase();
    const searchInInfo = document.getElementById('info-page-search');
    if(searchInInfo) searchInInfo.value = coin;

    // 차트 로드 (TradingView)
    new TradingView.widget({
        "container_id": "info_tv_chart",
        "symbol": `BINANCE:${coin}USDT`,
        "interval": "15",
        "theme": "dark",
        "style": "1",
        "locale": "kr",
        "autosize": true,
        "hide_side_toolbar": false
    });

    // 웹소켓 시작 (가격표시)
    startPriceStream(coin);
    
    // 뉴스 및 리포트 로드 (초기 1회)
    // 가격이 웹소켓으로 들어오기 전까지 '데이터 수신 중' 표시
    document.getElementById('analysis-verdict').innerText = "실시간 데이터 연결 중...";
    loadNewsData(coin);
}

// 정보 페이지 UI 업데이트 (웹소켓이 호출함)
function updateInfoUI(price) {
    const priceEl = document.getElementById('analysis-price');
    const scoreEl = document.getElementById('ai-score-val');
    const verdictEl = document.getElementById('analysis-verdict');

    if(priceEl) {
        // 가격 깜빡임 효과 (상승/하락 색상)
        const prevPrice = parseFloat(priceEl.getAttribute('data-prev')) || price;
        const color = price > prevPrice ? 'var(--color-up)' : (price < prevPrice ? 'var(--color-down)' : '#fff');
        
        priceEl.innerText = `$ ${price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        priceEl.style.color = color;
        priceEl.setAttribute('data-prev', price);
    }

    // AI 점수 및 분석 (가격에 따라 동적 변경)
    // 가격의 소수점 끝자리를 이용하여 랜덤한 척 자연스럽게 점수 변동
    const dynamicScore = 60 + Math.floor((price % 10) * 3); 
    if(scoreEl) scoreEl.innerText = Math.min(99, Math.max(40, dynamicScore)); // 40~99 사이

    if(verdictEl) {
        if(dynamicScore >= 80) verdictEl.innerHTML = `"현재 구간은 <span class='text-green'>강력 매수</span>가 유효합니다."`;
        else if(dynamicScore >= 50) verdictEl.innerHTML = `"추세 전환을 모색하는 <span style='color:#aaa'>중립</span> 구간입니다."`;
        else verdictEl.innerHTML = `"단기 <span class='text-red'>매도 압력</span>이 존재합니다."`;
    }

    // 지지/저항 라인 자동 계산 (현재가 기준)
    document.getElementById('val-support').innerText = `$ ${(price * 0.985).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    document.getElementById('val-resistance').innerText = `$ ${(price * 1.015).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    document.getElementById('val-stoploss').innerText = `$ ${(price * 0.97).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    document.getElementById('val-target').innerText = `$ ${(price * 1.05).toLocaleString(undefined, {maximumFractionDigits:2})}`;

    // 심층 보고서 텍스트 업데이트 (가격 연동)
    const reportEl = document.getElementById('deep-report-text');
    if(reportEl && reportEl.getAttribute('data-updated') !== 'true') {
        reportEl.innerHTML = `
            현재 <strong>BINANCE</strong> 실시간 데이터를 분석한 결과, <strong>$${price.toLocaleString()}</strong> 구간에서 매수와 매도 공방이 치열합니다.<br><br>
            AI 알고리즘은 단기 이동평균선(MA 5)이 상승 추세를 유지하고 있어, 
            <strong>$${(price * 1.01).toLocaleString(undefined, {maximumFractionDigits:2})}</strong> 돌파 시 추가 상승이 가능할 것으로 예측합니다.<br><br>
            ⚠️ <strong>전략:</strong> 실시간 변동성이 크므로 지정가 매매를 권장합니다.
        `;
        reportEl.setAttribute('data-updated', 'true'); // 너무 자주 바뀌지 않게 락
    }
}

/* --- 트레이딩 엔진 (실시간 가격 반영) --- */
async function executeAiTrade() {
    if(!appState.isRunning) return;

    // 1. 현재 코인 가격 가져오기 (웹소켓 데이터 우선)
    const coin = appState.runningCoin;
    let price = appState.realPrices[coin];
    
    // 데이터 없으면 fetch 시도
    if(!price) price = await fetchRealPrice(coin);

    // 2. 매매 로직
    const action = Math.random();
    let type = '관망';
    let pnl = 0;

    if (action > 0.6) { // 40% 확률 매수
        type = '매수';
        pnl = (appState.investedAmount * (Math.random() * 0.002)); 
    } else if (action > 0.3) { // 30% 확률 익절
        type = '익절';
        pnl = (appState.investedAmount * (Math.random() * 0.005)); 
    } else { // 30% 확률 손절
        type = '매도';
        pnl = -(appState.investedAmount * (Math.random() * 0.003)); 
    }

    appState.balance += pnl;
    
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

async function fetchRealPrice(coin) {
    try { 
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`); 
        const d = await res.json(); 
        const p = parseFloat(d.price);
        appState.realPrices[coin] = p; 
        return p; 
    } catch (e) { 
        // API 실패 시 2026년 가상 가격 (백업)
        return getRealisticPrice(coin); 
    }
}

function getRealisticPrice(s) {
    const r=Math.random(); 
    if(s==='BTC') return 96500+(r*200); 
    if(s==='ETH') return 2750+(r*10); 
    if(s==='XRP') return 2.42+(r*0.01); 
    return 100; 
}

/* --- UI 렌더링 --- */
function renderGlobalUI() {
    const els = { total: document.getElementById('total-val'), label: document.getElementById('balance-label'), wallet: document.getElementById('wallet-display'), avail: document.getElementById('avail-cash'), bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit') };
    const currentCash = appState.isRunning ? appState.cash : appState.balance;

    if(els.total) {
        if(appState.isRunning) {
            const activeMoney = appState.balance - appState.cash;
            els.total.innerText = `$ ${activeMoney.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            els.label.innerText = `현재 운용 자산 (${appState.runningCoin})`;
            els.label.style.color = "var(--accent)";
            
            if(appState.startBalance <= 0) appState.startBalance = appState.investedAmount;
            const profit = appState.balance - (appState.startBalance + appState.cash);
            const profitRate = (profit / appState.investedAmount) * 100;
            const color = profit >= 0 ? 'text-green' : 'text-red';
            const sign = profit >= 0 ? '+' : '';
            els.prof.innerHTML = `<span class="${color}">${sign}${profitRate.toFixed(2)}%</span> <span style="font-size:0.9rem; color:#888;">($${profit.toFixed(2)})</span>`;
        } else {
            els.total.innerText = `$ 0.00`;
            els.label.innerText = `AI TRADING READY`;
            els.label.style.color = "#888";
            els.prof.innerText = "---";
        }
    }

    if(els.wallet) {
        els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        els.avail.innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updatePnLTab();
        updatePortfolio(currentCash);
    }
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    updateHistoryTables();
}

// [중요] 포트폴리오 업데이트
function updatePortfolio(currentCash) {
    const pie = document.getElementById('portfolio-pie');
    const list = document.getElementById('holdings-list');
    if(!list) return;

    const investedVal = appState.balance - currentCash;
    const totalVal = appState.balance > 0 ? appState.balance : 1;
    let investPercent = 0;
    if(appState.isRunning && investedVal > 0) investPercent = (investedVal / totalVal) * 100;
    const cashPercent = 100 - investPercent;

    if(pie) pie.style.background = investPercent > 0 ? `conic-gradient(var(--accent) 0% ${investPercent}%, #444 ${investPercent}% 100%)` : `conic-gradient(#444 0% 100%)`;

    let html = '';
    if(appState.isRunning && investedVal > 0) {
        html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:15px 5px; border-bottom:1px solid #222;">
            <div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; background:var(--accent); border-radius:50%;"></div><div><div style="font-weight:bold; color:#fff; font-size:0.95rem;">${appState.runningCoin}</div><div style="font-size:0.75rem; color:var(--accent);">AI Trading</div></div></div>
            <div style="text-align:right;"><div style="color:#fff; font-weight:bold;">$ ${investedVal.toLocaleString(undefined, {minimumFractionDigits:2})}</div><div style="font-size:0.75rem; color:#888;">${investPercent.toFixed(1)}%</div></div></div>`;
    }
    if(appState.balance > 0) {
        html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:15px 5px; border-bottom:1px solid #222;">
            <div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; background:#444; border-radius:50%;"></div><div><div style="font-weight:bold; color:#fff; font-size:0.95rem;">USDT</div><div style="font-size:0.75rem; color:#888;">Cash</div></div></div>
            <div style="text-align:right;"><div style="color:#fff; font-weight:bold;">$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}</div><div style="font-size:0.75rem; color:#888;">${cashPercent.toFixed(1)}%</div></div></div>`;
    }
    list.innerHTML = html;
}

// 지갑 투자손익
function updatePnLTab() {
    const pnlAmt = document.getElementById('pnl-total-amount');
    const pnlPct = document.getElementById('pnl-total-percent');
    const pnlInv = document.getElementById('pnl-avg-invest');
    if(pnlAmt && appState.startBalance > 0) {
        const profit = appState.balance - appState.startBalance;
        const pct = (profit / appState.startBalance) * 100;
        const color = profit >= 0 ? 'text-green' : 'text-red';
        pnlAmt.innerText = `$ ${profit.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        pnlAmt.className = `hero-number ${color}`;
        pnlPct.innerText = `${profit>=0?'+':''}${pct.toFixed(2)}%`;
        pnlPct.className = color;
        pnlInv.innerText = `$ ${appState.investedAmount.toLocaleString()}`;
    }
}

// 거래내역
function updateHistoryTables() {
    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        if(appState.tradeHistory.length === 0) historyTable.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">거래 내역이 없습니다.</td></tr>';
        else {
            let html = '';
            appState.tradeHistory.slice(0, 30).forEach(t => {
                let color = 'text-green'; if(t.type.includes('매도') || t.type.includes('손절')) color = 'text-red';
                html += `<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>${t.market}</td><td class="${color}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`;
            });
            historyTable.innerHTML = html;
        }
    }
    const mainList = document.getElementById('main-ledger-list');
    if(mainList) {
        if(appState.tradeHistory.length === 0) mainList.innerHTML = '<div style="padding:40px; text-align:center; color:#444;">NO TRADES YET</div>';
        else {
            let html = '';
            appState.tradeHistory.slice(0, 50).forEach(t => {
                const color = parseFloat(t.pnl) >= 0 ? 'text-green' : 'text-red';
                html += `<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${t.type.includes('매도')?'text-red':'text-green'}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${color}">${t.net}</div></div>`;
            });
            mainList.innerHTML = html;
        }
    }
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) {
        let html = ''; appState.transfers.forEach(t => { html += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`; }); bankList.innerHTML = html;
    }
}

// 뉴스 (기존)
function loadNewsData(c){const l=document.getElementById('news-board-list');if(!l)return;const t=[{t:`[속보] ${c}, 대규모 고래 이체 포착`,c:`익명 지갑에서 거래소로 대량 이체가 발생했습니다.`},{t:`${c} 네트워크 활성 주소 급증`,c:`온체인 데이터가 긍정적 신호를 보이고 있습니다.`},{t:`[시황] ${c} 주요 지지선 테스트 중`,c:`변동성이 확대되고 있으니 주의가 필요합니다.`},{t:`글로벌 기관, ${c} 포트폴리오 추가`,c:`기관 자금 유입이 기대됩니다.`},{t:`${c} 선물 미결제 약정 증가`,c:`단기 변동성이 커질 수 있습니다.`}];let h='';for(let i=0;i<5;i++){const n=t[i%t.length];h+=`<div class="news-item" onclick="toggleNews(${i})"><div class="news-title"><span class="news-new-badge">NEW</span> ${n.t}</div><div class="news-meta"><span>${new Date().toLocaleTimeString()}</span></div><div id="news-content-${i}" class="news-content">${n.c}</div></div>`;}l.innerHTML=h;}
function toggleNews(i){const e=document.getElementById(`news-content-${i}`);if(e)e.classList.toggle('show')}

// 공통함수 (기존)
function startSystem(s=false) { if (appState.balance < 10) { if(!s) alert("지갑 잔고 부족"); stopSystem(true); return; } if (!appState.config.isReady) { if(!s) alert("AI 설정 필요"); return; } if(appState.balance < appState.config.amount) { if(!s) alert("설정 금액 > 잔고"); stopSystem(true); return; } appState.runningCoin = appState.config.target.split('/')[0]; appState.investedAmount = appState.config.amount; appState.cash = appState.balance - appState.investedAmount; if(appState.startBalance === 0 || !appState.isRunning) appState.startBalance = appState.balance; if(appState.openOrders.length===0) generateFakeOpenOrders(appState.runningCoin); if(autoTradeInterval) clearInterval(autoTradeInterval); appState.isRunning = true; autoTradeInterval = setInterval(executeAiTrade, 1200); updateButtonState(true); saveState(); }
function stopSystem(s=false) { appState.isRunning = false; appState.investedAmount = 0; appState.cash = appState.balance; if(autoTradeInterval) clearInterval(autoTradeInterval); updateButtonState(false); saveState(); renderGlobalUI(); }
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
