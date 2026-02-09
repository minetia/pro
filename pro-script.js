/* pro-script.js - V16.0 (버튼 부활 & 폰트 최적화) */
let appState = {
    balance: 50000.00, bankBalance: 1000000.00, startBalance: 50000.00,
    tradeHistory: [], dataCount: 425102, config: {}, isRealMode: false,
    isRunning: true // 시스템 가동 상태
};
let autoTradeInterval = null;
let dataCounterInterval = null;

window.addEventListener('load', () => {
    loadState();
    
    // 헤더 로드
    fetch('header.html').then(r => r.text()).then(d => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) { slot.innerHTML = d; highlightMenu(); }
    });

    // 즉시 렌더링 (Loading 제거)
    renderGlobalUI();
    
    // 자동 시작
    if(appState.isRunning) startSystem();
    else stopSystem(); // 꺼진 상태면 멈춤 유지
});

// [NEW] 시스템 제어 함수
function startSystem() {
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true;
    autoTradeInterval = setInterval(() => { executeAiTrade(appState.config); }, 1000); // 1초 간격
    startDataCounter();
    alert("SYSTEM STARTED: AI ENGINE ONLINE");
}

function stopSystem() {
    appState.isRunning = false;
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    alert("SYSTEM STOPPED: ENGINE OFFLINE");
}

function startDataCounter() {
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    dataCounterInterval = setInterval(() => {
        appState.dataCount += Math.floor(Math.random() * 5);
        if(document.getElementById('data-mining-counter')) 
            document.getElementById('data-mining-counter').innerText = appState.dataCount.toLocaleString();
    }, 50);
}

// 렌더링 (숫자 포맷)
function renderGlobalUI() {
    const totalAssets = appState.balance + (appState.bankBalance || 0);
    const els = {
        total: document.getElementById('total-val'),
        bal: document.getElementById('real-balance'),
        bank: document.getElementById('bank-balance-display')
    };

    // 소수점 2자리까지만 표시해서 길이 줄임
    if(els.total) els.total.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;

    const profEl = document.getElementById('real-profit');
    if(profEl) {
        const profit = appState.balance - appState.startBalance;
        const arrow = profit >= 0 ? '▲' : '▼';
        profEl.innerText = `${arrow} $${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits:2})}`;
        profEl.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }
    renderMainLedger();
}

function renderMainLedger() {
    const listArea = document.getElementById('main-ledger-list');
    if(!listArea) return;
    let html = '';
    appState.tradeHistory.slice(0, 50).forEach(t => {
        const pnlClass = t.profit >= 0 ? 'text-green' : 'text-red';
        html += `<div class="ledger-row">
            <div style="width:25%" class="ledger-date">${t.date}<br><span style="color:#666">${t.time}</span></div>
            <div style="width:25%" class="ledger-pos ${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</div>
            <div style="width:25%" class="ledger-price">${t.in.toFixed(0)}</div>
            <div style="width:25%" class="ledger-pnl ${pnlClass}">${t.profit.toFixed(2)}</div>
        </div>`;
    });
    listArea.innerHTML = html;
}

function executeAiTrade(config) {
    if(!appState.isRunning) return; // 멈췄으면 실행 안함
    
    // 이자 지급
    if(appState.bankBalance > 0) appState.bankBalance += (appState.bankBalance * 0.0000008);

    const isWin = Math.random() > 0.48; 
    const amt = config.amount || 1000;
    const percent = (Math.random() * 0.8) + 0.1; 
    const pnl = isWin ? (amt * (percent / 100)) : -(amt * (percent / 100) * 0.6);
    
    appState.balance += pnl;
    if(isNaN(appState.balance)) appState.balance = 50000; // NaN 방지

    const currentPrice = 69000 + (Math.random() * 1000);
    const pos = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const now = new Date();
    
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: pos, in: currentPrice, out: currentPrice + (isWin ? 50 : -50), profit: pnl, win: isWin
    });
    
    if(appState.tradeHistory.length > 500) appState.tradeHistory.pop();
    appState.dataCount++;
    
    saveState();
    renderGlobalUI();
}

/* --- 공통 유틸 --- */
function loadState() {
    try {
        const data = localStorage.getItem('neuroBotData');
        if (data) { 
            const parsed = JSON.parse(data);
            appState = {...appState, ...parsed}; // 병합
            if(isNaN(appState.balance)) appState.balance = 50000;
        }
    } catch(e) { localStorage.removeItem('neuroBotData'); }
}
function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function openChartModal() {
    document.getElementById('chart-modal').style.display = 'flex';
    new TradingView.widget({
        "container_id": "modal_tv_chart", "symbol": "BINANCE:BTCUSDT", "interval": "1", "theme": "dark", "style": "1", "locale": "en", "toolbar_bg": "#000", "enable_publishing": false, "hide_side_toolbar": false, "autosize": true
    });
}
function closeChartModal() { document.getElementById('chart-modal').style.display = 'none'; document.getElementById('modal_tv_chart').innerHTML = ''; }
function handleEnter(e) { if(e.key === 'Enter') openChartModal(); }
function highlightMenu() { /* 생략 */ }
function exportLogs() { /* 생략 */ }
