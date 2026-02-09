/* ai-real-script.js - (전문가용 AI 터미널 모드) */
const ROOT_URL = "https://minetia.github.io/";

let isAiRunning = false;
let currentPrice = 0;
let balance = 50000000; // 초기 자산 5천만원
let startBalance = 50000000;
let profit = 0;
let coinSymbol = "BTC";

// 분석 멘트 모음 (있어 보이는 말들)
const logMessages = [
    "Analyzing RSI(14) divergence...",
    "Checking Volume Oscillator...",
    "Bollinger Bands squeeze detected...",
    "MACD Golden Cross approaching...",
    "Scanning order book depth...",
    "Whale movement detected in wallet...",
    "Calculating Fibonacci retracement...",
    "Sentiment analysis: Bullish...",
    "Funding rate check: Positive..."
];

window.onload = async () => {
    await includeResources([
        { id: 'header-placeholder', file: 'header.html' },
        { id: 'nav-placeholder', file: 'nav.html' }
    ]);
    
    const params = new URLSearchParams(window.location.search);
    coinSymbol = params.get('coin') || 'BTC';
    const symbol = params.get('symbol') || 'BINANCE:BTCUSDT';

    // 차트 로드
    new TradingView.widget({ "container_id": "tv_chart", "symbol": symbol, "interval": "1", "theme": "dark", "autosize": true, "toolbar_bg": "#000", "hide_side_toolbar": true, "save_image": false });

    fetchRealPrice();
};

async function includeResources(targets) {
    const promises = targets.map(t => fetch(`${ROOT_URL}${t.file}`).then(r => r.text()).then(html => ({ id: t.id, html })));
    const results = await Promise.all(promises);
    results.forEach(res => { const el = document.getElementById(res.id); if(el) el.innerHTML = res.html; });
}

// 업비트 가격 실시간 조회
async function fetchRealPrice() {
    try {
        const res = await axios.get(`https://api.upbit.com/v1/ticker?markets=KRW-${coinSymbol}`);
        if(res.data && res.data.length > 0) {
            currentPrice = res.data[0].trade_price;
            document.getElementById('coin-price').innerText = currentPrice.toLocaleString() + " KRW";
        }
    } catch(e) {}
    setTimeout(fetchRealPrice, 500); // 0.5초마다 갱신 (빠름)
}

// 로그 출력 함수 (터미널 효과)
function log(msg, type="") {
    const terminal = document.getElementById('terminal');
    const anchor = document.getElementById('log-anchor');
    const now = new Date().toTimeString().split(' ')[0] + "." + Math.floor(Math.random()*999); // 밀리초까지 표시
    
    const div = document.createElement('div');
    div.className = 'log-line';
    
    let colorClass = 'log-info';
    if(type === 'BUY') colorClass = 'log-buy';
    if(type === 'SELL') colorClass = 'log-sell';
    if(type === 'SUCCESS') colorClass = 'log-success';

    div.innerHTML = `<span class="log-time">[${now}]</span> <span class="${colorClass}">${msg}</span>`;
    
    terminal.insertBefore(div, anchor); // 아래에 추가
    terminal.scrollTop = terminal.scrollHeight; // 자동 스크롤

    // 로그가 너무 많으면 위에서부터 삭제 (메모리 관리)
    if(terminal.children.length > 100) {
        terminal.removeChild(terminal.firstChild);
    }
}

// AI 실행
function startAi() {
    if(isAiRunning) return;
    isAiRunning = true;
    log("SYSTEM STARTED. AI AGENT ACTIVATED.", "SUCCESS");
    aiLoop();
}

function stopAi() {
    isAiRunning = false;
    log("SYSTEM HALTED BY USER.", "SELL");
}

// AI 메인 루프 (랜덤 분석 후 매매)
function aiLoop() {
    if(!isAiRunning) return;

    // 1. 랜덤하게 분석 로그 출력
    if(Math.random() > 0.3) {
        const msg = logMessages[Math.floor(Math.random() * logMessages.length)];
        log(msg);
    }

    // 2. 가끔 매매 발생 (10% 확률)
    if(Math.random() < 0.1) {
        executeAiTrade();
    }

    // 속도: 0.5초 ~ 1.5초 사이 랜덤 (빠르게)
    const nextTime = Math.random() * 1000 + 500;
    setTimeout(aiLoop, nextTime);
}

// 매매 실행 (가상)
function executeAiTrade() {
    const isBuy = Math.random() > 0.5;
    const type = isBuy ? "BUY" : "SELL";
    
    // 투자금 5천만원 기준
    const bet = 50000000;
    const fee = bet * 0.001; // 수수료 0.1%
    
    // 수익/손실 계산 (리얼리티)
    const percent = (Math.random() * 0.01) + 0.005; // 0.5% ~ 1.5%
    let tradeProfit = 0;
    
    // 승률 70% 설정
    const isWin = Math.random() < 0.7; 

    if(isWin) {
        tradeProfit = Math.floor(bet * percent) - fee;
        log(`[EXECUTE] ${type} Signal Confirmed! Price: ${currentPrice}`, type);
        setTimeout(() => {
            log(`[RESULT] Trade Closed. Profit: +${tradeProfit.toLocaleString()} KRW`, "SUCCESS");
            updateBalance(tradeProfit);
        }, 1000); // 1초 뒤 체결
    } else {
        tradeProfit = -Math.floor(bet * (percent * 0.5)) - fee; // 손실은 조금 작게
        log(`[EXECUTE] ${type} Signal Confirmed! Price: ${currentPrice}`, type);
        setTimeout(() => {
            log(`[RESULT] Stop Loss Triggered. Loss: ${tradeProfit.toLocaleString()} KRW`, "SELL");
            updateBalance(tradeProfit);
        }, 1000);
    }
}

function updateBalance(amount) {
    balance += amount;
    profit += amount;
    
    document.getElementById('real-balance').innerText = balance.toLocaleString();
    
    const profitEl = document.getElementById('real-profit');
    profitEl.innerText = (profit > 0 ? '+' : '') + profit.toLocaleString();
    profitEl.style.color = profit > 0 ? '#0f0' : '#f00';
}
