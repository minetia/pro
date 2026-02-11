// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    initChart();       // 차트 생성
    connectBinance();  // 바이낸스 연결
    
    // 주문창 화면 만들기
    fixLayoutAndShowOrderUI();
    updateOrderList();
    
    // 내 평단가 선 그리기 (처음 로드시)
    setTimeout(updateMyPriceLine, 1000); // 데이터 로딩 시간 고려
});

// 전역 변수
var ws = null;
var currentPrice = 0;
var chart = null;
var candleSeries = null;
var myPriceLine = null; 

// 데이터 저장소
if (!window.appState) window.appState = { 
    balance: 100000, 
    pendingOrders: [], 
    position: { amount: 0, entryPrice: 0, side: 'none' } 
};

// ==========================================
// 1. 차트 설정 (다크모드 적용!)
// ==========================================
function initChart() {
    var chartContainer = document.getElementById('chart-container');
    
    // 차트 박스 없으면 생성
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'chart-container';
        chartContainer.style.width = '100%';
        chartContainer.style.height = '350px';
        chartContainer.style.backgroundColor = '#1e1e1e'; // 박스 자체도 검게
        chartContainer.style.marginBottom = '20px';
        
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

    // ★ 차트 생성 (여기가 중요: 배경색 지정)
    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 350,
        layout: {
            background: { type: 'solid', color: '#1e1e1e' }, // ★ 배경을 어두운 색으로!
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.1)' }, // 그리드 선도 연하게
            horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
        },
        priceScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
        },
        timeScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
            timeVisible: true,
            secondsVisible: false,
        },
    });

    // 캔들 시리즈 추가
    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81',        // 양봉 (초록)
        downColor: '#f6465d',      // 음봉 (빨강)
        borderDownColor: '#f6465d',
        borderUpColor: '#0ecb81',
        wickDownColor: '#f6465d',
        wickUpColor: '#0ecb81',
    });

    // 반응형 크기 조절
    window.addEventListener('resize', () => {
        chart.resize(chartContainer.clientWidth, 350);
    });
}

// ==========================================
// 2. 평단가 선 그리기
// ==========================================
function updateMyPriceLine() {
    if (!candleSeries) return;

    if (myPriceLine) {
        candleSeries.removePriceLine(myPriceLine);
        myPriceLine = null;
    }

    var pos = window.appState.position;
    if (pos && pos.amount > 0 && pos.entryPrice > 0) {
        myPriceLine = candleSeries.createPriceLine({
            price: pos.entryPrice,
            color: '#F0B90B', 
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dotted,
            axisLabelVisible: true,
            title: '내 평단가',
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

        checkOrders(currentPrice);
    };
}

// ==========================================
// 4. 주문창 UI (어두운 테마 유지)
// ==========================================
function fixLayoutAndShowOrderUI() {
    var target = document.querySelector('.control-box') || document.querySelector('.card');
    
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
// 5. 주문 로직
// ==========================================
window.order = function(side) {
    var pVal = document.getElementById('inp-price').value;
    var aVal = document.getElementById('inp-amount').value;
    var amount = parseFloat(aVal);

    if (!amount) return alert("수량을 입력해주세요.");
    
    if (!pVal || pVal === "") {
        executeTrade(side, amount, currentPrice); 
    } else {
        var price = parseFloat(pVal);
        window.appState.pendingOrders.push({
            id: Date.now(), side: side, price: price, amount: amount, time: new Date().toLocaleTimeString()
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

        alert(`💎 매수 체결!\n${amount}개 @ $${price}\n(새 평단가: $${newEntry.toFixed(2)})`);
    } else {
        if(window.appState.position.amount < amount) return alert("보유 코인이 부족합니다.");
        window.appState.position.amount -= amount;
        if(window.appState.position.amount <= 0) window.appState.position.entryPrice = 0;
        alert(`💰 매도 체결!\n${amount}개 @ $${price}`);
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
                <span style="color:#fff;">$${o.price}</span>
                <span style="color:#ccc;">${o.amount}개</span>
            </div>`;
        });
    }
    area.innerHTML = html;
}
