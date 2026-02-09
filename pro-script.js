/* pro-script.js - V18.0 (충돌 방지 & 무결점 통합 엔진) */
let appState = {
    balance: 50000.00, bankBalance: 1000000.00, startBalance: 50000.00,
    tradeHistory: [], dataCount: 425102, config: {}, isRealMode: false,
    isRunning: true
};
let autoTradeInterval = null;
let dataCounterInterval = null;

window.addEventListener('load', () => {
    loadState();
    
    // [변경] 헤더 로드 기능 삭제 (HTML에 직접 넣음) -> 하이라이트만 실행
    highlightMenu();

    renderGlobalUI();
    
    // 메인 차트가 있을 때만 소켓 연결 (에러 방지)
    if (document.getElementById('tv_chart')) initWebSocket();

    // 시스템 가동 (팝업 없이 조용히)
    if(appState.isRunning) startSystem(true);
    
    // 데이터 카운터 시작
    startDataCounter();
    
    // 0.5초마다 UI 갱신
    setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
});

/* --- 시스템 제어 --- */
function startSystem(isSilent = false) {
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true;
    autoTradeInterval = setInterval(() => { executeAiTrade(appState.config); }, 1000); 
    startDataCounter();
    updateButtonState(true);
    if(!isSilent) console.log("System Started");
}

function stopSystem(isSilent = false) {
    appState.isRunning = false;
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    updateButtonState(false);
    if(!isSilent) console.log("System Stopped");
    saveState();
}

function updateButtonState(isOn) {
    const btn = document.querySelector('.btn-start');
    if(btn) {
        btn.style.opacity = isOn ? "1" : "0.5";
        btn.innerHTML = isOn ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START';
    }
}

/* --- 데이터 로직 --- */
function executeAiTrade(config) {
    if(!appState.isRunning) return;
    
    // 이자 및 수익 계산
    if(appState.bankBalance > 0) appState.bankBalance += (appState.bankBalance * 0.0000008);
    const isWin = Math.random() > 0.48; 
    const amt = config.amount || 1000;
    const percent = (Math.random() * 0.8) + 0.1; 
    const pnl = isWin ? (amt * (percent / 100)) : -(amt * (percent / 100) * 0.6);
    
    appState.balance += pnl;
    if(isNaN(appState.balance)) appState.balance = 50000;

    // 기록 추가
    const now = new Date();
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: Math.random()>0.5?'LONG':'SHORT', 
        in: 69000 + Math.random()*1000, 
        profit: pnl
    });
    
    if(appState.tradeHistory.length > 500) appState.tradeHistory.pop();
    appState.dataCount++;
}

/* --- 렌더링 --- */
function renderGlobalUI() {
    const totalAssets = appState.balance + (appState.bankBalance || 0);
    const els = {
        total: document.getElementById('total-val'),
        bal: document.getElementById('real-balance'),
        bank: document.getElementById('bank-balance-display'),
        prof: document.getElementById('real-profit')
    };

    // 요소가 있을 때만 값 넣기 (에러 방지)
    if(els.total) els.total.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        els.prof.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }
    
    renderMainLedger();
    renderWalletLedger(); // 지갑용 리스트
    renderBankLedger();   // 은행용 리스트
}

function renderMainLedger() {
    const list = document.getElementById('main-ledger-list');
    if(list) renderList(list, appState.tradeHistory);
}
function renderWalletLedger() {
    const list = document.getElementById('wallet-history-list');
    if(list) renderList(list, appState.tradeHistory);
}
function renderBankLedger() {
    const list = document.getElementById('bank-history-list');
    if(list && appState.transfers) {
        let html = '';
        appState.transfers.forEach(t => {
            html += `<div class="ledger-row">
                <div style="width:30%" class="ledger-date">${t.date.split(' ')[0]}</div>
                <div style="width:30%; font-weight:bold;">${t.type}</div>
                <div style="width:40%; text-align:right;" class="ledger-price">$${t.amount.toLocaleString()}</div>
            </div>`;
        });
        list.innerHTML = html;
    }
}

// 공통 리스트 렌더러
function renderList(el, data) {
    let html = '';
    data.slice(0, 50).forEach(t => {
        const color = t.profit >= 0 ? 'text-green' : 'text-red';
        html += `<div class="ledger-row">
            <div style="width:25%" class="ledger-date">${t.date}<br><span style="color:#666">${t.time}</span></div>
            <div style="width:25%" class="ledger-pos ${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</div>
            <div style="width:25%" class="ledger-price">${t.in.toFixed(0)}</div>
            <div style="width:25%" class="ledger-pnl ${color}">${t.profit.toFixed(2)}</div>
        </div>`;
    });
    el.innerHTML = html;
}

/* --- 유틸 --- */
function startDataCounter() {
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    dataCounterInterval = setInterval(() => {
        appState.dataCount += Math.floor(Math.random() * 5);
        const el = document.getElementById('data-mining-counter');
        if(el) el.innerText = appState.dataCount.toLocaleString();
    }, 50);
}
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function loadState() {
    try {
        const data = localStorage.getItem('neuroBotData');
        if (data) { 
            const parsed = JSON.parse(data);
            appState = {...appState, ...parsed};
            if(isNaN(appState.balance)) appState.balance = 50000;
        }
    } catch(e) {}
}
function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active');
        else el.classList.remove('active');
    });
}
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; new TradingView.widget({"container_id":"modal_tv_chart","symbol":"BINANCE:BTCUSDT","interval":"1","theme":"dark","style":"1","locale":"en","toolbar_bg":"#000","enable_publishing":false,"hide_side_toolbar":false,"autosize":true}); }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; document.getElementById('modal_tv_chart').innerHTML=''; }
function handleEnter(e) { if(e.key==='Enter') openChartModal(); }
function initWebSocket() { socket = new WebSocket(BINANCE_WS_URL); socket.onmessage = (e) => { const d=JSON.parse(e.data); const el=document.getElementById('coin-price'); if(el) { el.innerText=parseFloat(d.p).toLocaleString(); el.style.color=!d.m?'#0ecb81':'#f6465d'; } }; }
function openModal(mode) { document.getElementById('transaction-modal').style.display='flex'; } // 간단 처리
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }
function exportLogs() { /* 생략 */ }
