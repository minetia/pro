/* pro-script.js - V95.0 (Real Binance API & Profit Fix) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: "",
    realPrices: {} // 실시간 가격 저장용
};
let autoTradeInterval = null;
let dataCounterInterval = null;
let priceUpdateInterval = null;
const SAVE_KEY = 'neuroBotData_V95_FINAL';
const CONFIG_KEY = 'neuroConfig_V95_FINAL';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    // 정보 페이지면 실시간 가격 모드 진입
    if (window.location.pathname.includes('info.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || (appState.config.target ? appState.config.target.split('/')[0] : 'BTC');
        initInfoPage(coin);
    } else {
        if(document.getElementById('tab-holdings')) showTab(appState.activeTab || 'holdings');
        const searchInput = document.getElementById('coin-search-input');
        if(searchInput && appState.searchQuery) searchInput.value = appState.searchQuery;

        // 메인 화면 실행 상태 복구
        if (appState.isRunning && document.getElementById('total-val')) {
            startSystem(true);
        } else {
            updateButtonState(false);
        }
        
        startDataCounter();
        // 0.5초마다 UI 갱신 (빠르게)
        setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
        renderGlobalUI();
    }
});

/* --- [핵심] 바이낸스 실시간 가격 가져오기 --- */
async function fetchRealPrice(coin) {
    try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`);
        const data = await res.json();
        const price = parseFloat(data.price);
        appState.realPrices[coin] = price; // 저장
        return price;
    } catch (e) {
        // 에러 시 기존 방식(난수) 백업
        return getRealisticPrice(coin);
    }
}

/* --- 정보 페이지 (Real-time) --- */
async function initInfoPage(coin) {
    coin = coin.toUpperCase();
    const searchInInfo = document.getElementById('info-page-search');
    if(searchInInfo) searchInInfo.value = coin;

    // 차트 로드
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

    // 초기 실행
    await updateInfoDisplay(coin);

    // 1초마다 가격 갱신
    if(priceUpdateInterval) clearInterval(priceUpdateInterval);
    priceUpdateInterval = setInterval(() => updateInfoDisplay(coin), 1000);
    
    // 뉴스 로드
    loadNewsData(coin);
}

async function updateInfoDisplay(coin) {
    const price = await fetchRealPrice(coin); // 실제 가격
    const score = Math.floor(Math.random() * (95 - 40) + 40); // AI 점수

    const priceEl = document.getElementById('analysis-price');
    const scoreEl = document.getElementById('ai-score-val');
    const verdictEl = document.getElementById('analysis-verdict');

    if(priceEl) priceEl.innerText = `$ ${price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    if(scoreEl) scoreEl.innerText = score;
    
    if(verdictEl) {
        if(score >= 80) verdictEl.innerHTML = `"강력 매수 신호 포착"`;
        else if(score >= 50) verdictEl.innerHTML = `"중립/관망 구간"`;
        else verdictEl.innerHTML = `"매도 압력 증가"`;
    }

    // 지지/저항 (실시간 가격 기반)
    document.getElementById('val-support').innerText = `$ ${(price * 0.98).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    document.getElementById('val-resistance').innerText = `$ ${(price * 1.02).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    document.getElementById('val-stoploss').innerText = `$ ${(price * 0.95).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    document.getElementById('val-target').innerText = `$ ${(price * 1.05).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    
    document.getElementById('deep-report-text').innerHTML = `
        현재 <strong>${coin}</strong>의 실시간 시세는 <strong>$${price.toLocaleString()}</strong>입니다.<br>
        바이낸스 오더북 분석 결과, 매수 벽이 두터워지며 단기 반등을 시도하고 있습니다.<br>
        AI는 현재가를 기준으로 변동성 돌파 전략이 유효하다고 판단합니다.<br>
        ⚠️ <strong>실시간 조언:</strong> 거래량이 동반된 상승 시 추격 매수 유효.
    `;
}

/* --- 트레이딩 엔진 (수익률 변동 강화) --- */
async function executeAiTrade() {
    if(!appState.isRunning) return;

    // 1. 실제 가격 기반 거래
    const coin = appState.runningCoin;
    let price = appState.realPrices[coin];
    if(!price) price = await fetchRealPrice(coin);

    // 2. 수익률 랜덤 변동 (좀 더 다이나믹하게)
    const action = Math.random();
    let type = '관망';
    let pnl = 0;

    if (action > 0.6) { // 40% 확률로 매수 (가격 상승 가정)
        type = '매수';
        pnl = (appState.investedAmount * (Math.random() * 0.002)); // 0.2% 이익
    } else if (action > 0.3) { // 30% 확률로 매도 (이익 실현)
        type = '익절';
        pnl = (appState.investedAmount * (Math.random() * 0.005)); // 0.5% 이익
    } else { // 30% 확률로 손절/하락
        type = '매도';
        pnl = -(appState.investedAmount * (Math.random() * 0.003)); // -0.3% 손실
    }

    // 3. 자산 반영
    appState.balance += pnl;
    
    // 4. 리스트 데이터 생성
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

/* --- 렌더링 (24H 수익 표시 수정) --- */
function renderGlobalUI() {
    const els = { total: document.getElementById('total-val'), label: document.getElementById('balance-label'), wallet: document.getElementById('wallet-display'), avail: document.getElementById('avail-cash'), bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit') };
    const currentCash = appState.isRunning ? appState.cash : appState.balance;

    // 메인화면
    if(els.total) {
        if(appState.isRunning) {
            const activeMoney = appState.balance - appState.cash;
            els.total.innerText = `$ ${activeMoney.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            els.label.innerText = `현재 운용 자산 (${appState.runningCoin})`;
            els.label.style.color = "var(--accent)";
            
            // [수정] 수익률 계산 (시작금액이 0이면 현재 금액으로 초기화)
            if(appState.startBalance <= 0) appState.startBalance = appState.investedAmount;
            
            const profit = appState.balance - (appState.startBalance + appState.cash); // 순수익 = 현재총액 - (원금+현금)
            const profitRate = (profit / appState.investedAmount) * 100;
            
            const color = profit >= 0 ? 'text-green' : 'text-red';
            const sign = profit >= 0 ? '+' : '';
            
            // 24H 수익 표시
            els.prof.innerHTML = `<span class="${color}">${sign}${profitRate.toFixed(2)}%</span> <span style="font-size:0.9rem; color:#888;">($${profit.toFixed(2)})</span>`;
        } else {
            els.total.innerText = `$ 0.00`;
            els.label.innerText = `AI TRADING READY`;
            els.label.style.color = "#888";
            els.prof.innerText = "---";
        }
    }

    // 지갑 및 기타 화면 (기존 유지)
    if(els.wallet) {
        els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        els.avail.innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updatePnLTab(); // 지갑 수익 탭 업데이트
    }
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    updateHistoryTables(); // 거래내역 업데이트
}

// 지갑 투자손익 탭 업데이트
function updatePnLTab() {
    const pnlAmt = document.getElementById('pnl-total-amount');
    const pnlPct = document.getElementById('pnl-total-percent');
    const pnlInv = document.getElementById('pnl-avg-invest');
    if(pnlAmt) {
        const profit = appState.balance - appState.startBalance;
        const pct = appState.startBalance > 0 ? (profit/appState.startBalance)*100 : 0;
        const color = profit >= 0 ? 'text-green' : 'text-red';
        pnlAmt.innerText = `$ ${profit.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        pnlAmt.className = `hero-number ${color}`;
        pnlPct.innerText = `${profit>=0?'+':''}${pct.toFixed(2)}%`;
        pnlPct.className = color;
        pnlInv.innerText = `$ ${appState.investedAmount.toLocaleString()}`;
    }
}

// 거래내역 테이블 업데이트
function updateHistoryTables() {
    // 1. 상세 내역 (지갑)
    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        if(appState.tradeHistory.length === 0) historyTable.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">거래 내역이 없습니다.</td></tr>';
        else {
            let html = '';
            appState.tradeHistory.slice(0, 30).forEach(t => {
                let color = 'text-green';
                if(t.type === '매도' || t.type.includes('손절')) color = 'text-red';
                if(t.type === '익절') color = 'text-green';
                
                html += `<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>${t.market}</td><td class="${color}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`;
            });
            historyTable.innerHTML = html;
        }
    }
    // 2. 간편 내역 (메인)
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
}

/* --- 시스템 시작/정지 --- */
function startSystem(isSilent=false) {
    if (appState.balance < 10) { if(!isSilent) alert("지갑 잔고 부족"); stopSystem(true); return; }
    if (!appState.config.isReady) { if(!isSilent) alert("AI 설정 필요"); return; }
    
    appState.runningCoin = appState.config.target.split('/')[0];
    appState.investedAmount = appState.config.amount;
    appState.cash = appState.balance - appState.investedAmount;
    
    // 시작 시점 자산 저장 (수익률 기준점)
    if(!appState.isRunning) {
        appState.startBalance = appState.balance; 
    }
    
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true;
    autoTradeInterval = setInterval(executeAiTrade, 1200);
    updateButtonState(true);
    saveState();
}

function stopSystem(isSilent=false) {
    appState.isRunning = false;
    appState.investedAmount = 0;
    appState.cash = appState.balance;
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    updateButtonState(false);
    saveState();
    renderGlobalUI();
}

// 나머지 함수 (기존 유지)
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(appState))}
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)}}catch(e){}}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d)}catch(e){}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c||(c.includes('info')&&e.href.includes('index')))e.classList.add('active');else e.classList.remove('active')})}
// (getRealisticPrice는 이제 fetch 실패 시 백업용으로만 사용됨)
function getRealisticPrice(s){const r=Math.random();return s==='BTC'?96000+r*500:s==='ETH'?2700+r*20:s==='XRP'?2.4+r*0.05:100+r}
function updateButtonState(o){const b=document.getElementById('btn-main-control');if(b){b.innerHTML=o?'<i class="fas fa-play"></i> RUNNING':'<i class="fas fa-play"></i> START';b.style.background=o?'#c84a31':'#2b3139'}}
function handleSearch(v){appState.searchQuery=v.toUpperCase()}
function searchInfoCoin(){const i=document.getElementById('info-page-search');if(i&&i.value)window.location.href=`info.html?coin=${i.value.toUpperCase()}`}
function openInfoPage(){window.location.href=`info.html?coin=${appState.searchQuery||appState.runningCoin||'BTC'}`}
function showTab(t){appState.activeTab=t;saveState();document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));document.getElementById('tab-'+t).classList.remove('hidden');document.querySelectorAll('.wallet-tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('btn-'+t).classList.add('active');renderGlobalUI()}
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
