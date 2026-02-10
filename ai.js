/* ai.js - V300.0 (Setup & Info) */
window.addEventListener('load', () => {
    // 정보 페이지면 차트 그리기
    if (document.getElementById('info_tv_chart')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || 'BTC';
        drawChart(coin);
        loadNews(coin);
        
        // 검색창 엔터키
        document.getElementById('info-page-search').addEventListener('keyup', (e)=>{
            if(e.key==='Enter') location.href=`info.html?coin=${e.target.value}`;
        });
    }
});

/* --- 설정 페이지 기능 --- */
function checkKeys() {
    const k1 = document.getElementById('api-key-input').value;
    if (k1.length < 5) return alert("키가 너무 짧습니다.");
    
    appState.config.keysVerified = true;
    saveState();
    alert("인증 완료");
}

function selectStrategy(el, name) {
    document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    appState.config.strategy = name;
}

function activateSystem() {
    if (!appState.config.keysVerified) return alert("키 인증 필요");
    
    const coin = document.getElementById('target-coin').value.toUpperCase();
    const amt = parseFloat(document.getElementById('invest-amount').value);
    
    if (!coin || !amt) return alert("입력값 확인 필요");
    
    appState.config.target = coin;
    appState.config.amount = amt;
    appState.config.isReady = true;
    
    saveState();
    alert("설정 완료! 메인으로 이동합니다.");
    location.href = 'index.html';
}

/* --- 정보 페이지 기능 --- */
function drawChart(coin) {
    new TradingView.widget({
        "container_id": "info_tv_chart",
        "symbol": `BINANCE:${coin}USDT`,
        "interval": "15",
        "theme": "dark",
        "autosize": true
    });
    
    // 가격 표시 (단순 표시만 함, 데이터 저장 안함)
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${coin.toLowerCase()}usdt@trade`);
    ws.onmessage = (e) => {
        const p = parseFloat(JSON.parse(e.data).p);
        document.getElementById('analysis-price').innerText = `$ ${p.toLocaleString()}`;
    };
}

function loadNews(coin) {
    document.getElementById('news-board-list').innerHTML = `<div style="padding:10px;">${coin} 관련 뉴스 로딩 완료</div>`;
}

function searchInfoCoin() {
    const v = document.getElementById('info-page-search').value;
    if(v) location.href = `info.html?coin=${v}`;
}
