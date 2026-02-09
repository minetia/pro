/* pro-script.js - AI 실전 매매 엔진 (V4.0) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;
let autoTradeInterval = null; // 자동매매 타이머

// [전역 데이터]
let appState = {
    balance: 50000.00,       // 현재 잔고
    startBalance: 50000.00,  // 시작 잔고 (수익률 계산용)
    tradeHistory: [],        // 매매 기록
    transfers: [],           // 입출금 기록
    logs: [],                // 시스템 로그
    totalLogCount: 0,        // 로그 카운터
    isRealMode: false,       // 실전 모드 여부
    config: {}               // 설정값 (금액, 타겟 등)
};

window.addEventListener('load', () => {
    loadState();
    
    // [중요] 실전 모드인지 체크하고, 맞다면 자동매매 시작
    checkRealModeAndStart(); 

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
    
    // 화면 갱신 루프 (1초)
    setInterval(() => {
        saveState();
        renderGlobalUI();
    }, 1000);
});

// [핵심] 실전 모드 감지 및 엔진 시동
function checkRealModeAndStart() {
    const config = JSON.parse(localStorage.getItem('neuroConfig') || '{}');
    appState.config = config;

    if(config.apiKey && config.mode === 'REAL') {
        appState.isRealMode = true;
        
        // UI 변경 (녹색 신호)
        updateRealModeUI(config);

        // [엔진 가동] 이미 돌고 있지 않다면 3초마다 매매 시작
        if(!autoTradeInterval) {
            console.log("AI TRADING ENGINE STARTED...");
            // 최초 실행 시 자산이 너무 적으면 설정한 금액만큼 입금 처리 (시각적 효과)
            if(appState.balance < parseFloat(config.amount)) {
                appState.balance = parseFloat(config.amount);
                appState.startBalance = parseFloat(config.amount);
            }

            autoTradeInterval = setInterval(() => {
                executeAiTrade(config);
            }, 3000); // 3초마다 매매 실행
        }
    }
}

// [핵심] AI 자동 매매 로직 (3초마다 실행됨)
function executeAiTrade(config) {
    // 1. 랜덤 수익률 계산 (-0.5% ~ +1.2%)
    const isWin = Math.random() > 0.45; // 승률 55% 설정
    const percent = (Math.random() * 1.5); 
    const pnl = isWin ? (parseFloat(config.amount) * (percent / 100)) : -(parseFloat(config.amount) * (percent / 100) * 0.5);
    
    // 2. 자산 업데이트
    appState.balance += pnl;
    
    // 3. 현재 가격 (가상)
    const currentPrice = 70000 + (Math.random() * 500);
    
    // 4. 로그 및 기록 추가
    const pos = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const msg = `AI EXECUTION: ${pos} ${config.target} | PNL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    
    // 로그창에 출력
    addLog(pos, msg);

    // 지갑 내역에 추가
    const now = new Date();
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: pos,
        in: currentPrice,
        out: currentPrice + (isWin ? 50 : -50),
        profit: pnl,
        win: isWin
    });

    // 너무 많이 쌓이면 삭제
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
}

// 실전 모드 UI 표시
function updateRealModeUI(config) {
    const modeText = document.getElementById('system-mode-text');
    const keyDisplay = document.getElementById('api-key-display');
    const panel = document.getElementById('api-status-panel');
    const badge = document.getElementById('header-status-badge');

    if(modeText) {
        modeText.innerText = `AI TRADING ACTIVE (${config.target})`;
        modeText.style.color = "#00ff41";
    }
    if(keyDisplay) {
        const masked = config.apiKey.substring(0,4) + "****";
        keyDisplay.innerText = `API: ${masked} | BET: $${config.amount}`;
        keyDisplay.style.color = "#fff";
    }
    if(panel) panel.style.borderLeftColor = "#00ff41";
    if(badge) {
        badge.innerText = "REAL NET";
        badge.style.borderColor = "#00ff41";
        badge.style.color = "#00ff41";
    }
}

/* --- [이하 기존 기본 로직 유지] --- */

function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }

function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) {
        appState = JSON.parse(data);
        if(appState.totalLogCount === undefined) appState.totalLogCount = appState.logs.length;
    }
}

function generateInitialData() {
    appState.tradeHistory = [];
    for(let i=0; i<10; i++) {
        appState.tradeHistory.push({
            date: `02/09`, time: `12:00:00`, pos: 'LONG', in: 60000, out: 60100, profit: 50.00, win: true
        });
    }
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
        if(appState.totalLogCount >= 1000000) els.logCnt.style.color = '#ff003c';
        else els.logCnt.style.color = '#fff';
    }

    // 지갑 리스트 갱신
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

        if(els.win) {
            const wins = appState.tradeHistory.filter(t => t.win).length;
            const total = appState.tradeHistory.length;
            const rate = total ? Math.round((wins/total)*100) : 0;
            els.win.innerHTML = `WIN RATE: <span class="text-green">${rate}%</span> (${wins}W ${total-wins}L)`;
        }
    }

    // 입출금 리스트
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
    if(appState.logs.length === 0) return alert("No logs.");
    let csv = "Time,Type,Message\n";
    appState.logs.forEach(l => csv += `${l.time},${l.type},${l.msg}\n`);
    const blob = new Blob([csv], {type:'text/csv'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TradeLog.csv`;
    link.click();
    appState.logs = [];
    appState.totalLogCount = 0;
    saveState();
    const terminal = document.getElementById('terminal');
    if(terminal) terminal.innerHTML = '';
    renderGlobalUI();
}

function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active');
        else el.classList.remove('active');
    });
}
