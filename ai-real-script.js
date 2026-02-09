/* pro-script.js - V10.0 (데이터 다운로드 기능 탑재) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;
let autoTradeInterval = null;

let appState = {
    balance: 50000.00,
    bankBalance: 1000000.00,
    startBalance: 50000.00,
    tradeHistory: [], // 여기가 진짜 데이터
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
    
    // 0.5초 갱신
    setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
});

// 은행 이자
function applyBankInterest() {
    if(appState.bankBalance > 0) appState.bankBalance += (appState.bankBalance * 0.0000008);
}

// UI 렌더링 (자산 통일)
function renderGlobalUI() {
    const totalAssets = appState.balance + (appState.bankBalance || 0);
    const els = {
        total: document.getElementById('total-val'),
        bal: document.getElementById('real-balance'),
        bank: document.getElementById('bank-balance-display')
    };

    if(els.total) els.total.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.bal) els.bal.innerText = appState.balance.toLocaleString(undefined, {minimumFractionDigits:2});
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    const profEl = document.getElementById('real-profit');
    if(profEl) {
        const profit = appState.balance - appState.startBalance;
        const arrow = profit >= 0 ? '▲' : '▼';
        profEl.innerText = `${arrow} $${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits:2})}`;
        profEl.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }
    
    // 로그 카운터가 있다면
    const logCnt = document.getElementById('log-count-display');
    if(logCnt) logCnt.innerText = `[${appState.totalLogCount.toLocaleString()}]`;

    renderTables();
}

// [핵심] 엑셀(CSV) 다운로드 기능
function exportLogs() {
    if(appState.tradeHistory.length === 0) return alert("No trading data to download.");
    
    // CSV 헤더 만들기
    let csvContent = "Date,Time,Position,Price_In,Price_Out,Profit(USDT),Result\n";
    
    // 데이터 한 줄씩 추가
    appState.tradeHistory.forEach(t => {
        const result = t.win ? "WIN" : "LOSS";
        csvContent += `${t.date},${t.time},${t.pos},${t.in.toFixed(2)},${t.out.toFixed(2)},${t.profit.toFixed(2)},${result}\n`;
    });

    // 파일 생성 및 다운로드 트리거
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().slice(0,19).replace(/:/g,"-");
    link.setAttribute("href", url);
    link.setAttribute("download", `Trading_Report_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("✅ TRADING DATA DOWNLOADED SUCCESSFULLY!");
}

// AI 트레이딩 (무한)
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
        pos: pos, in: currentPrice, out: currentPrice + (isWin ? 50 : -50), profit: pnl, win: isWin
    };

    appState.tradeHistory.unshift(newTrade);
    // 무한히 쌓이면 브라우저 느려지므로 1000개 유지
    if(appState.tradeHistory.length > 1000) appState.tradeHistory.pop(); 

    const msg = `AI: ${pos} ${config.target || 'BTC/USDT'} | PNL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    if(window.addSystemLog) window.addSystemLog(pos, msg);
    
    appState.totalLogCount++;
}

/* --- 기타 기본 함수들 --- */
function checkRealModeAndStart() {
    const config = JSON.parse(localStorage.getItem('neuroConfig') || '{}');
    appState.config = config;
    if(config.apiKey && config.mode === 'REAL') {
        appState.isRealMode = true;
        updateRealModeUI(config);
        if(autoTradeInterval) clearInterval(autoTradeInterval);
        autoTradeInterval = setInterval(() => { executeAiTrade(config); }, 1200);
    }
}
function forceStartTrade() {
    checkRealModeAndStart();
    if(!appState.config.target) {
        executeAiTrade({target:'BTC/USDT', amount:1000});
        autoTradeInterval = setInterval(() => { executeAiTrade({target:'BTC/USDT', amount:1000}); }, 1200);
    }
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
        appState.transfers.slice(0, 10).forEach(t => {
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
function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) { appState = JSON.parse(data); if(!appState.bankBalance) appState.bankBalance = 1000000; }
}
function updateRealModeUI(config) {
    const btn = document.getElementById('btn-status');
    if(btn) { btn.innerText = "AI TRADING ACTIVE"; btn.classList.add('btn-auto'); }
}
function initWebSocket() { socket = new WebSocket(BINANCE_WS_URL); socket.onmessage = (e) => {
    const d = JSON.parse(e.data);
    const p = parseFloat(d.p);
    const el = document.getElementById('coin-price');
    if(el) { el.innerText = p.toLocaleString(undefined,{minimumFractionDigits:2}); el.style.color = !d.m ? '#0ecb81' : '#f6465d'; }
};}
function processTransaction(amount) {
    if(!amount) return;
    if(amount > 0) { appState.bankBalance -= amount; appState.balance += amount; } 
    else { appState.balance -= Math.abs(amount); appState.bankBalance += Math.abs(amount); }
    appState.transfers.unshift({date: new Date().toISOString().slice(0,16).replace('T',' '), type: amount>0?'DEPOSIT':'WITHDRAW', amount: Math.abs(amount), status:'Done'});
    saveState(); closeModal(); renderGlobalUI();
}
function openModal(mode) {
    const m = document.getElementById('transaction-modal'); m.style.display='flex';
    document.getElementById('amount-input').value='';
    const btn = document.getElementById('modal-confirm-btn');
    if(mode==='deposit') { document.getElementById('modal-title').innerText="DEPOSIT"; btn.onclick=()=>processTransaction(parseFloat(document.getElementById('amount-input').value)); }
    else { document.getElementById('modal-title').innerText="WITHDRAW"; btn.onclick=()=>processTransaction(-parseFloat(document.getElementById('amount-input').value)); }
}
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }
function highlightMenu() { /* 생략 */ }
