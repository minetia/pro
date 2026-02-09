// [1] 업비트 API 주소 정의 (비트코인)
const API_URL = 'https://api.upbit.com/v1/ticker?markets=KRW-BTC';

window.addEventListener('load', () => {
    
    // [2] 자체 헤더 파일(header.html) 연동
    fetch('header.html')
        .then(response => {
            if (!response.ok) throw new Error("Header load failed");
            return response.text();
        })
        .then(data => {
            document.getElementById('internal-header-slot').innerHTML = data;
        })
        .catch(error => console.error('Error loading header:', error));

    // [3] 초기 상태 메시지 설정
    const statusText = document.getElementById('connection-status');
    statusText.innerText = "CONNECTING TO UPBIT...";
    statusText.style.color = 'orange';

    // [4] 1초마다 실시간 시세 가져오기 (심장 박동 시작)
    setInterval(fetchRealPrice, 1000);

    // [5] 가짜 Latency(지연시간) 연출 시작
    startLatencyUpdate();
});

// [6] 실제 업비트 시세 가져오는 핵심 함수
async function fetchRealPrice() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        const ticker = data[0]; // KRW-BTC 정보

        // 가격 포맷팅 (예: 104,000,000)
        const currentPrice = ticker.trade_price;
        const formattedPrice = currentPrice.toLocaleString();
        
        // 전일 대비 등락에 따른 색상 결정
        const changeRate = (ticker.signed_change_rate * 100).toFixed(2);
        let color = '#fff'; // 기본 흰색
        if (ticker.signed_change_price > 0) color = '#0f0'; // 상승: 초록
        if (ticker.signed_change_price < 0) color = '#f00'; // 하락: 빨강

        // 화면 업데이트
        const priceEl = document.getElementById('coin-price');
        const statusEl = document.getElementById('connection-status');

        priceEl.innerText = formattedPrice;
        priceEl.style.color = color;
        
        // 상태바 텍스트 업데이트
        statusEl.innerHTML = `BTC/KRW <span style="color:${color}">${changeRate}%</span>`;
        statusEl.classList.remove('blink');
        statusEl.style.color = '#fff';

        // [연출] 10% 확률로 터미널에 로그 기록 (AI가 감지한 것처럼)
        if (Math.random() < 0.1) { 
            const signal = ticker.signed_change_price > 0 ? 'Bullish Signal' : 'Sell Pressure';
            const position = ticker.signed_change_price > 0 ? 'LONG' : 'SHORT';
            addPrecisionLog(position, currentPrice, changeRate, signal);
        }

    } catch (error) {
        console.error("API Error:", error);
        document.getElementById('connection-status').innerText = "CONNECTION LOST";
        document.getElementById('connection-status').style.color = "red";
    }
}

// [7] Latency 랜덤 업데이트 (연출용)
function startLatencyUpdate() {
    setInterval(() => {
        const ms = Math.floor(Math.random() * (15 - 8 + 1)) + 8; // 8~15ms
        document.getElementById('latency-val').innerText = ms + "ms";
    }, 2000);
}

// [8] 정밀 로그 찍는 함수
function addPrecisionLog(pos, price, profit, signal) {
    const terminal = document.getElementById('terminal');
    const time = new Date().toLocaleTimeString('ko-KR', {hour12: false});
    const colorClass = pos === 'LONG' ? 'pos-long' : 'pos-short';
    const profitColor = profit >= 0 ? '#0f0' : '#f00';
    
    const logRow = `
        <div class="log-line">
            <span style="color:#555;">[${time}]</span>
            <span class="${colorClass}">${pos}</span>
            <span style="color:#eee; text-align:right;">${Number(price).toLocaleString()}</span>
            <span style="color:#aaa;">${signal} <b style="color:${profitColor}">(${profit}%)</b></span>
        </div>`;
    
    terminal.insertAdjacentHTML('afterbegin', logRow);
}

// [9] 버튼 기능
function startAi() {
    addPrecisionLog('SYSTEM', 0, 0, 'Real-Time Data Stream Connected.');
    alert("AI TRADING STARTED with Real Market Data.");
}

function stopAi() {
    alert("EMERGENCY STOP EXECUTED.");
}
