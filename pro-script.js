/* pro-script.js - V15.0 (검색엔진 & 대형 장부 패치) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;
let autoTradeInterval = null;
let dataCounterInterval = null;

let appState = {
    balance: 50000.00,
    bankBalance: 1000000.00,
    startBalance: 50000.00,
    tradeHistory: [], 
    dataCount: 425102,
    config: {},
    isRealMode: false
};

window.addEventListener('load', () => {
    loadState();
    checkRealModeAndStart();

    // 메뉴바 복구
    fetch('header.html').then(r => r.text()).then(d => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) { slot.innerHTML = d; highlightMenu(); }
    });

    renderGlobalUI();
    
    // 0.5초 갱신
    setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
    startDataCounter();
});

// [NEW] 검색 및 차트 모달 열기
function handleEnter(e) { if(e.key === 'Enter') openChartModal(); }

function openChartModal() {
    const input = document.getElementById('coin-search-input');
    let symbol = input.value.toUpperCase().trim() || "BTC";
    if(!symbol.includes("USDT")) symbol += "USDT"; // 자동으로 USDT 붙임

    document.getElementById('chart-title').innerText = `${symbol} CHART`;
    document.getElementById('chart-modal').style.display = 'flex';

    // 트레이딩뷰 위젯 생성
    new TradingView.widget({
        "container_id": "modal_tv_chart",
        "symbol": `BINANCE:${symbol}`,
        "interval": "1",
        "timezone": "Asia/Seoul",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#000",
        "enable_publishing": false,
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "autosize": true
    });
}

function closeChartModal() {
    document.getElementById('chart-modal').style.display = 'none';
    document.getElementById('modal_tv_chart').innerHTML = ''; // 차트 초기화
}

// [핵심] 대형 장부 렌더링 (차트 대신 들어가는 곳)
function renderMainLedger() {
    const listArea = document.getElementById('main-ledger-list');
    if(!listArea) return;

    let html = '';
    // 최근 50개 내역 표시
    appState.tradeHistory.slice(0, 50).forEach(t => {
        const pnlClass = t.profit >= 0 ? 'text-green' : 'text-red';
        const pnlSign = t.profit >= 0 ? '+' : '';
        // 포지션 명칭 조합 (예: BTC LONG)
        const coinName = appState.config.target ? appState.config.target.split('/')[0] : 'BTC';
        const positionText = `${coinName} <span class="${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</span>`;

        html += `
        <div class="ledger-row">
            <div style="width:25%" class="ledger-date">
                ${t.date}<br><span style="color:#666">${t.time}</span>
            </div>
            <div style="width:25%" class="ledger-pos">${positionText}</div>
            <div style="width:25%" class="ledger-price">$${t.in.toLocaleString()}</div>
            <div style="width:25%" class="ledger-pnl ${pnlClass}">${pnlSign}$${t.profit.toFixed(2)}</div>
        </div>`;
    });
    listArea.innerHTML = html;
}

// UI 렌더링 통합
function renderGlobalUI() {
    const totalAssets = appState.balance + (appState.bankBalance || 0);
    
    // 자산 표시
    const elTotal = document.getElementById('total-val');
    const elProf = document.getElementById('real-profit');
    
    if(elTotal) elTotal.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    if(elProf) {
        const profit = appState.balance - appState.startBalance;
        const arrow = profit >= 0 ? '▲' : '▼';
        elProf.innerText = `${arrow} $${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits:2})}`;
        elProf.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }

    // 장부(리스트) 그리기
    renderMainLedger();
}

// AI 트레이딩 엔진 (데이터 생성)
function executeAiTrade(config) {
    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 0.8) + 0.1; 
    const pnl = isWin ? (parseFloat(config.amount) * (percent / 100)) : -(parseFloat(config.amount) * (percent / 100) * 0.6);
    appState.balance += pnl;

    const currentPrice = 69000 + (Math.random() * 1000);
    const pos = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const now = new Date();
    
    const newTrade = {
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: pos, 
        in: currentPrice, 
        out: currentPrice + (isWin ? 50 : -50), 
        profit: pnl, 
        win: isWin
    };

    appState.tradeHistory.unshift(newTrade);
    if(appState.tradeHistory.length > 2000) appState.tradeHistory.pop();
    appState.dataCount++;
}

/* --- 기본 함수 유지 --- */
function loadState() {
    try {
        const data = localStorage.getItem('neuroBotData');
        if (data) { 
            const parsed = JSON.parse(data);
            appState.balance = isNaN(parsed.balance) ? 50000 : parsed.balance;
            appState.bankBalance = isNaN(parsed.bankBalance) ? 1000000 : parsed.bankBalance;
            appState.dataCount = isNaN(parsed.dataCount) ? 425102 : parsed.dataCount;
            appState.tradeHistory = parsed.tradeHistory || [];
            appState.config = parsed.config || {};
        }
    } catch(e) { localStorage.removeItem('neuroBotData'); }
}
function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function startDataCounter() {
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    dataCounterInterval = setInterval(() => {
        appState.dataCount += Math.floor(Math.random() * 5);
        if(document.getElementById('data-mining-counter')) 
            document.getElementById('data-mining-counter').innerText = appState.dataCount.toLocaleString();
    }, 50);
}
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function checkRealModeAndStart() {
    const config = JSON.parse(localStorage.getItem('neuroConfig') || '{}');
    appState.config = config;
    if(config.apiKey && config.mode === 'REAL') {
        appState.isRealMode = true;
        if(autoTradeInterval) clearInterval(autoTradeInterval);
        autoTradeInterval = setInterval(() => { executeAiTrade(config); }, 1200);
    }
}
function forceStartTrade() {
    if(!appState.config.target) {
        executeAiTrade({target:'BTC/USDT', amount:1000});
        autoTradeInterval = setInterval(() => { executeAiTrade({target:'BTC/USDT', amount:1000}); }, 1200);
    }
}
function exportLogs() { /* 기존 동일 */ }
function highlightMenu() { /* 기존 동일 */ }
