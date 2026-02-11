// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    loadData();             // 1. 저장된 데이터(시드머니, 내역) 불러오기
    createChartContainer(); // 2. 차트 박스 생성
    loadChartLibrary();     // 3. 차트 라이브러리 및 데이터 실행
    createOrderUI();        // 4. UI 그리기
    updateDashboard(currentPrice); // 5. 대시보드 초기화
    updateHistoryUI();      // 6. 내역 초기화
});

// 전역 변수
var ws = null;
var chart = null;
var candleSeries = null;
var currentPrice = 0;
var myPriceLine = null;

// ==========================================
// 1. 데이터 저장 및 불러오기 (영구 보존 핵심)
// ==========================================
function saveData() {
    localStorage.setItem('tradingAppState', JSON.stringify(window.appState));
}

function loadData() {
    var saved = localStorage.getItem('tradingAppState');
    if (saved) {
        window.appState = JSON.parse(saved);
    } else {
        // 데이터가 없으면 초기값 설정
        window.appState = { 
            balance: 100000, 
            pendingOrders: [], 
            tradeHistory: [], 
            position: { amount: 0, entryPrice: 0 } 
        };
    }
}

// ==========================================
// 2. 차트 설정 및 과거 데이터
// ==========================================
function createChartContainer() {
    var container = document.getElementById('chart-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'chart-container';
        container.style.width = '100%';
        container.style.height = '350px';
        container.style.backgroundColor = '#1e1e1e';
        container.style.marginBottom = '10px';
        container.style.position = 'relative';
        container.innerHTML = '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#888;">📊 차트 로딩 중...</div>';
        
        var header = document.querySelector('.header') || document.body.firstChild;
        if(header && header.parentNode) header.parentNode.insertBefore(container, header.nextSibling);
        else document.body.prepend(container);
    }
}

function loadChartLibrary() {
    if (window.LightweightCharts) { initChart(); return; }
    var script = document.createElement('script');
    script.src = "https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js";
    script.onload = function() { initChart(); };
    document.head.appendChild(script);
}

function initChart() {
    var container = document.getElementById('chart-container');
    container.innerHTML = ''; 

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 350,
        layout: { background: { type: 'solid', color: '#1e1e1e' }, textColor: '#d1d4dc' },
        grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#444' },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d',
        borderDownColor: '#f6465d', borderUpColor: '#0ecb81',
        wickDownColor: '#f6465d', wickUpColor: '#0ecb81',
    });

    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
        .then(res => res.json())
        .then(data => {
            var candles = data.map(d => ({
                time: d[0] / 1000,
                open: parseFloat(d[1]), high: parseFloat(d[2]),
                low: parseFloat(d[3]), close: parseFloat(d[4])
            }));
            candleSeries.setData(candles);
            currentPrice = candles[candles.length - 1].close;
            
            updateDashboard(currentPrice);
            updateMyPriceLine(); // ★ 로딩 시 평단가 선 그리기
            connectBinance(); 
        });

    window.addEventListener('resize', () => { chart.resize(container.clientWidth, 350); });
}

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

        if(candleSeries) candleSeries.update(pl);
        currentPrice = pl.close;
        updateDashboard(currentPrice);
        checkOrders(currentPrice);
    };
}

// ==========================================
// 3. 실시간 대시보드 (수익률 & 시드머니 +- 표시)
// ==========================================
function updateDashboard(price) {
    if(!price) return;
    
    // 1. 현재가 표시
    var elPrice = document.getElementById('price-display');
    if (elPrice) {
        elPrice.innerText = '$ ' + price.toLocaleString(undefined, {minimumFractionDigits:2});
        elPrice.style.color = (window.lastP && price > window.lastP) ? '#0ecb81' : '#f6465d';
    }
    window.lastP = price;

    var pos = window.appState.position;
    var pnl = 0;
    var pnlPercent = 0;

    // 실시간 미실현 손익 계산
    if (pos.amount > 0) {
        pnl = (price - pos.entryPrice) * pos.amount;
        pnlPercent = ((price - pos.entryPrice) / pos.entryPrice) * 100;
    }

    // UI 반영
    var elPnlVal = document.getElementById('pnl-val');
    var elPnlPct = document.getElementById('pnl-pct');
    var elBal = document.getElementById('balance-val');

    if (elPnlVal) {
        elPnlVal.innerText = (pnl >= 0 ? '+' : '') + `$ ${pnl.toFixed(2)}`;
        elPnlVal.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
    }
    if (elPnlPct) {
        elPnlPct.innerText = `(${pnlPercent.toFixed(2)}%)`;
        elPnlPct.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
    }
    if (elBal) {
        // 총 자산 = 남은 현금 + (보유 코인 수량 * 현재가)
        var totalAsset = window.appState.balance + (pos.amount * price);
        elBal.innerText = `$ ${totalAsset.toLocaleString(undefined, {maximumFractionDigits:2})}`;
    }
}

