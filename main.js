// [초기화]
window.addEventListener('load', function() {
    startBinanceStream(); // 가격 수신 시작
    transformToManualTrade(); // 화면을 수동 거래용으로 개조 (마법!)
    updateOrderList(); // 미체결 목록 표시
});

// 전역 변수
var ws = null;
var currentPrice = 0;
// 주문 목록 저장소 (미체결 주문들)
if (!window.appState) window.appState = { balance: 0, pendingOrders: [], position: {amount:0, entry:0} };
if (!window.appState.pendingOrders) window.appState.pendingOrders = [];

// ==========================================
// 1. 화면 개조 마법 (HTML 수정 없이 JS로 입력창 만들기)
// ==========================================
function transformToManualTrade() {
    // START/STOP 버튼이 있는 영역 찾기
    var controlBox = document.querySelector('.control-box') || document.querySelector('.card') || document.body;
    
    // 기존 내용(START 버튼 등)을 지우고, 지정가 거래 화면으로 교체
    // (기존 HTML 구조를 덮어씁니다)
    var uiHTML = `
        <div style="padding: 15px; background: #1e1e1e; border-radius: 12px; margin-top: 10px; border:1px solid #333;">
            <h3 style="margin:0 0 10px 0; font-size:14px; color:#F0B90B;">⚡ 지정가 주문 (Limit Order)</h3>
            
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <input type="number" id="inp-price" placeholder="목표 가격 ($)" 
                       style="flex:1; padding:12px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:8px; outline:none;">
                <input type="number" id="inp-amount" placeholder="수량" 
                       style="flex:1; padding:12px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:8px; outline:none;">
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="placeLimitOrder('buy')" 
                        style="flex:1; padding:12px; background:#0ecb81; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:16px;">
                    매수 (Long)
                </button>
                <button onclick="placeLimitOrder('sell')" 
                        style="flex:1; padding:12px; background:#f6465d; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:16px;">
                    매도 (Short)
                </button>
            </div>
            
            <div style="margin-top:10px; font-size:12px; color:#888; text-align:center;">
                * 현재가에 도달하면 자동 체결됩니다.
            </div>
        </div>
    `;

    // START/STOP 버튼이 있던 자리에 위 코드를 끼워넣기 (찾아서 덮어쓰기)
    // 정확한 위치를 잡기 위해 버튼들을 찾습니다.
    var buttons = document.querySelectorAll('button');
    if (buttons.length > 0) {
        // 버튼의 부모(박스)를 찾아서 내용을 교체
        buttons[0].parentElement.innerHTML = uiHTML;
    } else {
        // 못 찾으면 그냥 맨 위에 붙임
        var header = document.querySelector('.header');
        if(header) header.insertAdjacentHTML('afterend', uiHTML);
    }
}


// ==========================================
// 2. 바이낸스 실시간 시세 연동
// ==========================================
function startBinanceStream() {
    if (ws) ws.close();
    ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

    ws.onmessage = function(event) {
        var data = JSON.parse(event.data);
        currentPrice = parseFloat(data.p);

        // 가격 표시 업데이트
        var priceEl = document.querySelector('.hero-number') || document.querySelector('h1') || document.getElementById('price-display');
        if (priceEl) {
            priceEl.innerText = '$ ' + currentPrice.toLocaleString(undefined, {minimumFractionDigits:2});
            priceEl.style.color = (window.lastP && currentPrice > window.lastP) ? '#0ecb81' : '#f6465d';
        }
        window.lastP = currentPrice;

        // [핵심] 주문 체결 감시자 실행
        checkOrderExecution(currentPrice);
    };
}


// ==========================================
// 3. 주문 로직 (주문 넣기 & 체결 확인)
// ==========================================

