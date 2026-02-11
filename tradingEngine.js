var chart, candleSeries, currentPrice = 0, priceLine = null;
var activeTab = 'history', isAIRunning = false, lastPrices = [];

// 데이터 초기화
var appData = JSON.parse(localStorage.getItem('neuralNodeData')) || {
    balance: 100000, qty: 0, entry: 0, tradeHistory: [], pendingOrders: [], pnlHistory: []
};
if (appData.balance <= 0 && appData.qty === 0) appData.balance = 100000;
function save() { localStorage.setItem('neuralNodeData', JSON.stringify(appData)); }

window.addEventListener('load', function() {
    const container = document.getElementById('chart-box');
    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: 350,
        layout: { background: { color: '#000' }, textColor: '#888' },
        grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
        timeScale: { borderColor: '#333', timeVisible: true },
    });
    candleSeries = chart.addCandlestickSeries({ upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d' });

    fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(r => r.json()).then(data => {
            candleSeries.setData(data.map(d => ({ time: d[0]/1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) })));
            currentPrice = parseFloat(data[data.length-1][4]);
            startSocket(); drawAvg(); updateUI(); renderList();
        });
});

function startSocket() {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");
    ws.onmessage = (e) => {
        const k = JSON.parse(e.data).k;
        currentPrice = parseFloat(k.c);
        candleSeries.update({ time: k.t/1000, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: currentPrice });
        updateUI();
        checkPending();
        if (isAIRunning) runAIStrategy(currentPrice); // AI 전략 실시간 감시
    };
}

// AI 제어
window.toggleAI = function(run) {
    isAIRunning = run;
    document.getElementById('ai-start-btn').style.display = run ? 'none' : 'block';
    document.getElementById('ai-stop-btn').style.display = run ? 'block' : 'none';
    const tag = document.getElementById('ai-status-tag');
    tag.innerText = run ? "운전 중" : "중지됨";
    tag.style.color = run ? "#0ecb81" : "#666";
    document.getElementById('ai-msg').innerText = run ? "AI 분석 중..." : "AI 대기 중";
};

function runAIStrategy(price) {
    lastPrices.push(price);
    if (lastPrices.length > 15) lastPrices.shift();
    if (lastPrices.length < 15) return;
    const avg = lastPrices.reduce((a, b) => a + b) / lastPrices.length;

    // AI 조건: 저점 매수 / 고점 매도
    if (appData.qty === 0 && price < avg * 0.9997) {
        executeTrade('buy', 0.1, price, true); // AI 매수
    } else if (appData.qty > 0 && price > appData.entry * 1.0015) {
        executeTrade('sell', appData.qty, price, true); // AI 익절
    }
}

// 매매 핵심 함수
function executeTrade(side, q, price, isAI = false) {
    const time = new Date().toLocaleTimeString();
    const prefix = isAI ? "🤖AI " : "";
    
    if (side === 'buy') {
        const cost = q * price;
        if (appData.balance < cost) return;
        appData.balance -= cost;
        appData.entry = ((appData.qty * appData.entry) + cost) / (appData.qty + q);
        appData.qty += q;
    } else {
        if (appData.qty < q) return;
        const profit = (price - appData.entry) * q;
        appData.balance += (q * price);
        appData.pnlHistory.unshift({ time, price, pnl: profit });
        appData.qty -= q;
        if (appData.qty <= 0) appData.entry = 0;
    }
    appData.tradeHistory.unshift({ time, type: prefix + (side === 'buy' ? '매수' : '매도'), price, qty: q });
    save(); updateUI(); drawAvg(); renderList(); // ★ 리스트 즉시 갱신
    if(isAI) document.getElementById('ai-msg').innerHTML = `<span style="color:#F0B90B">${prefix} ${side==='buy'?'진입':'청산'} 완료</span>`;
}

window.trade = function(side) {
    const q = parseFloat(document.getElementById('qty-in').value);
    const p = parseFloat(document.getElementById('price-in').value);
    if (!q) return alert("수량을 입력하세요.");
    if (p > 0) {
        appData.pendingOrders.push({ time: new Date().toLocaleTimeString(), side, price: p, qty: q });
        alert("지정가 주문 접수");
    } else {
        executeTrade(side, q, currentPrice);
    }
    save(); renderList();
};

// UI 및 리스트 렌더링
window.switchTab = function(tab, el) {
    activeTab = tab;
    document.querySelectorAll('.tab-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    const head = document.getElementById('list-header-div');
    if (tab === 'pnl') head.innerHTML = '<span class="col-1">시간</span><span class="col-2">구분</span><span class="col-3">매도가</span><span class="col-4">손익($)</span>';
    else head.innerHTML = '<span class="col-1">시간</span><span class="col-2">구분</span><span class="col-3">가격</span><span class="col-4">수량</span>';
    renderList();
};

function renderList() {
    const cont = document.getElementById('list-content');
    let html = '';
    let data = (activeTab==='history')?appData.tradeHistory:(activeTab==='open')?appData.pendingOrders:appData.pnlHistory;
    if (!data || data.length === 0) { cont.innerHTML = '<div style="padding:40px; text-align:center; color:#444;">내역 없음</div>'; return; }
    data.forEach(item => {
        if (activeTab === 'pnl') html += `<div class="list-row"><span class="col-1">${item.time}</span><span class="col-2" style="color:#f6465d">매도</span><span class="col-3">$${item.price.toLocaleString()}</span><span class="col-4" style="color:${item.pnl>=0?'#0ecb81':'#f6465d'}">${item.pnl>=0?'+':''}${item.pnl.toFixed(2)}</span></div>`;
        else html += `<div class="list-row"><span class="col-1">${item.time}</span><span class="col-2" style="color:${(item.type||item.side).includes('매수')?'#0ecb81':'#f6465d'}">${item.type||(item.side==='buy'?'매수':'매도')}</span><span class="col-3">$${item.price.toLocaleString()}</span><span class="col-4">${item.qty}</span></div>`;
    });
    cont.innerHTML = html;
}

function updateUI() {
    const total = appData.balance + (appData.qty * currentPrice);
    const pnl = appData.qty > 0 ? (currentPrice - appData.entry) * appData.qty : 0;
    document.getElementById('top-balance').innerText = '$ ' + total.toLocaleString(undefined, {maximumFractionDigits:0});
    const pnlEl = document.getElementById('top-pnl');
    pnlEl.innerText = (pnl>=0?'+':'')+pnl.toFixed(2);
    pnlEl.style.color = pnl>=0?'#0ecb81':'#f6465d';
}

function drawAvg() {
    if (priceLine) candleSeries.removePriceLine(priceLine);
    if (appData.qty > 0) priceLine = candleSeries.createPriceLine({ price: appData.entry, color: '#F0B90B', lineWidth: 2, lineStyle: 2, title: '평단가' });
}

function checkPending() {
    for (let i = appData.pendingOrders.length - 1; i >= 0; i--) {
        const o = appData.pendingOrders[i];
        if ((o.side === 'buy' && currentPrice <= o.price) || (o.side === 'sell' && currentPrice >= o.price)) {
            appData.pendingOrders.splice(i, 1);
            executeTrade(o.side, o.qty, o.price);
        }
    }
}
window.resetApp = function() { localStorage.removeItem('neuralNodeData'); location.reload(); };
