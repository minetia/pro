// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    loadAppState();         // 1. 저장된 데이터 불러오기
    renderBaseLayout();     // 2. UI 레이아웃 고정 (겹침 방지)
    initTradingChart();     // 3. 차트 라이브러리 및 데이터 로드
    startPriceStream();     // 4. 바이낸스 실시간 시세 연결
});

// 전역 변수
var chartObj = null;
var candleSeries = null;
var avgPriceLine = null;
var wsConnection = null;
var lastTickPrice = 0;

// ==========================================
// 1. 데이터 저장 및 로드 (새로고침 해결)
// ==========================================
function saveAppState() {
    localStorage.setItem('neuralNodeState', JSON.stringify(window.appState));
}

function loadAppState() {
    var saved = localStorage.getItem('neuralNodeState');
    if (saved) {
        window.appState = JSON.parse(saved);
    } else {
        // 초기 시드머니 설정
        window.appState = { 
            balance: 100000, 
            pendingOrders: [], 
            tradeHistory: [], 
            position: { amount: 0, entryPrice: 0 } 
        };
        saveAppState();
    }
}

// ==========================================
// 2. 레이아웃 고정 (UI 겹침 방지)
// ==========================================
function renderBaseLayout() {
    // 기존에 꼬인 UI 요소들을 정리하고 표준 위치에 배치
    var mainContainer = document.querySelector('.card') || document.body;
    mainContainer.style.display = 'flex';
    mainContainer.style.flexDirection = 'column';

    mainContainer.innerHTML = `
        <div id="dashboard" style="background:#1e1e1e; padding:15px; border-bottom:1px solid #333;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div>
                    <div style="color:#888; font-size:11px;">총 자산 (Equity)</div>
                    <div id="equity-display" style="color:#fff; font-weight:bold; font-size:20px;">$ 0</div>
                </div>
                <div style="text-align:right;">
                    <div style="color:#888; font-size:11px;">미실현 손익 (PnL)</div>
                    <div id="pnl-display" style="font-weight:bold;">$ 0.00 (0.00%)</div>
                </div>
            </div>
        </div>

        <div id="chart-box" style="width:100%; height:300px; background:#000;"></div>

        <div id="trade-panel" style="background:#1e1e1e; padding:15px; border-top:1px solid #333;">
            <div style="display:flex; gap:10px; margin-bottom:12px;">
                <input type="number" id="order-price" placeholder="지정가(빈칸=시장가)" style="flex:1; padding:10px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:6px;">
                <input type="number" id="order-qty" placeholder="수량(BTC)" style="flex:1; padding:10px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:6px;">
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="handleTrade('buy')" style="flex:1; padding:12px; background:#0ecb81; border:none; border-radius:6px; color:#fff; font-weight:bold;">매수</button>
                <button onclick="handleTrade('sell')" style="flex:1; padding:12px; background:#f6465d; border:none; border-radius:6px; color:#fff; font-weight:bold;">매도</button>
            </div>
            <div style="text-align:center; margin-top:10px;">
                <span onclick="resetData()" style="color:#555; font-size:10px; text-decoration:underline; cursor:pointer;">데이터 초기화 (리셋)</span>
            </div>
        </div>

        <div id="history-container" style="background:#121212; flex:1; overflow-y:auto; padding:10px;">
            <div style="color:#888; font-size:11px; margin-bottom:8px;">📋 체결 내역</div>
            <div id="history-list"></div>
        </div>
    `;
}

// ==========================================
// 3. 차트 및 시세 (평단가 자동 복구)
// ==========================================
function initTradingChart() {
    if (!window.LightweightCharts) {
        var s = document.createElement('script');
        s.src = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";
        s.onload = initTradingChart;
        document.head.appendChild(s);
        return;
    }

    chartObj = LightweightCharts.createChart(document.getElementById('chart-box'), {
        width: document.getElementById('chart-box').clientWidth,
        height: 300,
        layout: { background: { color: '#000' }, textColor: '#ccc' },
        grid: { vertLines: { color: '#111' }, horzLines: { color: '#111' } },
        timeScale: { borderColor: '#333' }
    });

    candleSeries = chartObj.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
    });

    // 과거 데이터 호출
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=80')
        .then(res => res.json())
        .then(data => {
            candleSeries.setData(data.map(d => ({
                time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            })));
            drawAvgPriceLine(); // ★ 평단가 선 복구
        });
}