// ==========================================
// 4. 주문창 & 체결 내역 UI
// ==========================================
function createOrderUI() {
    var target = document.querySelector('.control-box') || document.body;
    target.innerHTML = `
        <div style="background: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 15px; margin: 10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">
                <div>
                    <div style="color:#888; font-size:12px;">총 자산 (Equity)</div>
                    <div id="balance-val" style="color:#fff; font-weight:bold; font-size:18px;">$ 0</div>
                </div>
                <div style="text-align:right;">
                    <div style="color:#888; font-size:12px;">미실현 손익 (PnL)</div>
                    <div>
                        <span id="pnl-val" style="color:#fff; font-weight:bold;">$ 0.00</span>
                        <span id="pnl-pct" style="font-size:12px;">(0.00%)</span>
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;"><input type="number" id="inp-price" placeholder="시장가(빈칸)" style="width:90%; padding:10px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:6px;"></div>
                <div style="flex:1;"><input type="number" id="inp-amount" placeholder="수량(BTC)" style="width:90%; padding:10px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:6px;"></div>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="order('buy')" style="flex:1; padding:12px; background:#0ecb81; border:none; border-radius:6px; color:#fff; font-weight:bold;">매수</button>
                <button onclick="order('sell')" style="flex:1; padding:12px; background:#f6465d; border:none; border-radius:6px; color:#fff; font-weight:bold;">매도</button>
            </div>
            <button onclick="resetApp()" style="width:100%; margin-top:10px; background:transparent; border:none; color:#555; font-size:11px; text-decoration:underline;">데이터 초기화 (리셋)</button>
        </div>
        <div style="margin: 0 10px;">
            <div style="color:#888; font-size:12px; margin-bottom:5px;">📋 체결 내역</div>
            <div id="history-list" style="max-height: 180px; overflow-y:auto; background:#111; border-radius:6px; padding:5px;"></div>
        </div>
        <div id="order-list-area" style="margin: 20px 10px;"></div>
    `;
}

// ==========================================
// 5. 핵심 매매 로직
// ==========================================
window.order = function(side) {
    var pVal = document.getElementById('inp-price').value;
    var amount = parseFloat(document.getElementById('inp-amount').value);
    if (!amount) return alert("수량을 입력하세요.");
    
    if (!pVal) {
        executeTrade(side, amount, currentPrice); // 시장가 체결
    } else {
        window.appState.pendingOrders.push({
            id: Date.now(), side: side, price: parseFloat(pVal), amount: amount
        });
        saveData(); // 데이터 저장
        updatePendingUI();
    }
};

function executeTrade(side, amount, price) {
    var pos = window.appState.position;
    if(side === 'buy') {
        var cost = amount * price;
        if(window.appState.balance < cost) return alert("잔고 부족!");
        window.appState.balance -= cost;
        var newEntry = ((pos.amount * pos.entryPrice) + (amount * price)) / (pos.amount + amount);
        pos.amount += amount;
        pos.entryPrice = newEntry;
        addHistory("매수", price, amount, cost);
    } else {
        if(pos.amount < amount) return alert("코인 부족!");
        var income = amount * price;
        window.appState.balance += income;
        pos.amount -= amount;
        if(pos.amount <= 0) pos.entryPrice = 0;
        addHistory("매도", price, amount, income);
    }
    saveData();         // ★ 변경사항 저장
    updateMyPriceLine(); // ★ 평단가 선 갱신
    updateDashboard(currentPrice);
}

function addHistory(type, price, amount, val) {
    window.appState.tradeHistory.unshift({
        time: new Date().toLocaleTimeString(), type: type, price: price, amount: amount
    });
    updateHistoryUI();
}

function updateHistoryUI() {
    var list = document.getElementById('history-list');
    if (!list) return;
    var html = '';
    window.appState.tradeHistory.forEach(h => {
        var color = h.type === '매수' ? '#0ecb81' : '#f6465d';
        html += `<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #222; font-size:12px;">
            <span style="color:#666;">${h.time}</span>
            <span style="color:${color}; font-weight:bold;">${h.type}</span>
            <span style="color:#fff;">$${h.price.toLocaleString()}</span>
            <span style="color:#ccc;">${h.amount} BTC</span>
        </div>`;
    });
    list.innerHTML = html || '<div style="color:#444; text-align:center; padding:10px;">내역 없음</div>';
}

function updateMyPriceLine() {
    if (!candleSeries) return;
    if (myPriceLine) { candleSeries.removePriceLine(myPriceLine); myPriceLine = null; }
    var pos = window.appState.position;
    if (pos && pos.amount > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: pos.entryPrice, color: '#F0B90B', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: '평단가'
        });
    }
}

function checkOrders(nowPrice) {
    var orders = window.appState.pendingOrders;
    for (var i = orders.length - 1; i >= 0; i--) {
        var o = orders[i];
        if ((o.side === 'buy' && nowPrice <= o.price) || (o.side === 'sell' && nowPrice >= o.price)) {
            orders.splice(i, 1);
            executeTrade(o.side, o.amount, o.price); 
            updatePendingUI();
        }
    }
}

function updatePendingUI() {
    var area = document.getElementById('order-list-area');
    if (!area) return;
    var html = '<div style="font-size:12px; color:#888; margin-bottom:5px;">📋 미체결 주문</div>';
    window.appState.pendingOrders.forEach(o => {
        html += `<div style="padding:10px; background:#222; border-radius:4px; margin-bottom:5px; font-size:13px; color:#fff;">
            ${o.side === 'buy' ? '매수' : '매도'} | $${o.price} | ${o.amount} BTC
        </div>`;
    });
    area.innerHTML = html;
}

window.resetApp = function() {
    if(confirm("모든 거래 기록과 시드머니를 초기화할까요?")) {
        localStorage.removeItem('tradingAppState');
        location.reload();
    }
};
