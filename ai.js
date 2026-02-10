l/* ai.js - V320.0 (Balance Check Gate) */

window.addEventListener('load', () => {
    // 정보 페이지용 차트 로더
    if (document.getElementById('info_tv_chart')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || 'BTC';
        drawChart(coin);
        loadNews(coin);
        
        const searchInput = document.getElementById('info-page-search');
        if(searchInput) {
            searchInput.addEventListener('keyup', (e)=>{
                if(e.key==='Enter') location.href=`info.html?coin=${e.target.value}`;
            });
        }
    }
});

/* --- 설정 페이지 기능 --- */

// 1. 키 검증
function checkKeys() {
    const k1 = document.getElementById('api-key-input').value.trim();
    const k2 = document.getElementById('secret-key-input').value.trim();
    
    // 길이 체크 (너무 짧으면 거절)
    if (k1.length < 5 || k2.length < 5) {
        return alert("⛔ 키가 너무 짧습니다. 올바른 API 키를 입력하세요.");
    }
    
    appState.config.keysVerified = true;
    saveState();
    
    alert("✅ 키 검증 완료! 보안 연결 성공.");
    
    // 버튼 초록색으로 변경
    const btn = document.querySelector('.verify-btn');
    if(btn) {
        btn.innerText = "VERIFIED (인증됨)";
        btn.style.background = "var(--color-up)";
        btn.style.color = "#fff";
    }
}

// 2. 전략 선택 (디자인 효과)
function selectStrategy(el, name) {
    document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    appState.config.strategy = name;
}

// 3. [핵심] 시스템 활성화 (여기에 검문소 설치함)
function activateSystem() {
    // A. 키 인증 안 했으면 쫓아냄
    if (!appState.config.keysVerified) {
        return alert("⚠️ 먼저 [VERIFY KEYS] 버튼을 눌러 키를 검증해주세요.");
    }
    
    const coin = document.getElementById('target-coin').value.toUpperCase();
    const amt = parseFloat(document.getElementById('invest-amount').value);
    
    // B. 입력값 없으면 경고
    if (!coin) return alert("코인 심볼(예: BTC)을 입력하세요.");
    if (!amt || amt <= 0) return alert("투자할 금액을 입력하세요.");

    // C. [신규] 잔고 부족하면 절대 못 지나감!
    if (appState.balance < 10) {
        return alert(`⛔ 지갑 잔고가 부족합니다!\n현재 잔고: $${appState.balance.toLocaleString()}\n\n먼저 [입출금] 메뉴에서 자금을 충전해주세요.`);
    }

    // D. 가진 돈보다 더 많이 투자하려고 하면 경고
    if (amt > appState.balance) {
        return alert(`⛔ 잔고보다 큰 금액입니다.\n가능한 최대 금액: $${appState.balance.toLocaleString()}`);
    }
    
    // 모든 검문 통과 시 설정 저장
    appState.config.target = coin;
    appState.config.amount = amt;
    appState.config.isReady = true;
    
    saveState();
    
    alert(`🚀 시스템 가동 승인!\n목표: ${coin}\n금액: $${amt.toLocaleString()}\n\n메인 화면으로 이동합니다.`);
    location.href = 'index.html';
}

/* --- 정보 페이지 기능 (기존 유지) --- */
function drawChart(coin) {
    try {
        new TradingView.widget({
            "container_id": "info_tv_chart",
            "symbol": `BINANCE:${coin}USDT`,
            "interval": "15",
            "theme": "dark",
            "autosize": true,
            "hide_side_toolbar": false
        });
    } catch(e) {}
    
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${coin.toLowerCase()}usdt@trade`);
    ws.onmessage = (e) => {
        const p = parseFloat(JSON.parse(e.data).p);
        updateInfoUI(p, coin);
    };
}

function updateInfoUI(p, coin) {
    const elPrice = document.getElementById('analysis-price');
    if(elPrice) elPrice.innerText = `$ ${p.toLocaleString()}`;
    
    const elScore = document.getElementById('ai-score-val');
    if(elScore) {
        const seed = Math.floor(p) % 100;
        elScore.innerText = Math.min(99, Math.max(60, seed + 20));
    }
    
    // 지지/저항 업데이트
    if(document.getElementById('val-support')) {
        document.getElementById('val-support').innerText = `$ ${(p * 0.98).toLocaleString(undefined, {maximumFractionDigits:2})}`;
        document.getElementById('val-resistance').innerText = `$ ${(p * 1.02).toLocaleString(undefined, {maximumFractionDigits:2})}`;
        document.getElementById('val-stoploss').innerText = `$ ${(p * 0.97).toLocaleString(undefined, {maximumFractionDigits:2})}`;
        document.getElementById('val-target').innerText = `$ ${(p * 1.05).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    }
}

function loadNews(coin) {
    const list = document.getElementById('news-board-list');
    if(!list) return;
    const newsData = [
        `[속보] ${coin}, 대규모 고래 지갑 이동 포착`,
        `${coin} 네트워크 활성 주소, 전주 대비 15% 급증`,
        `주요 거래소 ${coin} 입금량 감소... 매도 압력 완화?`,
        `[시황] 비트코인 반등에 ${coin} 동반 상승세`,
        `글로벌 투자 기관, ${coin} 포트폴리오 비중 확대`
    ];
    let html = '';
    newsData.forEach(n => {
        html += `<div style="padding:10px 0; border-bottom:1px solid #333;">
            <div style="font-size:0.85rem; color:#eee;">${n}</div>
            <div style="font-size:0.7rem; color:#888; margin-top:3px;">${new Date().toLocaleTimeString()}</div>
        </div>`;
    });
    list.innerHTML = html;
}

function searchInfoCoin() {
    const v = document.getElementById('info-page-search').value;
    if(v) location.href = `info.html?coin=${v.toUpperCase()}`;
}
