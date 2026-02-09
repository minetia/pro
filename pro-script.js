/* pro-script.js - V21.0 (퍼센트 계산 기능 탑재) */
let appState = {
    balance: 50000.00, bankBalance: 1000000.00, startBalance: 50000.00,
    tradeHistory: [], transfers: [], dataCount: 425102, config: {}, isRealMode: false,
    isRunning: true
};
let autoTradeInterval = null;
let dataCounterInterval = null;
// [NEW] 현재 거래 모드 기억 (deposit 또는 withdraw)
let currentTxMode = ''; 

window.addEventListener('load', () => {
    loadState();
    highlightMenu();
    renderGlobalUI();
    if (document.getElementById('tv_chart')) initWebSocket();
    if(appState.isRunning) startSystem(true);
    startDataCounter();
    setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
});

/* --- [핵심] 입출금 및 퍼센트 계산 --- */

function openModal(mode) {
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const input = document.getElementById('amount-input');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    modal.style.display = 'flex';
    input.value = ''; 
    input.focus();
    
    // [중요] 현재 모드 저장 (퍼센트 계산을 위해)
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

// [NEW] 퍼센트 계산 함수
function calcPercent(percent) {
    const input = document.getElementById('amount-input');
    let baseAmount = 0;

    // 모드에 따라 기준 잔고가 다름
    if (currentTxMode === 'deposit') {
        baseAmount = appState.bankBalance; // 입금은 은행 잔고 기준
    } else {
        baseAmount = appState.balance; // 출금은 지갑 잔고 기준
    }

    // 계산 (소수점 2자리)
    const calcValue = baseAmount * (percent / 100);
    input.value = Math.floor(calcValue * 100) / 100; // 소수점 2자리 밑 버림
}

function closeModal() { document.getElementById('transaction-modal').style.display = 'none'; }

function processTransaction(amount) {
    if (!amount || isNaN(amount) || amount === 0) {
        alert("⚠️ Please enter a valid amount.");
        return;
    }
    // 1. 입금 (은행 -> 지갑)
    if (amount > 0) {
        if (appState.bankBalance < amount) return alert("⛔ INSUFFICIENT BANK FUNDS!");
        appState.bankBalance -= amount;
        appState.balance += amount;
        alert(`✅ DEPOSIT SUCCESSFUL\nMoved $${amount.toLocaleString()} to Wallet.`);
    } 
    // 2. 출금 (지갑 -> 은행)
    else {
        const absAmount = Math.abs(amount);
        if (appState.balance < absAmount) return alert("⛔ INSUFFICIENT WALLET FUNDS!");
        appState.balance -= absAmount;
        appState.bankBalance += absAmount;
        alert(`✅ WITHDRAW SUCCESSFUL\nMoved $${absAmount.toLocaleString()} to Bank.`);
    }
    // 기록 및 저장
    const type = amount > 0 ? "DEPOSIT" : "WITHDRAW";
    appState.transfers.unshift({ date: new Date().toISOString().slice(0, 10), type: type, amount: Math.abs(amount) });
    saveState();
    renderGlobalUI();
    closeModal();
}

/* --- 기존 시스템 유지 --- */
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
    if(btn) { btn.style.opacity = isOn ? "1" : "0.5"; btn.innerHTML = isOn ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START'; }
}
function executeAiTrade(config) {
    if(!appState.isRunning) return;
    const targetPair = config.target || "BTC/USDT";
    const symbol = targetPair.split('/')[0];
    const tradeAmt = parseFloat(config.amount) || 10000;
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
        date: `${now.getMonth()+1}/${now.getDate()}`, time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: positionLabel, in: currentPrice, profit: pnl
    });
    if(appState.tradeHistory.length > 500) appState.tradeHistory.pop();
    appState.dataCount++;
}
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
function renderGlobalUI() {
    const totalAssets = appState.balance + (appState.bankBalance || 0);
    const els = { total: document.getElementById('total-val'), bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit') };
    if(els.total) els.total.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        els.prof.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }
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
function renderList(el, data) {
    let html = '';
    data.slice(0, 50).forEach(t => {
        const pnlColor = t.profit >= 0 ? 'text-green' : 'text-red';
        const posColor = t.pos.includes('LONG') ? 'text-green' : 'text-red';
        html += `<div class="ledger-row"><div style="width:25%" class="ledger-date">${t.date}<br><span style="color:#666">${t.time}</span></div><div style="width:25%" class="ledger-pos ${posColor}">${t.pos}</div><div style="width:25%" class="ledger-price">${t.in.toLocaleString(undefined, {maximumFractionDigits:2})}</div><div style="width:25%" class="ledger-pnl ${pnlColor}">${t.profit.toFixed(2)}</div></div>`;
    });
    el.innerHTML = html;
}
function startDataCounter() {
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    dataCounterInterval = setInterval(() => { appState.dataCount += Math.floor(Math.random() * 5); const el = document.getElementById('data-mining-counter'); if(el) el.innerText = appState.dataCount.toLocaleString(); }, 50);
}
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function loadState() { try { const data = localStorage.getItem('neuroBotData'); if (data) { const parsed = JSON.parse(data); appState = {...appState, ...parsed}; if(isNaN(appState.balance)) appState.balance = 50000; if(!appState.transfers) appState.transfers = []; } } catch(e) {} }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active'); }); }
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; new TradingView.widget({"container_id":"modal_tv_chart","symbol":"BINANCE:BTCUSDT","interval":"1","theme":"dark","style":"1","locale":"en","toolbar_bg":"#000","enable_publishing":false,"hide_side_toolbar":false,"autosize":true}); }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; document.getElementById('modal_tv_chart').innerHTML=''; }
function handleEnter(e) { if(e.key==='Enter') openChartModal(); }
function initWebSocket() { socket = new WebSocket(BINANCE_WS_URL); socket.onmessage = (e) => { const d=JSON.parse(e.data); const el=document.getElementById('coin-price'); if(el) { el.innerText=parseFloat(d.p).toLocaleString(); el.style.color=!d.m?'#0ecb81':'#f6465d'; } }; }
function exportLogs() { /* 생략 */ }
