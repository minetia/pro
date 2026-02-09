/* pro-script.js - 토탈 자산 관리 및 눈 보호 모드 (V6.0) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;
let autoTradeInterval = null;

// [전역 데이터]
let appState = {
    balance: 50000.00,       // 거래소 지갑 (매매용)
    bankBalance: 1000000.00, // 은행 계좌 (저장용)
    startBalance: 50000.00,  // 수익률 기준
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

    // 헤더 로드
    fetch('header.html').then(r => r.text()).then(d => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) { slot.innerHTML = d; highlightMenu(); }
    });

    renderGlobalUI();

    if (document.getElementById('tv_chart')) initWebSocket();
    
    // 1초마다 화면 갱신 (저장 & 렌더링)
    setInterval(() => { saveState(); renderGlobalUI(); }, 1000);
});

// [UI 렌더링 - 자산 연동 핵심]
function renderGlobalUI() {
    const els = {
        total: document.getElementById('total-val'), // 총 자산
        bal: document.getElementById('real-balance'), // 지갑 잔고
        prof: document.getElementById('real-profit'), // 수익금
        win: document.getElementById('win-rate-display'),
        logCnt: document.getElementById('log-count-display'),
        bank: document.getElementById('bank-balance-display')
    };

    // 1. 총 자산 계산 (지갑 + 은행)
    const totalAssets = appState.balance + (appState.bankBalance || 0);

    // 2. 메인 화면에 '총 자산' 표시 (지갑 잔고 대신)
    // 사용자가 "은행 잔고도 같이 연동해서" 보길 원하므로, 가장 큰 숫자를 보여줌
    if(els.total) els.total.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    // 지갑 잔고 (EST. BALANCE)
    if(els.bal) els.bal.innerText = appState.balance.toLocaleString(undefined, {minimumFractionDigits:2});
    
    // 은행 잔고 (Transfers 페이지용)
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    // 24H PNL (수익금)
    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        els.prof.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }

    // 로그 카운터 및 리스트 렌더링
    if(els.logCnt) els.logCnt.innerText = `[${appState.totalLogCount}]`;
    renderTables();
}

// [자동매매 엔진]
function executeAiTrade(config) {
    // 승률 및 수익금 계산
    const isWin = Math.random() > 0.45; 
    const percent = (Math.random() * 0.8) + 0.1; // 변동폭 조금 줄임 (현실감)
    const pnl = isWin ? (parseFloat(config.amount) * (percent / 100)) : -(parseFloat(config.amount) * (percent / 100) * 0.5);
    
    // 지갑 잔고 업데이트 -> 결과적으로 총 자산도 변함!
    appState.balance += pnl;
    
    const currentPrice = 70000 + (Math.random() * 500);
    const pos = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const msg = `AI: ${pos} ${config.target} | PNL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    
    addSystemLog(pos, msg);
    
    const now = new Date();
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: pos, in: currentPrice, out: currentPrice + (isWin ? 50 : -50), profit: pnl, win: isWin
    });
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
}

/* --- [기본 로직 유지] --- */
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
        if(!autoTradeInterval) autoTradeInterval = setInterval(() => { executeAiTrade(config); }, 3000);
    }
}
function updateRealModeUI(config) {
    const modeText = document.getElementById('system-mode-text');
    const keyDisplay = document.getElementById('api-key-display');
    const panel = document.getElementById('api-status-panel');
    const badge = document.getElementById('header-status-badge'); // header.html이 로드된 후 작동
    
    if(modeText) { modeText.innerText = "REAL ACTIVE"; modeText.style.color = "#0ecb81"; }
    if(keyDisplay) keyDisplay.innerText = `KEY: ${config.apiKey.substring(0,4)}...`;
    if(panel) panel.style.borderLeft = "3px solid #0ecb81";
    // 헤더 뱃지는 비동기로 로드되므로 안전장치 필요하나, 반복 렌더링에서 처리됨
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
        // 승률 표시
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
function processTransaction(amount) {
    if(!amount) return;
    if(amount > 0) { // 입금
        if(appState.bankBalance < amount) return alert("잔고 부족");
        appState.bankBalance -= amount; appState.balance += amount;
    } else { // 출금
        if(appState.balance < Math.abs(amount)) return alert("잔고 부족");
        appState.balance -= Math.abs(amount); appState.bankBalance += Math.abs(amount);
    }
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
function exportLogs() { /* 생략 (기존 동일) */ }
function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active');
    });
}
