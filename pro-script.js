// [NEW] API 설정 (업비트 비트코인)
const API_URL = 'https://api.upbit.com/v1/ticker?markets=KRW-BTC';

window.addEventListener('load', () => {
    // 1. 헤더 로드 (기존 유지)
    fetch('header.html')
        .then(res => res.text())
        .then(data => document.getElementById('internal-header-slot').innerHTML = data);

    // 2. 초기 상태 메시지
    const statusText = document.getElementById('connection-status');
    statusText.innerText = "CONNECTING TO UPBIT...";
    
    // 3. 실시간 데이터 펌핑 시작
    setInterval(fetchRealPrice, 1000); // 1초마다 가격 갱신
});

// [NEW] 실제 시세 가져오기 함수
async function fetchRealPrice() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        const ticker = data[0]; // 첫 번째 결과 (KRW-BTC)

        // 가격 포맷팅 (예: 104,000,000)
        const currentPrice = ticker.trade_price;
        const formattedPrice = currentPrice.toLocaleString();
        
        // 전일 대비 색상 결정
        const changeRate = (ticker.signed_change_rate * 100).toFixed(2);
        const color = ticker.signed_change_price > 0 ? '#0f0' : (ticker.signed_change_price < 0 ? '#f00' : '#fff');

        // UI 업데이트
        const priceEl = document.getElementById('coin-price');
        const statusEl = document.getElementById('connection-status');

        priceEl.innerText = formattedPrice;
        priceEl.style.color = color;
        
        // 상태 메시지에 변동률 표시
        statusEl.innerHTML = `BTC/KRW <span style="color:${color}">${changeRate}%</span>`;
        statusEl.classList.remove('blink');
        statusEl.style.color = '#fff';

        // 가끔씩 AI 로그에 실제 가격 반영 (연출)
        if (Math.random() < 0.1) { // 10% 확률로 로그 기록
            const signal = changeRate > 0 ? 'Bullish Trend Detected' : 'Panic Selling Detected';
            const position = changeRate > 0 ? 'LONG' : 'SHORT';
            addPrecisionLog(position, currentPrice, changeRate, signal);
        }

    } catch (error) {
        console.error("API Error:", error);
    }
}

// Latency 시뮬레이션 (기존 유지)
function startLatencyUpdate() { /* ... 기존 코드 ... */ }

// 로그 시스템 (기존 유지)
function addPrecisionLog(pos, price, profit, signal) {
    const terminal = document.getElementById('terminal');
    const time = new Date().toLocaleTimeString('ko-KR', {hour12: false});
    const color = pos === 'LONG' ? 'pos-long' : 'pos-short';
    const profitColor = profit >= 0 ? '#0f0' : '#f00';
    
    const logRow = `
        <div class="log-line">
            <span style="color:#555;">[${time}]</span>
            <span class="${color}">${pos}</span>
            <span style="color:#eee; text-align:right;">${Number(price).toLocaleString()}</span>
            <span style="color:#aaa;">${signal} <b style="color:${profitColor}">(${profit}%)</b></span>
        </div>`;
    
    terminal.insertAdjacentHTML('afterbegin', logRow);
}

// 버튼 기능들 (기존 유지)
function startAi() { alert("AI AUTO-TRADING STARTED based on Real-Time Data."); }
function stopAi() { alert("TRADING HALTED."); }
