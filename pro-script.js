/* pro-script.js - V7.0 (레이아웃 수정 및 고속 엔진) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;
let autoTradeInterval = null;

let appState = {
    balance: 50000.00,
    bankBalance: 1000000.00,
    startBalance: 50000.00,
    tradeHistory: [],
    transfers: [],
    logs: [],
    totalLogCount: 0,
    isRealMode: false,
    config: {}
};

window.addEventListener('load', () => {
    loadState();
    checkRealModeAndStart(); 

    fetch('header.html').then(r => r.text()).then(d => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) { slot.innerHTML = d; highlightMenu(); }
    });

    renderGlobalUI();
    if (document.getElementById('tv_chart')) initWebSocket();
    
    // 0.5초마다 UI 갱신 (더 부드럽게)
    setInterval(() => { saveState(); renderGlobalUI(); }, 500);
});

// [강제 실행 함수] 버튼 누르면 호출됨
function forceStartTrade() {
    alert("RE-INITIALIZING AI ENGINE...");
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    const config = appState.config;
    // 설정이 없으면 기본값으로 가동
    if(!config.target) config.target = "BTC/USDT";
    if(!config.amount) config.amount = 1000;
    
    executeAiTrade(config); // 즉시 1회 실행
    autoTradeInterval = setInterval(() => { executeAiTrade(config); }, 1500); // 1.5초마다 반복
}

function renderGlobalUI() {
    const els = {
        total: document.getElementById('total-val'),
        bal: document.getElementById('real-balance'),
        prof: document.getElementById('real-profit'),
        win: document.getElementById('win-rate-display'),
        logCnt: document.getElementById('log-count-display'),
        bank: document.getElementById('bank-balance-display')
    };

    const totalAssets = appState.balance + (appState.bankBalance || 0);

    // [레이아웃 수정 대응] 큰 숫자 콤마 처리
    if(els.total) els.total.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.bal) els.bal.innerText = appState.balance.toLocaleString(undefined, {minimumFractionDigits:2});
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        // PNL에 화살표 추가해서 움직임 강조
        const arrow = profit >= 0 ? '▲' : '▼';
        els.prof.innerText = `${arrow} $${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits:2})}`;
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }

    if(els.logCnt) els.logCnt.innerText = `[${appState.totalLogCount}]`;
    renderTables();
}

function executeAiTrade(config) {
    // 변동폭을 조금 키워서 숫자가 바뀌는게 눈에 띄게 함
    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 1.2) + 0.2; 
    const pnl = isWin ? (parseFloat(config.amount) * (percent / 100)) : -(parseFloat(config.amount) * (percent / 100) * 0.6);
    
    appState.balance += pnl;
    
    const currentPrice = 69000 + (Math.random() * 1000);
    const pos = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const msg = `AI: ${pos} ${config.target || 'BTC/USDT'} | PNL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    
    addSystemLog(pos, msg);
    
    const now = new Date();
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: pos, in: currentPrice, out: currentPrice + (isWin ? 50 : -50), profit: pnl, win: isWin
    });
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
}

/* --- 기본 유지 --- */
function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) { appState = JSON.parse(data); if(!appState.bankBalance) appState.bankBalance = 1000000; }
}
function checkRealModeAndStart() {
    const config = JSON.parse(localStorage.getItem('neuroConfig') || '{}');
    appState.config = config;
    if(config.apiKey && config.mode === 'REAL') {
        appState.isRealMode = true;
        updateRealModeUI(config);
        if(!autoTradeInterval) autoTradeInterval = setInterval(() => { executeAiTrade(config); }, 1500); // 1.5초 고속
    }
}
function updateRealModeUI(config) {
    const btn = document.getElementById('btn-status');
    if(btn) { btn.innerText = "AI TRADING ACTIVE"; btn.classList.add('btn-auto'); }
}
function renderTables() {
    const histBody = document.getElementById('history-body');
    if(histBody) {
        let html = '';
        appState.tradeHistory.slice(0, 15).forEach(t => { 
            const color = t.profit >= 0 ? 'text-green' : 'text-red';
            html += `<tr>
                <td class="num-font" style="color:var(--text-secondary); font-size:0.75rem;">${t.time}</td>
                <td style="font-weight:600;" class="${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</td>
                <td class="num-font" style="text-align:right;">${t.profit>=0?'+':''}$${t.profit.toFixed(2)}</td>
            </tr>`;
        });
        histBody.innerHTML = html;
        const winEl = document.getElementById('win-rate-display');
        if(winEl) {
            const wins = appState.tradeHistory.filter(t => t.win).length;
            const total = appState.tradeHistory.length;
            const rate = total ? Math.round((wins/total)*100) : 0;
            winEl.innerHTML = `WIN RATE: <span class="text-green">${rate}%</span>`;
        }
    }
    const transBody = document.getElementById('transfer-body');
    if(transBody) {
        let html = '';
        appState.transfers.slice(0,10).forEach(t => {
            const isDep = t.type === 'DEPOSIT';
            html += `<tr>
                <td class="num-font" style="color:var(--text-secondary);">${t.date.split(' ')[0]}</td>
                <td style="font-weight:600;">${t.type}</td>
                <td style="text-align:right;" class="num-font ${isDep?'text-green':'text-red'}">$${t.amount.toLocaleString()}</td>
            </tr>`;
        });
        transBody.innerHTML = html;
    }
}
function initWebSocket() { socket = new WebSocket(BINANCE_WS_URL); socket.onmessage = (e) => {
    const d = JSON.parse(e.data);
    const p = parseFloat(d.p);
    const el = document.getElementById('coin-price');
    if(el) { el.innerText = p.toLocaleString(undefined,{minimumFractionDigits:2}); el.style.color = !d.m ? '#0ecb81' : '#f6465d'; }
};}
function addSystemLog(type, msg) {
    if(appState.totalLogCount>=1000000) return;
    appState.logs.unshift({time: new Date().toLocaleTimeString('en-US',{hour12:false}), type, msg});
    appState.totalLogCount++;
    if(appState.logs.length>50) appState.logs.pop();
    const t = document.getElementById('terminal');
    if(t) {
        const c = type==='LONG'?'pos-long':'pos-short';
        t.insertAdjacentHTML('afterbegin', `<div class="log-line"><span style="color:#666">${new Date().toLocaleTimeString().split(' ')[0]}</span><span class="${c}">${type}</span><span>${msg}</span></div>`);
        if(t.children.length>50) t.removeChild(t.lastChild);
    }
}
function exportLogs() { /* 생략 */ }
function highlightMenu() { /* 생략 */ }
