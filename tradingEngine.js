// [tradingEngine.js] 차트 복구 + 테이블 완벽 구현 버전

// 전역 변수
var chart = null;
var candleSeries = null;
var currentPrice = 0;
var myPriceLine = null;
var ws = null;
var activeTab = 'history'; // 현재 보고 있는 탭 (history, open, pnl)

// [1] 데이터 로드 및 초기화
window.appState = JSON.parse(localStorage.getItem('neuralNodeData')) || {
    balance: 100000,
    position: { amount: 0, entryPrice: 0 },
    pendingOrders: [],
    tradeHistory: [], // 체결 내역
    pnlHistory: []    // 실현 손익 내역 (매도 시 기록)
};

window.saveState = function() {
    localStorage.setItem('neuralNodeData', JSON.stringify(window.appState));
};

window.addEventListener('load', function() {
    renderUI();           // 1. UI 뼈대 만들기
    initChart();          // 2. 차트 만들기
    connectBinance();     // 3. 시세 연결
    updateAll();          // 4. 데이터 채우기
});


// [2] UI 렌더링 (탭 메뉴 추가)
function renderUI() {
    var app = document.getElementById('app-container');
    if (!app) return;

    app.innerHTML = `
        <div style="padding:20px; text-align:center; background:#121212; border-bottom:1px solid #333;">
            <div style="color:#888; font-size:12px;">총 자산 (Total Equity)</div>
            <div id="equity-val" style="font-size:32px; font-weight:bold; color:#fff; margin:5px 0;">$ 0.00</div>
            <div id="pnl-val" style="font-size:14px; color:#888;">미실현 손익: $ 0.00 (0.00%)</div>
        </div>

        <div id="chart-area" style="width:100%; height:350px; background:#000;"></div>

        <div style="padding:15px; background:#1e1e1e; border-top:1px solid #333; border-bottom:1px solid #333;">
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <input type="number" id="inp-price" placeholder="지정가 (빈칸=시장가)" style="flex:1; padding:12px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:6px;">
                <input type="number" id="inp-amount" placeholder="수량 (BTC)" style="flex:1; padding:12px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:6px;">
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="order('buy')" style="flex:1; padding:12px; background:#0ecb81; border:none; border-radius:6px; color:#fff; font-weight:bold;">매수</button>
                <button onclick="order('sell')" style="flex:1; padding:12px; background:#f6465d; border:none; border-radius:6px; color:#fff; font-weight:bold;">매도</button>
            </div>
            <div style="text-align:center; margin-top:10px;">
                <span onclick="resetData()" style="font-size:11px; color:#666; text-decoration:underline; cursor:pointer;">데이터 초기화</span>
            </div>
        </div>

        <div class="tab-menu">
            <div class="tab-item active" onclick="switchTab('history', this)">체결 내역</div>
            <div class="tab-item" onclick="switchTab('open', this)">미체결 주문</div>
            <div class="tab-item" onclick="switchTab('pnl', this)">실현 손익</div>
        </div>

        <div style="min-height:200px; background:#121212;">
            <div class="list-header" id="list-header">
                <span class="col-1">시간</span>
                <span class="col-2">구분</span>
                <span class="col-3">가격</span>
                <span class="col-4">수량</span>
            </div>
            <div id="list-content"></div>
        </div>
    `;
}


// [3] 차트 생성 (안정성 강화)
function initChart() {
    if (!window.LightweightCharts) {
        var script = document.createElement('script');
        script.src = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";
        script.onload = initChart;
        document.head.appendChild(script);
        return;
    }

    var container = document.getElementById('chart-area');
    if(!container) return; // 에러 방지
    container.innerHTML = ''; // 초기화

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 350,
        layout: { background: { color: '#000' }, textColor: '#888' },
        grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
        timeScale: { borderColor: '#333', timeVisible: true },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, wickUpColor: '#0ecb81', wickDownColor: '#f6465d'
    });

    // 초기 데이터 로드
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json())
        .then(data => {
            var candles = data.map(d => ({
                time: d[0] / 1000, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4])
            }));
            candleSeries.setData(candles);
            currentPrice = candles[candles.length-1].close;
            updateAll();
            drawAvgLine();
        });
}


// [4] 데이터 업데이트 로직
function updateAll() {
    var state = window.appState;
    var pos = state.position;
    
    // 1. 자산 계산
    var coinVal = pos.amount * currentPrice;
    var total = state.balance + coinVal;
    
    // 2. 미실현 손익
    var pnl = 0, pnlPct = 0;
    if (pos.amount > 0) {
        pnl = (currentPrice - pos.entryPrice) * pos.amount;
        pnlPct = (pnl / (pos.entryPrice * pos.amount)) * 100;
    }

    // 3. UI 반영
    var eqEl = document.getElementById('equity-val');
    if(eqEl) eqEl.innerText = '$ ' + total.toLocaleString(undefined, {minimumFractionDigits:2});

    var pnlEl = document.getElementById('pnl-val');
    if(pnlEl) {
        pnlEl.innerText = `미실현: ${pnl>=0?'+':''}$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`;
        pnlEl.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
    }

    // 4. 리스트 갱신
    renderList();
}


