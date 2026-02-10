/* pro-script.js - V33.0 (상세 계산식 & PNL 금액 표시) */
let appState = {
    balance: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], transfers: [], dataCount: 0, 
    config: {}, isRunning: false 
};
let autoTradeInterval = null;
let dataCounterInterval = null;
const SAVE_KEY = 'neuroBotData_V4_FINAL'; 
const CONFIG_KEY = 'neuroConfig_V4';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    renderGlobalUI();
    if (document.getElementById('tv_chart')) initWebSocket();
    
    if (appState.isRunning) {
        if (appState.balance > 0 && appState.config && appState.config.isReady) {
            startSystem(true);
        } else {
            stopSystem(true);
        }
    } else {
        updateButtonState(false);
    }
    
    startDataCounter();
    setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
});

/* --- 시스템 제어 --- */
function startSystem(isSilent = false) {
    if (appState.balance <= 0) {
        if(!isSilent) alert("⚠️ WALLET EMPTY!\nGo to [TRANSFERS] -> [WALLET] to add funds.");
        stopSystem(true); return;
    }
    if (!appState.config || !appState.config.isReady) {
        if(!isSilent) {
            if(confirm("⚠️ SYSTEM NOT CONFIGURED!\nGo to [AI-CORE] to set Keys & Target.")) window.location.href = 'ai-core.html';
        }
        stopSystem(true); return;
    }
    // 시작할 때 startBalance가 0이면 현재 잔고로 설정 (PNL 계산 기준점)
    if(appState.startBalance === 0) appState.startBalance = appState.balance;

    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true; 
    autoTradeInterval = setInterval(executeAiTrade, 1000); 
    updateButtonState(true);
    if(!isSilent) console.log(`System Started: Trading ${appState.config.target}`);
    saveState(); 
}

function stopSystem(isSilent = false) {
    appState.isRunning = false;
    if(autoTradeInterval) clearInterval(autoTradeInterval);
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

/* --- 트레이딩 엔진 --- */
function executeAiTrade() {
    if(!appState.isRunning) return;

    const symbol = appState.config.target || "BTC"; 
    const tradeAmt = appState.config.amount || 1000;
    
    if (appState.balance < 1) { stopSystem(); return; }

    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 0.8) + 0.1;
    let pnl = isWin ? (tradeAmt * (percent / 100)) : -(tradeAmt * (percent / 100) * 0.6);
    pnl = Math.floor(pnl * 100) / 100;

    appState.balance += pnl;
    if (appState.balance < 0) appState.balance = 0;

    const currentPrice = getRealisticPrice(symbol);
    const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const positionLabel = `${symbol} ${direction}`;

    const now = new Date();
    appState.tradeHistory.unshift({
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: positionLabel, in: currentPrice, profit: pnl
    });
    
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
    renderGlobalUI();
}

function getRealisticPrice(symbol) {
    const jitter = Math.random();
    if(symbol === 'BTC') return 69000 + (jitter * 500);
    if(symbol === 'ETH') return 2040 + (jitter * 20);
    if(symbol === 'SOL') return 84 + (jitter * 2);
    if(symbol === 'XRP') return 1.40 + (jitter * 0.05);
    return 100 + (jitter * 10);
}

/* --- 입출금 --- */
let currentTxMode = '';
let isTransactionPending = false; 
function openModal(mode) {
    isTransactionPending = true;
    const modal = document.getElementById('transaction-modal'); if(!modal) return;
    modal.style.display = 'flex'; currentTxMode = mode;
    const btn = document.getElementById('modal-confirm-btn');
    const title = document.getElementById('modal-title');
    const input = document.getElementById('amount-input'); input.value = ''; input.focus();
    if(mode === 'deposit') { title.innerText = "DEPOSIT (Bank → Wallet)"; title.style.color = "var(--color-up)"; btn.onclick = () => processTx(parseFloat(input.value)); } 
    else { title.innerText = "WITHDRAW (Wallet → Bank)"; title.style.color = "var(--color-down)"; btn.onclick = () => processTx(-parseFloat(input.value)); }
}
function processTx(amt) {
    if(!amt || amt===0) return alert("Invalid Amount");
    if(amt > 0) { 
        if(appState.bankBalance < amt) return alert("Low Bank Funds"); 
        appState.bankBalance -= amt; appState.balance += amt; 
        // 입금 시 시작 잔고 재설정 (PNL 리셋 효과)
        appState.startBalance = appState.balance; 
    } else { 
        const abs = Math.abs(amt); 
        if(appState.balance < abs) return alert("Low Wallet Funds"); 
        appState.balance -= abs; appState.bankBalance += abs; 
        appState.startBalance = appState.balance; 
    }
    if(appState.balance < 0.01) appState.balance = 0; 
    if(appState.bankBalance < 0.01) appState.bankBalance = 0;
    appState.transfers.unshift({date: new Date().toISOString().slice(0,10), type: amt>0?"DEPOSIT":"WITHDRAW", amount: Math.abs(amt)});
    saveState(); renderGlobalUI(); closeModal();
}
function calcPercent(pct) { const input = document.getElementById('amount-input'); let base = currentTxMode==='deposit' ? appState.bankBalance : appState.balance; if(pct===100) input.value = base; else input.value = Math.floor(base * (pct/100)*100)/100; }
function closeModal() { document.getElementById('transaction-modal').style.display='none'; isTransactionPending=false; }

