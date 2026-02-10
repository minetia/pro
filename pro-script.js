/* pro-script.js - V48.0 (Real-time Search Fix) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings',
    searchQuery: "" // 검색어 저장
};
let autoTradeInterval = null;
let dataCounterInterval = null;
const SAVE_KEY = 'neuroBotData_V43_FINAL';
const CONFIG_KEY = 'neuroConfig_V43_FINAL';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    if(document.getElementById('tab-holdings')) {
        const lastTab = appState.activeTab || 'holdings';
        showTab(lastTab);
    }
    
    // [NEW] 검색어 복구 (페이지 이동 후 돌아와도 검색 유지)
    const searchInput = document.getElementById('coin-search-input');
    if(searchInput && appState.searchQuery) {
        searchInput.value = appState.searchQuery;
    }

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

/* --- [NEW] 실시간 검색 핸들러 --- */
function handleSearch(query) {
    // 입력값을 대문자로 변환해 저장
    appState.searchQuery = query.trim().toUpperCase();
    renderGlobalUI(); // 즉시 화면 갱신
}

/* --- 시스템 시작 --- */
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

    let setAmount = appState.config.amount || 0;
    if (setAmount < 10) { if(!isSilent) alert("⛔ 최소 $10 이상이어야 합니다."); stopSystem(true); return; }
    if (setAmount > 100000) { if(!isSilent) alert("⛔ 최대 $100,000 이하이어야 합니다."); stopSystem(true); return; }
    if (setAmount > appState.balance) { if(!isSilent) alert(`⛔ 잔고 부족!`); stopSystem(true); return; }

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
    appState.cash = appState.balance; 
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
        total: total.toFixed(2),
        fee: fee.toFixed(2),
        net: net.toFixed(2)
    };

    appState.tradeHistory.unshift(tradeRecord);
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
    renderGlobalUI();
}