// [5] 탭 전환 및 리스트 그리기
window.switchTab = function(tabName, element) {
    activeTab = tabName;
    // 탭 스타일 변경
    var tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(t => t.classList.remove('active'));
    element.classList.add('active');
    
    // 헤더 변경
    var header = document.getElementById('list-header');
    if(tabName === 'pnl') {
        header.innerHTML = '<span class="col-1">시간</span><span class="col-2">구분</span><span class="col-3">매도가</span><span class="col-4">실현손익($)</span>';
    } else {
        header.innerHTML = '<span class="col-1">시간</span><span class="col-2">구분</span><span class="col-3">가격</span><span class="col-4">수량</span>';
    }

    renderList();
};

function renderList() {
    var list = document.getElementById('list-content');
    if(!list) return;
    
    var html = '';
    var data = [];

    if (activeTab === 'history') {
        data = window.appState.tradeHistory;
        if(data.length === 0) html = '<div style="padding:20px; text-align:center; color:#555;">거래 내역이 없습니다.</div>';
        else {
            data.forEach(item => {
                html += `
                <div class="list-row">
                    <span class="col-1 text-gray">${item.time}</span>
                    <span class="col-2 ${item.type==='매수'?'text-buy':'text-sell'}">${item.type}</span>
                    <span class="col-3 text-white">$${item.price.toLocaleString()}</span>
                    <span class="col-4 text-white">${item.amount}</span>
                </div>`;
            });
        }
    } 
    else if (activeTab === 'open') {
        data = window.appState.pendingOrders;
        if(data.length === 0) html = '<div style="padding:20px; text-align:center; color:#555;">대기 중인 주문이 없습니다.</div>';
        else {
            data.forEach(item => {
                html += `
                <div class="list-row">
                    <span class="col-1 text-gray">대기</span>
                    <span class="col-2 ${item.side==='buy'?'text-buy':'text-sell'}">${item.side==='buy'?'매수':'매도'}</span>
                    <span class="col-3 text-white">$${item.price.toLocaleString()}</span>
                    <span class="col-4 text-white">${item.amount}</span>
                </div>`;
            });
        }
    }
    else if (activeTab === 'pnl') {
        data = window.appState.pnlHistory || [];
        if(data.length === 0) html = '<div style="padding:20px; text-align:center; color:#555;">실현된 수익이 없습니다.</div>';
        else {
            data.forEach(item => {
                html += `
                <div class="list-row">
                    <span class="col-1 text-gray">${item.time}</span>
                    <span class="col-2 text-sell">매도</span>
                    <span class="col-3 text-white">$${item.price.toLocaleString()}</span>
                    <span class="col-4 ${item.pnl>=0?'text-buy':'text-sell'}">
                        ${item.pnl>=0?'+':''}${item.pnl.toFixed(2)}
                    </span>
                </div>`;
            });
        }
    }

    list.innerHTML = html;
}


// [6] 주문 실행 로직 (실현손익 계산 추가)
window.order = function(side) {
    var pInput = document.getElementById('inp-price').value;
    var amtInput = parseFloat(document.getElementById('inp-amount').value);
    
    if(!amtInput) return alert("수량을 입력하세요.");

    // 지정가 주문
    if(pInput) {
        window.appState.pendingOrders.push({
            side: side, price: parseFloat(pInput), amount: amtInput, time: getTime()
        });
        saveState();
        if(activeTab === 'open') renderList();
        return alert("주문이 접수되었습니다.");
    }

    // 시장가 주문 실행
    executeTrade(side, amtInput, currentPrice);
};

function executeTrade(side, amount, price) {
    var state = window.appState;
    
    if (side === 'buy') {
        var cost = amount * price;
        if(state.balance < cost) return alert("잔고 부족!");
        state.balance -= cost;
        // 평단가 갱신
        state.position.entryPrice = ((state.position.amount * state.position.entryPrice) + cost) / (state.position.amount + amount);
        state.position.amount += amount;
    } 
    else {
        if(state.position.amount < amount) return alert("코인 부족!");
        var revenue = amount * price;
        state.balance += revenue;
        
        // ★ 실현 손익 기록 (핵심)
        var profit = (price - state.position.entryPrice) * amount;
        if(!state.pnlHistory) state.pnlHistory = [];
        state.pnlHistory.unshift({
            time: getTime(), price: price, amount: amount, pnl: profit
        });

        state.position.amount -= amount;
        if(state.position.amount <= 0) state.position.entryPrice = 0;
    }

    // 체결 내역 기록
    state.tradeHistory.unshift({
        time: getTime(), type: side==='buy'?'매수':'매도', price: price, amount: amount
    });

    saveState();
    updateAll();
    drawAvgLine();
    alert("체결되었습니다!");
}

// [7] 유틸리티
function getTime() {
    var d = new Date();
    return d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
}

function connectBinance() {
    if(ws) ws.close();
    ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");
    ws.onmessage = function(e) {
        var k = JSON.parse(e.data).k;
        currentPrice = parseFloat(k.c);
        if(candleSeries) candleSeries.update({ time: k.t/1000, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: currentPrice });
        updateAll();
        checkPending();
    };
}

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

function drawAvgLine() {
    if(!candleSeries) return;
    if(myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    if(window.appState.position.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: window.appState.position.entryPrice, color: '#F0B90B', lineWidth: 2, title: '평단가'
        });
    }
}

window.resetData = function() {
    if(confirm("초기화 하시겠습니까?")) {
        localStorage.removeItem('neuralNodeData');
        location.reload();
    }
};
