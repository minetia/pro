/* pro-script.js - V41.0 (Bug Fixes & Restoration) */
let appState = {
    balance: 0.00,        // 총 자산 (투자금 + 현금)
    cash: 0.00,           // 주문 가능 현금 (지갑에 있는 현금)
    bankBalance: 0.00,    // 은행 계좌 잔고
    startBalance: 0.00,   
    tradeHistory: [],     // 거래 내역
    openOrders: [],       // 미체결
    transfers: [],        // 입출금 내역
    dataCount: 42105,     // 데이터 마이닝 카운트
    config: {}, 
    isRunning: false,
    runningCoin: null,    
    investedAmount: 0     
};

let autoTradeInterval = null;
let dataCounterInterval = null; // 데이터 카운터용 타이머
const SAVE_KEY = 'neuroBotData_V41_FIX';
const CONFIG_KEY = 'neuroConfig_V41_FIX';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    if(document.getElementById('tab-holdings')) showTab('holdings');

    // 상태 복구 및 자동 시작
    if (appState.isRunning) {
        if (appState.balance > 0 && appState.config && appState.config.isReady) {
            startSystem(true);
        } else {
            stopSystem(true);
        }
    } else {
        updateButtonState(false);
    }
    
    // 데이터 카운터 시작
    startDataCounter();
    
    // 주기적 갱신
    setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
    
    // 초기 렌더링 강제 실행
    renderGlobalUI();
});

