/* pro-script.js - V19.0 (코인별 맞춤 가격 & 금액 반영) */
let appState = {
    balance: 50000.00, bankBalance: 1000000.00, startBalance: 50000.00,
    tradeHistory: [], dataCount: 425102, config: {}, isRealMode: false,
    isRunning: true
};
let autoTradeInterval = null;
let dataCounterInterval = null;

window.addEventListener('load', () => {
    loadState();
    highlightMenu();
    renderGlobalUI();
    
    // 차트가 있는 메인 화면이면 소켓 연결
    if (document.getElementById('tv_chart')) initWebSocket();

    if(appState.isRunning) startSystem(true);
    startDataCounter();
    setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
});

/* --- 시스템 제어 --- */
function startSystem(isSilent = false) {
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true;
    autoTradeInterval = setInterval(() => { executeAiTrade(appState.config); }, 1000); 
    startDataCounter();
    updateButtonState(true);
    if(!isSilent) console.log("System Started");
}

function stopSystem(isSilent = false) {
    appState.isRunning = false;
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    updateButtonState(false);
    if(!isSilent) console.log("System Stopped");
    saveState();
}

function updateButtonState(isOn) {
    const btn = document.querySelector('.btn-start');
    if(btn) {
        btn.style.opacity = isOn ? "1" : "0.5";
        btn.innerHTML = isOn ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START';
    }
}

/* --- [핵심] AI 트레이딩 로직 --- */
function executeAiTrade(config) {
    if(!appState.isRunning) return;
    
    // 1. 설정값 가져오기
    const targetPair = config.target || "BTC/USDT";
    const symbol = targetPair.split('/')[0]; // "BTC" 추출
    const tradeAmt = parseFloat(config.amount) || 10000; // 설정된 금액 사용 (없으면 만원)

    // 2. 이자 지급
    if(appState.bankBalance > 0) appState.bankBalance += (appState.bankBalance * 0.0000008);

    // 3. 승패 및 수익 계산
    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 0.8) + 0.1; // 0.1% ~ 0.9% 변동
    const pnl = isWin ? (tradeAmt * (percent / 100)) : -(tradeAmt * (percent / 100) * 0.6);
    
    appState.balance += pnl;
    if(isNaN(appState.balance)) appState.balance = 50000;

    // 4. [NEW] 코인별 리얼한 가격 생성
    const currentPrice = getRealisticPrice(symbol);
    const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    
    // 5. [NEW] 포지션 명칭 조합 (예: BTC LONG)
    const positionLabel = `${symbol} ${direction}`;

    const now = new Date();
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: positionLabel, // "BTC LONG" 저장
        in: currentPrice, 
        profit: pnl
    });
    
    if(appState.tradeHistory.length > 500) appState.tradeHistory.pop();
    appState.dataCount++;
}

// [NEW] 코인별 가격 생성기 (단위 맞춤)
function getRealisticPrice(symbol) {
    const jitter = Math.random();
    switch(symbol) {
        case 'BTC': return 96000 + (jitter * 500);  // 9만불 대
        case 'ETH': return 2700 + (jitter * 20);    // 2700불 대
        case 'SOL': return 180 + (jitter * 5);      // 180불 대
        case 'XRP': return 2.4 + (jitter * 0.1);    // 2.4불 대
        case 'DOGE': return 0.28 + (jitter * 0.01); // 0.28불 대
        default: return 100 + (jitter * 10);
    }
}

/* --- 렌더링 --- */
function renderGlobalUI() {
    const totalAssets = appState.balance + (appState.bankBalance || 0);
    const els = {
        total: document.getElementById('total-val'),
        bal: document.getElementById('real-balance'),
        bank: document.getElementById('bank-balance-display'),
        prof: document.getElementById('real-profit')
    };

    if(els.total) els.total.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        els.prof.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }
    
    // 리스트 그리기
    const mainList = document.getElementById('main-ledger-list');
    const walletList = document.getElementById('wallet-history-list');
    if(mainList) renderList(mainList, appState.tradeHistory);
    if(walletList) renderList(walletList, appState.tradeHistory);
    
    // 은행 리스트
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) {
        let html = '';
        appState.transfers.forEach(t => {
            html += `<div class="ledger-row">
                <div style="width:30%" class="ledger-date">${t.date.split(' ')[0]}</div>
                <div style="width:30%; font-weight:bold;">${t.type}</div>
                <div style="width:40%; text-align:right;" class="ledger-price">$${t.amount.toLocaleString()}</div>
            </div>`;
        });
        bankList.innerHTML = html;
    }
}

// [수정] 공통 리스트 렌더러 (포지션 색상 로직 개선)
function renderList(el, data) {
    let html = '';
    data.slice(0, 50).forEach(t => {
        const pnlColor = t.profit >= 0 ? 'text-green' : 'text-red';
        // 포지션 글자에 LONG이 있으면 초록, SHORT면 빨강
        const posColor = t.pos.includes('LONG') ? 'text-green' : 'text-red';
        
        html += `<div class="ledger-row">
            <div style="width:25%" class="ledger-date">${t.date}<br><span style="color:#666">${t.time}</span></div>
            <div style="width:25%" class="ledger-pos ${posColor}">${t.pos}</div>
            <div style="width:25%" class="ledger-price">${t.in.toLocaleString(undefined, {maximumFractionDigits:2})}</div>
            <div style="width:25%" class="ledger-pnl ${pnlColor}">${t.profit.toFixed(2)}</div>
        </div>`;
    });
    el.innerHTML = html;
}

/* --- 유틸 --- */
function startDataCounter() {
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    dataCounterInterval = setInterval(() => {
        appState.dataCount += Math.floor(Math.random() * 5);
        const el = document.getElementById('data-mining-counter');
        if(el) el.innerText = appState.dataCount.toLocaleString();
    }, 50);
}
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function loadState() {
    try {
        const data = localStorage.getItem('neuroBotData');
        if (data) { 
            const parsed = JSON.parse(data);
            appState = {...appState, ...parsed};
            if(isNaN(appState.balance)) appState.balance = 50000;
        }
    } catch(e) {}
}
function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active');
        else el.classList.remove('active');
    });
}
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; new TradingView.widget({"container_id":"modal_tv_chart","symbol":"BINANCE:BTCUSDT","interval":"1","theme":"dark","style":"1","locale":"en","toolbar_bg":"#000","enable_publishing":false,"hide_side_toolbar":false,"autosize":true}); }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; document.getElementById('modal_tv_chart').innerHTML=''; }
function handleEnter(e) { if(e.key==='Enter') openChartModal(); }
function initWebSocket() { socket = new WebSocket(BINANCE_WS_URL); socket.onmessage = (e) => { const d=JSON.parse(e.data); const el=document.getElementById('coin-price'); if(el) { el.innerText=parseFloat(d.p).toLocaleString(); el.style.color=!d.m?'#0ecb81':'#f6465d'; } }; }
function openModal(mode) { document.getElementById('transaction-modal').style.display='flex'; }
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }
function exportLogs() { /* 생략 */ }
