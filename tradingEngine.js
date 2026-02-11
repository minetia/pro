var chart, candleSeries, currentPrice = 0, priceLine = null;

// 1. 데이터 로드 및 0원 복구 로직
var appData = JSON.parse(localStorage.getItem('neuralNodeData')) || {
    balance: 100000, qty: 0, entry: 0, logs: []
};
if (appData.balance <= 0 && appData.qty === 0) appData.balance = 100000;

function save() { localStorage.setItem('neuralNodeData', JSON.stringify(appData)); }

// 2. 초기화
window.addEventListener('load', function() {
    const container = document.getElementById('chart-box');
    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: 400,
        layout: { background: { color: '#000' }, textColor: '#888' },
        grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
        timeScale: { borderColor: '#333', timeVisible: true },
    });
    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
    });

    // 바이낸스 데이터 가져오기
    fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(r => r.json())
        .then(data => {
            candleSeries.setData(data.map(d => ({
                time: d[0]/1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            })));
            currentPrice = parseFloat(data[data.length-1][4]);
            startSocket();
            drawAvg();
            updateUI();
        });
});

function startSocket() {
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

window.trade = function(side) {
    const q = parseFloat(document.getElementById('qty-in').value);
    if (!q || q <= 0) return alert("수량을 입력하세요.");

    if (side === 'buy') {
        const cost = q * currentPrice;
        if (appData.balance < cost) return alert("잔고 부족");
        appData.balance -= cost;
        appData.entry = ((appData.qty * appData.entry) + cost) / (appData.qty + q);
        appData.qty += q;
    } else {
        if (appData.qty < q) return alert("수량 부족");
        appData.balance += (q * currentPrice);
        appData.qty -= q;
        if (appData.qty <= 0) appData.entry = 0;
    }
    save(); drawAvg(); updateUI(); alert("체결 완료");
};

function drawAvg() {
    if (priceLine) candleSeries.removePriceLine(priceLine);
    if (appData.qty > 0) {
        priceLine = candleSeries.createPriceLine({
            price: appData.entry, color: '#F0B90B', lineWidth: 2, lineStyle: 2, title: '평단가'
        });
    }
}

function updateUI() {
    const total = appData.balance + (appData.qty * currentPrice);
    const pnl = appData.qty > 0 ? (currentPrice - appData.entry) * appData.qty : 0;
    document.getElementById('top-balance').innerText = '$ ' + total.toLocaleString(undefined, {maximumFractionDigits:0});
    document.getElementById('top-pnl').innerText = (pnl >= 0 ? '+' : '') + pnl.toFixed(2);
}

window.resetApp = function() {
    localStorage.removeItem('neuralNodeData');
    location.reload();
};
