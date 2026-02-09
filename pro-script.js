/* pro-script.js - 데이터 동기화 및 실전 모드 감지 */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;

// 전역 데이터
let appState = {
    balance: 50000.00,
    startBalance: 50000.00,
    tradeHistory: [],
    transfers: [],
    logs: [],
    totalLogCount: 0,
    lastLogin: Date.now(),
    isRealMode: false // [NEW] 실전 모드 여부
};

window.addEventListener('load', () => {
    loadState();
    checkRealMode(); // [NEW] 실전 모드인지 체크
    
    if(appState.tradeHistory.length === 0) generateInitialData();

    // 헤더 메뉴 로드
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            const slot = document.getElementById('internal-header-slot');
            if(slot) {
                slot.innerHTML = data;
                highlightMenu();
            }
        });

    renderGlobalUI();

    if (document.getElementById('tv_chart')) {
        initWebSocket();
    }
    
    setInterval(() => {
        saveState();
        renderGlobalUI();
    }, 1000);
});

// [NEW] 실전 모드 감지 함수
function checkRealMode() {
    const config = JSON.parse(localStorage.getItem('neuroConfig') || '{}');
    if(config.apiKey && config.apiKey.length > 5) {
        appState.isRealMode = true;
        
        // 월렛 페이지라면 UI 즉시 변경
        const modeText = document.getElementById('system-mode-text');
        const keyDisplay = document.getElementById('api-key-display');
        const panel = document.getElementById('api-status-panel');
        const badge = document.getElementById('header-status-badge');

        if(modeText && keyDisplay && panel) {
            modeText.innerText = "REAL TRADING (ACTIVE)";
            modeText.style.color = "#00ff41"; // 녹색
            
            // 키의 앞 4자리만 보여주고 나머지는 별표 처리 (보안)
            const maskedKey = config.apiKey.substring(0, 4) + "****" + config.apiKey.substring(config.apiKey.length-4);
            keyDisplay.innerText = `API: ${maskedKey}`;
            keyDisplay.style.color = "#fff";
            
            panel.style.borderLeftColor = "#00ff41"; // 패널 왼쪽 선 녹색으로
        }
        
        if(badge) {
            badge.innerText = "REAL NET";
            badge.style.borderColor = "#00ff41";
            badge.style.color = "#00ff41";
        }
    }
}

function saveState() {
    localStorage.setItem('neuroBotData', JSON.stringify(appState));
}

function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) {
        appState = JSON.parse(data);
        if(appState.totalLogCount === undefined) appState.totalLogCount = appState.logs.length;
    }
}

function generateInitialData() {
    appState.tradeHistory = [];
    for(let i=0; i<15; i++) {
        const isWin = Math.random() > 0.4;
        const profit = (Math.random() * 500) * (isWin ? 1 : -1);
        appState.tradeHistory.push({
            date: `02/${10-Math.floor(i/3)}`,
            time: `${10+i}:30:15`,
            pos: Math.random()>0.5 ? 'LONG' : 'SHORT',
            in: 60000 + (Math.random()*1000),
            out: 60000 + (Math.random()*1000),
            profit: parseFloat(profit.toFixed(2)),
            win: isWin
        });
    }
    appState.transfers = [
        { date: '2026-02-09 10:00', type: 'DEPOSIT', amount: 50000, status: 'Completed' }
    ];
    saveState();
}

function renderGlobalUI() {
    const els = {
        total: document.getElementById('total-val'),
        bal: document.getElementById('real-balance'),
        prof: document.getElementById('real-profit'),
        win: document.getElementById('win-rate-display'),
        logCnt: document.getElementById('log-count-display')
    };

    if(els.total) els.total.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.bal) els.bal.innerText = appState.balance.toLocaleString(undefined, {minimumFractionDigits:2});
    
    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        els.prof.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }

    if(els.logCnt) {
        els.logCnt.innerText = `[${appState.totalLogCount.toLocaleString()}]`;
        if(appState.totalLogCount >= 1000000) {
            els.logCnt.style.color = '#ff003c';
            els.logCnt.innerText += " FULL";
        } else {
            els.logCnt.style.color = '#fff';
        }
    }

    const histBody = document.getElementById('history-body');
    if(histBody) {
        let html = '';
        appState.tradeHistory.slice(0, 20).forEach(t => { 
            const color = t.profit >= 0 ? 'text-green' : 'text-red';
            html += `<tr>
                <td class="num-font" style="color:#888; font-size:0.75rem;">${t.date}<br>${t.time}</td>
                <td style="font-weight:bold;" class="${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</td>
                <td class="num-font" style="font-size:0.8rem;">IN:${t.in.toFixed(0)}<br>OUT:${t.out.toFixed(0)}</td>
                <td style="text-align:right;" class="num-font ${color}"><b>${t.profit>=0?'+':''}$${t.profit}</b></td>
            </tr>`;
        });
        histBody.innerHTML = html;

        if(els.win) {
            const wins = appState.tradeHistory.filter(t => t.win).length;
            const total = appState.tradeHistory.length;
            const rate = total ? Math.round((wins/total)*100) : 0;
            els.win.innerHTML = `WIN RATE: <span class="text-green">${rate}%</span> (${wins}W ${total-wins}L)`;
        }
    }

    const transBody = document.getElementById('transfer-body');
    if(transBody) {
        let html = '';
        appState.transfers.forEach(t => {
            const isDep = t.type === 'DEPOSIT';
            html += `<tr>
                <td class="num-font" style="color:#888; font-size:0.75rem;">${t.date.split(' ')[0]}<br>${t.date.split(' ')[1]}</td>
                <td style="font-weight:bold; color:${isDep?'#0f0':'#f00'}">${t.type}</td>
                <td style="text-align:right;" class="num-font ${isDep?'text-green':'text-red'}">${isDep?'+':'-'}$${t.amount.toLocaleString()}</td>
                <td style="text-align:right; font-size:0.7rem; color:#666;">${t.status}</td>
            </tr>`;
        });
        transBody.innerHTML = html;
    }
}