/* --- [핵심] 화면 렌더링 (PNL 및 계산식 표시) --- */
function renderGlobalUI() {
    const els = { 
        total: document.getElementById('total-val'), 
        wallet: document.getElementById('wallet-display'), 
        bank: document.getElementById('bank-balance-display'), 
        prof: document.getElementById('real-profit'),
        walletDetail: document.getElementById('wallet-detail-text'), // 지갑 상세 텍스트
        walletPnl: document.getElementById('wallet-pnl-display')     // 지갑 PNL
    };
    
    // 기본 잔고 표시
    if(els.total) els.total.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.wallet) els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    
    // [중요] PNL 계산 (현재 잔고 - 시작 잔고)
    // 만약 startBalance가 없으면 현재 잔고를 기준으로 함
    const base = appState.startBalance > 0 ? appState.startBalance : appState.balance;
    const profit = appState.balance - base;
    const pnlSign = profit >= 0 ? '+' : '-';
    const pnlColorClass = profit >= 0 ? 'text-green' : 'text-red';
    const coinName = appState.config.target ? appState.config.target.split('/')[0] : 'CASH';

    // 1. 메인 화면 PNL 표시
    if(els.prof) { 
        els.prof.innerText = `${pnlSign} $${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits:2})}`; 
        els.prof.className = `num-font ${pnlColorClass}`; 
    }

    // 2. 지갑 화면 PNL 표시
    if(els.walletPnl) {
        els.walletPnl.innerText = `${pnlSign} $${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits:2})}`;
        els.walletPnl.className = `num-font ${pnlColorClass}`;
    }

    // 3. [핵심] 지갑 상세 계산식 표시 (COIN ± PNL = TOTAL)
    if(els.walletDetail) {
        if(appState.balance <= 0) {
            els.walletDetail.innerHTML = `<span style="color:#666">Wallet Empty</span>`;
        } else {
            // 예: SOL + $50.00 = $1,050.00
            const html = `
                <span style="color:#fff; font-weight:bold;">${coinName}</span> 
                <span class="${pnlColorClass}">${pnlSign} $${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits:2})}</span> 
                <span style="color:#666"> = </span> 
                <span style="color:#fff">$${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
            `;
            els.walletDetail.innerHTML = html;
        }
    }
    
    // 리스트 렌더링
    const mainList = document.getElementById('main-ledger-list'); 
    const walletList = document.getElementById('wallet-history-list');
    let listHtml = '';
    if(appState.tradeHistory.length === 0) listHtml = '<div style="padding:20px; text-align:center; color:#666;">NO TRADES YET</div>';
    else { 
        appState.tradeHistory.slice(0,50).forEach(t => { 
            const pnlColor = t.profit >= 0 ? 'text-green' : 'text-red'; 
            listHtml += `<div class="ledger-row"><div style="width:25%" class="ledger-date">${t.time}</div><div style="width:25%" class="ledger-pos ${pnlColor}">${t.pos}</div><div style="width:25%" class="ledger-price">${t.in.toLocaleString()}</div><div style="width:25%" class="ledger-pnl ${pnlColor}">${t.profit>0?'+':''}${t.profit}</div></div>`; 
        }); 
    }
    if(mainList) mainList.innerHTML = listHtml; 
    if(walletList) walletList.innerHTML = listHtml;
    
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) { 
        let bHtml = ''; 
        appState.transfers.forEach(t => { 
            bHtml += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`; 
        }); 
        bankList.innerHTML = bHtml; 
    }
}

/* --- 유틸 --- */
function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(appState)); }
function loadState() { try { const d = localStorage.getItem(SAVE_KEY); if(d) appState = {...appState, ...JSON.parse(d)}; } catch(e){} }
function loadConfig() { try { const d = localStorage.getItem(CONFIG_KEY); if(d) appState.config = JSON.parse(d); } catch(e){} }
function startDataCounter() { setInterval(() => {appState.dataCount+=3; const el=document.getElementById('data-mining-counter'); if(el) el.innerText=appState.dataCount.toLocaleString();}, 100); }
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active'); }); }
function initWebSocket() {} function exportLogs() {} function handleEnter(e) {}
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; }
