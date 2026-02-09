/* pro-script.js - 자금 이동 및 은행 연동 시스템 (V5.0) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;
let autoTradeInterval = null;

// [전역 데이터]
let appState = {
    balance: 0,              // 거래소 지갑 잔고
    bankBalance: 1000000.00, // [NEW] 은행 계좌 잔고 (초기 자금 100만불 가정)
    startBalance: 0,         
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

    if(appState.tradeHistory.length === 0) generateInitialData();

    fetch('header.html').then(r => r.text()).then(d => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) { slot.innerHTML = d; highlightMenu(); }
    });

    renderGlobalUI();

    if (document.getElementById('tv_chart')) initWebSocket();
    
    setInterval(() => { saveState(); renderGlobalUI(); }, 1000);
});

// [핵심] 입출금 처리 로직 (지갑 <-> 은행)
function processTransaction(amount) {
    if(!amount || amount <= 0) return alert("Please enter a valid amount.");
    
    // amount가 양수면 입금(Deposit), 음수면 출금(Withdraw)
    
    // 1. 입금 (은행 -> 지갑)
    if (amount > 0) {
        if (appState.bankBalance < amount) return alert("INSUFFICIENT BANK FUNDS!"); // 은행 돈 부족
        appState.bankBalance -= amount; // 은행에서 차감
        appState.balance += amount;     // 지갑에 추가
        appState.startBalance += amount;
        addSystemLog('SYSTEM', `DEPOSIT FROM BANK: $${amount.toLocaleString()}`);
    } 
    // 2. 출금 (지갑 -> 은행)
    else {
        const withdrawAmount = Math.abs(amount);
        if (appState.balance < withdrawAmount) return alert("INSUFFICIENT WALLET BALANCE!"); // 지갑 돈 부족
        appState.balance -= withdrawAmount;     // 지갑에서 차감
        appState.bankBalance += withdrawAmount; // 은행에 추가
        addSystemLog('SYSTEM', `WITHDRAW TO BANK: $${withdrawAmount.toLocaleString()}`);
    }

    // 내역 기록
    appState.transfers.unshift({
        date: new Date().toISOString().slice(0,16).replace('T', ' '),
        type: amount > 0 ? 'DEPOSIT' : 'WITHDRAW',
        amount: Math.abs(amount),
        status: 'Completed'
    });

    saveState();
    closeModal();
    renderGlobalUI(); 
    
    // 알림 메시지
    if(amount > 0) alert(`$${amount} DEPOSITED TO WALLET.`);
    else alert(`$${Math.abs(amount)} WITHDRAWN TO BANK ACCOUNT.`);
}

/* --- [UI 렌더링 및 기타 로직] --- */

function renderGlobalUI() {
    const els = {
        total: document.getElementById('total-val'),
        bal: document.getElementById('real-balance'),
        prof: document.getElementById('real-profit'),
        win: document.getElementById('win-rate-display'),
        logCnt: document.getElementById('log-count-display'),
        bank: document.getElementById('bank-balance-display') // [NEW] 은행 잔고 ID
    };

    // 지갑 잔고 표시
    if(els.total) els.total.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.bal) els.bal.innerText = appState.balance.toLocaleString(undefined, {minimumFractionDigits:2});
    
    // 은행 잔고 표시 (Transfers 페이지)
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    // 수익금 표시
    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        els.prof.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }

    // 로그 카운터
    if(els.logCnt) {
        els.logCnt.innerText = `[${appState.totalLogCount.toLocaleString()}]`;
        if(appState.totalLogCount >= 1000000) { els.logCnt.style.color = '#ff003c'; } 
        else { els.logCnt.style.color = '#fff'; }
    }

    // 리스트 렌더링 (지갑 & 이체내역)
    renderTables();
}

function renderTables() {
    // 지갑 매매 내역
    const histBody = document.getElementById('history-body');
    if(histBody) {
        let html = '';
        appState.tradeHistory.slice(0, 20).forEach(t => { 
            const color = t.profit >= 0 ? 'text-green' : 'text-red';
            html += `<tr>
                <td class="num-font" style="color:#888; font-size:0.75rem;">${t.date}<br>${t.time}</td>
                <td style="font-weight:bold;" class="${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</td>
                <td class="num-font" style="font-size:0.8rem;">IN:${t.in.toFixed(0)}<br>OUT:${t.out.toFixed(0)}</td>
                <td style="text-align:right;" class="num-font ${color}"><b>${t.profit>=0?'+':''}$${t.profit.toFixed(2)}</b></td>
            </tr>`;
        });
        histBody.innerHTML = html;
        
        // 승률
        const winEl = document.getElementById('win-rate-display');
        if(winEl) {
            const wins = appState.tradeHistory.filter(t => t.win).length;
            const total = appState.tradeHistory.length;
            const rate = total ? Math.round((wins/total)*100) : 0;
            winEl.innerHTML = `WIN RATE: <span class="text-green">${rate}%</span> (${wins}W ${total-wins}L)`;
        }
    }

    // 은행 이체 내역
    const transBody = document.getElementById('transfer-body');
    if(transBody) {
        let html = '';
        appState.transfers.forEach(t => {
            const isDep = t.type === 'DEPOSIT'; // 입금(지갑으로)
            // 은행 입장에서는: Deposit(돈 나감-), Withdraw(돈 들어옴+)
            // 하지만 보통 'Deposit'은 거래소 입금 내역을 의미하므로 그대로 둡니다.
            html += `<tr>
                <td class="num-font" style="color:#888; font-size:0.75rem;">${t.date.split(' ')[0]}<br>${t.date.split(' ')[1]}</td>
                <td style="font-weight:bold; color:${isDep?'#0f0':'#f00'}">${t.type}</td>
                <td style="text-align:right;" class="num-font ${isDep?'text-green':'text-red'}">$${t.amount.toLocaleString()}</td>
                <td style="text-align:right; font-size:0.7rem; color:#666;">${t.status}</td>
            </tr>`;
        });
        transBody.innerHTML = html;
    }
}

