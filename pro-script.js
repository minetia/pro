/* pro-script.js - V25.0 (잔고 표시 분리 & 안전 거래) */
let appState = {
    balance: 50000.00, bankBalance: 1000000.00, startBalance: 50000.00,
    tradeHistory: [], transfers: [], dataCount: 425102, config: {}, isRealMode: false,
    isRunning: true
};
let autoTradeInterval = null;
let dataCounterInterval = null;
let currentTxMode = ''; 
// [NEW] 거래 중일 때 트레이딩 멈추는 플래그
let isTransactionPending = false; 

window.addEventListener('load', () => {
    loadState();
    highlightMenu();
    renderGlobalUI();
    if (document.getElementById('tv_chart')) initWebSocket();
    if(appState.isRunning) startSystem(true);
    startDataCounter();
    setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
});

/* --- [핵심] 입출금 시스템 --- */

function openModal(mode) {
    // [중요] 모달 열리면 트레이딩 잠시 멈춤 (금액 고정)
    isTransactionPending = true;

    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const input = document.getElementById('amount-input');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    modal.style.display = 'flex';
    input.value = ''; 
    input.focus();
    
    currentTxMode = mode;

    if (mode === 'deposit') {
        title.innerText = "DEPOSIT (Bank → Wallet)";
        title.style.color = "var(--color-up)";
        confirmBtn.onclick = () => processTransaction(parseFloat(input.value));
    } else {
        title.innerText = "WITHDRAW (Wallet → Bank)";
        title.style.color = "var(--color-down)";
        confirmBtn.onclick = () => processTransaction(-parseFloat(input.value));
    }
}

function closeModal() { 
    document.getElementById('transaction-modal').style.display = 'none'; 
    // 모달 닫으면 트레이딩 재개
    isTransactionPending = false;
}

function calcPercent(percent) {
    const input = document.getElementById('amount-input');
    let baseAmount = 0;

    if (currentTxMode === 'deposit') {
        baseAmount = appState.bankBalance; 
    } else {
        baseAmount = appState.balance; 
    }

    if (baseAmount <= 0) { input.value = 0; return; }

    if (percent === 100) {
        input.value = baseAmount; 
    } else {
        const calcValue = baseAmount * (percent / 100);
        input.value = Math.floor(calcValue * 100) / 100; 
    }
}

function processTransaction(amount) {
    if (!amount || isNaN(amount) || amount === 0) {
        alert("⚠️ Please enter a valid amount.");
        return;
    }

    if (amount > 0) { // 입금
        if (appState.bankBalance < amount) return alert("⛔ INSUFFICIENT BANK FUNDS");
        appState.bankBalance -= amount;
        appState.balance += amount;
        if(appState.bankBalance < 0.000001) appState.bankBalance = 0; // 잔돈 털기
        alert(`✅ DEPOSIT COMPLETE\nWallet: $${appState.balance.toLocaleString()}`);
    } else { // 출금
        const absAmount = Math.abs(amount);
        // 미세 오차 허용 비교
        if (appState.balance < absAmount - 0.000001) return alert("⛔ INSUFFICIENT WALLET FUNDS");
        
        appState.balance -= absAmount;
        appState.bankBalance += absAmount;
        
        // [중요] 완벽한 0원 만들기
        if(appState.balance < 0.000001) appState.balance = 0;

        alert(`✅ WITHDRAW COMPLETE\nSent to Bank. Wallet is now $${appState.balance.toLocaleString()}`);
    }

    appState.transfers.unshift({ date: new Date().toISOString().slice(0, 10), type: amount>0?"DEPOSIT":"WITHDRAW", amount: Math.abs(amount) });
    saveState();
    renderGlobalUI();
    closeModal();
}

/* --- 트레이딩 로직 --- */
function executeAiTrade(config) {
    // [중요] 멈춰있거나 거래창이 열려있으면 매매 안함
    if(!appState.isRunning || isTransactionPending) return;

    // ... 기존 로직 ...
    const targetPair = config.target || "BTC/USDT";
    const symbol = targetPair.split('/')[0];
    const tradeAmt = parseFloat(config.amount) || 10000;
    
    // 이자
    if(appState.bankBalance > 0) appState.bankBalance += (appState.bankBalance * 0.0000008);

    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 0.8) + 0.1;
    const pnl = isWin ? (tradeAmt * (percent / 100)) : -(tradeAmt * (percent / 100) * 0.6);
    
    appState.balance += pnl;
    if(isNaN(appState.balance)) appState.balance = 50000;

    const currentPrice = getRealisticPrice(symbol);
    const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const positionLabel = `${symbol} ${direction}`;

    const now = new Date();
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: positionLabel, 
        in: currentPrice, 
        profit: pnl
    });
    
    if(appState.tradeHistory.length > 500) appState.tradeHistory.pop();
    appState.dataCount++;
}