function processTransaction(amount) {
    if(!amount || amount <= 0) return alert("Invalid Amount");
    if(amount < 0 && (appState.balance + amount) < 0) return alert("Insufficient Funds");

    appState.balance += amount;
    if(amount > 0) appState.startBalance += amount; 

    appState.transfers.unshift({
        date: new Date().toISOString().slice(0,16).replace('T', ' '),
        type: amount > 0 ? 'DEPOSIT' : 'WITHDRAW',
        amount: Math.abs(amount),
        status: 'Completed'
    });

    saveState();
    closeModal();
    renderGlobalUI(); 
    alert("TRANSACTION COMPLETED");
}

function openModal(mode) {
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const input = document.getElementById('amount-input');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    modal.style.display = 'flex';
    input.value = '';
    
    if(mode === 'deposit') {
        title.innerText = "DEPOSIT ASSETS";
        title.style.color = "#0f0";
        confirmBtn.innerText = "DEPOSIT";
        confirmBtn.onclick = () => processTransaction(parseFloat(input.value));
    } else {
        title.innerText = "WITHDRAW ASSETS";
        title.style.color = "#f00";
        confirmBtn.innerText = "WITHDRAW";
        confirmBtn.onclick = () => processTransaction(-parseFloat(input.value));
    }
}
function closeModal() { document.getElementById('transaction-modal').style.display = 'none'; }

function initWebSocket() {
    socket = new WebSocket(BINANCE_WS_URL);
    socket.onmessage = (e) => {
        const d = JSON.parse(e.data);
        const price = parseFloat(d.p);
        const isBuy = !d.m;
        
        const priceEl = document.getElementById('coin-price');
        if(priceEl) {
            priceEl.innerText = price.toLocaleString(undefined, {minimumFractionDigits:2});
            priceEl.style.color = isBuy ? '#00ff88' : '#ff3344';
        }
        
        const noise = (Math.random()-0.5)*5;
        const dispBal = appState.balance + noise;
        const balEl = document.getElementById('real-balance');
        if(balEl) balEl.innerText = dispBal.toLocaleString(undefined, {minimumFractionDigits:2});

        if(Math.random() < 0.05) addLog(isBuy?'LONG':'SHORT', `Price ${price.toFixed(1)} Executed`);
    };
    socket.onclose = () => setTimeout(initWebSocket, 2000);
}

function addLog(type, msg) {
    if (appState.totalLogCount >= 1000000) return;

    const time = new Date().toLocaleTimeString('en-US',{hour12:false});
    appState.logs.unshift({time, type, msg});
    appState.totalLogCount++;

    if(appState.logs.length > 500) appState.logs.pop();
    
    const terminal = document.getElementById('terminal');
    if(terminal) {
        const color = type==='LONG'?'pos-long':'pos-short';
        const row = `<div class="log-line"><span style="color:#666">[${time}]</span> <span class="${color}">${type}</span> <span style="color:#aaa">${msg}</span></div>`;
        terminal.insertAdjacentHTML('afterbegin', row);
        if(terminal.children.length > 50) terminal.removeChild(terminal.lastChild);
    }
}

function exportLogs() {
    if(appState.logs.length === 0) return alert("No logs to save.");
    
    let csv = "Time,Type,Message\n";
    appState.logs.forEach(l => csv += `${l.time},${l.type},${l.msg}\n`);
    const blob = new Blob([csv], {type:'text/csv'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `NeuroLog_${Date.now()}.csv`;
    link.click();

    appState.logs = [];
    appState.totalLogCount = 0;
    saveState();
    
    const terminal = document.getElementById('terminal');
    if(terminal) terminal.innerHTML = '';
    renderGlobalUI();
    alert("LOGS SAVED & RESET.");
}

function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active');
        else el.classList.remove('active');
    });
}