/* --- 시스템 제어 --- */
function startSystem(isSilent = false) {
    if (appState.balance <= 0) {
        if(!isSilent) alert("⚠️ 지갑 잔고가 없습니다. 은행에서 입금해주세요.");
        stopSystem(true); return;
    }
    if (!appState.config || !appState.config.isReady) {
        if(!isSilent) {
            if(confirm("⚠️ AI 설정이 필요합니다. 설정 페이지로 이동할까요?")) window.location.href = 'ai-core.html';
        }
        stopSystem(true); return;
    }

    let investAmt = appState.config.amount || 1000;
    if (investAmt > appState.balance) investAmt = appState.balance;

    appState.runningCoin = appState.config.target.split('/')[0]; 
    appState.investedAmount = investAmt;
    appState.cash = appState.balance - investAmt; 
    
    if(appState.startBalance === 0) appState.startBalance = appState.balance;

    generateFakeOpenOrders(appState.runningCoin);

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

function updateButtonState(isOn) {
    const btn = document.getElementById('btn-main-control');
    if(btn) {
        btn.style.opacity = isOn ? "1" : "0.5";
        btn.innerHTML = isOn ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START';
        btn.style.backgroundColor = isOn ? 'var(--color-up)' : '#2b3139';
    }
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

function generateFakeOpenOrders(coin) {
    appState.openOrders = [];
    const price = getRealisticPrice(coin);
    for(let i=0; i<3; i++) {
        appState.openOrders.push({
            time: new Date().toLocaleTimeString('en-GB'),
            coin: coin,
            type: Math.random()>0.5 ? '매수' : '매도',
            price: (price * (1 + (Math.random()*0.01 - 0.005))).toFixed(2), 
            vol: (Math.random() * 2).toFixed(4)
        });
    }
}

function getRealisticPrice(symbol) {
    const jitter = Math.random();
    if(symbol === 'BTC') return 96000 + (jitter * 500);
    if(symbol === 'ETH') return 2700 + (jitter * 20);
    if(symbol === 'SOL') return 145 + (jitter * 2);
    if(symbol === 'XRP') return 2.40 + (jitter * 0.05);
    return 100 + (jitter * 10);
}

/* --- 입출금 시스템 (버그 수정됨) --- */
let currentTxMode = '';
function openModal(mode) {
    const modal = document.getElementById('transaction-modal'); if(!modal) return;
    modal.style.display = 'flex'; currentTxMode = mode;
    const input = document.getElementById('amount-input'); input.value = ''; input.focus();
    const btn = document.getElementById('modal-confirm-btn');
    const title = document.getElementById('modal-title');
    
    if(mode==='deposit') { title.innerText="입금 (Bank -> Wallet)"; btn.onclick=()=>processTx(parseFloat(input.value)); }
    else { title.innerText="출금 (Wallet -> Bank)"; btn.onclick=()=>processTx(-parseFloat(input.value)); }
}

function processTx(amt) {
    if(!amt || amt<=0 || isNaN(amt)) return alert("올바른 금액을 입력하세요.");
    
    if(currentTxMode === 'deposit') { // 입금 (은행 -> 지갑)
        if(appState.bankBalance < amt) {
            alert(`⛔ 은행 잔고 부족! (현재: $${appState.bankBalance.toLocaleString()})`);
            return;
        }
        appState.bankBalance -= amt; 
        appState.balance += amt; 
        appState.cash += amt; 
        alert("✅ 입금 완료");
    } else { // 출금 (지갑 -> 은행)
        const abs = Math.abs(amt);
        if(appState.cash < abs) {
            alert(`⛔ 출금 가능 현금 부족! (현재: $${appState.cash.toLocaleString()})`);
            return;
        }
        appState.balance -= abs; 
        appState.bankBalance += abs;
        appState.cash -= abs;
        alert("✅ 출금 완료");
    }
    
    // 소수점 정리
    if(appState.balance < 0.01) appState.balance = 0; 
    if(appState.bankBalance < 0.01) appState.bankBalance = 0;
    
    // 기록 저장
    appState.transfers.unshift({
        date: new Date().toISOString().slice(0,10), 
        type: currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW", 
        amount: Math.abs(amt)
    });
    
    saveState(); 
    renderGlobalUI(); 
    document.getElementById('transaction-modal').style.display='none';
}

function calcPercent(pct) { 
    const input = document.getElementById('amount-input'); 
    // 입금이면 은행잔고 기준, 출금이면 지갑현금 기준
    let base = currentTxMode==='deposit' ? appState.bankBalance : appState.cash; 
    if(pct===100) input.value = base; 
    else input.value = Math.floor(base * (pct/100)*100)/100; 
}
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }

/* --- 은행 외부 입금 시뮬레이션 (버그 수정됨) --- */
function simulateExternalDeposit() {
    const amt = 1000;
    // 앱 상태가 로드되었는지 확인
    if (!appState) loadState();
    
    appState.bankBalance += amt;
    appState.transfers.unshift({
        date: new Date().toISOString().slice(0, 10),
        type: "WIRE IN",
        amount: amt
    });
    
    saveState(); 
    renderGlobalUI(); // 즉시 화면 갱신
    alert(`✅ $${amt.toLocaleString()} 입금 확인되었습니다.`);
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
    
    if(els.total) els.total.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.wallet) els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.avail) els.avail.innerText = `$ ${appState.cash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    const base = appState.startBalance > 0 ? appState.startBalance : appState.balance;
    const profit = appState.balance - base;
    const profitPercent = base > 0 ? (profit / base) * 100 : 0;
    const pnlColor = profit >= 0 ? 'text-green' : 'text-red';
    
    if(els.prof) {
        els.prof.innerHTML = `<span class="${pnlColor}">${profit>=0?'+':''}${profitPercent.toFixed(2)}%</span> ($${profit.toFixed(2)})`;
    }

    // 메인화면 리스트
    const mainList = document.getElementById('main-ledger-list');
    if(mainList) {
        if(appState.tradeHistory.length === 0) {
            mainList.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">NO TRADES YET</div>';
        } else {
            let html = '';
            appState.tradeHistory.slice(0, 50).forEach(t => {
                const pnlColor = t.type === '매수' ? 'text-green' : 'text-red'; 
                // 메인화면 리스트는 심플하게
                html += `<div class="ledger-row" style="display:flex; padding:10px; border-bottom:1px solid #222; font-size:0.8rem;">
                    <div style="width:25%; color:#888;">${t.time}</div>
                    <div style="width:25%; font-weight:bold;">${t.coin} <span class="${pnlColor}">${t.type}</span></div>
                    <div style="width:25%; text-align:right;">${t.price}</div>
                    <div style="width:25%; text-align:right; font-weight:bold;">${t.net}</div>
                </div>`;
            });
            mainList.innerHTML = html;
        }
    }

    // 지갑화면 리스트 (상세 테이블)
    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        let tHtml = '';
        appState.tradeHistory.slice(0, 30).forEach(t => {
            const typeColor = t.type === '매수' ? 'text-green' : 'text-red';
            tHtml += `<tr>
                <td>${t.time}<br><span style="color:#888">${t.market}</span></td>
                <td><span style="font-weight:bold;">${t.coin}</span></td>
                <td class="${typeColor}">${t.type}</td>
                <td>${t.vol}<br><span style="color:#888">${t.price}</span></td>
                <td>${t.total}<br><span style="color:#888">${t.fee}</span></td>
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
            const color = t.type==='WIRE IN' || t.type==='DEPOSIT' ? 'text-green' : 'text-red';
            bHtml += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%; font-weight:bold;" class="${color}">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`; 
        }); 
        bankList.innerHTML = bHtml; 
    }
}

/* 유틸 */
function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(appState)); }
function loadState() { try { const d = localStorage.getItem(SAVE_KEY); if(d) appState = {...appState, ...JSON.parse(d)}; } catch(e){} }
function loadConfig() { try { const d = localStorage.getItem(CONFIG_KEY); if(d) appState.config = JSON.parse(d); } catch(e){} }
function startDataCounter() { 
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    dataCounterInterval = setInterval(() => {
        appState.dataCount += Math.floor(Math.random()*5); 
        const el=document.getElementById('data-mining-counter'); 
        if(el) el.innerText=appState.dataCount.toLocaleString();
    }, 200); 
}
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active'); }); }
function initWebSocket() {} function exportLogs() {} function handleEnter() {}
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; }
function showTab(tabName) { document.querySelectorAll('.wallet-tab-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(`btn-${tabName}`).classList.add('active'); document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden')); document.getElementById(`tab-${tabName}`).classList.remove('hidden'); renderGlobalUI(); }
