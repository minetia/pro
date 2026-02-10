/* main.js - V300.0 (Trading Engine) */
let socket = null;
let autoTradeInterval = null;

window.addEventListener('load', () => {
    // 1. UI 초기화
    renderMainUI();
    
    // 2. 검색창 엔터키 연결
    const searchInput = document.getElementById('coin-search-input');
    if(searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') location.href = `info.html?coin=${e.target.value}`;
        });
    }

    // 3. 실행 중이면 재가동
    if (appState.isRunning && appState.config.keysVerified) {
        startTradingSystem(true);
    } else {
        stopTradingSystem(true);
    }
    
    // 4. 화면 갱신 (데이터 수정 없음)
    setInterval(renderMainUI, 500);
});

/* --- 트레이딩 로직 --- */
function startTradingSystem(isResume = false) {
    if (!appState.config.keysVerified) return alert("키 검증 필요");
    
    // 잔고 부족 체크
    if (appState.balance < 10) {
        if (!isResume) alert("잔고 부족");
        appState.isRunning = false;
        saveState();
        return;
    }

    appState.isRunning = true;
    appState.runningCoin = appState.config.target;
    
    // 투자금 설정 (잔고 내에서)
    if (appState.balance < appState.config.amount) appState.investedAmount = appState.balance;
    else appState.investedAmount = appState.config.amount;

    if (appState.startBalance === 0) appState.startBalance = appState.balance;

    // 웹소켓 연결
    connectWebSocket(appState.runningCoin);
    
    // 매매 루프 시작
    if (autoTradeInterval) clearInterval(autoTradeInterval);
    autoTradeInterval = setInterval(executeTradeLogic, 1500); // 1.5초마다 체크

    updateButton(true);
    saveState();
}

function stopTradingSystem(isResume = false) {
    appState.isRunning = false;
    appState.investedAmount = 0;
    if (socket) socket.close();
    if (autoTradeInterval) clearInterval(autoTradeInterval);
    
    updateButton(false);
    saveState();
    renderMainUI();
}

function executeTradeLogic() {
    if (!appState.isRunning) return;
    
    // 랜덤 매매 (시뮬레이션)
    const chance = Math.random();
    // 5% 확률로 익절, 2% 확률로 손절
    let type = '';
    let pnl = 0;

    if (chance > 0.95) { type = '익절'; pnl = appState.investedAmount * 0.005; } // 0.5% 이익
    else if (chance < 0.02) { type = '손절'; pnl = -appState.investedAmount * 0.003; } // 0.3% 손실
    
    if (type) {
        appState.balance += pnl; // 실제 돈 변경
        
        // 내역 추가
        appState.tradeHistory.unshift({
            time: new Date().toLocaleTimeString(),
            coin: appState.runningCoin,
            type: type,
            price: "MARKET",
            pnl: pnl.toFixed(2)
        });
        if(appState.tradeHistory.length > 30) appState.tradeHistory.pop();
        
        saveState(); // 저장
    }
}

/* --- UI 렌더링 --- */
function renderMainUI() {
    const elTotal = document.getElementById('total-val');
    const elProfit = document.getElementById('real-profit');
    
    if (elTotal) {
        // 투자 중이면 평가금액 표시, 아니면 그냥 잔고
        // (단순화: 여기서는 잔고만 보여줌. 뻥튀기 방지)
        elTotal.innerText = `$ ${formatMoney(appState.balance)}`;
        
        if (elProfit) {
            const profit = appState.balance - appState.startBalance;
            const pct = appState.startBalance > 0 ? (profit / appState.startBalance) * 100 : 0;
            const color = profit >= 0 ? 'text-green' : 'text-red';
            elProfit.innerHTML = `<span class="${color}">${pct.toFixed(2)}% ($${profit.toFixed(2)})</span>`;
        }
    }
    
    // 리스트 업데이트
    const list = document.getElementById('main-ledger-list');
    if (list) {
        let html = '';
        appState.tradeHistory.slice(0, 10).forEach(t => {
            const c = t.pnl >= 0 ? 'text-green' : 'text-red';
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
        // 여기선 가격만 받고 UI 업데이트는 안 함 (데이터 오염 방지)
    } catch(e){}
}

function searchInfoCoin() {
    const v = document.getElementById('coin-search-input').value;
    if(v) location.href = `info.html?coin=${v.toUpperCase()}`;
}
