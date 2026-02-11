// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    startBinanceStream();
    injectLimitOrderUI(); // 지정가 입력창 자동 생성
    updatePendingList();  // 미체결 내역 보여주기
});

// 전역 변수
var ws = null;
var currentPrice = 0;
// 미체결 주문 목록 (여기에 주문이 쌓입니다)
if (!window.appState) window.appState = { balance: 100000, bankBalance: 500000, position: { amount: 0, entry: 0 }, pendingOrders: [] };
if (!window.appState.pendingOrders) window.appState.pendingOrders = [];

// ==========================================
// 1. 바이낸스 실시간 연결 & 체결 감시자
// ==========================================
function startBinanceStream() {
    if (ws) ws.close();
    ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

    ws.onmessage = function(event) {
        var data = JSON.parse(event.data);
        var price = parseFloat(data.p);
        currentPrice = price;

        // 1. 화면 가격 업데이트
        updatePriceDisplay(price);

        // 2. [핵심] 미체결 주문 감시 (가격 도달했나?)
        checkPendingOrders(price);
    };
}

function updatePriceDisplay(price) {
    var el = document.getElementById('price-display');
    if (el) {
        el.innerText = '$ ' + price.toLocaleString(undefined, { minimumFractionDigits: 2 });
        // 색상 변경 효과
        el.style.color = (window.lastPrice && price > window.lastPrice) ? '#0ecb81' : '#f6465d';
    }
    window.lastPrice = price;
}

// ==========================================
// 2. 다중 체결 엔진 (가격 도달 시 실행)
// ==========================================
function checkPendingOrders(nowPrice) {
    // 주문 목록을 하나씩 검사
    for (var i = appState.pendingOrders.length - 1; i >= 0; i--) {
        var order = appState.pendingOrders[i];
        var isExecuted = false;

        // 매수 주문: 내 목표가보다 싸지거나 같아지면 체결!
        if (order.side === 'buy' && nowPrice <= order.targetPrice) {
            executeRealTrade('buy', order.amount, nowPrice);
            isExecuted = true;
        }
        // 매도 주문: 내 목표가보다 비싸지거나 같아지면 체결!
        else if (order.side === 'sell' && nowPrice >= order.targetPrice) {
            executeRealTrade('sell', order.amount, nowPrice);
            isExecuted = true;
        }

        // 체결되었으면 목록에서 삭제하고 알림
        if (isExecuted) {
            appState.pendingOrders.splice(i, 1); // 목록에서 제거
            updatePendingList(); // 화면 갱신
            alert("🔔 지정가 주문 체결 완료!\n가격: " + nowPrice);
        }
    }
}

// ==========================================
// 3. 주문 넣기 (매수/매도 버튼 클릭 시)
// ==========================================
function placeOrder(side) {
    // 입력한 수량과 가격 가져오기
    var amtInput = document.getElementById('amount-input');
    var priceInput = document.getElementById('target-price-input'); // 지정가 입력창

    var amount = parseFloat(amtInput ? amtInput.value : 0);
    var targetPrice = parseFloat(priceInput ? priceInput.value : 0);

    if (!amount || amount <= 0) return alert("수량을 입력해주세요.");

    // 1) 지정가가 입력되어 있으면 -> 대기 목록(미체결)에 추가
    if (targetPrice > 0) {
        // 유효성 체크
        if (side === 'buy' && targetPrice > currentPrice) return alert("현재가보다 낮은 가격에만 예약 매수할 수 있습니다.");
        if (side === 'sell' && targetPrice < currentPrice) return alert("현재가보다 높은 가격에만 예약 매도할 수 있습니다.");

        // 주문 저장
        appState.pendingOrders.push({
            id: Date.now(), // 고유 번호
            side: side,
            amount: amount,
            targetPrice: targetPrice,
            time: new Date().toLocaleTimeString()
        });

        alert("✅ 지정가 주문 접수 완료!\n가격이 " + targetPrice + "에 도달하면 체결됩니다.");
        updatePendingList(); // 미체결 목록 갱신
        priceInput.value = ''; // 입력창 비우기

    } else {
        // 2) 지정가가 없으면 -> 즉시 시장가 체결
        executeRealTrade(side, amount, currentPrice);
    }
}

