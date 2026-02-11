// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    initChart();       // 차트 생성
    connectBinance();  // 바이낸스 연결
    
    // 주문창 화면 만들기
    fixLayoutAndShowOrderUI();
    updateOrderList();
    
    // 내 평단가 선 그리기 (처음 로드시)
    updateMyPriceLine();
});

// 전역 변수
var ws = null;
var currentPrice = 0;
var chart = null;
var candleSeries = null;
var myPriceLine = null; // 내 평단가 선을 저장할 변수

// 데이터 저장소 (없으면 기본값 생성)
if (!window.appState) window.appState = { 
    balance: 100000, 
    pendingOrders: [], 
    position: { amount: 0, entryPrice: 0, side: 'none' } // 포지션 정보
};

// ==========================================
// 1. 차트 설정 (TradingView)
// ==========================================
function initChart() {
    var chartContainer = document.getElementById('chart-container');
    
    // 차트 박스가 없으면 강제로 만듦
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'chart-container';
        chartContainer.style.width = '100%';
        chartContainer.style.height = '350px';
        chartContainer.style.backgroundColor = '#1e1e1e';
        chartContainer.style.marginBottom = '20px';
        
        // 헤더 밑에 끼워넣기
        var header = document.querySelector('.header') || document.body.firstChild;
        if(header && header.parentNode) header.parentNode.insertBefore(chartContainer, header.nextSibling);
        else document.body.appendChild(chartContainer);
    }

    // 라이브러리 로드 체크
    if (!window.LightweightCharts) {
        var script = document.createElement('script');
        script.src = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";
        script.onload = function() { initChart(); };
        document.head.appendChild(script);
        return;
    }

    // 차트 생성
    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 350,
        layout: { backgroundColor: '#1e1e1e', textColor: '#d1d4dc' },
        grid: { vertLines: { color: 'rgba(42, 46, 57, 0.5)' }, horzLines: { color: 'rgba(42, 46, 57, 0.5)' } },
        priceScale: { borderColor: 'rgba(197, 203, 206, 0.8)' },
        timeScale: { borderColor: 'rgba(197, 203, 206, 0.8)', timeVisible: true, secondsVisible: false },
    });

    // 캔들 시리즈 추가
    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81', downColor: '#f6465d',
        borderDownColor: '#f6465d', borderUpColor: '#0ecb81',
        wickDownColor: '#f6465d', wickUpColor: '#0ecb81',
    });

    // 반응형 크기 조절
    window.addEventListener('resize', () => {
        chart.resize(chartContainer.clientWidth, 350);
    });
}

// ==========================================
// 2. 평단가 선 그리기 (핵심 기능!)
// ==========================================
function updateMyPriceLine() {
    if (!candleSeries) return;

    // 1. 기존 선이 있으면 지우기 (갱신을 위해)
    if (myPriceLine) {
        candleSeries.removePriceLine(myPriceLine);
        myPriceLine = null;
    }

    // 2. 포지션(가진 코인)이 있을 때만 새로 그리기
    var pos = window.appState.position;
    if (pos && pos.amount > 0 && pos.entryPrice > 0) {
        
        myPriceLine = candleSeries.createPriceLine({
            price: pos.entryPrice,
            color: '#F0B90B', // 노란색 (눈에 잘 띔)
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dotted, // 점선
            axisLabelVisible: true,
            title: '내 평단가', // 라벨 이름
        });
    }
}

// ==========================================
// 3. 바이낸스 연결
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
        var el = document.getElementById('price-display');
        if (el) {
            el.innerText = '$ ' + currentPrice.toLocaleString(undefined, {minimumFractionDigits:2});
            el.style.color = (window.lastP && currentPrice > window.lastP) ? '#0ecb81' : '#f6465d';
        }
        window.lastP = currentPrice;

        // 지정가 주문 감시
        checkOrders(currentPrice);
    };
}

