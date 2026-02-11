// [tradingEngine.js] 하이브리드 강력 연결 버전

var chart = null;
var candleSeries = null;
var currentPrice = 65000; // 초기값
var myPriceLine = null;
var ws = null;
var activeTab = 'history';
var isSimulated = false; // 시뮬레이션 모드 여부

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

// 2. 실행 (앱 켜자마자 강제 실행)
window.addEventListener('load', function() {
    updateAll(); // 잔고부터 표시
    
    // 차트 라이브러리 로딩 확인
    var checkLoop = setInterval(function() {
        if (window.LightweightCharts) {
            clearInterval(checkLoop);
            initChart();       // 차트 틀 만들기
            connectData();     // 데이터 연결
        }
    }, 100);
    
    // 3초 뒤에도 차트가 안 그려졌으면 강제 시뮬레이션 가동
    setTimeout(() => {
        if (!chart || !currentPrice || currentPrice === 65000) {
            console.log("응답 지연 -> 시뮬레이션 모드 강제 전환");
            runSimulation();
        }
    }, 3000);
});

// 3. 차트 생성 (검은 박스에 그리기)
function initChart() {
    var container = document.getElementById('chart-area');
    if (!container) return;
    container.innerHTML = ''; // 기존 로딩 문구 삭제

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

    // 반응형 크기 조절
    window.addEventListener('resize', () => { chart.resize(container.clientWidth, 400); });
}

// 4. 데이터 연결 (3단계 방어 시스템)
function connectData() {
    // 1단계: 바이낸스 비전 API (가장 빠름)
    fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json())
        .then(data => {
            if(!data || data.length === 0) throw new Error("데이터 없음");
            
            var candles = data.map(d => ({
                time: d[0]/1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            }));
            candleSeries.setData(candles);
            currentPrice = candles[candles.length-1].close;
            
            // 실시간 소켓 연결
            connectWebSocket();
            updateAll();
            drawAvgLine();
            updateStatus("LIVE", "#0ecb81");
        })
        .catch(err => {
            console.warn("API 연결 실패, 시뮬레이션 모드 실행");
            runSimulation();
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
    ws.onerror = function() { runSimulation(); }; // 소켓 에러나면 바로 시뮬레이션
}

// ★ [핵심] 시뮬레이션 모드 (인터넷 안 돼도 차트 나옴)
function runSimulation() {
    if(isSimulated) return; // 중복 실행 방지
    isSimulated = true;
    updateStatus("SIMUL", "#F0B90B"); // 상태 표시: 노란색

    // 1. 가짜 과거 데이터 100개 생성
    var now = Math.floor(Date.now() / 1000);
    var price = 96000; // 기준 가격
    var data = [];
    
    for(var i=100; i>0; i--) {
        var time = now - (i * 60);
        var change = (Math.random() - 0.5) * 100;
        var close = price + change;
        var high = Math.max(price, close) + Math.random() * 20;
        var low = Math.min(price, close) - Math.random() * 20;
        
        data.push({ time: time, open: price, high: high, low: low, close: close });
        price = close;
    }
    
    if(candleSeries) candleSeries.setData(data);
    currentPrice = price;
    updateAll();
    drawAvgLine();

    // 2. 1초마다 움직이게 만듦 (살아있는 것처럼)
    setInterval(() => {
        var time = Math.floor(Date.now() / 1000);
        // 랜덤하게 가격 변동
        var change = (Math.random() - 0.5) * 50; 
        currentPrice += change;
        
        if(candleSeries) {
            candleSeries.update({
                time: time,
                open: currentPrice,
                high: currentPrice + 10,
                low: currentPrice - 10,
                close: currentPrice
            });
        }
        updateAll();
        checkPending();
    }, 1000);
}

// 5. 화면 업데이트 & 유틸리티
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
    var badge = document.getElementById('status-badge') || document.querySelector('.badge');
    if(badge) { 
        badge.innerText = text; 
        badge.style.color = color; 
        badge.style.borderColor = color; 
    }
}

function drawAvgLine() {
    if(!candleSeries) return;
    if(myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    if(window.appState.position.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: window.appState.position.entryPrice, color: '#F0B90B', lineWidth: 2, lineStyle: 2, title: '내 평단가'
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
