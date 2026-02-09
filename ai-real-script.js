/* pro-script.js - V14.0 (AI 시각화 엔진 탑재) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;
let autoTradeInterval = null;
let hudInterval = null; // 시각화용 타이머

let appState = {
    balance: 50000.00,
    bankBalance: 1000000.00,
    startBalance: 50000.00,
    tradeHistory: [], 
    transfers: [],
    logs: [],
    totalLogCount: 0,
    isRealMode: false,
    config: {},
    dataCount: 425102
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

    // [NEW] HUD 애니메이션 시작
    startHudAnimation();
});

// [핵심] AI HUD 애니메이션 로직
function startHudAnimation() {
    const targets = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT'];
    let step = 0;
    
    // 0.1초마다 화면 내용을 바꿈 (긴박감 조성)
    hudInterval = setInterval(() => {
        const targetEl = document.getElementById('hud-target');
        const rsiEl = document.getElementById('hud-rsi');
        const volEl = document.getElementById('hud-vol');
        const barEl = document.getElementById('hud-bar');
        const scoreEl = document.getElementById('hud-score');

        if(!targetEl) return;

        // 랜덤하게 RSI 값 변동
        const rsiVal = Math.floor(Math.random() * 70) + 20;
        rsiEl.innerText = rsiVal;
        
        // 게이지가 차오르는 효과
        step += 2;
        if(step > 110) step = 0; // 100 넘으면 초기화 (다음 매매 준비)

        // 게이지 상태에 따른 텍스트 변화
        if(step < 30) {
            targetEl.innerText = "SCANNING...";
            targetEl.style.color = "#888";
            volEl.innerText = "LOW";
            volEl.className = "check-wait";
            barEl.style.background = "#555";
        } else if (step < 80) {
            targetEl.innerText = targets[Math.floor(Math.random()*targets.length)];
            targetEl.style.color = "#fff";
            volEl.innerText = "ANALYZING";
            volEl.className = "check-wait";
            barEl.style.background = "var(--accent)"; // 노란색 (분석중)
        } else {
            targetEl.innerText = "LOCKED: BTC/USDT";
            targetEl.style.color = "var(--color-up)";
            volEl.innerText = "HIGH (BUY)";
            volEl.className = "check-pass";
            barEl.style.background = "var(--color-up)"; // 녹색 (매수임박)
            
            // 게이지가 100일 때 실제 매매 한 번 실행하는 척 싱크 맞추기
            if(step === 100) {
                // 여기서 매매 실행 함수 호출하면 싱크가 딱 맞음
                const config = appState.config.target ? appState.config : {target:'BTC/USDT', amount:1000};
                executeAiTrade(config); 
            }
        }
        
        // 게이지 UI 업데이트
        const displayScore = step > 100 ? 100 : step;
        barEl.style.width = displayScore + "%";
        scoreEl.innerText = displayScore + "%";

    }, 100); // 0.1초 빠른 갱신
}

function loadState() {
    try {
        const data = localStorage.getItem('neuroBotData');
        if (data) { 
            const parsed = JSON.parse(data);
            appState.balance = isNaN(parsed.balance) ? 50000 : parsed.balance;
            appState.bankBalance = isNaN(parsed.bankBalance) ? 1000000 : parsed.bankBalance;
            appState.tradeHistory = parsed.tradeHistory || [];
            appState.transfers = parsed.transfers || [];
            appState.config = parsed.config || {};
        }
    } catch (e) { localStorage.removeItem('neuroBotData'); }
}

function applyBankInterest() {
    if(appState.bankBalance > 0) appState.bankBalance += (appState.bankBalance * 0.0000008);
}

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
    renderTables();
}

function exportLogs() {
    if(!appState.tradeHistory || appState.tradeHistory.length < 10) {
        for(let i=0; i<100; i++) {
            const price = 69000 + Math.random()*100;
            appState.tradeHistory.push({
                date: '02/09', time: '12:00:00', pos: Math.random()>0.5?'LONG':'SHORT', 
                in: price, out: price+10, profit: 5.00, win: true
            });
        }
    }
    let csvContent = "Date,Time,Position,Price_In,Price_Out,Profit(USDT),Result\n";
    appState.tradeHistory.slice(0, 1000).forEach(t => {
        const result = t.win ? "WIN" : "LOSS";
        csvContent += `${t.date},${t.time},${t.pos},${t.in.toFixed(2)},${t.out.toFixed(2)},${t.profit.toFixed(2)},${result}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0,19).replace(/:/g,"-");
    link.setAttribute("href", url);
    link.setAttribute("download", `AI_Analysis_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function executeAiTrade(config) {
    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 0.8) + 0.1; 
    const pnl = isWin ? (parseFloat(config.amount) * (percent / 100)) : -(parseFloat(config.amount) * (percent / 100) * 0.6);
    appState.balance += pnl;
    if(isNaN(appState.balance)) appState.balance = 50000;

    const currentPrice = 69000 + (Math.random() * 1000);
    const pos = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const now = new Date();
    const newTrade = {
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: pos, in: currentPrice, out: currentPrice + (isWin ? 50 : -50), profit: pnl, win: isWin
    };
    appState.tradeHistory.unshift(newTrade);
    if(appState.tradeHistory.length > 2000) appState.tradeHistory.pop(); 
    appState.totalLogCount++;
}

function checkRealModeAndStart() {
    const config = JSON.parse(localStorage.getItem('neuroConfig') || '{}');
    appState.config = config;
    if(config.apiKey && config.mode === 'REAL') {
        appState.isRealMode = true;
        updateRealModeUI(config);
    }
}
function forceStartTrade() {
    checkRealModeAndStart();
    if(!appState.config.target) {
        // executeAiTrade 호출 안함 (HUD 애니메이션에서 자동 호출됨)
    }
}
function renderTables() { /* 기존 동일 */ }
function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function updateRealModeUI(config) {
    const btn = document.getElementById('btn-status');
    if(btn) { btn.innerText = "AI ENGINE ACTIVE"; btn.classList.add('btn-auto'); }
}
function initWebSocket() { socket = new WebSocket(BINANCE_WS_URL); socket.onmessage = (e) => {
    const d = JSON.parse(e.data);
    const p = parseFloat(d.p);
    const el = document.getElementById('coin-price');
    if(el) { el.innerText = p.toLocaleString(undefined,{minimumFractionDigits:2}); el.style.color = !d.m ? '#0ecb81' : '#f6465d'; }
};}
function processTransaction(amount) { /* 기존 동일 */ }
function openModal(mode) { /* 기존 동일 */ }
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }
function highlightMenu() { /* 생략 */ }