// 주문 등록 함수
window.placeLimitOrder = function(side) {
    var priceInput = document.getElementById('inp-price');
    var amtInput = document.getElementById('inp-amount');
    
    var targetPrice = parseFloat(priceInput.value);
    var amount = parseFloat(amtInput.value);

    if (!targetPrice || !amount) return alert("가격과 수량을 입력해주세요.");

    // 유효성 검사 (말도 안 되는 주문 방지)
    if (side === 'buy' && targetPrice > currentPrice) return alert("예약 매수는 현재가보다 낮아야 합니다.\n(즉시 체결은 시장가를 이용하세요)");
    if (side === 'sell' && targetPrice < currentPrice) return alert("예약 매도는 현재가보다 높아야 합니다.");

    // 주문 목록에 추가
    var newOrder = {
        id: Date.now(),
        side: side,
        targetPrice: targetPrice,
        amount: amount,
        time: new Date().toLocaleTimeString()
    };
    
    window.appState.pendingOrders.push(newOrder);
    
    alert(`✅ 예약 주문 완료!\n$${targetPrice}에 도달하면 체결됩니다.`);
    updateOrderList();
    
    // 입력창 비우기
    priceInput.value = '';
    amtInput.value = '';
};

// 체결 감시 함수 (0.1초마다 실행됨)
function checkOrderExecution(nowPrice) {
    // 주문 목록을 역순으로 검사 (삭제 시 인덱스 오류 방지)
    for (var i = window.appState.pendingOrders.length - 1; i >= 0; i--) {
        var order = window.appState.pendingOrders[i];
        var isExecuted = false;

        // 매수 주문: 가격이 내 목표가보다 싸지거나 같아지면 체결
        if (order.side === 'buy' && nowPrice <= order.targetPrice) {
            isExecuted = true;
        }
        // 매도 주문: 가격이 내 목표가보다 비싸지거나 같아지면 체결
        else if (order.side === 'sell' && nowPrice >= order.targetPrice) {
            isExecuted = true;
        }

        // 체결 처리
        if (isExecuted) {
            // 목록에서 삭제
            window.appState.pendingOrders.splice(i, 1);
            
            // 알림 및 화면 갱신
            alert(`🔔 띵동! 주문 체결!\n${order.side.toUpperCase()} ${order.amount}개 @ $${nowPrice}`);
            updateOrderList();
            
            // (여기서 실제 잔고나 포지션 업데이트 로직을 추가하면 됩니다)
            console.log("체결 완료:", order);
        }
    }
}

// 화면 아래 리스트 업데이트
function updateOrderList() {
    var listContainer = document.querySelector('.list-view') || document.querySelector('.live-feed') || document.getElementById('order-list');
    
    // 리스트 박스가 없으면 강제로 하나 만듦 (마법 2탄)
    if (!listContainer) {
        var box = document.createElement('div');
        box.className = 'list-view';
        box.style.padding = '15px';
        box.style.color = 'white';
        // 기존 리스트 위치 찾아서 교체하거나 추가
        var target = document.querySelector('.control-box') || document.body;
        target.parentNode.insertBefore(box, target.nextSibling);
        listContainer = box;
    }

    var html = '<div style="margin-bottom:10px; font-weight:bold; color:#888;">📋 미체결 주문 목록</div>';
    
    if (window.appState.pendingOrders.length === 0) {
        html += '<div style="text-align:center; padding:20px; color:#555;">대기 중인 주문이 없습니다.</div>';
    } else {
        window.appState.pendingOrders.forEach(function(o) {
            var color = o.side === 'buy' ? '#0ecb81' : '#f6465d';
            var typeKor = o.side === 'buy' ? '매수' : '매도';
            
            html += `
                <div style="display:flex; justify-content:space-between; padding:10px; background:#222; margin-bottom:5px; border-radius:4px; border-left: 3px solid ${color};">
                    <span style="color:${color}; font-weight:bold;">${typeKor}</span>
                    <span>$ ${o.targetPrice}</span>
                    <span>${o.amount} 개</span>
                    <span style="color:#666; font-size:12px;">${o.time}</span>
                </div>
            `;
        });
    }
    
    listContainer.innerHTML = html;
}
