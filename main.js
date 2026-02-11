// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    createChartContainer(); // 차트 박스
    loadChartLibrary();     // 차트 라이브러리 로드
    
    // UI 초기화 (주문창 + 내역창)
    if(typeof fixLayoutAndShowOrderUI === 'function') fixLayoutAndShowOrderUI();
    else createOrderUI();
    
    updateHistoryUI(); // 초기 내역 그리기
});

// 전역 변수
var ws = null;
var chart = null;
var candleSeries = null;
var currentPrice = 0;
var myPriceLine = null;

// 데이터 저장소 (시드머니 10만불 시작)
if (!window.appState) window.appState = { 
    balance: 100000, 
    pendingOrders: [], 
    tradeHistory: [], // 체결 내역 저장소
    position: { amount: 0, entryPrice: 0 } 
};

// ==========================================
// 1. 차트 & 데이터 설정
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
        grid: { vertLines: { color: 'rgba(255, 255, 255, 0.1)' }, horzLines: { color: 'rgba(255, 255, 255, 0.1)' } },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#444' },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d',
        borderDownColor: '#f6465d', borderUpColor: '#0ecb81',
        wickDownColor: '#f6465d', wickUpColor: '#0ecb81',
    });

    // 과거 데이터 가져오기
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
            updateDashboard(currentPrice); // 화면 갱신
            connectBinance(); 
        });

    window.addEventListener('resize', () => { chart.resize(container.clientWidth, 350); });
}

// ==========================================
// 2. 실시간 연결 (가격 & 수익률 계산)
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

        if(candleSeries) candleSeries.update(pl);
        currentPrice = pl.close;
        
        // ★ 실시간 수익률 계산 및 화면 갱신
        updateDashboard(currentPrice);
        checkOrders(currentPrice);
    };
}

// ★ 대시보드 업데이트 (가격, 잔고, PnL 표시)
function updateDashboard(price) {
    // 1. 현재가 표시
    var elPrice = document.getElementById('price-display');
    if (elPrice) {
        elPrice.innerText = '$ ' + price.toLocaleString(undefined, {minimumFractionDigits:2});
        elPrice.style.color = (window.lastP && price > window.lastP) ? '#0ecb81' : '#f6465d';
    }
    window.lastP = price;

    // 2. 실시간 수익률(PnL) 계산
    var pos = window.appState.position;
    var pnl = 0;
    var pnlPercent = 0;

    if (pos.amount > 0) {
        // (현재가 - 평단가) * 수량
        pnl = (price - pos.entryPrice) * pos.amount;
        // 수익률 = (현재가 - 평단가) / 평단가 * 100
        pnlPercent = ((price - pos.entryPrice) / pos.entryPrice) * 100;
    }

    // 3. UI에 반영
    var elPnlVal = document.getElementById('pnl-val');
    var elPnlPct = document.getElementById('pnl-pct');
    var elBal = document.getElementById('balance-val');

    if (elPnlVal) {
        elPnlVal.innerText = `$ ${pnl.toFixed(2)}`;
        elPnlVal.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
    }
    if (elPnlPct) {
        elPnlPct.innerText = `(${pnlPercent.toFixed(2)}%)`;
        elPnlPct.style.color = pnl >= 0 ? '#0ecb81' : '#f6465d';
    }
    if (elBal) {
        // 총 자산 = 현금 + 평가금액(코인가치)
        var totalAsset = window.appState.balance + (pos.amount * price);
        elBal.innerText = `$ ${totalAsset.toLocaleString(undefined, {maximumFractionDigits:0})}`;
    }
}


