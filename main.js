/* main.js - V320.0 (Mining & Download Fix) */
let socket = null;
let autoTradeInterval = null;
let miningInterval = null; // 마이닝 타이머

window.addEventListener('load', () => {
    // 1. UI 초기화
    renderMainUI();
    
    // 2. [필수] 데이터 마이닝 시작
    startDataMining();
    
    // 3. 검색창 엔터키 연결
    const searchInput = document.getElementById('coin-search-input');
    if(searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') location.href = `info.html?coin=${e.target.value}`;
        });
    }

    // 4. 시스템 재가동 체크
    if (appState.isRunning && appState.config.keysVerified) {
        startTradingSystem(true);
    } else {
        stopTradingSystem(true);
    }
    
    // 5. 화면 갱신
    setInterval(renderMainUI, 500);
});

/* --- [복구] 데이터 마이닝 (숫자 올라가는 효과) --- */
function startDataMining() {
    const el = document.getElementById('data-mining-counter');
    if (!el) return;
    
    if (miningInterval) clearInterval(miningInterval);
    
    miningInterval = setInterval(() => {
        // 숫자가 멈추지 않고 계속 올라감
        appState.dataCount += Math.floor(Math.random() * 15) + 5;
        el.innerText = appState.dataCount.toLocaleString();
    }, 100);
}

/* --- [복구] CSV 다운로드 --- */
function exportLogs() {
    if (!appState.tradeHistory || appState.tradeHistory.length === 0) {
        return alert("다운로드할 거래 내역이 없습니다.");
    }
    
    let csvContent = "Time,Coin,Type,Price,PnL\n";
    appState.tradeHistory.forEach(t => {
        csvContent += `${t.time},${t.coin},${t.type},${t.price},${t.pnl}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `trade_logs_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* --- 트레이딩 로직 (기존 유지) --- */
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
    saveState();
    renderMainUI();
}

function executeTradeLogic() {
    if (!appState.isRunning) return;
    const chance = Math.random();
    let type = '';
    let pnl = 0;
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
        saveState();
    }
}

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
    try { socket = new WebSocket(`wss://stream.binance.com:9443/ws/${coin.toLowerCase()}usdt@trade`); } catch(e){}
}

function searchInfoCoin() {
    const v = document.getElementById('coin-search-input').value;
    if(v) location.href = `info.html?coin=${v.toUpperCase()}`;
}
// ===============================================
// [긴급 패치] 가짜 돈 삭제하고 진짜 바이낸스 연결하기
// 기존 코드는 두고, 이 코드를 파일 맨 밑에 붙여넣으세요.
// ===============================================

// 1. 혹시 돌아가고 있을 가짜 가격 생성기를 멈춥니다.
var highestIntervalId = setInterval(";");
for (var i = 0; i < highestIntervalId; i++) {
    clearInterval(i);
}

// 2. 바이낸스(Binance) 실시간 서버에 접속합니다.
var wsUrl = "wss://stream.binance.com:9443/ws/btcusdt@trade";
var ws = new WebSocket(wsUrl);

ws.onopen = function() {
    console.log("★ 바이낸스 실제 시세 연결 성공!");
    var priceDisplay = document.getElementById('price-display');
    if(priceDisplay) priceDisplay.style.color = '#F0B90B'; // 연결되면 노란색 깜빡
};

ws.onmessage = function(event) {
    var data = JSON.parse(event.data);
    var realPrice = parseFloat(data.p); // 이게 진짜 비트코인 가격입니다.
    
    // 화면에 가격 표시 (소수점 2자리)
    var el = document.getElementById('price-display');
    if (el) {
        el.innerText = '$ ' + realPrice.toLocaleString(undefined, {
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2
        });
        
        // 가격 등락 색상 (이전 가격보다 높으면 초록, 낮으면 빨강)
        if (window.lastPrice && realPrice > window.lastPrice) {
            el.style.color = '#0ECB81'; // 상승
        } else if (window.lastPrice && realPrice < window.lastPrice) {
            el.style.color = '#F6465D'; // 하락
        }
        window.lastPrice = realPrice;
    }

    // 전역 변수에 진짜 가격 저장 (매수/매도할 때 이 가격 사용)
    if (typeof appState !== 'undefined') {
        appState.currentPrice = realPrice;
        
        // 수익률 실시간 계산 (포지션 잡았을 때만)
        if (appState.position && appState.position.amount > 0) {
            updateRealProfit(realPrice);
        }
    }
};

// 3. 진짜 수익률 계산 함수 (기존 가짜 계산 로직 덮어쓰기)
function updateRealProfit(currentPrice) {
    var entry = appState.position.entryPrice;
    var leverage = appState.position.leverage || 1;
    var margin = appState.position.margin;
    
    // 수익률 공식: ((현재가 - 진입가) / 진입가) * 100 * 레버리지
    var pnlRate = ((currentPrice - entry) / entry) * 100 * leverage;
    
    // 숏(Short)이면 수익률 반대로
    if (appState.position.side === 'short') pnlRate *= -1;
    
    // 수익금 계산
    var pnlValue = (margin * pnlRate) / 100;

    // 화면 업데이트
    var elPnl = document.getElementById('pnl-display');
    var elRoe = document.getElementById('roe-display');
    
    if (elPnl) {
        elPnl.innerText = '$ ' + pnlValue.toFixed(2);
        elPnl.className = pnlValue >= 0 ? 'text-green' : 'text-red';
    }
    if (elRoe) {
        elRoe.innerText = pnlRate.toFixed(2) + '%';
        elRoe.className = pnlRate >= 0 ? 'text-green' : 'text-red';
    }
}

