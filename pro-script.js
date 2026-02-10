/* pro-script.js - V28.0 (완전 초기화: 하드코어 모드) */
let appState = {
    balance: 0.00,        // 지갑: 0원 시작
    bankBalance: 1000.00, // 은행: 1,000달러 시작
    startBalance: 0.00,   // 수익률 계산 기준점
    tradeHistory: [],     // 거래 내역 초기화
    transfers: [],        // 이체 내역 초기화
    dataCount: 0,         // 데이터 카운트 초기화
    config: {}, 
    isRealMode: false,
    isRunning: false      // [중요] 돈이 없으니 일단 정지 상태로 시작
};
let autoTradeInterval = null;
let dataCounterInterval = null;
let currentTxMode = ''; 
let isTransactionPending = false; 

// [중요] 저장소 키를 변경하여 강제 리셋 (이전 데이터 무시)
const SAVE_KEY = 'neuroBotData_RESET_V1';

window.addEventListener('load', () => {
    loadState();
    
    // 리셋 상태이므로 가짜 데이터 생성 안 함 (깨끗하게 시작)
    // if (appState.tradeHistory.length === 0) generateFakeHistory(); 

    highlightMenu();
    renderGlobalUI();
    if (document.getElementById('tv_chart')) initWebSocket();
    
    // 돈이 있어야 시스템 가동 (지갑에 돈이 있으면 자동 시작)
    if(document.getElementById('total-val') && appState.balance > 0) {
        startSystem(true);
    } else {
        // 돈 없으면 정지 상태 표시
        updateButtonState(false);
    }
    
    startDataCounter();
    setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
});

/* --- 입출금 시스템 --- */
function openModal(mode) {
    isTransactionPending = true;
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const input = document.getElementById('amount-input');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    modal.style.display = 'flex';
    input.value = ''; input.focus();
    currentTxMode = mode;

    if (mode === 'deposit') {
        title.innerText = "DEPOSIT (Bank → Wallet)"; title.style.color = "var(--color-up)";
        confirmBtn.onclick = () => processTransaction(parseFloat(input.value));
    } else {
        title.innerText = "WITHDRAW (Wallet → Bank)"; title.style.color = "var(--color-down)";
        confirmBtn.onclick = () => processTransaction(-parseFloat(input.value));
    }
}

function calcPercent(percent) {
    const input = document.getElementById('amount-input');
    let baseAmount = currentTxMode === 'deposit' ? appState.bankBalance : appState.balance;
    if (baseAmount <= 0) { input.value = 0; return; }
    if (percent === 100) input.value = baseAmount;
    else input.value = Math.floor(baseAmount * (percent / 100) * 100) / 100;
}

function closeModal() { 
    document.getElementById('transaction-modal').style.display = 'none'; 
    isTransactionPending = false; 
}

function processTransaction(amount) {
    if (!amount || isNaN(amount) || amount === 0) return alert("⚠️ Please enter a valid amount.");
    
    if (amount > 0) { // 입금
        if (appState.bankBalance < amount) return alert("⛔ INSUFFICIENT BANK FUNDS");
        appState.bankBalance -= amount;
        appState.balance += amount;
        if(appState.bankBalance < 0.000001) appState.bankBalance = 0;
        alert(`✅ DEPOSIT COMPLETE`);
    } else { // 출금
        const absAmount = Math.abs(amount);
        if (appState.balance < absAmount - 0.000001) return alert("⛔ INSUFFICIENT WALLET FUNDS");
        appState.balance -= absAmount;
        appState.bankBalance += absAmount;
        if(appState.balance < 0.000001) appState.balance = 0;
        alert(`✅ WITHDRAW COMPLETE`);
    }
    appState.transfers.unshift({ date: new Date().toISOString().slice(0, 10), type: amount>0?"DEPOSIT":"WITHDRAW", amount: Math.abs(amount) });
    
    // [중요] 입금이 확인되면 시스템 자동 시작해줄까? 일단 저장만 함.
    saveState(); 
    renderGlobalUI(); 
    closeModal();
}

/* --- 시스템 제어 --- */
function startSystem(isSilent = false) {
    // 지갑에 돈이 없으면 시작 불가
    if (appState.balance <= 0) {
        if(!isSilent) alert("⚠️ WALLET IS EMPTY!\nPlease DEPOSIT funds from Bank first.");
        return;
    }

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
    const btn = document.getElementById('btn-main-control');
    if(btn) {
        btn.style.opacity = isOn ? "1" : "0.5";
        btn.innerHTML = isOn ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START';
    }
}

/* --- 트레이딩 로직 --- */
function executeAiTrade(config) {
    if(!appState.isRunning || isTransactionPending) return;
    
    // 돈 다 잃으면 정지
    if (appState.balance <= 0) {
        stopSystem(true);
        alert("⚠️ BALANCE DEPLETED. GAME OVER.");
        return;
    }

    const HOT_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'NKN', 'GPS'];
    let symbol = config.target ? config.target.split('/')[0] : HOT_COINS[Math.floor(Math.random() * HOT_COINS.length)];
    
    // 투자금: 잔고의 10% 또는 1000불 중 작은 것 (파산 방지)
    let tradeAmt = parseFloat(config.amount) || 1000;
    if (tradeAmt > appState.balance) tradeAmt = appState.balance; // 잔고보다 크게 베팅 불가

    // 은행 이자 (아주 조금)
    if(appState.bankBalance > 0) appState.bankBalance += (appState.bankBalance * 0.0000008);

    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 0.8) + 0.1;
    const pnl = isWin ? (tradeAmt * (percent / 100)) : -(tradeAmt * (percent / 100) * 0.6);
    
    appState.balance += pnl;
    
    // 0원 방어 로직
    if (appState.balance < 0) appState.balance = 0;

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
    
    if(appState.tradeHistory.length > 100) appState.tradeHistory.pop();
    appState.dataCount++;
    renderGlobalUI();
}

