// [tradingEngine.js] 차트 우선 로딩 + 평단가 표시

var chart = null;
var candleSeries = null;
var currentPrice = 0;
var myPriceLine = null; // ★ 평단가 라인 변수
var ws = null;
var activeTab = 'history';

// 1. 데이터 복구 (0원 문제 해결)
var savedData = localStorage.getItem('neuralNodeData');
if (savedData) {
    window.appState = JSON.parse(savedData);
    if (!window.appState.balance || window.appState.balance <= 0) {
        window.appState.balance = 100000; // 강제 복구
        window.saveState();
    }
} else {
    window.appState = {
        balance: 100000,
        position: { amount: 0, entryPrice: 0 },
        pendingOrders: [],
        tradeHistory: [],
        pnlHistory: []
    };
}

window.saveState = function() {
    localStorage.setItem('neuralNodeData', JSON.stringify(window.appState));
};

// 2. 실행 (차트 그리기 -> 데이터 연결)
window.addEventListener('load', function() {
    renderUI(); // 화면 뼈대 생성
    
    // 0.1초 뒤 차트 생성 (HTML이 다 그려진 후 실행하기 위함)
    setTimeout(() => {
        initChart();
        connectBinance();
        updateAll();
    }, 100);
});

// 3. UI 그리기
function renderUI() {
    var app = document.getElementById('app-container');
    if (!app) return;

    app.innerHTML = `
        <div style="padding:20px; text-align:center; background:#121212; border-bottom:1px solid #333;">
            <div style="color:#888; font-size:12px;">총 자산 (Equity)</div>
            <div id="equity-val" style="font-size:32px; font-weight:bold; color:#fff; margin:5px 0;">Loading...</div>
            <div id="pnl-val" style="font-size:13px; color:#888;">--</div>
        </div>

        <div id="chart-area" style="width:100%; height:350px; background:#000;"></div>

        <div style="padding:15px; background:#1e1e1e; border-top:1px solid #333;">
            <div class="input-group">
                <input type="number" id="inp-price" class="input-field" placeholder="지정가 (빈칸=시장가)">
                <input type="number" id="inp-amount" class="input-field" placeholder="수량 (BTC)">
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="order('buy')" style="flex:1; padding:12px; background:#0ecb81; border:none; border-radius:6px; color:#fff; font-weight:bold;">매수</button>
                <button onclick="order('sell')" style="flex:1; padding:12px; background:#f6465d; border:none; border-radius:6px; color:#fff; font-weight:bold;">매도</button>
            </div>
            <div style="text-align:center; margin-top:15px;" onclick="resetData()">
                <span style="font-size:11px; color:#666; text-decoration:underline; cursor:pointer;">데이터 초기화 (Reset)</span>
            </div>
        </div>

        <div class="tab-menu">
            <div class="tab-item active" onclick="switchTab('history', this)">체결 내역</div>
            <div class="tab-item" onclick="switchTab('open', this)">미체결</div>
            <div class="tab-item" onclick="switchTab('pnl', this)">실현 손익</div>
        </div>
        <div style="min-height:300px; background:#121212;">
            <div class="list-header" id="list-header"></div>
            <div id="list-content"></div>
        </div>
    `;
    switchTab('history', document.querySelector('.tab-item'));
}

// 4. 차트 생성 (TradingView 라이브러리)
function initChart() {
    var container = document.getElementById('chart-area');
    if(!container) return;
    container.innerHTML = ''; // "로딩중" 문구 삭제

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: 350,
        layout: { background: { color: '#000' }, textColor: '#888' },
        grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
        timeScale: { borderColor: '#333', timeVisible: true },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
    });

    // 바이낸스 과거 데이터 로드
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json())
        .then(data => {
            var candles = data.map(d => ({
                time: d[0]/1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            }));
            candleSeries.setData(candles);
            currentPrice = candles[candles.length-1].close;
            updateAll();
            drawAvgLine(); // ★ 로딩되자마자 평단가 선 그리기
        });
}

// 5. 바이낸스 실시간 연결
function connectBinance() {
    if(ws) ws.close();
    ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");
    ws.onmessage = function(e) {
        var k = JSON.parse(e.data).k;
        currentPrice = parseFloat(k.c);
        if(candleSeries) candleSeries.update({
            time: k.t/1000, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: currentPrice
        });
        updateAll();
        checkPending();
    };
}

// 6. 평단가 선 그리기 (핵심 기능)
function drawAvgLine() {
    if(!candleSeries) return;
    // 기존 선 삭제
    if(myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    
    // 코인을 가지고 있을 때만 새로 그리기
    if(window.appState.position.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: window.appState.position.entryPrice,
            color: '#F0B90B', // 노란색 (Gold)
            lineWidth: 2,
            lineStyle: 2,     // 점선
            axisLabelVisible: true,
            title: '내 평단가'
        });
    }
}

