/* pro-script.js - V8.0 (은행 이자 시스템 탑재) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;
let autoTradeInterval = null;

let appState = {
    balance: 50000.00,       // 지갑 잔고
    bankBalance: 1000000.00, // 은행 잔고
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
    
    // 0.5초마다 화면 갱신 + 이자 지급
    setInterval(() => { 
        applyBankInterest(); // [NEW] 이자 지급 함수 실행
        saveState(); 
        renderGlobalUI(); 
    }, 500);
});

// [NEW] 은행 이자 지급 로직
function applyBankInterest() {
    if(appState.bankBalance > 0) {
        // 연이율 5% 가정 -> 초단위 쪼개서 지급 (시각적 효과를 위해 조금 과장됨)
        // 매 0.5초마다 잔고의 0.00005%가 늘어남
        const interest = appState.bankBalance * 0.0000005; 
        appState.bankBalance += interest;
    }
}

// [강제 실행 함수]
function forceStartTrade() {
    alert("AI ENGINE RE-BOOTING...");
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    const config = appState.config;
    if(!config.target) config.target = "BTC/USDT";
    if(!config.amount) config.amount = 1000;
    
    executeAiTrade(config);
    autoTradeInterval = setInterval(() => { executeAiTrade(config); }, 1500);
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

    // 총 자산 표시
    if(els.total) els.total.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    // 지갑 잔고
    if(els.bal) els.bal.innerText = appState.balance.toLocaleString(undefined, {minimumFractionDigits:2});
    
    // [중요] 은행 잔고 (이자 붙어서 계속 변함)
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:3})}`; 
    // 소수점 3자리까지 보여주어 움직임이 더 잘 보이게 함

    // 수익금 (화살표 추가)
    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        const arrow = profit >= 0 ? '▲' : '▼';
        els.prof.innerText = `${arrow} $${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits:2})}`;
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }

    if(els.logCnt) els.logCnt.innerText = `[${appState.totalLogCount}]`;
    renderTables();
}

function executeAiTrade(config) {
    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 1.2) + 0.2; 
    const pnl = isWin ? (parseFloat(config.amount) * (percent / 100)) : -(parseFloat(config.amount) * (percent / 100) * 0.6);
    
    appState.balance += pnl;
    
    const currentPrice = 69000 + (Math.random() * 1000);
    const pos = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const msg = `AI: ${pos} ${config.target || 'BTC/USDT'} | PNL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    
    // 한 줄 로그 업데이트 (index.html 연동)
    if(window.addSystemLog) window.addSystemLog(pos, msg);
    else addInternalLog(pos, msg); // 백업
    
    const now = new Date();
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: pos, in: currentPrice, out: currentPrice + (isWin ? 50 : -50), profit: pnl, win: isWin
    });
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
}

// 내부 로그 함수 (index.html 없을 때 대비)
function addInternalLog(type, msg) {
    appState.logs.unshift({time: new Date().toLocaleTimeString(), type, msg});
    if(appState.logs.length > 50) appState.logs.pop();
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
        if(!autoTradeInterval) autoTradeInterval = setInterval(() => { executeAiTrade(config); }, 1500); 
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
function processTransaction(amount) { /* 생략 (기존 동일) */ }
function openModal(mode) { /* 생략 (기존 동일) */ }
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }
function exportLogs() { /* 생략 */ }
function highlightMenu() { /* 생략 */ }
