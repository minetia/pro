var chart, candleSeries, currentPrice = 0, priceLine = null;
var activeTab = 'history';

// 1. 데이터 로드
var appData = JSON.parse(localStorage.getItem('neuralNodeData')) || {
    balance: 100000, qty: 0, entry: 0, tradeHistory: [], pendingOrders: [], pnlHistory: []
};
if (appData.balance <= 0 && appData.qty === 0) appData.balance = 100000;

function save() { localStorage.setItem('neuralNodeData', JSON.stringify(appData)); }

// 2. 초기화
window.addEventListener('load', function() {
    const container = document.getElementById('chart-box');
    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: 380,
        layout: { background: { color: '#000' }, textColor: '#888' },
        grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
        timeScale: { borderColor: '#333', timeVisible: true },
    });
    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
    });

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
            renderList(); // 초기 리스트 그리기
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
        checkPending();
    };
}

// 3. 주문 및 탭 전환 로직
window.trade = function(side) {
    const q = parseFloat(document.getElementById('qty-in').value);
    const p = parseFloat(document.getElementById('price-in').value);
    if (!q || q <= 0) return alert("수량을 입력하세요.");

    // 지정가 주문인 경우 미체결로 보냄
    if (p && p > 0) {
        appData.pendingOrders.push({ time: getTime(), side: side, price: p, qty: q });
        alert("지정가 주문이 접수되었습니다.");
    } else {
        // 시장가 체결
        executeTrade(side, q, currentPrice);
    }
    save(); renderList();
};

function executeTrade(side, q, price) {
    if (side === 'buy') {
        const cost = q * price;
        if (appData.balance < cost) return alert("잔고 부족");
        appData.balance -= cost;
        appData.entry = ((appData.qty * appData.entry) + cost) / (appData.qty + q);
        appData.qty += q;
    } else {
        if (appData.qty < q) return alert("수량 부족");
        const profit = (price - appData.entry) * q;
        appData.balance += (q * price);
        appData.pnlHistory.unshift({ time: getTime(), price: price, pnl: profit });
        appData.qty -= q;
        if (appData.qty <= 0) appData.entry = 0;
    }
    appData.tradeHistory.unshift({ time: getTime(), type: side === 'buy' ? '매수' : '매도', price: price, qty: q });
    save(); updateUI(); drawAvg();
}

window.switchTab = function(tab, el) {
    activeTab = tab;
    document.querySelectorAll('.tab-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    
    const header = document.getElementById('list-header-div');
    if (tab === 'pnl') {
        header.innerHTML = '<span class="col-1">시간</span><span class="col-2">구분</span><span class="col-3">매도가</span><span class="col-4">손익($)</span>';
    } else {
        header.innerHTML = '<span class="col-1">시간</span><span class="col-2">구분</span><span class="col-3">가격</span><span class="col-4">수량</span>';
    }
    renderList();
};

function renderList() {
    const container = document.getElementById('list-content');
    let html = '';
    let data = [];
    
    if (activeTab === 'history') data = appData.tradeHistory;
    else if (activeTab === 'open') data = appData.pendingOrders;
    else if (activeTab === 'pnl') data = appData.pnlHistory;

    if (data.length === 0) {
        container.innerHTML = '<div style="padding:30px; text-align:center; color:#444; font-size:13px;">내역이 없습니다.</div>';
        return;
    }

    data.forEach(item => {
        if (activeTab === 'pnl') {
            html += `<div class="list-row"><span class="col-1">${item.time}</span><span class="col-2 text-sell" style="color:#f6465d">매도</span><span class="col-3">$${item.price.toLocaleString()}</span><span class="col-4" style="color:${item.pnl>=0?'#0ecb81':'#f6465d'}">${item.pnl>=0?'+':''}${item.pnl.toFixed(2)}</span></div>`;
        } else if (activeTab === 'open') {
            html += `<div class="list-row"><span class="col-1">${item.time}</span><span class="col-2" style="color:${item.side==='buy'?'#0ecb81':'#f6465d'}">${item.side==='buy'?'매수':'매도'}</span><span class="col-3">$${item.price.toLocaleString()}</span><span class="col-4">${item.qty}</span></div>`;
        } else {
            html += `<div class="list-row"><span class="col-1">${item.time}</span><span class="col-2" style="color:${item.type==='매수'?'#0ecb81':'#f6465d'}">${item.type}</span><span class="col-3">$${item.price.toLocaleString()}</span><span class="col-4">${item.qty}</span></div>`;
        }
    });
    container.innerHTML = html;
}

// 기타 유틸리티
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
    const pnlPct = appData.qty > 0 ? (pnl / (appData.entry * appData.qty)) * 100 : 0;
    
    document.getElementById('top-balance').innerText = '$ ' + total.toLocaleString(undefined, {maximumFractionDigits:0});
    const pnlEl = document.getElementById('top-pnl');
    pnlEl.innerText = `${pnl>=0?'+':''}${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`;
    pnlEl.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
}

function checkPending() {
    for (let i = appData.pendingOrders.length - 1; i >= 0; i--) {
        const o = appData.pendingOrders[i];
        if ((o.side === 'buy' && currentPrice <= o.price) || (o.side === 'sell' && currentPrice >= o.price)) {
            appData.pendingOrders.splice(i, 1);
            executeTrade(o.side, o.qty, o.price);
            save(); renderList();
        }
    }
}

function getTime() { const d = new Date(); return d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds(); }