// 자동매매 및 기타 로직은 기존 유지
function checkRealModeAndStart() {
    const config = JSON.parse(localStorage.getItem('neuroConfig') || '{}');
    appState.config = config;
    if(config.apiKey && config.mode === 'REAL') {
        appState.isRealMode = true;
        updateRealModeUI(config);
        if(!autoTradeInterval) {
            autoTradeInterval = setInterval(() => { executeAiTrade(config); }, 3000);
        }
    }
}

function executeAiTrade(config) {
    const isWin = Math.random() > 0.45; 
    const percent = (Math.random() * 1.5); 
    const pnl = isWin ? (parseFloat(config.amount) * (percent / 100)) : -(parseFloat(config.amount) * (percent / 100) * 0.5);
    appState.balance += pnl;
    const currentPrice = 70000 + (Math.random() * 500);
    const pos = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const msg = `AI EXECUTION: ${pos} ${config.target} | PNL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    addSystemLog(pos, msg);
    const now = new Date();
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: pos, in: currentPrice, out: currentPrice + (isWin ? 50 : -50), profit: pnl, win: isWin
    });
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
}

function updateRealModeUI(config) {
    const modeText = document.getElementById('system-mode-text');
    const keyDisplay = document.getElementById('api-key-display');
    const panel = document.getElementById('api-status-panel');
    const badge = document.getElementById('header-status-badge');
    if(modeText) { modeText.innerText = `AI TRADING ACTIVE (${config.target})`; modeText.style.color = "#00ff41"; }
    if(keyDisplay) { keyDisplay.innerText = `API: ${config.apiKey.substring(0,4)}****`; keyDisplay.style.color = "#fff"; }
    if(panel) panel.style.borderLeftColor = "#00ff41";
    if(badge) { badge.innerText = "REAL NET"; badge.style.borderColor = "#00ff41"; badge.style.color = "#00ff41"; }
}

function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) { appState = JSON.parse(data); if(!appState.bankBalance) appState.bankBalance = 1000000; } // 초기 은행잔고
}
function generateInitialData() { /* 기존 동일 */ }
function openModal(mode) {
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const input = document.getElementById('amount-input');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    modal.style.display = 'flex'; input.value = '';
    if(mode === 'deposit') {
        title.innerText = "DEPOSIT FROM BANK"; title.style.color = "#0f0";
        confirmBtn.innerText = "DEPOSIT"; confirmBtn.onclick = () => processTransaction(parseFloat(input.value));
    } else {
        title.innerText = "WITHDRAW TO BANK"; title.style.color = "#f00";
        confirmBtn.innerText = "WITHDRAW"; confirmBtn.onclick = () => processTransaction(-parseFloat(input.value));
    }
}
function closeModal() { document.getElementById('transaction-modal').style.display = 'none'; }
function initWebSocket() { /* 기존 동일 */ }
function addSystemLog(type, msg) { /* addLog 함수임. 이름 통일 필요 */
    if (appState.totalLogCount >= 1000000) return;
    const time = new Date().toLocaleTimeString('en-US',{hour12:false});
    appState.logs.unshift({time, type, msg});
    appState.totalLogCount++;
    if(appState.logs.length > 500) appState.logs.pop();
    const terminal = document.getElementById('terminal');
    if(terminal) {
        const color = type==='LONG'?'pos-long':(type==='SHORT'?'pos-short':'text-green');
        const row = `<div class="log-line"><span style="color:#666">[${time}]</span> <span class="${color}">${type}</span> <span style="color:#aaa">${msg}</span></div>`;
        terminal.insertAdjacentHTML('afterbegin', row);
        if(terminal.children.length > 50) terminal.removeChild(terminal.lastChild);
    }
}
function exportLogs() { /* 기존 동일 */ }
function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active');
        else el.classList.remove('active');
    });
}
