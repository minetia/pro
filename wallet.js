// 1. 화면이 켜지면 실행 (Loading 해결)
window.addEventListener('load', function() {
    updateWalletUI(); // 잔고 숫자 표시
    showTab('holdings'); // 기본 화면 켜기
});

// 2. 탭 메뉴 전환 (클릭 안 되는 문제 해결)
function showTab(t) {
    // 모든 화면 숨기기
    document.querySelectorAll('.tab-content').forEach(function(c) {
        c.style.display = 'none';
        c.classList.add('hidden'); // 숨김 강제 적용
    });

    // 선택한 화면만 보이기
    var target = document.getElementById('tab-' + t);
    if (target) {
        target.style.display = 'block';
        target.classList.remove('hidden'); // 숨김 해제 (중요!)
    }
}

// 3. 화면의 숫자와 내역을 갱신하는 함수
function updateWalletUI() {
    // 은행 잔고 표시
    var elBank = document.getElementById('bank-balance-display');
    if (elBank) elBank.innerText = '$ ' + appState.bankBalance.toLocaleString();

    // 지갑 잔고 표시
    var elWallet = document.getElementById('wallet-display');
    if (elWallet) elWallet.innerText = '$ ' + appState.balance.toLocaleString();
    
    // 현금 잔고 표시
    var elCash = document.getElementById('avail-cash');
    if (elCash) elCash.innerText = '$ ' + appState.balance.toLocaleString();
}

// 4. 거래 내역 1초마다 자동 갱신
setInterval(function() {
    var tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    var html = "";
    // 거래 기록이 있으면 표 만들기
    if (appState.tradeHistory && appState.tradeHistory.length > 0) {
        appState.tradeHistory.forEach(function(t) {
            var color = Number(t.pnl) >= 0 ? "text-green" : "text-red";
            html += '<tr>' +
                    '<td>' + t.time + '</td>' +
                    '<td>' + t.coin + '</td>' +
                    '<td class="' + color + '">' + t.type + '</td>' +
                    '<td>' + t.pnl + '</td>' +
                    '</tr>';
        });
        tbody.innerHTML = html;
    } else {
        tbody.innerHTML = '<tr><td colspan="4">거래 내역 없음</td></tr>';
    }
}, 1000);

// 5. 입출금 모달창 기능
function openModal(mode) {
    // 입금/출금 모드 설정 (전역변수 대신 속성 활용)
    window.currentMode = mode; 
    document.getElementById('transaction-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('transaction-modal').style.display = 'none';
}

function processTx() {
    var amt = parseFloat(document.getElementById('amount-input').value);
    if (!amt || amt <= 0) return alert("금액을 확인해주세요.");

    if (window.currentMode === 'deposit') {
        if (appState.bankBalance < amt) return alert("은행 잔고 부족");
        appState.bankBalance -= amt;
        appState.balance += amt;
    } else {
        if (appState.balance < amt) return alert("지갑 잔고 부족");
        appState.balance -= amt;
        appState.bankBalance += amt;
    }

    saveState(); // 저장
    updateWalletUI(); // 화면 즉시 갱신
    closeModal(); // 창 닫기
    alert("처리 완료");
}