// 7. 주문 로직
window.order = function(side) {
    var pInput = document.getElementById('inp-price').value;
    var amtInput = parseFloat(document.getElementById('inp-amount').value);
    
    if(!amtInput || isNaN(amtInput)) return alert("수량을 입력하세요.");

    if(pInput) { // 지정가
        window.appState.pendingOrders.push({
            side: side, price: parseFloat(pInput), amount: amtInput, time: getTime()
        });
        saveState();
        if(activeTab === 'open') renderList();
        return alert("주문이 접수되었습니다.");
    }

    executeTrade(side, amtInput, currentPrice); // 시장가
};

function executeTrade(side, amount, price) {
    var state = window.appState;
    if (side === 'buy') {
        var cost = amount * price;
        if(state.balance < cost) return alert("잔고 부족!");
        state.balance -= cost;
        // 평단가 계산
        state.position.entryPrice = ((state.position.amount * state.position.entryPrice) + cost) / (state.position.amount + amount);
        state.position.amount += amount;
    } else {
        if(state.position.amount < amount) return alert("코인 부족!");
        var revenue = amount * price;
        var profit = (price - state.position.entryPrice) * amount;
        state.balance += revenue;
        state.position.amount -= amount;
        if(!state.pnlHistory) state.pnlHistory = [];
        state.pnlHistory.unshift({ time: getTime(), price: price, amount: amount, pnl: profit });
        if(state.position.amount <= 0) state.position.entryPrice = 0;
    }
    
    state.tradeHistory.unshift({ time: getTime(), type: side==='buy'?'매수':'매도', price: price, amount: amount });
    saveState();
    updateAll();
    drawAvgLine(); // ★ 거래 후 즉시 선 그리기
    renderList();
    alert("체결되었습니다!");
}

// 8. 업데이트 유틸
function updateAll() {
    var state = window.appState;
    var pos = state.position;
    var total = state.balance + (pos.amount * currentPrice);

    var pnl = 0, pnlPct = 0;
    if(pos.amount > 0) {
        pnl = (currentPrice - pos.entryPrice) * pos.amount;
        pnlPct = (pnl / (pos.entryPrice * pos.amount)) * 100;
    }

    var eqEl = document.getElementById('equity-val');
    if(eqEl) eqEl.innerText = '$ ' + total.toLocaleString(undefined, {minimumFractionDigits:2});

    var pnlEl = document.getElementById('pnl-val');
    if(pnlEl) {
        pnlEl.innerText = `미실현: ${pnl>=0?'+':''}$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`;
        pnlEl.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
    }
}

window.switchTab = function(tabName, el) {
    activeTab = tabName;
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    
    var header = document.getElementById('list-header');
    if(tabName === 'pnl') header.innerHTML = '<span class="col-1">시간</span><span class="col-2">구분</span><span class="col-3">매도가</span><span class="col-4">손익($)</span>';
    else header.innerHTML = '<span class="col-1">시간</span><span class="col-2">구분</span><span class="col-3">가격</span><span class="col-4">수량</span>';
    renderList();
};

function renderList() {
    var list = document.getElementById('list-content');
    if(!list) return;
    var html = '', data = [];
    if(activeTab === 'history') data = window.appState.tradeHistory;
    else if(activeTab === 'open') data = window.appState.pendingOrders;
    else if(activeTab === 'pnl') data = window.appState.pnlHistory || [];

    if(data.length === 0) html = '<div style="padding:20px; text-align:center; color:#555;">내역 없음</div>';
    else {
        data.forEach(item => {
            if(activeTab === 'pnl') {
                html += `<div class="list-row"><span class="col-1 text-gray">${item.time}</span><span class="col-2 text-sell">매도</span><span class="col-3 text-white">$${item.price.toLocaleString()}</span><span class="col-4 ${item.pnl>=0?'text-buy':'text-sell'}">${item.pnl>=0?'+':''}${item.pnl.toFixed(2)}</span></div>`;
            } else if(activeTab === 'open') {
                html += `<div class="list-row"><span class="col-1 text-gray">대기</span><span class="col-2 ${item.side==='buy'?'text-buy':'text-sell'}">${item.side==='buy'?'매수':'매도'}</span><span class="col-3 text-white">$${item.price.toLocaleString()}</span><span class="col-4 text-white">${item.amount}</span></div>`;
            } else {
                html += `<div class="list-row"><span class="col-1 text-gray">${item.time}</span><span class="col-2 ${item.type==='매수'?'text-buy':'text-sell'}">${item.type}</span><span class="col-3 text-white">$${item.price.toLocaleString()}</span><span class="col-4 text-white">${item.amount}</span></div>`;
            }
        });
    }
    list.innerHTML = html;
}

function getTime() { var d = new Date(); return d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds(); }
function checkPending() {
    var orders = window.appState.pendingOrders;
    for(var i=orders.length-1; i>=0; i--) {
        var o = orders[i];
        if((o.side==='buy' && currentPrice <= o.price) || (o.side==='sell' && currentPrice >= o.price)) {
            orders.splice(i, 1);
            executeTrade(o.side, o.amount, o.price);
        }
    }
}
window.resetData = function() {
    if(confirm("모든 데이터를 초기화하시겠습니까?")) {
        localStorage.removeItem('neuralNodeData');
        location.reload();
    }
};
