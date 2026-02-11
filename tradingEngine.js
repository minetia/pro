// [tradingEngine.js] 빈 화면 방지 + 즉시 렌더링 버전

var chart = null;
var candleSeries = null;
var currentPrice = 96000; // 요즘 비트코인 가격
var myPriceLine = null;
var ws = null;
var activeTab = 'history';

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

// 2. 실행 (무조건 차트부터 그린다)
window.addEventListener('load', function() {
    updateAll(); // 잔고 표시
    
    var loop = setInterval(function() {
        if (window.LightweightCharts) {
            clearInterval(loop);
            initChart(); // ★ 차트 생성 + 가짜 데이터 즉시 주입
            
            // 그 다음 진짜 연결 시도 (실패해도 이미 가짜가 있어서 안심)
            setTimeout(connectRealData, 500); 
        }
    }, 100);
});

// 3. 차트 생성 및 초기 데이터 주입
function initChart() {
    var container = document.getElementById('chart-area');
    if (!container) return;
    container.innerHTML = ''; // 메시지 삭제

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

    // ★ [핵심] 빈 화면 방지용 '기본 데이터' 깔아두기
    generateBaseData(currentPrice); 
    
    window.addEventListener('resize', () => { chart.resize(container.clientWidth, 400); });
    updateStatus("READY", "#888");
}

// 기본 데이터 생성기 (차트가 안 비어보이게 함)
function generateBaseData(startPrice) {
    var now = Math.floor(Date.now() / 1000);
    var data = [];
    var price = startPrice;
    
    // 과거 100분치 생성
    for(var i=100; i>0; i--) {
        var time = now - (i * 60);
        var change = (Math.random() - 0.5) * 200;
        var close = price + change;
        var high = Math.max(price, close) + Math.random() * 50;
        var low = Math.min(price, close) - Math.random() * 50;
        data.push({ time: time, open: price, high: high, low: low, close: close });
        price = close;
    }
    candleSeries.setData(data);
    currentPrice = price;
    updateAll();
}

// 4. 진짜 데이터 연결 시도
function connectRealData() {
    updateStatus("CONNECTING...", "#F0B90B");
    
    // 바이낸스 비전 API 시도
    fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json())
        .then(data => {
            // 성공하면 진짜 데이터로 교체!
            var candles = data.map(d => ({
                time: d[0]/1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            }));
            candleSeries.setData(candles);
            currentPrice = candles[candles.length-1].close;
            
            // 소켓 연결
            connectWebSocket();
            updateStatus("LIVE", "#0ecb81");
            drawAvgLine();
        })
        .catch(err => {
            console.log("연결 실패, 시뮬레이션 모드 유지");
            updateStatus("SIMUL", "#F0B90B");
            // 실패하면 아까 깔아둔 데이터에 이어서 시뮬레이션 시작
            startSimulation(); 
        });
}

function connectWebSocket() {
    if(ws) ws.close();
    ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");
    ws.onmessage = function(e) {
        var k = JSON.parse(e.data).k;
        currentPrice = parseFloat(k.c);
        candleSeries.update({
            time: k.t/1000, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: currentPrice
        });
        updateAll();
        checkPending();
    };
    ws.onerror = function() { startSimulation(); };
}

// 시뮬레이션 (인터넷 안될 때 움직이게 함)
function startSimulation() {
    setInterval(() => {
        var time = Math.floor(Date.now() / 1000);
        var change = (Math.random() - 0.5) * 50;
        currentPrice += change;
        candleSeries.update({
            time: time,
            open: currentPrice,
            high: currentPrice + 10,
            low: currentPrice - 10,
            close: currentPrice
        });
        updateAll();
        checkPending();
    }, 1000);
}

// 5. 화면 및 데이터 갱신
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

function updateStatus(text, color) {
    var badge = document.getElementById('status-badge');
    if(badge) { badge.innerText = text; badge.style.color = color; badge.style.borderColor = color; }
}

function drawAvgLine() {
    if(!candleSeries) return;
    if(myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    if(window.appState.position.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: window.appState.position.entryPrice, color: '#F0B90B', lineWidth: 2, lineStyle: 2, title: '평단가'
        });
    }
}

// 6. 주문 로직
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
