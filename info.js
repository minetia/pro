// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    // 1. 기본 비트코인(BTCUSDT)으로 시작
    startInsight('BTCUSDT'); 

    // 2. 검색 버튼(이동) 기능 연결
    var searchBtn = document.querySelector('.search-btn') || document.getElementById('search-btn') || document.querySelector('button');
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            var input = document.querySelector('input[type="text"]');
            if (input && input.value) {
                var symbol = input.value.toUpperCase();
                if (!symbol.includes('USDT')) symbol += 'USDT'; // USDT 자동 붙임
                startInsight(symbol);
            }
        });
    }
});

// 전역 변수들
var wsInsight = null;
var priceHistory = []; 
var currentSymbol = "BTCUSDT";

// [핵심] 바이낸스 연결 및 분석 시작
function startInsight(symbol) {
    currentSymbol = symbol;
    priceHistory = []; // 차트 데이터 초기화

    // 1. 기존 연결 끊기
    if (wsInsight) wsInsight.close();

    // 2. 화면 초기화 (로딩 표시)
    updatePriceUI("Loading...", "#F0B90B");
    updateStatus("데이터 수신 중...", "#F0B90B");

    // 3. 바이낸스 웹소켓 연결
    var url = "wss://stream.binance.com:9443/ws/" + symbol.toLowerCase() + "@trade";
    wsInsight = new WebSocket(url);

    wsInsight.onopen = function() {
        console.log("[Insight] 연결 성공: " + symbol);
    };

    wsInsight.onmessage = function(event) {
        var data = JSON.parse(event.data);
        var price = parseFloat(data.p);

        // 4. 화면 업데이트
        updatePriceUI(price);
        
        // 5. 차트 데이터 쌓기 (최대 50개)
        priceHistory.push(price);
        if (priceHistory.length > 50) priceHistory.shift();
        
        // 6. 차트 및 AI 분석 실행
        drawSimpleChart(); 
        analyzeMarket(price);
    };

    wsInsight.onerror = function() {
        updatePriceUI("Error", "red");
        updateStatus("종목을 찾을 수 없습니다.", "red");
    };
}

// [화면] 가격 표시 (큰 글씨)
function updatePriceUI(price, colorOverride) {
    // 화면에서 가장 큰 숫자($ ---)를 찾음
    var elPrice = document.querySelector('.hero-number') || document.querySelector('h1') || document.getElementById('insight-price');
    
    if (elPrice) {
        if (typeof price === 'string') {
            elPrice.innerText = price;
            if (colorOverride) elPrice.style.color = colorOverride;
        } else {
            elPrice.innerText = '$ ' + price.toLocaleString(undefined, {minimumFractionDigits: 2});
            
            // 전보다 올랐으면 초록, 내렸으면 빨강
            if (window.lastInsightPrice && price > window.lastInsightPrice) elPrice.style.color = '#0ecb81';
            else if (window.lastInsightPrice && price < window.lastInsightPrice) elPrice.style.color = '#f6465d';
            
            window.lastInsightPrice = price;
        }
    }
}

// [차트] 캔버스에 선 그리기 (검은 박스 안)
function drawSimpleChart() {
    // 차트 그릴 공간 찾기 (검은 박스)
    var container = document.querySelector('.chart-box') || document.getElementById('chart-container') || document.querySelector('.card');
    
    // 캔버스 없으면 만들기
    var canvas = document.getElementById('insight-chart');
    if (!canvas && container) {
        canvas = document.createElement('canvas');
        canvas.id = 'insight-chart';
        canvas.style.width = '100%';
        canvas.style.height = '200px'; // 높이 강제 지정
        container.appendChild(canvas);
    }
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.clientWidth;
    var h = canvas.height = canvas.clientHeight;

    // 초기화
    ctx.clearRect(0, 0, w, h);
    
    // 데이터가 2개 이상일 때만 그림
    if (priceHistory.length < 2) return;

    var min = Math.min(...priceHistory);
    var max = Math.max(...priceHistory);
    var range = max - min;
    if (range === 0) range = 1;

    // 선 스타일
    ctx.beginPath();
    ctx.strokeStyle = '#0ecb81'; 
    ctx.lineWidth = 2;

    // 선 잇기
    priceHistory.forEach((p, i) => {
        var x = (i / (priceHistory.length - 1)) * w;
        var y = h - ((p - min) / range) * (h - 20) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

// [AI] 가상 분석 로직 (점수 매기기)
function analyzeMarket(price) {
    // 점수 표시할 곳 찾기
    var elScore = document.getElementById('ai-score') || document.querySelector('.score-text');
    var elStatus = document.getElementById('analysis-text') || document.querySelector('.status-text');

    // 시뮬레이션: 가격의 끝자리를 이용해서 랜덤하게 점수 생성
    var lastDigit = Math.floor(price * 100) % 100; 
    var score = 40 + (lastDigit % 60); // 40 ~ 99점

    if (elScore) elScore.innerText = score + ' / 100';

    if (elStatus) {
        var msg = "관망 (Neutral)";
        var color = "#fff";
        
        if (score >= 80) { msg = "강력 매수 (Strong Buy)"; color = "#0ecb81"; }
        else if (score >= 60) { msg = "매수 우위 (Buy)"; color = "#0ecb81"; }
        else if (score <= 40) { msg = "매도 우위 (Sell)"; color = "#f6465d"; }

        elStatus.innerText = msg;
        elStatus.style.color = color;
    }
}
