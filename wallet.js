// [초기화] 페이지가 열리면 실행
window.addEventListener('load', function() {
    updateWalletUI(); 
    showTab('holdings'); // 기본 탭 열기
    
    // 그래프 그리기
    setTimeout(drawPortfolio, 500);
    setTimeout(drawPnLGraph, 500);
    
    // 은행 내역도 업데이트
    updateBankHistory();
});

// [1] 탭 전환 기능 (메뉴 클릭 해결)
function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(function(c) {
        c.style.display = 'none';
        c.classList.add('hidden');
    });
    document.querySelectorAll('.wallet-tab-btn').forEach(function(b) {
        b.classList.remove('active');
    });

    var target = document.getElementById('tab-' + t);
    var btn = document.getElementById('btn-' + t);
    
    if (target) {
        target.style.display = 'block';
        target.classList.remove('hidden');
    }
    if (btn) btn.classList.add('active');

    if (t === 'holdings') setTimeout(drawPortfolio, 100);
    if (t === 'pnl') setTimeout(drawPnLGraph, 100);
}

// [2] 화면 데이터 갱신 (숫자 & 그래프)
function updateWalletUI() {
    var elBank = document.getElementById('bank-balance-display');
    var elWallet = document.getElementById('wallet-display');
    var elCash = document.getElementById('avail-cash'); 
    var elTotal = document.getElementById('total-asset-display');

    if (elBank) elBank.innerText = '$ ' + formatMoney(appState.bankBalance);
    if (elWallet) elWallet.innerText = '$ ' + formatMoney(appState.balance);
    if (elCash) elCash.innerText = '$ ' + formatMoney(appState.balance);
    
    // 총 자산 계산
    var invested = appState.investedAmount || 0; 
    var total = appState.balance + invested;
    if (elTotal) elTotal.innerText = '$ ' + formatMoney(total);

    drawPortfolio();
    updateBankHistory(); // 은행 내역 갱신
}

// [3] 포트폴리오 도넛 차트 (보유자산 탭)
function drawPortfolio() {
    var pie = document.getElementById('portfolio-pie');
    if (!pie) return;

    var cash = appState.balance;
    var invest = appState.investedAmount || 0;
    var total = cash + invest;
    
    if (total === 0) return;

    var cashPct = (cash / total) * 100;
    
    pie.style.background = `conic-gradient(
        #F0B90B 0% ${cashPct}%, 
        #333333 ${cashPct}% 100%
    )`;
    pie.style.borderRadius = '50%';
}

// [4] 수익률 꺾은선 그래프 (투자손익 탭)
function drawPnLGraph() {
    var canvas = document.getElementById('pnlChart');
    if (!canvas) return;
    
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 예시 데이터 (실제로는 appState.history 사용 가능)
    var dataPoints = [0, -5, 10, -2, 15, 5, 20]; 
    
    ctx.beginPath();
    ctx.strokeStyle = '#3498db'; 
    ctx.lineWidth = 3;

    var stepX = width / (dataPoints.length - 1);
    var maxVal = 30; 
    var minVal = -30; 
    var range = maxVal - minVal;

    dataPoints.forEach((val, index) => {
        var x = index * stepX;
        var y = height - ((val - minVal) / range) * height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

// [5] 헬퍼 함수: 금액 콤마 찍기
function formatMoney(num) {
    return num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// [6] 거래내역(매매) 리스트 출력 - 1초마다 갱신
setInterval(function() {
    var tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    var html = "";
    if (appState.tradeHistory && appState.tradeHistory.length > 0) {
        appState.tradeHistory.forEach(function(t) {
            var color = Number(t.pnl) >= 0 ? "text-green" : "text-red";
            html += `<tr>
                <td>${t.time}</td>
                <td style="font-weight:bold">${t.coin}</td>
                <td class="${color}">${t.type}</td>
                <td>${t.pnl}</td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } else {
        tbody.innerHTML = '<tr><td colspan="4" style="color:#666; padding:20px;">매매 내역이 없습니다.</td></tr>';
    }
}, 1000);

// [7] 은행 입출금 내역 출력 (마지막 사진 해결!)
function updateBankHistory() {
    var list = document.querySelector('.bank-history-list') || document.getElementById('bank-history-list');
    // 화면에 리스트 넣을 곳이 없으면 중단
    if (!list) return; 

    var html = "";
    // appState.transfers 배열이 없으면 빈 배열로 생성
    if (!appState.transfers) appState.transfers = [];

    if (appState.transfers.length > 0) {
        appState.transfers.forEach(function(t) {
            var typeColor = t.type === '입금' ? 'text-green' : 'text-red';
            html += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #333;">
                <span style="color:#888; font-size:12px;">${t.date}</span>
                <span class="${typeColor}">${t.type}</span>
                <span style="font-weight:bold;">$ ${t.amount}</span>
            </div>`;
        });
        list.innerHTML = html;
    } else {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">은행 거래 내역이 없습니다.</div>';
    }
}

// [8] 모달(입출금) 기능 및 데이터 저장
function openModal(mode) {
    window.currentMode = mode;
    document.getElementById('transaction-modal').style.display = 'flex';
}
function closeModal() {
    document.getElementById('transaction-modal').style.display = 'none';
}
function processTx() {
    var amt = parseFloat(document.getElementById('amount-input').value);
    if (!amt || amt <= 0) return alert("금액을 확인해주세요.");

    var type = "";
    if (window.currentMode === 'deposit') {
        if (appState.bankBalance < amt) return alert("은행 잔고 부족");
        appState.bankBalance -= amt;
        appState.balance += amt;
        type = "입금";
    } else {
        if (appState.balance < amt) return alert("지갑 잔고 부족");
        appState.balance -= amt;
        appState.bankBalance += amt;
        type = "출금";
    }

    // 은행 내역에 기록 추가 (중요!)
    if (!appState.transfers) appState.transfers = [];
    appState.transfers.unshift({
        date: new Date().toLocaleTimeString(),
        type: type,
        amount: amt
    });

    saveState();
    updateWalletUI();
    closeModal();
    alert("처리되었습니다.");
}
