// [초기화] 페이지가 열리면 실행
window.addEventListener('load', function() {
    // 1. 차트 박스 먼저 만들기 (검은색 배경 강제 적용)
    createChartContainer();
    
    // 2. 차트 프로그램(라이브러리) 다운로드 및 실행
    loadChartLibrary();

    // 3. 주문창(UI) 표시
    if(typeof fixLayoutAndShowOrderUI === 'function') fixLayoutAndShowOrderUI();
    else createOrderUI(); // 주문창 만드는 함수가 없으면 비상용 실행
    
    // 4. 미체결 내역 표시
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
// 1. 차트 박스 만들기 (무조건 검은색!)
// ==========================================
function createChartContainer() {
    var container = document.getElementById('chart-container');
    
    // 박스가 없으면 새로 만듭니다.
    if (!container) {
        container = document.createElement('div');
        container.id = 'chart-container';
        // 스타일 강제 적용
        container.style.width = '100%';
        container.style.height = '350px';
        container.style.backgroundColor = '#1e1e1e'; // 검은색 배경
        container.style.borderBottom = '1px solid #333';
        container.style.marginBottom = '20px';
        container.style.position = 'relative'; // 로딩 문구 위치 잡기 위해
        
        // "차트 로딩 중..." 문구 추가
        container.innerHTML = '<div id="chart-loader" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#888; font-size:14px;">📊 차트 불러오는 중...</div>';

        // 헤더 밑에 붙이기
        var header = document.querySelector('.header') || document.body.firstChild;
        if(header && header.parentNode) {
            header.parentNode.insertBefore(container, header.nextSibling);
        } else {
            document.body.prepend(container);
        }
    }
}

// ==========================================
// 2. 라이브러리 로드 (안전하게 가져오기)
// ==========================================
function loadChartLibrary() {
    // 이미 있으면 바로 실행
    if (window.LightweightCharts) {
        initChart();
        return;
    }

    // 없으면 다운로드 (버전 4.0 고정)
    var script = document.createElement('script');
    script.src = "https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js";
    script.onload = function() {
        console.log("라이브러리 로드 완료!");
        initChart(); // 다 받으면 차트 그리기 시작
    };
    script.onerror = function() {
        document.getElementById('chart-container').innerHTML = '<div style="padding:20px; color:red; text-align:center;">⚠️ 차트 로딩 실패<br>인터넷 연결을 확인하세요.</div>';
    };
    document.head.appendChild(script);
}

// ==========================================
// 3. 진짜 차트 그리기
// ==========================================
function initChart() {
    var container = document.getElementById('chart-container');
    // 로딩 문구 지우기
    container.innerHTML = ''; 

    // 차트 생성
    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 350,
        layout: {
            background: { type: 'solid', color: '#1e1e1e' }, // 검은색 배경
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: 'rgba(197, 203, 206, 0.8)',
        },
    });

    // 캔들 설정
    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d',
        borderDownColor: '#f6465d', borderUpColor: '#0ecb81',
        wickDownColor: '#f6465d', wickUpColor: '#0ecb81',
    });

    // 바이낸스 데이터 연결
    connectBinance();

    // 반응형 크기 조절
    window.addEventListener('resize', () => {
        chart.resize(container.clientWidth, 350);
    });
    
    // 내 평단가 선 그리기 시도
    updateMyPriceLine();
}

// ==========================================
// 4. 바이낸스 실시간 데이터
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

        if (candleSeries) candleSeries.update(pl);
        currentPrice = pl.close;
        
        // 가격 표시 업데이트
        updatePriceDisplay(currentPrice);

        // 지정가 주문 감시
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
// 5. 주문창 UI (비상용 포함)
// ==========================================
function createOrderUI() {
    var target = document.querySelector('.control-box') || document.querySelector('.card');
    if (!target) { // 없으면 만들기
        target = document.createElement('div');
        target.className = 'control-box';
        var chartBox = document.getElementById('chart-container');
        if(chartBox) chartBox.parentNode.insertBefore(target, chartBox.nextSibling);
        else document.body.appendChild(target);
    }
    
    // UI 내용 (어두운 테마)
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
// 6. 주문 로직 (평단가 선 포함)
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
