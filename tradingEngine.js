// [tradingEngine.js] 트레이딩뷰 라이브러리 기반 엔진

var chart, candleSeries, currentPrice = 0, avgLine = null;
var activeTab = 'history';

// 1. 데이터 초기화 (0원 방지)
var state = JSON.parse(localStorage.getItem('neuralNodeData')) || {
    balance: 100000, pos: { qty: 0, price: 0 }, history: [], pnlLog: []
};

function save() { localStorage.setItem('neuralNodeData', JSON.stringify(state)); }

// 2. 실행
window.addEventListener('load', () => {
    initTradingView(); // 트레이딩뷰 차트 시작
    updateUI();
    setTab('history', document.querySelector('.tab-item'));
});

// 3. 트레이딩뷰 차트 생성
function initTradingView() {
    const container = document.getElementById('chart-container');
    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: 400,
        layout: { background: { color: '#000' }, textColor: '#888' },
        grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
        timeScale: { borderColor: '#333', timeVisible: true },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
    });

    // 바이낸스 과거 데이터 로드
    fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(r => r.json())
        .then(data => {
            candleSeries.setData(data.map(d => ({
                time: d[0]/1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            })));
            currentPrice = parseFloat(data[data.length-1][4]);
            connectSocket(); // 실시간 웹소켓 시작
            drawAvgLine();   // 평단가 선 그리기
        });
}

// 4. 바이낸스 실시간 웹소켓
function connectSocket() {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");
    ws.onmessage = (e) => {
        const k = JSON.parse(e.data).k;
        currentPrice = parseFloat(k.c);
        candleSeries.update({
            time: k.t/1000, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: currentPrice
        });
        updateUI();
    };
}

// 5. 주문 로직 (매매)
window.sendOrder = function(side) {
    const qty = parseFloat(document.getElementById('buy-qty').value);
    if (!qty || qty <= 0) return alert("수량을 입력하세요.");

    if (side === 'buy') {
        const cost = qty * currentPrice;
        if (state.balance < cost) return alert("잔고가 부족합니다.");
        state.balance -= cost;
        state.pos.price = ((state.pos.qty * state.pos.price) + cost) / (state.pos.qty + qty);
        state.pos.qty += qty;
    } else {
        if (state.pos.qty < qty) return alert("보유 수량이 부족합니다.");
        const revenue = qty * currentPrice;
        const profit = (currentPrice - state.pos.price) * qty;
        state.balance += revenue;
        state.pnlLog.unshift({ time: new Date().toLocaleTimeString(), pnl: profit });
        state.pos.qty -= qty;
        if (state.pos.qty <= 0) state.pos.price = 0;
    }

    state.history.unshift({ time: new Date().toLocaleTimeString(), type: side === 'buy' ? '매수' : '매도', price: currentPrice, qty: qty });
    save();
    updateUI();
    drawAvgLine(); // 평단가 선 갱신
    renderList();
    alert("체결되었습니다!");
};

// 6. 트레이딩뷰 평단가 선

function drawAvgLine() {
    if (!candleSeries) return;
    if (avgLine) { candleSeries.removePriceLine(avgLine); avgLine = null; }
    if (state.pos.qty > 0) {
        avgLine = candleSeries.createPriceLine({
            price: state.pos.price, color: '#F0B90B', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: '내 평단가'
        });
    }
}

// 7. 화면 갱신
function updateUI() {
    const total = state.balance + (state.pos.qty * currentPrice);
    const pnl = state.pos.qty > 0 ? (currentPrice - state.pos.price) * state.pos.qty : 0;
    const pnlPct = state.pos.qty > 0 ? (pnl / (state.pos.price * state.pos.qty)) * 100 : 0;

    document.getElementById('h-balance').innerText = '$ ' + total.toLocaleString(undefined, {maximumFractionDigits:0});
    const pnlEl = document.getElementById('h-pnl');
    pnlEl.innerText = `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`;
    pnlEl.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
}

window.setTab = function(t, el) {
    activeTab = t;
    document.querySelectorAll('.tab-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    renderList();
};

function renderList() {
    const list = document.getElementById('log-list');
    let html = '';
    const data = activeTab === 'history' ? state.history : state.pnlLog;
    
    if (data.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#555;">기록이 없습니다.</div>';
        return;
    }

    data.forEach(item => {
        if (activeTab === 'history') {
            html += `<div class="list-row"><span class="col-1">${item.time}</span><span class="col-2" style="color:${item.type==='매수'?'#0ecb81':'#f6465d'}">${item.type}</span><span class="col-3">$${item.price.toLocaleString()}</span><span class="col-4">${item.qty}</span></div>`;
        } else {
            html += `<div class="list-row"><span class="col-1">${item.time}</span><span class="col-2">수익</span><span class="col-3" style="color:${item.pnl>=0?'#0ecb81':'#f6465d'}">$${item.pnl.toFixed(2)}</span><span class="col-4"></span></div>`;
        }
    });
    list.innerHTML = html;
}
