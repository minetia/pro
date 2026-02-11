// [tradingEngine.js] 3중 안전장치 연결 버전

var chart = null;
var candleSeries = null;
var currentPrice = 65000; // 초기 안전값
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

// 2. 실행 (즉시 업데이트 실행)
window.addEventListener('load', function() {
    updateAll(); // ★ 중요: 앱 켜자마자 잔고부터 표시
    
    // 차트 라이브러리 체크 후 실행
    if (window.LightweightCharts) {
        startEngine();
    } else {
        // 혹시 늦게 로딩될까봐 0.5초 기다려줌
        setTimeout(() => { 
            if(window.LightweightCharts) startEngine(); 
            else alert("인터넷 연결을 확인해주세요 (차트 도구 로딩 실패)");
        }, 500);
    }
});

function startEngine() {
    initChart();       
    connectData();     // ★ 3중 연결 시스템 가동
    switchTab('history', document.querySelector('.tab-item'));
}

// 3. 차트 생성
function initChart() {
    var container = document.getElementById('chart-area');
    if (!container) return;
    container.innerHTML = ''; 

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: 400,
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

// 4. ★ 데이터 연결 (Binance -> CoinGecko -> Fake 순서)
function connectData() {
    // [시도 1] 바이낸스 공식 데이터 API (CORS 허용됨)
    fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json())
        .then(data => {
            // 성공 시
            var candles = data.map(d => ({
                time: d[0]/1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            }));
            candleSeries.setData(candles);
            currentPrice = candles[candles.length-1].close;
            connectWebSocket(); // 실시간 소켓 연결
            updateStatus('LIVE', '#0ecb81');
        })
        .catch(err => {
            console.log("바이낸스 연결 실패, 코인게코 시도...");
            // [시도 2] 코인게코 API (단순 가격 조회용)
            fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
                .then(res => res.json())
                .then(data => {
                    currentPrice = data.bitcoin.usd;
                    updateAll();
                    updateStatus('GECKO', '#F0B90B'); // 노란불 (코인게코 모드)
                    runFakeChart(currentPrice); // 차트는 가짜로 생성
                })
                .catch(err2 => {
                    console.log("코인게코 실패, 자체 엔진 가동");
                    // [시도 3] 완전 오프라인 모드
                    updateStatus('OFFLINE', '#f6465d'); // 빨간불
                    runFakeChart(65000);
                });
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
}

// 자체 차트 엔진 (데이터 안 올 때 화면 멈춤 방지)
function runFakeChart(startPrice) {
    var now = Math.floor(Date.now() / 1000);
    var price = startPrice;
    var data = [];
    // 과거 100개 생성
    for(var i=100; i>0; i--) {
        var time = now - (i * 60);
        var change = (Math.random() - 0.5) * (price * 0.002);
        var close = price + change;
        data.push({ time: time, open: price, high: Math.max(price, close)+5, low: Math.min(price, close)-5, close: close });
        price = close;
    }
    if(candleSeries) candleSeries.setData(data);
    
    // 1초마다 움직임 생성
    setInterval(() => {
        var time = Math.floor(Date.now() / 1000);
        var change = (Math.random() - 0.5) * (currentPrice * 0.0005);
        currentPrice += change;
        if(candleSeries) candleSeries.update({
            time: time, open: currentPrice, high: currentPrice+2, low: currentPrice-2, close: currentPrice
        });
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
    drawAvgLine();
}

function updateStatus(text, color) {
    var badge = document.getElementById('status-badge');
    if(badge) { badge.innerText = text; badge.style.color = color; badge.style.borderColor = color; }
}

// 6. 주문 및 기타
function drawAvgLine() {
    if(!candleSeries) return;
    if(myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    if(window.appState.position.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: window.appState.position.entryPrice, color: '#F0B90B', lineWidth: 2, lineStyle: 2, title: '내 평단가'
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