function getRealisticPrice(symbol) {
    const jitter = Math.random();
    switch(symbol) {
        case 'BTC': return 69000 + (jitter * 500); case 'ETH': return 2040 + (jitter * 20); case 'SOL': return 84 + (jitter * 2); case 'XRP': return 1.40 + (jitter * 0.05); case 'DOGE': return 0.094 + (jitter * 0.005); case 'NKN': return 0.0076 + (jitter * 0.001); case 'GPS': return 0.013 + (jitter * 0.002); default: return 100 + (jitter * 10);
    }
}

/* --- 화면 렌더링 --- */
function renderGlobalUI() {
    const totalAssets = appState.balance + (appState.bankBalance || 0);
    const els = { total: document.getElementById('total-val'), wallet: document.getElementById('wallet-display'), bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit') };
    
    if(els.total) els.total.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.wallet) els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    
    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        els.prof.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }

    const mainList = document.getElementById('main-ledger-list');
    const walletList = document.getElementById('wallet-history-list');
    
    // 데이터가 없으면 안내 문구
    if (!appState.tradeHistory || appState.tradeHistory.length === 0) {
        const emptyMsg = '<div style="padding:40px; text-align:center; color:#555;"><i class="fas fa-inbox" style="font-size:2rem; margin-bottom:10px;"></i><br>NO TRADES YET</div>';
        if(mainList) mainList.innerHTML = emptyMsg;
        if(walletList) walletList.innerHTML = emptyMsg;
    } else {
        if(mainList) renderList(mainList, appState.tradeHistory);
        if(walletList) renderList(walletList, appState.tradeHistory);
    }
    
    const bankList = document.getElementById('bank-history-list');
    if(bankList) {
        if (!appState.transfers || appState.transfers.length === 0) {
            bankList.innerHTML = '<div style="padding:40px; text-align:center; color:#555;">NO TRANSFERS</div>';
        } else {
            let html = '';
            appState.transfers.slice(0, 50).forEach(t => {
                const isDep = t.type === 'DEPOSIT';
                html += `<div class="ledger-row"><div style="width:30%" class="ledger-date">${t.date}</div><div style="width:30%; font-weight:bold; color:${isDep?'#0f0':'#f00'}">${t.type}</div><div style="width:40%; text-align:right;" class="ledger-price">$${t.amount.toLocaleString(undefined, {maximumFractionDigits:2})}</div></div>`;
            });
            bankList.innerHTML = html;
        }
    }
}

function renderList(el, data) {
    let html = '';
    data.slice(0, 50).forEach(t => {
        const pnlColor = t.profit >= 0 ? 'text-green' : 'text-red';
        const posColor = t.pos.includes('LONG') ? 'text-green' : 'text-red';
        const priceDisplay = t.in < 1 ? t.in.toFixed(4) : t.in.toLocaleString(undefined, {maximumFractionDigits:2});
        html += `<div class="ledger-row"><div style="width:25%" class="ledger-date">${t.date}<br><span style="color:#666">${t.time}</span></div><div style="width:25%" class="ledger-pos ${posColor}">${t.pos}</div><div style="width:25%" class="ledger-price">${priceDisplay}</div><div style="width:25%" class="ledger-pnl ${pnlColor}">${t.profit.toFixed(2)}</div></div>`;
    });
    el.innerHTML = html;
}

/* --- 유틸 --- */
function startDataCounter() { if(dataCounterInterval) clearInterval(dataCounterInterval); dataCounterInterval = setInterval(() => { appState.dataCount += Math.floor(Math.random() * 5); const el = document.getElementById('data-mining-counter'); if(el) el.innerText = appState.dataCount.toLocaleString(); }, 50); }
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(appState)); } // [중요] 새 키로 저장
function loadState() { try { const data = localStorage.getItem(SAVE_KEY); if (data) { const parsed = JSON.parse(data); appState = {...appState, ...parsed}; } } catch(e) {} }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active'); }); }
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; new TradingView.widget({"container_id":"modal_tv_chart","symbol":"BINANCE:BTCUSDT","interval":"1","theme":"dark","style":"1","locale":"en","toolbar_bg":"#000","enable_publishing":false,"hide_side_toolbar":false,"autosize":true}); }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; document.getElementById('modal_tv_chart').innerHTML=''; }
function handleEnter(e) { if(e.key==='Enter') openChartModal(); }
function initWebSocket() { socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade'); socket.onmessage = (e) => { const d=JSON.parse(e.data); const el=document.getElementById('coin-price'); if(el) { el.innerText=parseFloat(d.p).toLocaleString(); el.style.color=!d.m?'#0ecb81':'#f6465d'; } }; }
function exportLogs() { /* 생략 */ }
