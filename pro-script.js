/* pro-script.js - V30.0 (엄격한 규칙 & 코인 고정) */
let appState = {
    balance: 0.00, bankBalance: 0.00, startBalance: 0.00, // 0원으로 시작
    tradeHistory: [], transfers: [], dataCount: 0, 
    config: {}, isRunning: false
};
let autoTradeInterval = null;
let dataCounterInterval = null;
const SAVE_KEY = 'neuroBotData_V3'; // 저장소 키 변경 (초기화)
const CONFIG_KEY = 'neuroConfig_V3'; // 설정 키 변경

window.addEventListener('load', () => {
    loadState();
    loadConfig(); // 설정 불러오기
    highlightMenu();
    renderGlobalUI();
    if (document.getElementById('tv_chart')) initWebSocket();
    
    // 자동 시작 방지 (사용자가 눌러야 함)
    updateButtonState(false);
    startDataCounter();
    setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
});

/* --- 시스템 시작/정지 --- */
function startSystem() {
    // 1. 지갑 돈 체크
    if (appState.balance <= 0) {
        return alert("⚠️ WALLET EMPTY!\nGo to [TRANSFERS] -> [WALLET] to add funds.");
    }
    // 2. 설정 체크 (키, 코인, 금액)
    if (!appState.config || !appState.config.isReady) {
        if(confirm("⚠️ SYSTEM NOT CONFIGURED!\nGo to [AI-CORE] to set Keys & Target.")) {
            window.location.href = 'ai-core.html';
        }
        return;
    }

    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true;
    autoTradeInterval = setInterval(executeAiTrade, 1000); 
    updateButtonState(true);
    console.log(`System Started: Trading ${appState.config.target}`);
}

function stopSystem() {
    appState.isRunning = false;
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    updateButtonState(false);
    saveState();
}

/* --- [핵심] 트레이딩 엔진 (고정된 코인만 거래) --- */
function executeAiTrade() {
    if(!appState.isRunning) return;

    // 설정된 코인만 가져옴 (랜덤 X)
    const symbol = appState.config.target || "BTC"; // 기본값 BTC지만 설정 있으면 그거 따름
    const tradeAmt = appState.config.amount || 1000;
    
    // 잔고 부족하면 정지
    if (appState.balance < 1) {
        stopSystem();
        return alert("⚠️ INSUFFICIENT BALANCE FOR TRADING");
    }

    // 승률 로직
    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 0.8) + 0.1;
    let pnl = isWin ? (tradeAmt * (percent / 100)) : -(tradeAmt * (percent / 100) * 0.6);
    
    // 소수점 정리
    pnl = Math.floor(pnl * 100) / 100;

    appState.balance += pnl;
    if (appState.balance < 0) appState.balance = 0;

    const currentPrice = getRealisticPrice(symbol);
    const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    
    // [중요] 장부에 찍히는 이름: "SOL LONG" 
    const positionLabel = `${symbol} ${direction}`;

    const now = new Date();
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: positionLabel, 
        in: currentPrice, 
        profit: pnl
    });
    
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
    renderGlobalUI();
}

// 코인별 가격 (솔라나 선택하면 솔라나 가격 나옴)
function getRealisticPrice(symbol) {
    const jitter = Math.random();
    if(symbol === 'BTC') return 69000 + (jitter * 500);
    if(symbol === 'ETH') return 2040 + (jitter * 20);
    if(symbol === 'SOL') return 84 + (jitter * 2);  // SOL 가격
    if(symbol === 'XRP') return 1.40 + (jitter * 0.05);
    return 100 + (jitter * 10);
}

