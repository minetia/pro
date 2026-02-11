// [tradingEngine.js] 무조건 차트 띄우는 버전

var chart = null;
var candleSeries = null;
var currentPrice = 65000; // 기본값
var myPriceLine = null;
var ws = null;
var activeTab = 'history';
var isFakeMode = false; // 가짜 데이터 모드인지 확인

// 1. 데이터 로드
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

// 2. 실행 (라이브러리 로딩 대기)
window.addEventListener('load', function() {
    // 0.1초마다 라이브러리 확인 (최대 5초)
    var checkLib = setInterval(function() {
        if (window.LightweightCharts) {
            clearInterval(checkLib);
            startApp(); // 앱 시작!
        }
    }, 100);

    // 5초 지나도 안 되면 경고
    setTimeout(function() {
        if(!window.LightweightCharts) {
            alert("차트 도구 로딩 실패! 인터넷 연결을 확인하세요.");
        }
    }, 5000);
});

function startApp() {
    initChart();       // 차트 틀 생성
    tryConnectData();  // ★ 데이터 연결 시도 (3초 타임아웃 적용)
    updateAll();
    switchTab('history', document.querySelector('.tab-item'));
}

// 3. 차트 틀 만들기
function initChart() {
    var container = document.getElementById('chart-area');
    if (!container) return;
    container.innerHTML = ''; // "로딩중" 글씨 삭제

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 400,
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

// 4. ★ 데이터 연결 (3초 타임아웃 기능 추가)
function tryConnectData() {
    // 3초 안에 데이터 안 오면 강제로 에러 발생시킴
    var timeout = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error("시간 초과")), 3000);
    });

    var fetchData = fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json());

    // 둘 중 먼저 끝나는 것 실행 (데이터 vs 3초)
    Promise.race([fetchData, timeout])
        .then(data => {
            // 성공 시
            var candles = data.map(d => ({
                time: d[0]/1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            }));
            candleSeries.setData(candles);
            currentPrice = candles[candles.length-1].close;
            connectWebSocket(); // 소켓 연결
            updateAll();
            drawAvgLine();
        })
        .catch(err => {
            // ★ 3초 지났거나 에러 나면 -> 무조건 가짜 데이터 실행
            console.log("연결 실패/지연 -> 자체 엔진 가동");
            runFakeEngine();
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
    ws.onerror = function() { runFakeEngine(); }; // 소켓 에러나도 가짜 실행
}

// ★ 자체 엔진 (가짜 데이터 생성기)
function runFakeEngine() {
    if(isFakeMode) return; // 이미 실행 중이면 패스
    isFakeMode = true;
    
    // 헤더에 빨간 점 표시 (오프라인)
    var badge = document.querySelector('.badge');
    if(badge) { badge.innerText = "OFFLINE"; badge.style.borderColor = "#f6465d"; badge.style.color = "#f6465d"; }

    // 1. 초기 데이터 만들기 (최근 100분)
    var now = Math.floor(Date.now() / 1000);
    var price = 65000; 
    var data = [];
    for(var i=100; i>0; i--) {
        var time = now - (i * 60);
        var change = (Math.random() - 0.5) * 100;
        var open = price;
        var close = price + change;
        var high = Math.max(open, close) + Math.random() * 20;
        var low = Math.min(open, close) - Math.random() * 20;
        data.push({ time: time, open: open, high: high, low: low, close: close });
        price = close;
    }
    candleSeries.setData(data);
    currentPrice = price;
    updateAll();
    drawAvgLine();

    // 2. 1초마다 움직이기
    setInterval(function() {
        var time = Math.floor(Date.now() / 1000);
        var change = (Math.random() - 0.5) * 30; // 랜덤 등락
        var close = currentPrice + change;
        var open = currentPrice;
        
        candleSeries.update({
            time: time,
            open: open,
            high: Math.max(open, close) + 5,
            low: Math.min(open, close) - 5,
            close: close
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

// 6. 평단가 표시
function drawAvgLine() {
    if(!candleSeries) return;
    if(myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    if(window.appState.position.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: window.appState.position.entryPrice, color: '#F0B90B', lineWidth: 2, lineStyle: 2, title: '내 평단가'
        });
    }
}

// 7. 주문 로직
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
