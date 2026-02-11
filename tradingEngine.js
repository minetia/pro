// [tradingEngine.js] 실시간 차트 및 매매 엔진

var ws = null;
var chart = null;
var candleSeries = null;
var currentPrice = 0;
var myPriceLine = null;

// 페이지 로드 시 실행
window.addEventListener('load', function() {
    initChart();           // 차트 생성
    createTradingUI();     // UI 그리기
    connectBinance();      // 시세 연결
    updateDashboard();     // 대시보드 초기화
});

// 1. 차트 초기화
function initChart() {
    const container = document.getElementById('chart-container');
    if (!container) return;
    container.innerHTML = '';

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 350,
        layout: { background: { color: '#1e1e1e' }, textColor: '#d1d4dc' },
        grid: { vertLines: { color: '#333' }, horzLines: { color: '#333' } },
        timeScale: { borderColor: '#444' },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d',
        borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
    });

    // 과거 데이터 불러오기
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json())
        .then(data => {
            candleSeries.setData(data.map(d => ({
                time: d[0] / 1000, open: d[1], high: d[2], low: d[3], close: d[4]
            })));
            drawAvgPriceLine(); // 저장된 평단가 선 그리기
        });
}

// 2. 바이낸스 실시간 시세 연결
function connectBinance() {
    ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");
    ws.onmessage = function(e) {
        var k = JSON.parse(e.data).k;
        currentPrice = parseFloat(k.c);
        candleSeries.update({
            time: k.t/1000, open: k.o, high: k.h, low: k.l, close: k.c
        });
        updateDashboard();
    };
}

// 3. 대시보드 업데이트 (appData.js 데이터 활용)
function updateDashboard() {
    const state = window.appState;
    const pos = state.position;
    
    // 수익률 계산
    let pnl = 0;
    if (pos.amount > 0) {
        pnl = (currentPrice - pos.entryPrice) * pos.amount;
    }

    // UI 반영
    const equityEl = document.getElementById('total-equity');
    if (equityEl) {
        equityEl.innerText = window.formatCurrency(state.balance + (pos.amount * currentPrice));
    }
}

// 4. 매매 로직
window.placeOrder = function(side) {
    const qty = parseFloat(document.getElementById('order-qty').value);
    if (!qty) return alert("수량을 입력하세요");

    const state = window.appState;
    if (side === 'buy') {
        const cost = qty * currentPrice;
        if (state.balance < cost) return alert("잔고 부족");
        state.balance -= cost;
        state.position.entryPrice = ((state.position.amount * state.position.entryPrice) + (qty * currentPrice)) / (state.position.amount + qty);
        state.position.amount += qty;
    } else {
        if (state.position.amount < qty) return alert("수량 부족");
        state.balance += (qty * currentPrice);
        state.position.amount -= qty;
        if (state.position.amount <= 0) state.position.entryPrice = 0;
    }

    window.saveState(); // appData.js의 저장 함수 호출
    drawAvgPriceLine();
    updateDashboard();
    alert(side === 'buy' ? "매수 완료!" : "매도 완료!");
};

// 차트에 평단가 선 그리기
function drawAvgPriceLine() {
    if (myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    if (window.appState.position.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: window.appState.position.entryPrice, color: '#F0B90B', lineWidth: 2, lineStyle: 2, title: '평단가'
        });
    }
}
