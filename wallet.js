// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    updateWalletUI(); 
    showTab('holdings'); // 기본 탭: 보유자산
    
    // 그래프 그리기 (데이터가 없으면 가짜 데이터로 예시 보여줌)
    setTimeout(drawPortfolio, 500);
    setTimeout(drawPnLGraph, 500);
});

// [1] 탭 전환 기능 (메뉴 클릭 해결)
function showTab(t) {
    // 모든 탭 숨김 및 스타일 초기화
    document.querySelectorAll('.tab-content').forEach(function(c) {
        c.style.display = 'none';
        c.classList.add('hidden');
    });
    document.querySelectorAll('.wallet-tab-btn').forEach(function(b) {
        b.classList.remove('active');
    });

    // 선택한 탭 활성화
    var target = document.getElementById('tab-' + t);
    var btn = document.getElementById('btn-' + t); // 버튼 ID가 있다면
    
    if (target) {
        target.style.display = 'block';
        target.classList.remove('hidden');
    }
    if (btn) btn.classList.add('active');

    // 탭별 그래프 다시 그리기 (화면 갱신)
    if (t === 'holdings') setTimeout(drawPortfolio, 100);
    if (t === 'pnl') setTimeout(drawPnLGraph, 100);
}

// [2] 화면 데이터 갱신 (숫자 & 그래프)
function updateWalletUI() {
    // 1. 숫자 업데이트
    var elBank = document.getElementById('bank-balance-display');
    var elWallet = document.getElementById('wallet-display');
    var elCash = document.getElementById('avail-cash'); // 주문가능 금액
    var elTotal = document.getElementById('total-asset-display'); // 총 보유자산

    if (elBank) elBank.innerText = '$ ' + formatMoney(appState.bankBalance);
    if (elWallet) elWallet.innerText = '$ ' + formatMoney(appState.balance);
    if (elCash) elCash.innerText = '$ ' + formatMoney(appState.balance);
    
    // 총 자산 (현금 + 투자금) - 투자금은 임의로 계산
    var invested = appState.investedAmount || 0; 
    var total = appState.balance + invested;
    if (elTotal) elTotal.innerText = '$ ' + formatMoney(total);

    // 2. 그래프 업데이트
    drawPortfolio();
    drawPnLGraph();
}

// [3] 포트폴리오 도넛 차트 그리기 (CSS 활용)
function drawPortfolio() {
    var pie = document.getElementById('portfolio-pie'); // HTML에 이 ID가 있어야 함
    if (!pie) return;

    // 자산 비율 계산 (현금 vs 투자금)
    var cash = appState.balance;
    var invest = appState.investedAmount || 0;
    var total = cash + invest;
    
    if (total === 0) return; // 자산 0이면 패스

    var cashPct = (cash / total) * 100;
    
    // 도넛 차트 스타일 적용 (노랑: 현금, 회색: 투자)
    pie.style.background = `conic-gradient(
        #F0B90B 0% ${cashPct}%, 
        #333333 ${cashPct}% 100%
    )`;
    pie.style.borderRadius = '50%';
}

// [4] 수익률 꺾은선 그래프 그리기 (Canvas API 활용)
function drawPnLGraph() {
    var canvas = document.getElementById('pnlChart');
    if (!canvas) return;
    
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;

    // 캔버스 초기화
    ctx.clearRect(0, 0, width, height);

    // 가짜 데이터 생성 (최근 7일 수익률 예시)
    // 실제 데이터가 쌓이면 appState.history를 쓰면 됩니다.
    var dataPoints = [0, -5, 10, -2, 15, 5, 20]; // 예시 데이터 (%)
    
    // 그래프 스타일 설정
    ctx.beginPath();
    ctx.strokeStyle = '#3498db'; // 파란색 선
    ctx.lineWidth = 3;

    // 선 그리기
    var stepX = width / (dataPoints.length - 1);
    var maxVal = 30; // Y축 최대값
    var minVal = -30; // Y축 최소값
    var range = maxVal - minVal;

    dataPoints.forEach((val, index) => {
        var x = index * stepX;
        // Y값 좌표 변환 (높을수록 위로)
        var y = height - ((val - minVal) / range) * height;
        
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 그라데이션 채우기 (선 아래쪽)
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
    ctx.fill();
}

// [5] 금액 콤마 찍기 헬퍼 함수
function formatMoney(num) {
    return num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// [6] 거래내역 리스트 출력
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
        tbody.innerHTML = '<tr><td colspan="4" style="color:#666; padding:20px;">거래 내역 없음</td></tr>';
    }
}, 1000);

// [7] 모달(입출금) 기능
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

    if (window.currentMode === 'deposit') {
        if (appState.bankBalance < amt) return alert("은행 잔고 부족");
        appState.bankBalance -= amt;
        appState.balance += amt;
    } else {
        if (appState.balance < amt) return alert("지갑 잔고 부족");
        appState.balance -= amt;
        appState.bankBalance += amt;
    }
    saveState();
    updateWalletUI();
    closeModal();
    alert("완료되었습니다.");
}