/* --- 렌더링 --- */
function renderGlobalUI() {
    const els = { total: document.getElementById('total-val'), label: document.getElementById('balance-label'), wallet: document.getElementById('wallet-display'), avail: document.getElementById('avail-cash'), bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit') };
    const currentCash = appState.isRunning ? appState.cash : appState.balance;

    if(els.total && els.label) {
        if(appState.isRunning) {
            const activeMoney = appState.balance - appState.cash;
            els.total.innerText = `$ ${activeMoney.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            els.label.innerText = `현재 운용 자산 (${appState.runningCoin})`;
            els.label.style.color = "var(--accent)";
        } else {
            els.total.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            els.label.innerText = `총 보유 자산 (TOTAL BALANCE)`;
            els.label.style.color = "var(--text-secondary)";
        }
    }

    if(els.wallet) els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.avail) els.avail.innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    const base = appState.startBalance > 0 ? appState.startBalance : appState.balance;
    const profit = appState.balance - base;
    const profitPercent = base > 0 ? (profit / base) * 100 : 0;
    const pnlColor = profit >= 0 ? 'text-green' : 'text-red';
    const pnlSign = profit >= 0 ? '+' : '';

    if(els.prof) els.prof.innerHTML = `<span class="${pnlColor}">${pnlSign}${profitPercent.toFixed(2)}%</span> ($${profit.toFixed(2)})`;

    if(document.getElementById('pnl-total-amount')) {
        document.getElementById('pnl-total-amount').innerText = `${pnlSign} $${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits:2})}`;
        document.getElementById('pnl-total-amount').className = `hero-number ${pnlColor}`;
        document.getElementById('pnl-total-percent').innerText = `${pnlSign}${profitPercent.toFixed(2)}%`;
        document.getElementById('pnl-total-percent').className = pnlColor;
        const avgInvest = appState.isRunning ? appState.investedAmount : appState.balance;
        document.getElementById('pnl-avg-invest').innerText = `$ ${avgInvest.toLocaleString()}`;

        const chartArea = document.getElementById('pnl-chart-area');
        if(chartArea) {
            chartArea.innerHTML = '';
            for(let i=0; i<7; i++) {
                let h = 0; let color = '#333';
                if(i === 6) {
                    h = Math.abs(profitPercent) * 5; if(h < 5) h = 5; if(h > 100) h = 100;
                    color = profit >= 0 ? 'var(--color-up)' : 'var(--color-down)';
                    if(profit === 0) color = '#555';
                } else { h = Math.random() * 30 + 5; color = Math.random() > 0.5 ? 'rgba(200, 74, 49, 0.3)' : 'rgba(18, 97, 196, 0.3)'; }
                chartArea.innerHTML += `<div style="width:12%; height:${h}%; background:${color}; border-radius:4px 4px 0 0; transition: height 0.3s;"></div>`;
            }
        }
    }

    // [핵심] 검색 필터링 적용된 메인 리스트
    const mainList = document.getElementById('main-ledger-list');
    if(mainList) {
        let displayData = appState.tradeHistory;
        
        // 검색어가 있으면 필터링 (대문자 비교)
        if (appState.searchQuery && appState.searchQuery !== "") {
            displayData = appState.tradeHistory.filter(item => 
                item.coin.toUpperCase().includes(appState.searchQuery)
            );
        }

        if(displayData.length === 0) {
            const msg = appState.searchQuery ? `"${appState.searchQuery}" 검색 결과 없음` : 'NO TRADES YET';
            mainList.innerHTML = `<div style="padding:40px; text-align:center; color:#444;">${msg}</div>`;
        } else {
            let html = '';
            displayData.slice(0, 50).forEach(t => {
                const pnlColor = t.type === '매수' ? 'text-green' : 'text-red'; 
                html += `<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${pnlColor}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${t.net >= t.total ? 'text-green' : 'text-red'}">${t.net}</div></div>`;
            });
            mainList.innerHTML = html;
        }
    }

    if(document.getElementById('holdings-list')) {
        const invested = appState.isRunning ? (appState.balance - appState.cash) : 0;
        const total = appState.balance > 0 ? appState.balance : 1;
        const investPercent = (invested / total) * 100;
        const cashPercent = 100 - investPercent;
        const pie = document.getElementById('portfolio-pie');
        if(pie) pie.style.background = appState.isRunning && invested > 0 ? `conic-gradient(var(--accent) 0% ${investPercent}%, #444 ${investPercent}% 100%)` : `conic-gradient(#444 0% 100%)`;
        
        const holdingsList = document.getElementById('holdings-list');
        let hHtml = '';
        if(appState.isRunning && invested > 0) hHtml += `<div style="display:flex; justify-content:space-between; padding:12px 5px; border-bottom:1px solid #333;"><div><div style="font-weight:bold; color:#fff;">${appState.runningCoin}</div><div style="font-size:0.7rem; color:var(--accent);">AI TRADING</div></div><div style="text-align:right;"><div style="color:#fff;">$${invested.toLocaleString()}</div><div style="font-size:0.75rem; color:#888;">${investPercent.toFixed(1)}%</div></div></div>`;
        hHtml += `<div style="display:flex; justify-content:space-between; padding:12px 5px; border-bottom:1px solid #333;"><div><div style="font-weight:bold; color:#fff;">USDT</div><div style="font-size:0.7rem; color:#888;">현금 자산</div></div><div style="text-align:right;"><div style="color:#fff;">$${currentCash.toLocaleString()}</div><div style="font-size:0.75rem; color:#888;">${cashPercent.toFixed(1)}%</div></div></div>`;
        holdingsList.innerHTML = hHtml;
    }

    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        let tHtml = '';
        appState.tradeHistory.slice(0, 30).forEach(t => {
            const typeColor = t.type === '매수' ? 'text-green' : 'text-red';
            tHtml += `<tr><td>${t.time}</td><td><span style="font-weight:bold;">${t.coin}</span></td><td class="${typeColor}">${t.type}</td><td>${t.vol}</td><td>${t.total}</td><td><span style="font-weight:bold;">${t.net}</span></td></tr>`;
        });
        historyTable.innerHTML = tHtml;
    }
    
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
function processTx(amt) { if(!amt || amt<=0 || isNaN(amt)) return alert("금액 오류"); if(currentTxMode==='deposit') { if(appState.bankBalance < amt) return alert("은행 잔고 부족"); appState.bankBalance -= amt; appState.balance += amt; appState.cash += amt; } else { if(appState.cash < amt) return alert("현금 부족"); appState.balance -= amt; appState.bankBalance += amt; appState.cash -= amt; } if(appState.balance < 0.01) appState.balance = 0; if(appState.bankBalance < 0.01) appState.bankBalance = 0; appState.transfers.unshift({date: new Date().toISOString().slice(0,10), type: currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW", amount: Math.abs(amt)}); saveState(); renderGlobalUI(); closeModal(); }
function calcPercent(pct) { const input = document.getElementById('amount-input'); let base = currentTxMode==='deposit' ? appState.bankBalance : appState.cash; if(pct===100) input.value = base; else input.value = Math.floor(base * (pct/100)*100)/100; }
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }
function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(appState)); }
function loadState() { try { const d = localStorage.getItem(SAVE_KEY); if(d) appState = {...appState, ...JSON.parse(d)}; } catch(e){} }
function loadConfig() { try { const d = localStorage.getItem(CONFIG_KEY); if(d) appState.config = JSON.parse(d); } catch(e){} }
function startDataCounter() { if(dataCounterInterval) clearInterval(dataCounterInterval); dataCounterInterval = setInterval(() => { appState.dataCount += Math.floor(Math.random()*5); const el=document.getElementById('data-mining-counter'); if(el) el.innerText=appState.dataCount.toLocaleString(); }, 200); }
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active'); }); }
function initWebSocket() {} function exportLogs() {} 
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; }
function showTab(tabName) { appState.activeTab = tabName; saveState(); document.querySelectorAll('.wallet-tab-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(`btn-${tabName}`).classList.add('active'); document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden')); document.getElementById(`tab-${tabName}`).classList.remove('hidden'); renderGlobalUI(); }
function simulateExternalDeposit() { const amt = 1000; if(!appState) loadState(); appState.bankBalance += amt; appState.transfers.unshift({ date: new Date().toISOString().slice(0, 10), type: "WIRE IN", amount: amt }); saveState(); renderGlobalUI(); alert(`✅ $${amt.toLocaleString()} 입금 확인되었습니다.`); }
