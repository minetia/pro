// [초기화]
window.addEventListener('load', function() {
    startBinanceStream(); 
    initTradeUI(); // 화면 디자인 교체
    updateOrderList();
});

// 전역 변수 설정
var ws = null;
var currentPrice = 0;
// 데이터 저장소 초기화
if (!window.appState) window.appState = { balance: 0, pendingOrders: [], position: {amount:0, entry:0} };
if (!window.appState.pendingOrders) window.appState.pendingOrders = [];


// ==========================================
// 1. 화면 디자인 개조 (겹침 해결!)
// ==========================================
function initTradeUI() {
    // 1. 기존에 있던 START/STOP 버튼 박스를 찾습니다.
    var oldControlBox = document.querySelector('.control-box') || document.querySelector('.card');
    
    // 2. 입력창 디자인 (가격표 아래에 배치되도록 margin-top 추가)
    var newUI = `
    <div style="
        background-color: #1e1e1e; 
        padding: 20px; 
        border-radius: 16px; 
        margin: 20px 10px; 
        border: 1px solid #333; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <span style="color:#F0B90B; font-weight:bold; font-size:14px;">⚡ 지정가 주문 (Limit Order)</span>
            <span style="color:#666; font-size:12px;">Wallet: $ ${window.appState.balance.toLocaleString()}</span>
        </div>

        <div style="margin-bottom:10px;">
            <label style="color:#888; font-size:11px; display:block; margin-bottom:5px;">목표 가격 ($)</label>
            <input type="number" id="inp-price" placeholder="예: 68000" 
                style="width:94%; padding:12px; background:#2a2a2a; border:1px solid #444; border-radius:8px; color:#fff; font-size:16px; outline:none;">
        </div>

        <div style="margin-bottom:20px;">
            <label style="color:#888; font-size:11px; display:block; margin-bottom:5px;">주문 수량 (개)</label>
            <input type="number" id="inp-amount" placeholder="예: 0.1" 
                style="width:94%; padding:12px; background:#2a2a2a; border:1px solid #444; border-radius:8px; color:#fff; font-size:16px; outline:none;">
        </div>

        <div style="display:flex; gap:10px;">
            <button onclick="order('buy')" style="flex:1; padding:15px; background:#0ecb81; color:white; border:none; border-radius:8px; font-weight:bold; font-size:16px;">
                매수 (Long)
            </button>
            <button onclick="order('sell')" style="flex:1; padding:15px; background:#f6465d; color:white; border:none; border-radius:8px; font-weight:bold; font-size:16px;">
                매도 (Short)
            </button>
        </div>
    </div>
    
    <div id="order-list-area" style="margin: 0 10px;"></div>
    `;

    // 3. 기존 버튼을 없애고 새 디자인을 넣거나, 적절한 위치에 끼워넣기
    // (겹치지 않게 기존 내용을 싹 비우고 다시 채웁니다)
    if (oldControlBox) {
        // 기존 박스가 있으면 내용만 교체
        oldControlBox.innerHTML = newUI;
        // 스타일이 꼬일 수 있으니 강제로 초기화
        oldControlBox.style.height = "auto"; 
        oldControlBox.style.background = "transparent";
        oldControlBox.style.border = "none";
    } else {
        // 박스를 못 찾으면, 가격표(header) 바로 다음에 붙임
        var header = document.querySelector('.header') || document.body;
        var div = document.createElement('div');
        div.innerHTML = newUI;
        header.parentNode.insertBefore(div, header.nextSibling);
    }
}


// ==========================================
// 2. 바이낸스 연결
// ==========================================
function startBinanceStream() {
    if (ws) ws.close();
    ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

    ws.onmessage = function(event) {
        var data = JSON.parse(event.data);
        currentPrice = parseFloat(data.p);

        // 가격 표시 업데이트
        var el = document.getElementById('price-display') || document.querySelector('.hero-number') || document.querySelector('h1');
        if (el) {
            el.innerText = '$ ' + currentPrice.toLocaleString(undefined, {minimumFractionDigits:2});
            el.style.color = (window.lastP && currentPrice > window.lastP) ? '#0ecb81' : '#f6465d';
        }
        window.lastP = currentPrice;

        // 체결 감시
        checkOrders(currentPrice);
    };
}


// ==========================================
// 3. 주문 & 체결 로직
// ==========================================
window.order = function(side) {
    var priceVal = document.getElementById('inp-price').value;
    var amountVal = document.getElementById('inp-amount').value;
    
    var price = parseFloat(priceVal);
    var amount = parseFloat(amountVal);

    if (!price || !amount) return alert("가격과 수량을 정확히 입력해주세요.");

    // 유효성 체크
    if (side === 'buy' && price > currentPrice) return alert("예약 매수는 현재가보다 싸게 사야 합니다.");
    if (side === 'sell' && price < currentPrice) return alert("예약 매도는 현재가보다 비싸게 팔아야 합니다.");

    // 주문 추가
    window.appState.pendingOrders.push({
        id: Date.now(),
        side: side,
        price: price,
        amount: amount,
        time: new Date().toLocaleTimeString()
    });

    alert("✅ 주문 등록 완료!");
    updateOrderList();
    
    // 입력창 비우기
    document.getElementById('inp-price').value = '';
    document.getElementById('inp-amount').value = '';
};

function checkOrders(nowPrice) {
    var orders = window.appState.pendingOrders;
    for (var i = orders.length - 1; i >= 0; i--) {
        var o = orders[i];
        var executed = false;

        // 매수: 가격이 목표가 이하로 떨어지면 체결
        if (o.side === 'buy' && nowPrice <= o.price) executed = true;
        // 매도: 가격이 목표가 이상으로 오르면 체결
        if (o.side === 'sell' && nowPrice >= o.price) executed = true;

        if (executed) {
            orders.splice(i, 1); // 목록 삭제
            alert(`🔔 체결 알림!\n${o.side === 'buy'?'매수':'매도'} 성공\n가격: $${nowPrice}`);
            updateOrderList();
        }
    }
}

function updateOrderList() {
    var area = document.getElementById('order-list-area');
    if (!area) return;

    var html = '<div style="color:#888; font-size:12px; margin-bottom:10px;">📋 미체결 주문 목록</div>';
    
    if (window.appState.pendingOrders.length === 0) {
        html += '<div style="text-align:center; padding:15px; color:#555; background:#222; border-radius:8px;">대기 중인 주문이 없습니다.</div>';
    } else {
        window.appState.pendingOrders.forEach(function(o) {
            var color = o.side === 'buy' ? '#0ecb81' : '#f6465d';
            var txt = o.side === 'buy' ? '매수' : '매도';
            html += `
            <div style="display:flex; justify-content:space-between; padding:12px; background:#222; border-left:4px solid ${color}; border-radius:4px; margin-bottom:6px;">
                <span style="color:${color}; font-weight:bold;">${txt}</span>
                <span style="color:#fff;">$ ${o.price}</span>
                <span style="color:#ccc;">${o.amount}개</span>
            </div>`;
        });
    }
    area.innerHTML = html;
}
