/* core.js - V300.0 (Data Vault) */
const SAVE_KEY = 'neuroBot_V300_CLEAN'; 

// 1. 기본 상태 (전역 변수)
let appState = {
    balance: 0.00,        // 확정된 내 돈
    bankBalance: 0.00,    // 은행 돈
    startBalance: 0.00,   // 수익률 기준점
    config: { isReady: false, target: 'BTC', amount: 1000, keysVerified: false },
    isRunning: false,
    runningCoin: 'BTC',
    investedAmount: 0,    // 현재 투자 중인 원금
    tradeHistory: [],     // 거래 내역
    transfers: []         // 입출금 내역
};

// 2. 데이터 불러오기 (로드)
function loadState() {
    try {
        const d = localStorage.getItem(SAVE_KEY);
        if (d) appState = { ...appState, ...JSON.parse(d) };
        else saveState(); // 없으면 초기화
    } catch (e) { console.error("Load Error"); }
}

// 3. 데이터 저장하기 (세이브)
function saveState() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(appState));
}

// 4. 공통 기능 (메뉴 하이라이트 등)
window.addEventListener('load', () => {
    loadState();
    highlightMenu();
});

function highlightMenu() {
    const page = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(e => {
        if(e.getAttribute('href') === page) e.classList.add('active');
        else e.classList.remove('active');
    });
}

// 5. 숫자 예쁘게 찍기 (콤마)
function formatMoney(num) {
    return num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