// ==========================================
// 4. 주문창 UI (겹침 방지 버전)
// ==========================================
function fixLayoutAndShowOrderUI() {
    var target = document.querySelector('.control-box') || document.querySelector('.card');
    
    // 못 찾으면 강제 생성
    if (!target) {
        target = document.createElement('div');
        var chartBox = document.getElementById('chart-container');
        if(chartBox) chartBox.parentNode.insertBefore(target, chartBox.nextSibling);
        else document.body.appendChild(target);
    }

    target.style.position = 'static';
    target.style.margin = '20px 10px';
    target.style.display = 'block';

    target.innerHTML = `
        <div style="background: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">
                <span style="color:#F0B90B; font-weight:bold; font-size:15px;">⚡ 트레이딩 패널</span>
                <span style="color:#888; font-size:12px;">보유금: $ ${window.appState.balance.toLocaleString()}</span>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;">
                    <label style="font-size:11px; color:#aaa; display:block; margin-bottom:5px;">가격 (시장가는 비워두세요)</label>
                    <input type="number" id="inp-price" placeholder="시장가 (Market)" 
                        style="width:90%; padding:10px; background:#2a2a2a; border:1px solid #444; border-radius:6px; color:#fff; font-size:14px;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; color:#aaa; display:block; margin-bottom:5px;">수량</label>
                    <input type="number" id="inp-amount" placeholder="0.1" 
                        style="width:90%; padding:10px; background:#2a2a2a; border:1px solid #444; border-radius:6px; color:#fff; font-size:14px;">
                </div>
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="order('buy')" style="flex:1; padding:12px; background:#0ecb81; border:none; border-radius:6px; color:#fff; font-weight:bold;">매수 (Long)</button>
                <button onclick="order('sell')" style="flex:1; padding:12px; background:#f6465d; border:none; border-radius:6px; color:#fff; font-weight:bold;">매도 (Short)</button>
            </div>
        </div>
        <div id="order-list-area" style="margin-top:20px;"></div>
    `;
}

// ==========================================
// 5. 주문 로직 (평단가 표시 기능 추가)
// ==========================================
window.order = function(side) {
    var pVal = document.getElementById('inp-price').value;
    var aVal = document.getElementById('inp-amount').value;
    var amount = parseFloat(aVal);

    if (!amount) return alert("수량을 입력해주세요.");
    
    // 가격이 비어있으면 -> 시장가(즉시 체결)로 간주
    if (!pVal || pVal === "") {
        executeTrade(side, amount, currentPrice); // 즉시 체결
    } else {
        // 가격이 있으면 -> 지정가(예약) 주문
        var price = parseFloat(pVal);
        window.appState.pendingOrders.push({
            id: Date.now(), side: side, price: price, amount: amount, time: new Date().toLocaleTimeString()
        });
        alert("✅ 지정가 주문 등록!");
        updateOrderList();
    }
};

// 실제 체결 함수 (시장가 or 지정가 도달 시)
function executeTrade(side, amount, price) {
    if(side === 'buy') {
        // 매수: 평단가 계산 (물타기)
        var oldAmt = window.appState.position.amount;
        var oldEntry = window.appState.position.entryPrice;
        
        // 새 평단가 = (기존금액 + 새금액) / 전체수량
        var newEntry = ((oldAmt * oldEntry) + (amount * price)) / (oldAmt + amount);
        
        window.appState.position.amount += amount;
        window.appState.position.entryPrice = newEntry;
        window.appState.position.side = 'long';

        alert(`💎 매수 체결!\n${amount}개 @ $${price}\n(새 평단가: $${newEntry.toFixed(2)})`);
    } else {
        // 매도: 수량 감소
        if(window.appState.position.amount < amount) return alert("보유 코인이 부족합니다.");
        window.appState.position.amount -= amount;
        if(window.appState.position.amount <= 0) {
            window.appState.position.entryPrice = 0; // 다 팔면 평단가 초기화
        }
        alert(`💰 매도 체결!\n${amount}개 @ $${price}`);
    }

    // ★ 중요: 체결되었으니 차트에 평단가 선 다시 그리기
    updateMyPriceLine();
}

// 지정가 감시
function checkOrders(nowPrice) {
    var orders = window.appState.pendingOrders;
    for (var i = orders.length - 1; i >= 0; i--) {
        var o = orders[i];
        var executed = false;
        if (o.side === 'buy' && nowPrice <= o.price) executed = true;
        if (o.side === 'sell' && nowPrice >= o.price) executed = true;

        if (executed) {
            orders.splice(i, 1);
            executeTrade(o.side, o.amount, o.price); // 체결 실행
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
                <span style="color:#fff;">$${o.price}</span>
                <span style="color:#ccc;">${o.amount}개</span>
            </div>`;
        });
    }
    area.innerHTML = html;
}
