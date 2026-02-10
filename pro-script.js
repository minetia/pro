/* pro-script.js - V43.0 (Strict Fund Check & UI Fix) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0     
};
let autoTradeInterval = null;
let dataCounterInterval = null;
const SAVE_KEY = 'neuroBotData_V43_FINAL';
const CONFIG_KEY = 'neuroConfig_V43_FINAL';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    if(document.getElementById('tab-holdings')) showTab('holdings');
    
    // 자동 재시작 확인
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
    renderGlobalUI();
});

/* --- [중요] 시스템 시작 (잔고 검증) --- */
function startSystem(isSilent = false) {
    if (appState.balance <= 0) {
        if(!isSilent) alert("⚠️ 지갑 잔고가 0원입니다. [입출금]에서 충전해주세요.");
        stopSystem(true); return;
    }
    if (!appState.config || !appState.config.isReady) {
        if(!isSilent) {
            if(confirm("⚠️ AI 설정이 필요합니다. 이동할까요?")) window.location.href = 'ai-core.html';
        }
        stopSystem(true); return;
    }

    // [핵심] 설정 금액 검증 (Strict Mode)
    let setAmount = appState.config.amount || 0;
    
    // 지갑 잔고보다 설정액이 크면 실행 차단
    if (setAmount > appState.balance) {
        if(!isSilent) {
            alert(`⛔ [잔고 부족]\n설정 금액($${setAmount})이 보유 자산($${appState.balance})보다 큽니다.\nAI 설정에서 금액을 줄이거나 입금하세요.`);
        }
        stopSystem(true); 
        return; 
    }

    // 통과 시 실행
    appState.runningCoin = appState.config.target.split('/')[0]; 
    appState.investedAmount = setAmount;
    appState.cash = appState.balance - setAmount; 
    
    if(appState.startBalance === 0) appState.startBalance = appState.balance;
    if(appState.openOrders.length === 0) generateFakeOpenOrders(appState.runningCoin);

    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true; 
    autoTradeInterval = setInterval(executeAiTrade, 1000); 
    
    updateButtonState(true);
    if(!isSilent) console.log(`System Started: ${appState.runningCoin}`);
    saveState(); 
}

function stopSystem(isSilent = false) {
    appState.isRunning = false;
    appState.runningCoin = null;
    appState.investedAmount = 0;
    appState.cash = appState.balance; // 전액 현금화
    appState.openOrders = []; 
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    updateButtonState(false);
    saveState(); 
}

/* --- 트레이딩 엔진 --- */
function executeAiTrade() {
    if(!appState.isRunning) return;

    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 0.8) + 0.1; 
    let pnl = isWin ? (appState.investedAmount * (percent / 100)) : -(appState.investedAmount * (percent / 100) * 0.6);
    
    appState.balance += pnl;
    if (appState.balance < 0) { appState.balance = 0; stopSystem(); return; }

    const coin = appState.runningCoin;
    const price = getRealisticPrice(coin);
    const type = Math.random() > 0.5 ? '매수' : '매도';
    const volume = (appState.investedAmount / price).toFixed(6);
    const total = appState.investedAmount;
    const fee = total * 0.0005; 
    const net = type === '매수' ? total + fee : total - fee;

    const tradeRecord = {
        time: new Date().toLocaleTimeString('en-GB'),
        coin: coin,
        market: 'USDT',
        type: type,
        vol: volume,
        price: price.toLocaleString(),
        total: total.toFixed(2), // 거래 총액
        fee: fee.toFixed(2),
        net: net.toFixed(2)
    };

    appState.tradeHistory.unshift(tradeRecord);
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
    renderGlobalUI();
}