/* --- 입출금 로직 (동일) --- */
// (openModal, calcPercent, closeModal, processTransaction 코드는 위와 동일하므로 생략하지 않고 넣어드립니다. 중요하니까요.)
let currentTxMode = '';
function openModal(mode) {
    const modal = document.getElementById('transaction-modal');
    if(!modal) return;
    modal.style.display = 'flex';
    currentTxMode = mode;
    const btn = document.getElementById('modal-confirm-btn');
    const title = document.getElementById('modal-title');
    const input = document.getElementById('amount-input');
    input.value = ''; input.focus();

    if(mode === 'deposit') {
        title.innerText = "DEPOSIT (Bank → Wallet)"; title.style.color = "var(--color-up)";
        btn.onclick = () => processTx(parseFloat(input.value));
    } else {
        title.innerText = "WITHDRAW (Wallet → Bank)"; title.style.color = "var(--color-down)";
        btn.onclick = () => processTx(-parseFloat(input.value));
    }
}
function processTx(amt) {
    if(!amt || amt===0) return alert("Invalid Amount");
    if(amt > 0) { // 입금
        if(appState.bankBalance < amt) return alert("Low Bank Funds");
        appState.bankBalance -= amt; appState.balance += amt;
    } else { // 출금
        const abs = Math.abs(amt);
        if(appState.balance < abs) return alert("Low Wallet Funds");
        appState.balance -= abs; appState.bankBalance += abs;
    }
    // 잔돈 0 처리
    if(appState.balance < 0.01) appState.balance = 0;
    if(appState.bankBalance < 0.01) appState.bankBalance = 0;

    appState.transfers.unshift({date: new Date().toISOString().slice(0,10), type: amt>0?"DEPOSIT":"WITHDRAW", amount: Math.abs(amt)});
    saveState(); renderGlobalUI(); 
    document.getElementById('transaction-modal').style.display='none';
}
function calcPercent(pct) {
    const input = document.getElementById('amount-input');
    let base = currentTxMode==='deposit' ? appState.bankBalance : appState.balance;
    if(pct===100) input.value = base;
    else input.value = Math.floor(base * (pct/100)*100)/100;
}
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }

/* --- 유틸 --- */
function updateButtonState(isOn) {
    const btn = document.getElementById('btn-main-control');
    if(btn) {
        btn.style.opacity = isOn ? "1" : "0.5";
        btn.innerHTML = isOn ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START';
    }
}
function renderGlobalUI() {
    const els = { total: document.getElementById('total-val'), wallet: document.getElementById('wallet-display'), bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit') };
    
    // 메인: 지갑 잔고만 표시
    if(els.total) els.total.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.wallet) els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    // 리스트 렌더링
    const mainList = document.getElementById('main-ledger-list');
    const walletList = document.getElementById('wallet-history-list');
    
    let html = '';
    if(appState.tradeHistory.length === 0) html = '<div style="padding:20px; text-align:center; color:#666;">READY TO TRADE</div>';
    else {
        appState.tradeHistory.forEach(t => {
            const pnlColor = t.profit >= 0 ? 'text-green' : 'text-red';
            html += `<div class="ledger-row">
                <div style="width:25%" class="ledger-date">${t.time}</div>
                <div style="width:25%" class="ledger-pos ${pnlColor}">${t.pos}</div>
                <div style="width:25%" class="ledger-price">${t.in.toLocaleString()}</div>
                <div style="width:25%" class="ledger-pnl ${pnlColor}">${t.profit>0?'+':''}${t.profit}</div>
            </div>`;
        });
    }
    if(mainList) mainList.innerHTML = html;
    if(walletList) walletList.innerHTML = html;

    // 은행 내역
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) {
        let bHtml = '';
        appState.transfers.forEach(t => {
            bHtml += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`;
        });
        bankList.innerHTML = bHtml;
    }
}

function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(appState)); }
function loadState() { try { const d = localStorage.getItem(SAVE_KEY); if(d) appState = {...appState, ...JSON.parse(d)}; } catch(e){} }
function loadConfig() { try { const d = localStorage.getItem(CONFIG_KEY); if(d) appState.config = JSON.parse(d); } catch(e){} }
function startDataCounter() { setInterval(() => {appState.dataCount+=3; const el=document.getElementById('data-mining-counter'); if(el) el.innerText=appState.dataCount.toLocaleString();}, 100); }
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active'); }); }
function initWebSocket() {} // 간소화
function exportLogs() {} 
function handleEnter(e) {}
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; }
