// [초기화] 페이지 로드 시 실행
window.addEventListener('load', function() {
    startInsight('BTCUSDT'); // 기본: 비트코인
    
    // 검색 버튼 이벤트 연결
    var btn = document.getElementById('search-btn');
    if(btn) {
        btn.addEventListener('click', function() {
            var input = document.getElementById('coin-input');
            if(input && input.value) {
                var symbol = input.value.toUpperCase() + 'USDT';
                startInsight(symbol);
            }
        });
    }
});

// 전역 변수
var ws = null;
var priceHistory = []; // 차트용 데이터
var currentSymbol = "";

// [핵심] 바이낸스 연결 및 AI 분석 시작
function startInsight(symbol) {
    currentSymbol = symbol;
    
    // 1. 기존 연결 끊기
    if (ws) ws.close();
    priceHistory = []; // 차트 초기화

    // 2. 바이낸스 웹소켓 연결
    var url = "wss://stream.binance.com:9443/ws/" + symbol.toLowerCase() + "@trade";
    ws = new WebSocket(url);

    ws.onopen = function() {
        console.log("Insight 연결 성공: " + symbol);
        updateStatus("데이터 수신 중...", "#F0B90B");
    };

    ws.onmessage = function(event) {
        var data = JSON.parse(event.data);
        var price = parseFloat(data.p);

        // 3. 화면 업데이트
        updateInfoUI(price);
        
        // 4. 차트 데이터 쌓기 (최대 100개)
        priceHistory.push(price);
        if(priceHistory.length > 100) priceHistory.shift();
        drawInsightChart();

        // 5. AI 분석 시뮬레이션 (가격 변동에 따라 점수 변경)
        analyzeMarket(price);
    };

    ws.onerror = function() {
        updateStatus("종목을 찾을 수 없습니다.", "red");
    };
}

// [UI] 가격 및 텍스트 표시
function updateInfoUI(price) {
    // 가격 표시 (ID가 insight-price 라고 가정)
    var elPrice = document.querySelector('.hero-number') || document.getElementById('insight-price');
    if (elPrice) {
        elPrice.innerText = '$ ' + price.toLocaleString(undefined, {minimumFractionDigits: 2});
        
        // 색상 변경 (상승/하락)
        if(window.lastInfoPrice && price > window.lastInfoPrice) elPrice.style.color = '#0ecb81';
        else if(window.lastInfoPrice && price < window.lastInfoPrice) elPrice.style.color = '#f6465d';
        
        window.lastInfoPrice = price;
    }
}

// [차트] 캔버스에 라인 차트 그리기
function drawInsightChart() {
    // 검은색 박스 안에 canvas가 있어야 합니다.
    // HTML에 <canvas id="insight-chart"></canvas> 가 있다고 가정하거나, 없으면 찾아봅니다.
    var container = document.querySelector('.chart-box') || document.getElementById('chart-container'); 
    var canvas = document.getElementById('insight-chart');

    // 캔버스가 없으면 코드에서 강제로 만듭니다 (자동 복구)
    if (!canvas && container) {
        canvas = document.createElement('canvas');
        canvas.id = 'insight-chart';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);
    }
    
    if (!canvas) return; // 그릴 곳이 없으면 포기

    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.clientWidth; // 크기 맞춤
    var h = canvas.height = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);
    
    // 선 스타일
    ctx.beginPath();
    ctx.strokeStyle = '#0ecb81'; // 초록색 차트
    ctx.lineWidth = 2;

    // 데이터가 너무 적으면 그리지 않음
    if (priceHistory.length < 2) return;

    // Y축 범위 계산 (최대값, 최소값)
    var min = Math.min(...priceHistory);
    var max = Math.max(...priceHistory);
    var range = max - min;
    if (range === 0) range = 1;

    // 선 잇기
    priceHistory.forEach((p, i) => {
        var x = (i / (priceHistory.length - 1)) * w;
        var y = h - ((p - min) / range) * (h - 20) - 10; // 여백 10px
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // 그라데이션 채우기
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = 'rgba(14, 203, 129, 0.1)';
    ctx.fill();
}

// [AI] 가상 분석 로직
function analyzeMarket(price) {
    // 점수 표시 (ID가 ai-score 라고 가정)
    var elScore = document.querySelector('.score-text') || document.getElementById('ai-score');
    var elStatus = document.querySelector('.status-text') || document.getElementById('analysis-text');

    if (!elScore) return;

    // 가격의 끝자리를 이용해서 랜덤하게 점수 생성 (시뮬레이션)
    // 실제로는 복잡한 RSI 등의 지표가 필요하지만, 여기선 연출용
    var lastDigit = Math.floor(price * 100) % 100; 
    var score = 40 + (lastDigit % 60); // 40 ~ 99점 사이 왔다갔다

    elScore.innerText = score + ' / 100';

    // 점수에 따른 멘트
    var msg = "관망 (Neutral)";
    var color = "#fff";
    
    if (score >= 80) { msg = "강력 매수 (Strong Buy)"; color = "#0ecb81"; }
    else if (score >= 60) { msg = "매수 우위 (Buy)"; color = "#0ecb81"; }
    else if (score <= 40) { msg = "매도 우위 (Sell)"; color = "#f6465d"; }

    if (elStatus) {
        elStatus.innerText = msg;
        elStatus.style.color = color;
    }
}

function updateStatus(msg, color) {
    var el = document.querySelector('.status-text') || document.getElementById('analysis-text');
    if(el) {
        el.innerText = msg;
        if(color) el.style.color = color;
    }
}