/* --- 렌더링 --- */
function renderGlobalUI() {
    const els = { 
        total: document.getElementById('total-val'), 
        wallet: document.getElementById('wallet-display'), 
        avail: document.getElementById('avail-cash'),
        bank: document.getElementById('bank-balance-display'), 
        prof: document.getElementById('real-profit') 
    };
    
    // 금액 표시 (현금은 실행 중엔 남은 돈, 정지 중엔 전체 돈)
    const currentCash = appState.isRunning ? appState.cash : appState.balance;

    if(els.total) els.total.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.wallet) els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.avail) els.avail.innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    // 수익률
    const base = appState.startBalance > 0 ? appState.startBalance : appState.balance;
    const profit = appState.balance - base;
    const profitPercent = base > 0 ? (profit / base) * 100 : 0;
    const pnlColor = profit >= 0 ? 'text-green' : 'text-red';
    if(els.prof) els.prof.innerHTML = `<span class="${pnlColor}">${profit>=0?'+':''}${profitPercent.toFixed(2)}%</span> ($${profit.toFixed(2)})`;

    // [메인 리스트] (CSS 클래스 적용으로 깨짐 방지)
    const mainList = document.getElementById('main-ledger-list');
    if(mainList) {
        if(appState.tradeHistory.length === 0) {
            mainList.innerHTML = '<div style="padding:40px; text-align:center; color:#444;">NO TRADES YET</div>';
        } else {
            let html = '';
            appState.tradeHistory.slice(0, 50).forEach(t => {
                const pnlColor = t.type === '매수' ? 'text-green' : 'text-red'; 
                html += `
                <div class="ledger-row">
                    <div class="col-time">${t.time}</div>
                    <div class="col-coin">${t.coin} <span class="${pnlColor}" style="font-size:0.7rem;">${t.type}</span></div>
                    <div class="col-price">${t.price}</div>
                    <div class="col-pnl ${t.net >= t.total ? 'text-green' : 'text-red'}">${t.net}</div>
                </div>`;
            });
            mainList.innerHTML = html;
        }
    }

    // [지갑 페이지] 파이차트 및 보유현황
    if(document.getElementById('holdings-list')) {
        const invested = appState.isRunning ? (appState.balance - appState.cash) : 0;
        const total = appState.balance > 0 ? appState.balance : 1;
        const investPercent = (invested / total) * 100;
        const cashPercent = 100 - investPercent;

        const pie = document.getElementById('portfolio-pie');
        if(pie) {
            // 투자 중이면 [노랑|회색], 아니면 [회색 100%]
            if(appState.isRunning && invested > 0) {
                pie.style.background = `conic-gradient(var(--accent) 0% ${investPercent}%, #444 ${investPercent}% 100%)`;
            } else {
                pie.style.background = `conic-gradient(#444 0% 100%)`; // 전체 회색 (현금)
            }
        }

        const holdingsList = document.getElementById('holdings-list');
        let hHtml = '';
        
        // 1. 투자 코인 (실행 중일 때만)
        if(appState.isRunning && invested > 0) {
            hHtml += `
                <div style="display:flex; justify-content:space-between; padding:12px 5px; border-bottom:1px solid #333;">
                    <div><div style="font-weight:bold; color:#fff;">${appState.runningCoin}</div><div style="font-size:0.7rem; color:var(--accent);">AI TRADING</div></div>
                    <div style="text-align:right;"><div style="color:#fff;">$${invested.toLocaleString()}</div><div style="font-size:0.75rem; color:#888;">${investPercent.toFixed(1)}%</div></div>
                </div>`;
        }
        // 2. 현금 (항상)
        hHtml += `
            <div style="display:flex; justify-content:space-between; padding:12px 5px; border-bottom:1px solid #333;">
                <div><div style="font-weight:bold; color:#fff;">USDT</div><div style="font-size:0.7rem; color:#888;">현금 자산</div></div>
                <div style="text-align:right;"><div style="color:#fff;">$${currentCash.toLocaleString()}</div><div style="font-size:0.75rem; color:#888;">${cashPercent.toFixed(1)}%</div></div>
            </div>`;
        holdingsList.innerHTML = hHtml;
    }

    // [지갑 페이지] 거래내역 상세 테이블
    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        let tHtml = '';
        appState.tradeHistory.slice(0, 30).forEach(t => {
            const typeColor = t.type === '매수' ? 'text-green' : 'text-red';
            tHtml += `<tr>
                <td>${t.time}</td>
                <td><span style="font-weight:bold;">${t.coin}</span></td>
                <td class="${typeColor}">${t.type}</td>
                <td>${t.vol}</td>
                <td>${t.total}</td>
                <td><span style="font-weight:bold;">${t.net}</span></td>
            </tr>`;
        });
        historyTable.innerHTML = tHtml;
    }
    
    // 은행 입출금 내역
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) { 
        let bHtml = ''; 
        appState.transfers.forEach(t => { 
            const color = t.type.includes('IN') || t.type.includes('DEPOSIT') ? 'text-green' : 'text-red';
            bHtml += `<div class="ledger-row"><div style="width:30%; font-size:0.8rem;">${t.date}</div><div style="width:30%; font-weight:bold;" class="${color}">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`; 
        }); 
        bankList.innerHTML = bHtml; 
    }
}

