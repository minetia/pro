// [tradingEngine.js] 거래소 핵심 엔진

var ws = null;
var chart = null;
var candleSeries = null;
var currentPrice = 0;
var myPriceLine = null;

// [1] 페이지 로드 시 실행
window.addEventListener('load', function() {
    createTradingUI();     // 1. 화면(UI) 먼저 만들기 (이게 빠져서 멈췄었습니다!)
    initChart();           // 2. 차트 생성
    connectBinance();      // 3. 시세 연결
    updateDashboard();     // 4. 데이터 초기화
});

// [2] 화면 그리기 함수 (누락되었던 부분 추가!)
function createTradingUI() {
    var card = document.querySelector('.card');
    if (!card) return;

    card.innerHTML = `
        <div style="padding:20px; text-align:center; background:#1e1e1e; border-bottom:1px solid #333;">
            <div style="color:#888; font-size:12px; margin-bottom:5px;">총 보유 자산 (Equity)</div>
            <div id="total-equity" style="font-size:32px; font-weight:bold; color:#fff;">$ 0.00</div>
            <div id="pnl-display" style="font-size:14px; margin-top:5px; color:#888;">미실현 손익: $ 0.00 (0.00%)</div>
        </div>

        <div id="chart-container" style="width:100%; height:320px; background:#000;"></div>

        <div style="padding:15px; background:#1e1e1e; border-top:1px solid #333;">
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <input type="number" id="order-price" placeholder="시장가 (Market)" 
                       style="flex:1; padding:12px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:8px;">
                <input type="number" id="order-qty" placeholder="수량 (BTC)" 
                       style="flex:1; padding:12px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:8px;">
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="placeOrder('buy')" style="flex:1; padding:14px; background:#0ecb81; border:none; border-radius:8px; color:#fff; font-weight:bold; font-size:16px;">매수 (Long)</button>
                <button onclick="placeOrder('sell')" style="flex:1; padding:14px; background:#f6465d; border:none; border-radius:8px; color:#fff; font-weight:bold; font-size:16px;">매도 (Short)</button>
            </div>
            <div style="text-align:center; margin-top:15px;">
                <span onclick="resetData()" style="color:#666; font-size:11px; text-decoration:underline; cursor:pointer;">데이터 초기화</span>
            </div>
        </div>

        <div style="padding:15px; background:#121212;">
            <div style="color:#888; font-size:12px; margin-bottom:10px;">📋 최근 체결 내역</div>
            <div id="history-list" style="font-size:12px; color:#ccc;"></div>
        </div>
    `;
    
    updateHistoryList(); // 내역 표시
}

// [3] 차트 초기화
function initChart() {
    // 라이브러리 체크
    if (!window.LightweightCharts) {
        var script = document.createElement('script');
        script.src = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";
        script.onload = initChart;
        document.head.appendChild(script);
        return;
    }

    const container = document.getElementById('chart-container');
    if (!container) return;
    container.innerHTML = '';

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 320,
        layout: { background: { color: '#000' }, textColor: '#d1d4dc' },
        grid: { vertLines: { color: '#111' }, horzLines: { color: '#111' } },
        timeScale: { borderColor: '#333' },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d',
        borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
    });

    // 과거 데이터
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json())
        .then(data => {
            candleSeries.setData(data.map(d => ({
                time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            })));
            currentPrice = parseFloat(data[data.length - 1][4]);
            drawAvgPriceLine();
            updateDashboard();
        });
}

// [4] 바이낸스 연결
function connectBinance() {
    if(ws) ws.close();
    ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");
    ws.onmessage = function(e) {
        var k = JSON.parse(e.data).k;
        currentPrice = parseFloat(k.c);
        if(candleSeries) {
            candleSeries.update({
                time: k.t/1000, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: currentPrice
            });
        }
        updateDashboard();
    };
}

// [5] 대시보드 업데이트
function updateDashboard() {
    if(!window.appState) return;
    const state = window.appState;
    const pos = state.position;
    
    // 평가금액 = 잔고 + (코인수량 * 현재가)
    const total = state.balance + (pos.amount * currentPrice);
    
    // 수익률 계산
    let pnl = 0, pnlPct = 0;
    if (pos.amount > 0) {
        pnl = (currentPrice - pos.entryPrice) * pos.amount;
        pnlPct = (pnl / (pos.entryPrice * pos.amount)) * 100;
    }

    // 화면 표시
    const eqEl = document.getElementById('total-equity');
    if (eqEl) eqEl.innerText = window.formatCurrency(total);
    
    const pnlEl = document.getElementById('pnl-display');
    if (pnlEl) {
        pnlEl.innerText = `미실현 손익: ${window.formatCurrency(pnl)} (${pnlPct.toFixed(2)}%)`;
        pnlEl.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
    }
}

// [6] 주문 로직
window.placeOrder = function(side) {
    const qty = parseFloat(document.getElementById('order-qty').value);
    if (!qty) return alert("수량을 입력하세요");

    const state = window.appState;
    const cost = qty * currentPrice;

    if (side === 'buy') {
        if (state.balance < cost) return alert("잔고 부족");
        state.balance -= cost;
        state.position.entryPrice = ((state.position.amount * state.position.entryPrice) + cost) / (state.position.amount + qty);
        state.position.amount += qty;
    } else {
        if (state.position.amount < qty) return alert("수량 부족");
        state.balance += cost;
        state.position.amount -= qty;
        if (state.position.amount <= 0) state.position.entryPrice = 0;
    }

    // 내역 저장
    state.tradeHistory.unshift({
        time: new Date().toLocaleTimeString(),
        type: side === 'buy' ? '매수' : '매도',
        price: currentPrice,
        amount: qty
    });

    window.saveState(); // appData.js 저장 함수
    drawAvgPriceLine();
    updateDashboard();
    updateHistoryList();
    alert("체결되었습니다!");
};

// [7] 보조 함수들
function updateHistoryList() {
    const list = document.getElementById('history-list');
    if(!list) return;
    list.innerHTML = window.appState.tradeHistory.map(h => `
        <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #222;">
            <span>${h.time}</span>
            <span style="color:${h.type==='매수'?'#0ecb81':'#f6465d'}">${h.type}</span>
            <span>$${h.price.toLocaleString()}</span>
            <span>${h.amount} BTC</span>
        </div>
    `).join('') || '<div style="padding:10px; text-align:center;">거래 내역 없음</div>';
}

function drawAvgPriceLine() {
    if(!candleSeries) return;
    if (myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    if (window.appState.position.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: window.appState.position.entryPrice, color: '#F0B90B', lineWidth: 2, lineStyle: 2, title: '평단가'
        });
    }
}

window.resetData = function() {
    if(confirm("초기화 하시겠습니까?")) {
        localStorage.removeItem('tradingData');
        location.reload();
    }
};
