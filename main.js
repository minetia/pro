// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    startBinanceStream();
    fixLayoutAndShowOrderUI(); // 화면 정리 후 주문창 표시
    updateOrderList();
});

// 전역 변수
var ws = null;
var currentPrice = 0;
if (!window.appState) window.appState = { balance: 0, pendingOrders: [], position: {amount:0, entry:0} };
if (!window.appState.pendingOrders) window.appState.pendingOrders = [];


// ==========================================
// 1. 화면 정리 및 주문창 넣기 (강력 수정)
// ==========================================
function fixLayoutAndShowOrderUI() {
    // 1. 기존에 문제가 되는 버튼 박스나 컨트롤 박스를 찾습니다.
    var targetBox = document.querySelector('.control-box') || document.querySelector('.card');
    
    // 못 찾으면 버튼이라도 찾아서 그 부모를 타겟으로 잡습니다.
    if (!targetBox) {
        var btn = document.querySelector('button');
        if (btn) targetBox = btn.parentElement;
    }

    // 2. 타겟 박스를 찾았으면 내용을 싹 비우고(초기화), 새 디자인을 넣습니다.
    if (targetBox) {
        // 기존 스타일 초기화 (겹침 원인 제거)
        targetBox.style.position = 'static'; 
        targetBox.style.height = 'auto';
        targetBox.style.marginTop = '20px';
        targetBox.style.marginBottom = '20px';
        
        // 새 주문창 디자인 (깔끔한 카드 형태)
        targetBox.innerHTML = `
            <div style="background: #1e1e1e; border: 1px solid #333; border-radius: 12px; padding: 20px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <span style="color:#F0B90B; font-weight:bold;">⚡ 지정가 거래</span>
                    <span style="font-size:12px; color:#888;">가능 금액: $ ${window.appState.balance.toLocaleString()}</span>
                </div>

                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; color:#aaa; display:block; margin-bottom:5px;">주문 가격 ($)</label>
                    <input type="number" id="inp-price" placeholder="목표 가격 입력" 
                           style="width:95%; padding:12px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:8px; outline:none;">
                </div>

                <div style="margin-bottom:15px;">
                    <label style="font-size:11px; color:#aaa; display:block; margin-bottom:5px;">주문 수량 (개)</label>
                    <input type="number" id="inp-amount" placeholder="수량 입력" 
                           style="width:95%; padding:12px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:8px; outline:none;">
                </div>

                <div style="display:flex; gap:10px;">
                    <button onclick="order('buy')" style="flex:1; padding:12px; background:#0ecb81; border:none; border-radius:8px; color:#fff; font-weight:bold;">매수</button>
                    <button onclick="order('sell')" style="flex:1; padding:12px; background:#f6465d; border:none; border-radius:8px; color:#fff; font-weight:bold;">매도</button>
                </div>
            </div>
            
            <div id="order-list-area" style="margin-top:20px;"></div>
        `;
    }
}


// ==========================================
// 2. 바이낸스 시세 연동
// ==========================================
function startBinanceStream() {
    if (ws) ws.close();
    ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

    ws.onmessage = function(event) {
        var data = JSON.parse(event.data);
        currentPrice = parseFloat(data.p);

        // 가격 표시 (ID가 없으면 찾아서 넣음)
        var el = document.getElementById('price-display') || document.querySelector('.hero-number') || document.querySelector('h1');
        if (el) {
            el.innerText = '$ ' + currentPrice.toLocaleString(undefined, {minimumFractionDigits:2});
            el.style.color = (window.lastP && currentPrice > window.lastP) ? '#0ecb81' : '#f6465d';
        }
        window.lastP = currentPrice;

        checkOrders(currentPrice); // 체결 감시
    };
}


// ==========================================
// 3. 주문 및 체결 로직
// ==========================================
window.order = function(side) {
    var price = parseFloat(document.getElementById('inp-price').value);
    var amount = parseFloat(document.getElementById('inp-amount').value);

    if (!price || !amount) return alert("가격과 수량을 입력해주세요.");
    
    // 유효성 체크
    if (side === 'buy' && price > currentPrice) return alert("예약 매수는 현재가보다 낮아야 합니다.");
    if (side === 'sell' && price < currentPrice) return alert("예약 매도는 현재가보다 높아야 합니다.");

    window.appState.pendingOrders.push({
        id: Date.now(),
        side: side,
        price: price,
        amount: amount,
        time: new Date().toLocaleTimeString()
    });

    alert("✅ 주문이 접수되었습니다.");
    updateOrderList();
    
    // 입력창 초기화
    document.getElementById('inp-price').value = '';
    document.getElementById('inp-amount').value = '';
};

function checkOrders(nowPrice) {
    var orders = window.appState.pendingOrders;
    for (var i = orders.length - 1; i >= 0; i--) {
        var o = orders[i];
        var executed = false;

        if (o.side === 'buy' && nowPrice <= o.price) executed = true;
        if (o.side === 'sell' && nowPrice >= o.price) executed = true;

        if (executed) {
            orders.splice(i, 1);
            alert(`🔔 체결 완료!\n${o.side === 'buy'?'매수':'매도'} ${o.amount}개 @ $${nowPrice}`);
            updateOrderList();
        }
    }
}

function updateOrderList() {
    var area = document.getElementById('order-list-area');
    if (!area) return;

    var html = '<div style="font-size:12px; color:#888; margin-bottom:10px;">📋 미체결 주문</div>';
    
    if (window.appState.pendingOrders.length === 0) {
        html += '<div style="text-align:center; padding:15px; background:#222; color:#555; border-radius:8px; font-size:12px;">대기 중인 주문 없음</div>';
    } else {
        window.appState.pendingOrders.forEach(function(o) {
            var color = o.side === 'buy' ? '#0ecb81' : '#f6465d';
            var txt = o.side === 'buy' ? '매수' : '매도';
            html += `
            <div style="display:flex; justify-content:space-between; padding:10px; background:#222; border-left:3px solid ${color}; border-radius:4px; margin-bottom:5px; font-size:13px;">
                <span style="color:${color}; font-weight:bold;">${txt}</span>
                <span style="color:#fff;">$ ${o.price}</span>
                <span style="color:#ccc;">${o.amount}개</span>
            </div>`;
        });
    }
    area.innerHTML = html;
}