function startPriceStream() {
    wsConnection = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");
    wsConnection.onmessage = function(e) {
        var k = JSON.parse(e.data).k;
        var price = parseFloat(k.c);
        candleSeries.update({ time: k.t/1000, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: price });
        lastTickPrice = price;
        refreshDashboard(price);
        checkPendingOrders(price);
    };
}

// ==========================================
// 4. 매매 및 정산 (수익률 실시간 반영)
// ==========================================
function refreshDashboard(price) {
    var equityEl = document.getElementById('equity-display');
    var pnlEl = document.getElementById('pnl-display');
    var pos = window.appState.position;

    var pnl = 0, pnlPct = 0;
    if (pos.amount > 0) {
        pnl = (price - pos.entryPrice) * pos.amount;
        pnlPct = ((price - pos.entryPrice) / pos.entryPrice) * 100;
    }

    var totalEquity = window.appState.balance + (pos.amount * price);
    equityEl.innerText = `$ ${totalEquity.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    pnlEl.innerText = `${pnl >= 0 ? '+' : ''}$ ${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`;
    pnlEl.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
}

window.handleTrade = function(side) {
    var targetP = parseFloat(document.getElementById('order-price').value);
    var qty = parseFloat(document.getElementById('order-qty').value);
    if (!qty) return alert("수량을 입력하세요.");

    if (targetP) { // 지정가
        window.appState.pendingOrders.push({ side: side, price: targetP, qty: qty });
        saveAppState();
        alert("지정가 주문이 등록되었습니다.");
    } else { // 시장가
        executeFinalTrade(side, qty, lastTickPrice);
    }
}

function executeFinalTrade(side, qty, price) {
    var state = window.appState;
    if (side === 'buy') {
        var cost = qty * price;
        if (state.balance < cost) return alert("잔고 부족");
        state.balance -= cost;
        state.position.entryPrice = ((state.position.amount * state.position.entryPrice) + (qty * price)) / (state.position.amount + qty);
        state.position.amount += qty;
    } else {
        if (state.position.amount < qty) return alert("수량 부족");
        state.balance += (qty * price);
        state.position.amount -= qty;
        if (state.position.amount <= 0) state.position.entryPrice = 0;
    }
    
    state.tradeHistory.unshift({ time: new Date().toLocaleTimeString(), side: side, price: price, qty: qty });
    saveAppState();
    drawAvgPriceLine();
    updateHistoryList();
    refreshDashboard(price);
}

function drawAvgPriceLine() {
    if (!candleSeries) return;
    if (avgPriceLine) { candleSeries.removePriceLine(avgPriceLine); avgPriceLine = null; }
    if (window.appState.position.amount > 0) {
        avgPriceLine = candleSeries.createPriceLine({
            price: window.appState.position.entryPrice, color: '#F0B90B', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: '평단가'
        });
    }
}

function updateHistoryList() {
    var listEl = document.getElementById('history-list');
    if (!listEl) return;
    listEl.innerHTML = window.appState.tradeHistory.map(h => `
        <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #222; font-size:12px;">
            <span style="color:#666;">${h.time}</span>
            <span style="color:${h.side === 'buy' ? '#0ecb81' : '#f6465d'}; font-weight:bold;">${h.side === 'buy' ? '매수' : '매도'}</span>
            <span style="color:#fff;">$${h.price.toLocaleString()}</span>
            <span style="color:#ccc;">${h.qty} BTC</span>
        </div>
    `).join('') || '<div style="color:#444; text-align:center; padding:10px;">내역 없음</div>';
}

function checkPendingOrders(price) {
    var orders = window.appState.pendingOrders;
    for (var i = orders.length - 1; i >= 0; i--) {
        var o = orders[i];
        if ((o.side === 'buy' && price <= o.price) || (o.side === 'sell' && price >= o.price)) {
            orders.splice(i, 1);
            executeFinalTrade(o.side, o.qty, price);
        }
    }
}

window.resetData = function() {
    if (confirm("모든 데이터를 초기화하시겠습니까?")) {
        localStorage.removeItem('neuralNodeState');
        location.reload();
    }
}
