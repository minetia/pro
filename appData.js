// [appData.js] 모든 페이지의 데이터를 하나로 관리하는 중앙 저장소

// 1. 데이터 불러오기 (서랍 열기)
window.appState = JSON.parse(localStorage.getItem('tradingData')) || {
    balance: 100000,       // 현금 잔고 ($)
    bankBalance: 500000,   // 은행 잔고 ($)
    position: { amount: 0, entryPrice: 0 }, // 보유 중인 코인
    tradeHistory: [],      // 체결 내역
    transfers: []          // 입출금 내역
};

// 2. 데이터 저장하기 (서랍 닫기)
window.saveState = function() {
    localStorage.setItem('tradingData', JSON.stringify(window.appState));
};

// 3. 금액 포맷팅 (전역 함수)
window.formatCurrency = function(num) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};