// ... (getRealisticPrice, startSystem, stopSystem 등 기존 함수 유지) ...
function getRealisticPrice(symbol) {
    const jitter = Math.random();
    switch(symbol) {
        case 'BTC': return 96000 + (jitter * 500);
        case 'ETH': return 2700 + (jitter * 20);
        case 'SOL': return 180 + (jitter * 5);
        case 'XRP': return 2.4 + (jitter * 0.1);
        case 'DOGE': return 0.28 + (jitter * 0.01);
        default: return 100 + (jitter * 10);
    }
}
function startSystem(isSilent = false) { if(autoTradeInterval) clearInterval(autoTradeInterval); appState.isRunning = true; autoTradeInterval = setInterval(() => { executeAiTrade(appState.config); }, 1000); startDataCounter(); updateButtonState(true); if(!isSilent) console.log("System Started"); }
function stopSystem(isSilent = false) { appState.isRunning = false; if(autoTradeInterval) clearInterval(autoTradeInterval); if(dataCounterInterval) clearInterval(dataCounterInterval); updateButtonState(false); if(!isSilent) console.log("System Stopped"); saveState(); }
function updateButtonState(isOn) { const btn = document.querySelector('.btn-start'); if(btn) { btn.style.opacity = isOn ? "1" : "0.5"; btn.innerHTML = isOn ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START'; } }
function startDataCounter() { if(dataCounterInterval) clearInterval(dataCounterInterval); dataCounterInterval = setInterval(() => { appState.dataCount += Math.floor(Math.random() * 5); const el = document.getElementById('data-mining-counter'); if(el) el.innerText = appState.dataCount.toLocaleString(); }, 50); }
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function loadState() { try { const data = localStorage.getItem('neuroBotData'); if (data) { const parsed = JSON.parse(data); appState = {...appState, ...parsed}; if(isNaN(appState.balance)) appState.balance = 50000; if(!appState.transfers) appState.transfers = []; } } catch(e) {} }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active'); }); }
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; new TradingView.widget({"container_id":"modal_tv_chart","symbol":"BINANCE:BTCUSDT","interval":"1","theme":"dark","style":"1","locale":"en","toolbar_bg":"#000","enable_publishing":false,"hide_side_toolbar":false,"autosize":true}); }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; document.getElementById('modal_tv_chart').innerHTML=''; }
function handleEnter(e) { if(e.key==='Enter') openChartModal(); }
function initWebSocket() { socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade'); socket.onmessage = (e) => { const d=JSON.parse(e.data); const el=document.getElementById('coin-price'); if(el) { el.innerText=parseFloat(d.p).toLocaleString(); el.style.color=!d.m?'#0ecb81':'#f6465d'; } }; }
function exportLogs() { /* 생략 */ }

/* --- [NEW] 화면 렌더링 (지갑 vs 전체 분리) --- */
function renderGlobalUI() {
    const totalAssets = appState.balance + (appState.bankBalance || 0);
    
    // 1. 공통 요소 (메인 차트 등)
    const elTotal = document.getElementById('total-val'); 
    
    // 2. 페이지별 요소 확인
    const elWallet = document.getElementById('wallet-display'); // 지갑 페이지 전용
    const elBank = document.getElementById('bank-balance-display'); // 은행 페이지 전용
    const elProf = document.getElementById('real-profit'); // 메인 페이지 전용

    // 메인화면: 총 자산 표시
    if (elTotal) {
        elTotal.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    }

    // [중요] 지갑 페이지: 지갑 잔고만 표시!
    if (elWallet) {
        elWallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    }

    // 은행 페이지: 은행 잔고 표시
    if (elBank) {
        elBank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    }

    // 수익금 표시
    if (elProf) {
        const profit = appState.balance - appState.startBalance;
        elProf.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        elProf.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }
    
    // 리스트 렌더링
    const mainList = document.getElementById('main-ledger-list');
    const walletList = document.getElementById('wallet-history-list');
    if(mainList) renderList(mainList, appState.tradeHistory);
    if(walletList) renderList(walletList, appState.tradeHistory);
    
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) {
        let html = '';
        appState.transfers.forEach(t => {
            const isDep = t.type === 'DEPOSIT';
            html += `<div class="ledger-row"><div style="width:30%" class="ledger-date">${t.date}</div><div style="width:30%; font-weight:bold; color:${isDep?'#0f0':'#f00'}">${t.type}</div><div style="width:40%; text-align:right;" class="ledger-price">$${t.amount.toLocaleString()}</div></div>`;
        });
        bankList.innerHTML = html;
    }
}
