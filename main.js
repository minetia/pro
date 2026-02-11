// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    createChartContainer(); // 박스 만들기
    loadChartLibrary();     // 라이브러리 로드 -> 차트 생성 -> 데이터 수신 순으로 실행
    
    // UI 초기화
    if(typeof fixLayoutAndShowOrderUI === 'function') fixLayoutAndShowOrderUI();
    else createOrderUI();
    
    if(typeof updateOrderList === 'function') updateOrderList();
});

// 전역 변수
var ws = null;
var chart = null;
var candleSeries = null;
var currentPrice = 0;
var myPriceLine = null;

// 데이터 저장소
if (!window.appState) window.appState = { 
    balance: 100000, 
    pendingOrders: [], 
    position: { amount: 0, entryPrice: 0, side: 'none' } 
};

// ==========================================
// 1. 차트 UI 준비
// ==========================================
function createChartContainer() {
    var container = document.getElementById('chart-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'chart-container';
        container.style.width = '100%';
        container.style.height = '350px';
        container.style.backgroundColor = '#1e1e1e';
        container.style.marginBottom = '20px';
        container.style.position = 'relative';
        
        // 로딩 메시지
        container.innerHTML = '<div id="chart-loader" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#888;">📊 차트 데이터 불러오는 중...</div>';

        var header = document.querySelector('.header') || document.body.firstChild;
        if(header && header.parentNode) header.parentNode.insertBefore(container, header.nextSibling);
        else document.body.prepend(container);
    }
}

// ==========================================
// 2. 라이브러리 로드
// ==========================================
function loadChartLibrary() {
    if (window.LightweightCharts) {
        initChart();
        return;
    }
    var script = document.createElement('script');
    script.src = "https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js";
    script.onload = function() { initChart(); };
    document.head.appendChild(script);
}

// ==========================================
// 3. 차트 생성 및 과거 데이터 가져오기 (핵심!)
// ==========================================
function initChart() {
    var container = document.getElementById('chart-container');
    container.innerHTML = ''; // 로딩 문구 삭제

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 350,
        layout: { background: { type: 'solid', color: '#1e1e1e' }, textColor: '#d1d4dc' },
        grid: { vertLines: { color: 'rgba(255, 255, 255, 0.1)' }, horzLines: { color: 'rgba(255, 255, 255, 0.1)' } },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#444' },
        rightPriceScale: { borderColor: '#444' },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d',
        borderDownColor: '#f6465d', borderUpColor: '#0ecb81',
        wickDownColor: '#f6465d', wickUpColor: '#0ecb81',
    });

    // ★ 1. 과거 데이터 먼저 가져오기 (REST API)
    fetchHistoricalData();

    // 반응형 리사이즈
    window.addEventListener('resize', () => { chart.resize(container.clientWidth, 350); });
}

function fetchHistoricalData() {
    // 바이낸스 API로 최근 100개 캔들 가져오기
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json())
        .then(data => {
            var candles = data.map(d => ({
                time: d[0] / 1000,
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4])
            }));
            
            // 차트에 과거 데이터 채우기
            candleSeries.setData(candles);
            
            // 마지막 가격 업데이트
            currentPrice = candles[candles.length - 1].close;
            updatePriceDisplay(currentPrice);

            // ★ 2. 이제부터 실시간 연결 (WebSocket)
            connectBinance(); 
        })
        .catch(err => console.error("데이터 로딩 실패:", err));
}

// ==========================================
// 4. 실시간 연결 (WebSocket)
// ==========================================
function connectBinance() {
    if (ws) ws.close();
    ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");

    ws.onmessage = function(event) {
        var msg = JSON.parse(event.data);
        var kline = msg.k;
        var pl = {
            time: kline.t / 1000,
            open: parseFloat(kline.o), high: parseFloat(kline.h),
            low: parseFloat(kline.l), close: parseFloat(kline.c)
        };

        // 실시간 업데이트
        if(candleSeries) candleSeries.update(pl);
        currentPrice = pl.close;
        
        updatePriceDisplay(currentPrice);
        checkOrders(currentPrice);
    };
}

function updatePriceDisplay(price) {
    var el = document.getElementById('price-display') || document.querySelector('.hero-number') || document.querySelector('h1');
    if (el) {
        el.innerText = '$ ' + price.toLocaleString(undefined, {minimumFractionDigits:2});
        el.style.color = (window.lastP && price > window.lastP) ? '#0ecb81' : '#f6465d';
    }
    window.lastP = price;
}