/* 유틸리티 */
function updateButtonState(isOn) { const btn = document.getElementById('btn-main-control'); if(btn) { btn.style.opacity = isOn ? "1" : "0.5"; btn.innerHTML = isOn ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START'; btn.style.backgroundColor = isOn ? 'var(--color-up)' : '#2b3139'; } }
function getRealisticPrice(symbol) { const jitter = Math.random(); if(symbol === 'BTC') return 96000 + (jitter * 500); if(symbol === 'ETH') return 2700 + (jitter * 20); if(symbol === 'SOL') return 145 + (jitter * 2); if(symbol === 'XRP') return 2.40 + (jitter * 0.05); return 100 + (jitter * 10); }
function generateFakeOpenOrders(coin) { appState.openOrders = []; const price = getRealisticPrice(coin); for(let i=0; i<3; i++) { appState.openOrders.push({ time: new Date().toLocaleTimeString('en-GB'), coin: coin, type: Math.random()>0.5 ? '매수' : '매도', price: (price * (1 + (Math.random()*0.01 - 0.005))).toFixed(2), vol: (Math.random() * 2).toFixed(4) }); } }
function openModal(mode) { const modal = document.getElementById('transaction-modal'); if(!modal) return; modal.style.display = 'flex'; currentTxMode = mode; const input = document.getElementById('amount-input'); input.value = ''; input.focus(); const btn = document.getElementById('modal-confirm-btn'); const title = document.getElementById('modal-title'); if(mode==='deposit') { title.innerText="입금 (Bank -> Wallet)"; btn.onclick=()=>processTx(parseFloat(input.value)); } else { title.innerText="출금 (Wallet -> Bank)"; btn.onclick=()=>processTx(-parseFloat(input.value)); } }
function processTx(amt) { if(!amt || amt<=0 || isNaN(amt)) return alert("금액 오류"); if(currentTxMode==='deposit') { if(appState.bankBalance < amt) return alert("은행 잔고 부족"); appState.bankBalance -= amt; appState.balance += amt; appState.cash += amt; } else { if(appState.cash < amt) return alert("현금 부족 (투자중인 금액 제외)"); appState.balance -= amt; appState.bankBalance += amt; appState.cash -= amt; } if(appState.balance < 0.01) appState.balance = 0; if(appState.bankBalance < 0.01) appState.bankBalance = 0; appState.transfers.unshift({date: new Date().toISOString().slice(0,10), type: currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW", amount: Math.abs(amt)}); saveState(); renderGlobalUI(); closeModal(); }
function calcPercent(pct) { const input = document.getElementById('amount-input'); let base = currentTxMode==='deposit' ? appState.bankBalance : appState.cash; if(pct===100) input.value = base; else input.value = Math.floor(base * (pct/100)*100)/100; }
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }
function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(appState)); }
function loadState() { try { const d = localStorage.getItem(SAVE_KEY); if(d) appState = {...appState, ...JSON.parse(d)}; } catch(e){} }
function loadConfig() { try { const d = localStorage.getItem(CONFIG_KEY); if(d) appState.config = JSON.parse(d); } catch(e){} }
function startDataCounter() { if(dataCounterInterval) clearInterval(dataCounterInterval); dataCounterInterval = setInterval(() => { appState.dataCount += Math.floor(Math.random()*5); const el=document.getElementById('data-mining-counter'); if(el) el.innerText=appState.dataCount.toLocaleString(); }, 200); }
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active'); }); }
function initWebSocket() {} function exportLogs() {} function handleEnter() {}
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; }
function showTab(tabName) { document.querySelectorAll('.wallet-tab-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(`btn-${tabName}`).classList.add('active'); document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden')); document.getElementById(`tab-${tabName}`).classList.remove('hidden'); renderGlobalUI(); }
function simulateExternalDeposit() { const amt = 1000; if(!appState) loadState(); appState.bankBalance += amt; appState.transfers.unshift({ date: new Date().toISOString().slice(0, 10), type: "WIRE IN", amount: amt }); saveState(); renderGlobalUI(); alert(`✅ $${amt.toLocaleString()} 입금 확인되었습니다.`); }
