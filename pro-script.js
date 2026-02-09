// [1] 업비트 API 주소 (비트코인)
const API_URL = 'https://api.upbit.com/v1/ticker?markets=KRW-BTC';

window.addEventListener('load', () => {
    
    // [2] header.html 파일 불러오기
    fetch('header.html')
        .then(response => {
            if (!response.ok) throw new Error("Header load failed");
            return response.text();
        })
        .then(data => {
            document.getElementById('internal-header-slot').innerHTML = data;
        })
        .catch(error => console.error('Error loading header:', error));

    // [3] 초기 메시지
    const statusText = document.getElementById('connection-status');
    statusText.innerText = "CONNECTING TO UPBIT...";
    statusText.style.color = 'orange';

    // [4] 1초마다 실시간 시세 갱신
    setInterval(fetchRealPrice, 1000);

    // [5] 레이턴시(지연시간) 연출
    startLatencyUpdate();
});

// [6] 실제 시세 가져오는 함수
async function fetchRealPrice() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        const ticker = data[0]; // 비트코인 정보

        const currentPrice = ticker.trade_price;
        const formattedPrice = currentPrice.toLocaleString();
        
        // 전일 대비 색상
        const changeRate = (ticker.signed_change_rate * 100).toFixed(2);
        let color = '#fff';
        if (ticker.signed_change_price > 0) color = '#0f0'; // 상승
        if (ticker.signed_change_price < 0) color = '#f00'; // 하락

        // 화면 업데이트
        const priceEl = document.getElementById('coin-price');
        const statusEl = document.getElementById('connection-status');

        priceEl.innerText = formattedPrice;
        priceEl.style.color = color;
        
        statusEl.innerHTML = `BTC/KRW <span style="color:${color}">${changeRate}%</span>`;
        statusEl.classList.remove('blink');
        statusEl.style.color = '#fff';

        // 10% 확률로 로그 기록 (연출)
        if (Math.random() < 0.1) { 
            const signal = ticker.signed_change_price > 0 ? 'Bullish Signal' : 'Sell Pressure';
            const position = ticker.signed_change_price > 0 ? 'LONG' : 'SHORT';
            addPrecisionLog(position, currentPrice, changeRate, signal);
        }

    } catch (error) {
        console.error("API Error:", error);
    }
}

// [7] 레이턴시 숫자 랜덤 변경
function startLatencyUpdate() {
    setInterval(() => {
        const ms = Math.floor(Math.random() * (15 - 8 + 1)) + 8; // 8~15ms
        document.getElementById('latency-val').innerText = ms + "ms";
    }, 2000);
}

// [8] 로그 찍는 함수
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

function startAi() { alert("AI TRADING STARTED."); }
function stopAi() { alert("STOPPED."); }