// ==========================================
// 5. 주문창 UI (어두운 테마)
// ==========================================
function createOrderUI() {
    var target = document.querySelector('.control-box') || document.querySelector('.card');
    if (!target) { 
        target = document.createElement('div');
        var chartBox = document.getElementById('chart-container');
        if(chartBox) chartBox.parentNode.insertBefore(target, chartBox.nextSibling);
        else document.body.appendChild(target);
    }
    
    target.innerHTML = `
        <div style="background: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 15px; margin: 20px 10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">
                <span style="color:#F0B90B; font-weight:bold;">⚡ 트레이딩 패널</span>
                <span style="color:#888; font-size:12px;">잔고: $ ${window.appState.balance.toLocaleString()}</span>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;">
                    <label style="font-size:11px; color:#aaa;">가격 (시장가는 빈칸)</label>
                    <input type="number" id="inp-price" placeholder="Market" style="width:90%; padding:10px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:6px;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; color:#aaa;">수량</label>
                    <input type="number" id="inp-amount" placeholder="0.1" style="width:90%; padding:10px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:6px;">
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="order('buy')" style="flex:1; padding:12px; background:#0ecb81; border:none; border-radius:6px; color:#fff; font-weight:bold;">매수</button>
                <button onclick="order('sell')" style="flex:1; padding:12px; background:#f6465d; border:none; border-radius:6px; color:#fff; font-weight:bold;">매도</button>
            </div>
        </div>
        <div id="order-list-area" style="margin: 0 10px;"></div>
    `;
}

// ==========================================
// 6. 매매 로직
// ==========================================
window.order = function(side) {
    var pVal = document.getElementById('inp-price').value;
    var aVal = document.getElementById('inp-amount').value;
    var amount = parseFloat(aVal);

    if (!amount) return alert("수량을 입력해주세요.");
    
    if (!pVal || pVal === "") {
        executeTrade(side, amount, currentPrice); 
    } else {
        window.appState.pendingOrders.push({
            id: Date.now(), side: side, price: parseFloat(pVal), amount: amount, time: new Date().toLocaleTimeString()
        });
        alert("✅ 지정가 주문 등록!");
        updateOrderList();
    }
};

function executeTrade(side, amount, price) {
    if(side === 'buy') {
        var oldAmt = window.appState.position.amount;
        var oldEntry = window.appState.position.entryPrice;
        var newEntry = ((oldAmt * oldEntry) + (amount * price)) / (oldAmt + amount);
        window.appState.position.amount += amount;
        window.appState.position.entryPrice = newEntry;
        window.appState.position.side = 'long';
        alert(`💎 체결 완료! 평단: $${newEntry.toFixed(2)}`);
    } else {
        if(window.appState.position.amount < amount) return alert("코인 부족");
        window.appState.position.amount -= amount;
        alert(`💰 판매 완료!`);
    }
    updateMyPriceLine();
}

function checkOrders(nowPrice) {
    var orders = window.appState.pendingOrders;
    for (var i = orders.length - 1; i >= 0; i--) {
        var o = orders[i];
        var executed = false;
        if (o.side === 'buy' && nowPrice <= o.price) executed = true;
        if (o.side === 'sell' && nowPrice >= o.price) executed = true;
        if (executed) {
            orders.splice(i, 1);
            executeTrade(o.side, o.amount, o.price); 
            updateOrderList();
        }
    }
}

function updateOrderList() {
    var area = document.getElementById('order-list-area');
    if (!area) return;
    var html = '<div style="font-size:12px; color:#888; margin-bottom:5px;">📋 미체결 주문</div>';
    if (window.appState.pendingOrders.length === 0) html += '<div style="padding:10px; background:#222; color:#555; border-radius:6px; font-size:12px; text-align:center;">없음</div>';
    else {
        window.appState.pendingOrders.forEach(o => {
            var color = o.side === 'buy' ? '#0ecb81' : '#f6465d';
            html += `<div style="display:flex; justify-content:space-between; padding:10px; background:#222; border-left:3px solid ${color}; border-radius:4px; margin-bottom:5px; font-size:13px;">
                <span style="color:${color}; font-weight:bold;">${o.side==='buy'?'매수':'매도'}</span>
                <span>$${o.price}</span>
            </div>`;
        });
    }
    area.innerHTML = html;
}

function updateMyPriceLine() {
    if (!candleSeries) return;
    if (myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    var pos = window.appState.position;
    if (pos && pos.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: pos.entryPrice, color: '#F0B90B', lineWidth: 2, lineStyle: 2, title: '내 평단가'
        });
    }
}
