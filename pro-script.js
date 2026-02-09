/* pro-script.js - V17.0 (무소음 패치: 팝업 제거) */
let appState = {
    balance: 50000.00, bankBalance: 1000000.00, startBalance: 50000.00,
    tradeHistory: [], dataCount: 425102, config: {}, isRealMode: false,
    isRunning: true // 기본값: 켜짐
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

    renderGlobalUI();
    
    // [중요] 페이지 로드 시, 팝업 없이 조용히 엔진 가동
    if(appState.isRunning) {
        startSystem(true); // true = 조용히 시작 (Silent Mode)
    } else {
        stopSystem(true);
    }
});

// [수정됨] 시스템 시작 (팝업 제거됨)
function startSystem(isSilent = false) {
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true;
    autoTradeInterval = setInterval(() => { executeAiTrade(appState.config); }, 1000); 
    startDataCounter();
    
    // 버튼 상태 업데이트
    const btn = document.querySelector('.btn-start');
    if(btn) { btn.style.opacity = "1"; btn.innerHTML = '<i class="fas fa-play"></i> RUNNING'; }
    
    // [핵심] 사용자가 직접 누른 게 아니면 알림창 띄우지 않음
    if(!isSilent) {
        // alert("SYSTEM STARTED"); // <--- 이 줄을 삭제하여 팝업 차단
        console.log("System Started Silently");
    }
}

// [수정됨] 시스템 정지
function stopSystem(isSilent = false) {
    appState.isRunning = false;
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    
    const btn = document.querySelector('.btn-start');
    if(btn) { btn.style.opacity = "0.5"; btn.innerHTML = '<i class="fas fa-play"></i> START'; }

    if(!isSilent) {
        // alert("SYSTEM STOPPED"); // <--- 이 줄도 삭제
        console.log("System Stopped Silently");
    }
    saveState();
}

function startDataCounter() {
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    dataCounterInterval = setInterval(() => {
        appState.dataCount += Math.floor(Math.random() * 5);
        if(document.getElementById('data-mining-counter')) 
            document.getElementById('data-mining-counter').innerText = appState.dataCount.toLocaleString();
    }, 50);
}

// 렌더링
function renderGlobalUI() {
    const totalAssets = appState.balance + (appState.bankBalance || 0);
    const els = {
        total: document.getElementById('total-val'),
        bal: document.getElementById('real-balance'),
        bank: document.getElementById('bank-balance-display')
    };

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
    if(!appState.isRunning) return; 
    
    if(appState.bankBalance > 0) appState.bankBalance += (appState.bankBalance * 0.0000008);

    const isWin = Math.random() > 0.48; 
    const amt = config.amount || 1000;
    const percent = (Math.random() * 0.8) + 0.1; 
    const pnl = isWin ? (amt * (percent / 100)) : -(amt * (percent / 100) * 0.6);
    
    appState.balance += pnl;
    if(isNaN(appState.balance)) appState.balance = 50000;

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
            appState = {...appState, ...parsed}; 
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
function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active');
    });
}
function exportLogs() { /* 생략 */ }