// ==========================================
// 3. 주문창 & 내역창 UI (디자인 업그레이드)
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
        <div style="background: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 15px; margin: 10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">
                <div>
                    <div style="color:#888; font-size:12px;">총 자산 (Equity)</div>
                    <div id="balance-val" style="color:#fff; font-weight:bold; font-size:16px;">$ ${window.appState.balance.toLocaleString()}</div>
                </div>
                <div style="text-align:right;">
                    <div style="color:#888; font-size:12px;">미실현 손익 (PnL)</div>
                    <div>
                        <span id="pnl-val" style="color:#fff; font-weight:bold;">$ 0.00</span>
                        <span id="pnl-pct" style="font-size:12px; color:#fff;">(0.00%)</span>
                    </div>
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;">
                    <label style="font-size:11px; color:#aaa;">가격 (시장가는 빈칸)</label>
                    <input type="number" id="inp-price" placeholder="Market Price" style="width:90%; padding:10px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:6px;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; color:#aaa;">수량</label>
                    <input type="number" id="inp-amount" placeholder="0.1" style="width:90%; padding:10px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:6px;">
                </div>
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="order('buy')" style="flex:1; padding:12px; background:#0ecb81; border:none; border-radius:6px; color:#fff; font-weight:bold;">매수 (Long)</button>
                <button onclick="order('sell')" style="flex:1; padding:12px; background:#f6465d; border:none; border-radius:6px; color:#fff; font-weight:bold;">매도 (Short)</button>
            </div>
        </div>

        <div style="margin: 0 10px;">
            <div style="color:#888; font-size:12px; margin-bottom:5px;">📋 체결 내역 (History)</div>
            <div id="history-list" style="max-height: 200px; overflow-y:auto; background:#111; border-radius:6px; padding:5px;"></div>
        </div>
        
        <div id="order-list-area" style="margin: 20px 10px;"></div>
    `;
}

// ==========================================
// 4. 주문 & 체결 로직 (기록 저장 기능 추가)
// ==========================================
window.order = function(side) {
    var pVal = document.getElementById('inp-price').value;
    var amount = parseFloat(document.getElementById('inp-amount').value);

    if (!amount) return alert("수량을 입력해주세요.");
    
    if (!pVal || pVal === "") {
        executeTrade(side, amount, currentPrice); // 시장가 즉시 체결
    } else {
        window.appState.pendingOrders.push({
            id: Date.now(), side: side, price: parseFloat(pVal), amount: amount, time: new Date().toLocaleTimeString()
        });
        alert("✅ 주문 등록 완료");
        updatePendingUI();
    }
};

function executeTrade(side, amount, price) {
    var pos = window.appState.position;
    
    if(side === 'buy') {
        // 매수: 현금 차감 -> 코인 증가 (평단가 계산)
        var cost = amount * price;
        if(window.appState.balance < cost) return alert("잔고가 부족합니다!");
        
        window.appState.balance -= cost; // 현금 사용
        
        // 새 평단가 계산
        var newEntry = ((pos.amount * pos.entryPrice) + (amount * price)) / (pos.amount + amount);
        pos.amount += amount;
        pos.entryPrice = newEntry;

        addHistory("매수 (Buy)", price, amount, cost, "text-green");
    } else {
        // 매도: 코인 감소 -> 현금 증가 (수익 실현)
        if(pos.amount < amount) return alert("코인이 부족합니다!");
        
        var income = amount * price; // 판 금액
        var profit = (price - pos.entryPrice) * amount; // 순수익
        
        window.appState.balance += income; // 현금 입금
        pos.amount -= amount;
        if(pos.amount <= 0) pos.entryPrice = 0;

        addHistory("매도 (Sell)", price, amount, profit, "text-red");
    }
    
    // 차트에 평단가 선 업데이트
    updateMyPriceLine();
    // 화면 갱신
    updateDashboard(currentPrice);
}

// ★ 체결 내역 기록 함수
function addHistory(type, price, amount, value, colorClass) {
    var time = new Date().toLocaleTimeString();
    var log = { time: time, type: type, price: price, amount: amount, value: value, color: colorClass };
    
    // 배열 앞에 추가 (최신순)
    window.appState.tradeHistory.unshift(log);
    updateHistoryUI();
}

function updateHistoryUI() {
    var list = document.getElementById('history-list');
    if (!list) return;

    if (window.appState.tradeHistory.length === 0) {
        list.innerHTML = '<div style="padding:10px; text-align:center; color:#444; font-size:12px;">거래 내역이 없습니다.</div>';
        return;
    }

    var html = '';
    window.appState.tradeHistory.forEach(h => {
        var color = h.type.includes('매수') ? '#0ecb81' : '#f6465d';
        var valPrefix = h.type.includes('매수') ? '-' : '+'; // 매수는 돈 나감, 매도는 돈 들어옴
        
        // 매도일 때는 수익금 표시, 매수일 때는 총비용 표시
        var valDisplay = h.type.includes('매수') ? h.value : (h.value - 0); 
        
        html += `
        <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #222; font-size:12px;">
            <span style="color:#888;">${h.time}</span>
            <span style="color:${color}; font-weight:bold;">${h.type}</span>
            <span style="color:#fff;">$ ${h.price.toLocaleString()}</span>
            <span style="color:#fff;">${h.amount}개</span>
        </div>`;
    });
    list.innerHTML = html;
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
            updatePendingUI();
        }
    }
}

function updatePendingUI() {
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