// 실제 잔고 변경 및 포지션 처리 함수
function executeRealTrade(side, amount, price) {
    var totalCost = amount * price; // 필요 금액 (단순 계산)

    if (side === 'buy') {
        // 매수 로직
        // (잔고 체크 로직은 wallet.js와 연동 필요하지만 여기선 간단히 처리)
        appState.position = appState.position || { amount: 0, entry: 0 };
        
        // 평단가 계산: ((기존수량 * 기존평단) + (새수량 * 새가격)) / 전체수량
        var totalQty = appState.position.amount + amount;
        var avgPrice = ((appState.position.amount * appState.position.entryPrice) + (amount * price)) / totalQty;
        
        if(!appState.position.amount) avgPrice = price; // 처음 살 때

        appState.position.amount = totalQty;
        appState.position.entryPrice = avgPrice;
        appState.position.side = 'long';
        
    } else {
        // 매도 로직
        if (!appState.position || appState.position.amount < amount) return alert("매도할 코인이 부족합니다.");
        appState.position.amount -= amount;
        if (appState.position.amount <= 0) {
            appState.position = { amount: 0, entry: 0 };
        }
    }
    
    // 로그 저장 (옵션)
    console.log(`[체결] ${side.toUpperCase()} ${amount}개 @ ${price}`);
}


// ==========================================
// 4. UI 관리 (입력창 생성 & 리스트 출력)
// ==========================================

// 지정가 입력창이 없으면 자동으로 만들어주는 마법사
function injectLimitOrderUI() {
    var container = document.querySelector('.order-inputs') || document.querySelector('.trade-box'); // 넣을 위치 찾기
    
    // 이미 있으면 중단
    if (document.getElementById('target-price-input')) return;

    if (container) {
        var div = document.createElement('div');
        div.style.marginTop = "10px";
        div.innerHTML = `
            <label style="color:#888; font-size:12px;">지정가 (비우면 시장가)</label>
            <input id="target-price-input" type="number" placeholder="목표 가격 입력" 
                   style="width:100%; padding:10px; background:#333; border:1px solid #555; color:white; margin-bottom:10px; border-radius:4px;">
        `;
        // 버튼 위에 끼워넣기
        var btn = container.querySelector('button');
        if(btn) container.insertBefore(div, btn);
        else container.appendChild(div);
    }
}

// 미체결 내역을 화면 어딘가에 보여주기
function updatePendingList() {
    // 표시할 공간 찾기 (없으면 만듦)
    var listContainer = document.getElementById('pending-list');
    if (!listContainer) {
        var box = document.createElement('div');
        box.style.padding = "20px";
        box.style.borderTop = "1px solid #333";
        box.innerHTML = `<h3 style="color:#fff; font-size:14px;">📋 미체결 주문 (Open Orders)</h3><div id="pending-list"></div>`;
        document.body.appendChild(box);
        listContainer = document.getElementById('pending-list');
    }

    // 목록 그리기
    var html = "";
    if (appState.pendingOrders.length === 0) {
        html = "<div style='color:#666; font-size:12px;'>대기 중인 주문이 없습니다.</div>";
    } else {
        appState.pendingOrders.forEach(function(o) {
            var color = o.side === 'buy' ? '#0ecb81' : '#f6465d';
            var typeText = o.side === 'buy' ? '매수' : '매도';
            html += `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; padding:5px; background:#222; font-size:12px; color:#fff;">
                    <span style="color:${color}; font-weight:bold;">[${typeText}]</span>
                    <span>목표가: $${o.targetPrice}</span>
                    <span>수량: ${o.amount}</span>
                </div>
            `;
        });
    }
    listContainer.innerHTML = html;
}
