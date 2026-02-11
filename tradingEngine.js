// [tradingEngine.js] 주소 수정 및 연결 강화 버전

var chart = null;
var candleSeries = null;
var currentPrice = 0;
var myPriceLine = null;
var ws = null;
var activeTab = 'history';

// 1. 데이터 로드 (시드머니 복구)
var savedData = localStorage.getItem('neuralNodeData');
if (savedData) {
    window.appState = JSON.parse(savedData);
    if (!window.appState.balance || window.appState.balance <= 0) {
        window.appState.balance = 100000;
        window.saveState();
    }
} else {
    window.appState = {
        balance: 100000, position: { amount: 0, entryPrice: 0 },
        pendingOrders: [], tradeHistory: [], pnlHistory: []
    };
}

window.saveState = function() {
    localStorage.setItem('neuralNodeData', JSON.stringify(window.appState));
};

// 2. 실행
window.addEventListener('load', function() {
    initChart();       // 차트 틀 만들기
    connectData();     // ★ 데이터 연결 (주소 변경됨)
    updateAll();       // 자산 표시
    switchTab('history', document.querySelector('.tab-item'));
});

// 3. 차트 생성
function initChart() {
    var container = document.getElementById('chart-area');
    if (!container) return;

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 400, // 높이 고정
        layout: { background: { color: '#000' }, textColor: '#888' },
        grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
        timeScale: { borderColor: '#333', timeVisible: true },
        crosshair: { mode: 0 }
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d',
        borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
    });

    window.addEventListener('resize', () => { chart.resize(container.clientWidth, 400); });
}

// 4. ★ 데이터 연결 (여기가 핵심!)
function connectData() {
    // 1단계: 바이낸스 공식 데이터 API (CORS 허용된 주소) 사용
    // api.binance.com -> data-api.binance.vision 으로 변경!
    fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json())
        .then(data => {
            // 성공 시 데이터 채우기
            var candles = data.map(d => ({
                time: d[0]/1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            }));
            candleSeries.setData(candles);
            currentPrice = candles[candles.length-1].close;
            
            // 소켓 연결 시작
            connectWebSocket();
            updateAll();
            drawAvgLine();
        })
        .catch(err => {
            // 2단계: 만약 이것도 안 되면(인터넷 차단 등), 비상 모드 가동!
            console.log("API 연결 실패, 자체 데이터로 전환합니다.");
            loadFakeData();
        });
}

function connectWebSocket() {
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
    
    // 소켓도 끊기면 가짜 데이터 실행
    ws.onerror = function() { loadFakeData(); };
}

// ★ 비상용 데이터 생성기 (차트가 절대 안 꺼지게 함)
function loadFakeData() {
    var now = Math.floor(Date.now() / 1000);
    var price = 95000; // 비트코인 기준가
    var data = [];
    for(var i=0; i<100; i++) {
        var time = now - (99-i)*60;
        var open = price;
        var close = price + (Math.random() - 0.5) * 50;
        var high = Math.max(open, close) + Math.random() * 10;
        var low = Math.min(open, close) - Math.random() * 10;
        data.push({ time: time, open: open, high: high, low: low, close: close });
        price = close;
    }
    candleSeries.setData(data);
    currentPrice = price;
    updateAll();
    drawAvgLine();
    
    // 1초마다 움직이게 만듦
    setInterval(function() {
        var last = data[data.length-1];
        var newTime = Math.floor(Date.now() / 1000);
        var change = (Math.random() - 0.5) * 20;
        var close = currentPrice + change;
        candleSeries.update({
            time: newTime, open: currentPrice, high: Math.max(currentPrice, close), low: Math.min(currentPrice, close), close: close
        });
        currentPrice = close;
        updateAll();
        checkPending();
    }, 1000);
}

// 5. 화면 업데이트
function updateAll() {
    var state = window.appState;
    var pos = state.position;
    var total = state.balance + (pos.amount * currentPrice);

    var pnl = 0, pnlPct = 0;
    if(pos.amount > 0) {
        pnl = (currentPrice - pos.entryPrice) * pos.amount;
        pnlPct = (pnl / (pos.entryPrice * pos.amount)) * 100;
    }

    var hBal = document.getElementById('header-balance');
    var hPnl = document.getElementById('header-pnl');
    
    if(hBal) hBal.innerText = '$ ' + total.toLocaleString(undefined, {maximumFractionDigits:0});
    if(hPnl) {
        var sign = pnl >= 0 ? '+' : '';
        hPnl.innerText = `${sign}$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`;
        hPnl.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
    }
}

// 6. 주문 및 기타 로직
function drawAvgLine() {
    if(!candleSeries) return;
    if(myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    if(window.appState.position.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: window.appState.position.entryPrice, color: '#F0B90B', lineWidth: 2, lineStyle: 2, title: '평단가'
        });
    }
}

window.order = function(side) {
    var pInput = document.getElementById('inp-price').value;
    var amtInput = parseFloat(document.getElementById('inp-amount').value);
    if(!amtInput || isNaN(amtInput)) return alert("수량을 입력하세요.");

    if(pInput) {
        window.appState.pendingOrders.push({ side: side, price: parseFloat(pInput), amount: amtInput, time: getTime() });
        saveState();
        if(activeTab === 'open') renderList();
        return alert("주문 접수");
    }
    executeTrade(side, amtInput, currentPrice);
};

function executeTrade(side, amount, price) {
    var state = window.appState;
    if (side === 'buy') {
        var cost = amount * price;
        if(state.balance < cost) return alert("잔고 부족");
        state.balance -= cost;
        state.position.entryPrice = ((state.position.amount * state.position.entryPrice) + cost) / (state.position.amount + amount);
        state.position.amount += amount;
    } else {
        if(state.position.amount < amount) return alert("코인 부족");
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
    drawAvgLine();
    renderList();
    alert("체결 완료!");
}

window.switchTab = function(tabName, el) {
    activeTab = tabName;
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    if(el) el.classList.add('active');
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
                html += `<div class="list-row"><span class="col-1">${item.time}</span><span class="col-2 text-sell">매도</span><span class="col-3">$${item.price.toLocaleString()}</span><span class="col-4 ${item.pnl>=0?'text-buy':'text-sell'}">${item.pnl>=0?'+':''}${item.pnl.toFixed(2)}</span></div>`;
            } else if(activeTab === 'open') {
                html += `<div class="list-row"><span class="col-1">대기</span><span class="col-2 ${item.side==='buy'?'text-buy':'text-sell'}">${item.side==='buy'?'매수':'매도'}</span><span class="col-3">$${item.price.toLocaleString()}</span><span class="col-4">${item.amount}</span></div>`;
            } else {
                html += `<div class="list-row"><span class="col-1">${item.time}</span><span class="col-2 ${item.type==='매수'?'text-buy':'text-sell'}">${item.type}</span><span class="col-3">$${item.price.toLocaleString()}</span><span class="col-4">${item.amount}</span></div>`;
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
    if(confirm("초기화 하시겠습니까?")) { localStorage.removeItem('neuralNodeData'); location.reload(); }
};
