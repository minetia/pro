/* main.js - V310.0 (Data Mining & Download Restored) */
let socket = null;
let autoTradeInterval = null;
let miningInterval = null; // [복구] 마이닝용 타이머

window.addEventListener('load', () => {
    // 1. UI 초기화
    renderMainUI();
    
    // 2. [복구] 데이터 마이닝 시작
    startDataMining();
    
    // 3. 검색창 엔터키 연결
    const searchInput = document.getElementById('coin-search-input');
    if(searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') location.href = `info.html?coin=${e.target.value}`;
        });
    }

    // 4. 실행 중이면 재가동
    if (appState.isRunning && appState.config.keysVerified) {
        startTradingSystem(true);
    } else {
        stopTradingSystem(true);
    }
    
    // 5. 화면 갱신
    setInterval(renderMainUI, 500);
});

/* --- [복구] 데이터 마이닝 & 다운로드 --- */

function startDataMining() {
    const el = document.getElementById('data-mining-counter');
    if (!el) return;
    
    if (miningInterval) clearInterval(miningInterval);
    
    // 0.1초마다 숫자 증가 효과
    miningInterval = setInterval(() => {
        // 랜덤하게 5~20씩 증가
        appState.dataCount += Math.floor(Math.random() * 15) + 5;
        el.innerText = appState.dataCount.toLocaleString();
    }, 100);
}

function exportLogs() {
    if (!appState.tradeHistory || appState.tradeHistory.length === 0) {
        return alert("다운로드할 거래 내역이 없습니다.");
    }
    
    // CSV 형식으로 변환
    let csvContent = "Time,Coin,Type,Price,PnL\n";
    appState.tradeHistory.forEach(t => {
        csvContent += `${t.time},${t.coin},${t.type},${t.price},${t.pnl}\n`;
    });
    
    // 파일 다운로드 실행
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `trade_logs_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* --- 트레이딩 로직 --- */
function startTradingSystem(isResume = false) {
    if (!appState.config.keysVerified) return alert("키 검증 필요");
    
    if (appState.balance < 10) {
        if (!isResume) alert("잔고 부족");
        appState.isRunning = false;
        saveState();
        return;
    }

    appState.isRunning = true;
    appState.runningCoin = appState.config.target;
    
    if (appState.balance < appState.config.amount) appState.investedAmount = appState.balance;
    else appState.investedAmount = appState.config.amount;

    if (appState.startBalance === 0) appState.startBalance = appState.balance;

    connectWebSocket(appState.runningCoin);
    
    if (autoTradeInterval) clearInterval(autoTradeInterval);
    autoTradeInterval = setInterval(executeTradeLogic, 1500);

    updateButton(true);
    saveState();
}

function stopTradingSystem(isResume = false) {
    appState.isRunning = false;
    appState.investedAmount = 0;
    if (socket) socket.close();
    if (autoTradeInterval) clearInterval(autoTradeInterval);
    
    updateButton(false);
    saveState(); // 상태 저장
    renderMainUI();
}

function executeTradeLogic() {
    if (!appState.isRunning) return;
    
    const chance = Math.random();
    let type = '';
    let pnl = 0;

    // 매매 확률 (익절 5%, 손절 2%)
    if (chance > 0.95) { type = '익절'; pnl = appState.investedAmount * 0.005; } 
    else if (chance < 0.02) { type = '손절'; pnl = -appState.investedAmount * 0.003; }
    
    if (type) {
        appState.balance += pnl;
        appState.tradeHistory.unshift({
            time: new Date().toLocaleTimeString(),
            coin: appState.runningCoin,
            type: type,
            price: "MARKET",
            pnl: pnl.toFixed(2)
        });
        if(appState.tradeHistory.length > 30) appState.tradeHistory.pop();
        
        saveState(); // 돈이 바뀌었으니 저장
    }
}

/* --- UI 렌더링 --- */
function renderMainUI() {
    const elTotal = document.getElementById('total-val');
    const elProfit = document.getElementById('real-profit');
    
    if (elTotal) {
        elTotal.innerText = `$ ${formatMoney(appState.balance)}`;
        
        if (elProfit) {
            const profit = appState.balance - appState.startBalance;
            const pct = appState.startBalance > 0 ? (profit / appState.startBalance) * 100 : 0;
            const color = profit >= 0 ? 'text-green' : 'text-red';
            elProfit.innerHTML = `<span class="${color}">${pct.toFixed(2)}% ($${profit.toFixed(2)})</span>`;
        }
    }
    
    const list = document.getElementById('main-ledger-list');
    if (list) {
        let html = '';
        appState.tradeHistory.slice(0, 10).forEach(t => {
            const c = parseFloat(t.pnl) >= 0 ? 'text-green' : 'text-red';
            html += `<div class="ledger-row"><div style="width:25%">${t.time}</div><div style="width:25%">${t.coin}</div><div style="width:25%; text-align:right">${t.type}</div><div style="width:25%; text-align:right" class="${c}">${t.pnl}</div></div>`;
        });
        list.innerHTML = html || '<div style="text-align:center; padding:20px; color:#666;">거래 대기 중...</div>';
    }
}

function updateButton(isRunning) {
    const btn = document.getElementById('btn-main-control');
    if (btn) {
        if (isRunning) {
            btn.innerHTML = 'RUNNING';
            btn.style.background = '#333';
            btn.onclick = () => stopTradingSystem();
        } else {
            btn.innerHTML = 'START';
            btn.style.background = '#c84a31';
            btn.onclick = () => startTradingSystem();
        }
    }
}

function connectWebSocket(coin) {
    if (socket) socket.close();
    try {
        socket = new WebSocket(`wss://stream.binance.com:9443/ws/${coin.toLowerCase()}usdt@trade`);
    } catch(e){}
}

function searchInfoCoin() {
    const v = document.getElementById('coin-search-input').value;
    if(v) location.href = `info.html?coin=${v.toUpperCase()}`;
}
