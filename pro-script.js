[span_7](start_span)// 1. 외부 UI 로드 (헤더/네비 고정 호출)[span_7](end_span)
window.addEventListener('load', () => {
    const loadComponent = (id, file) => {
        fetch(`https://minetia.github.io/${file}`)
            .then(res => res.text())
            .then(data => document.getElementById(id).innerHTML = data)
            .catch(err => console.error("컴포넌트 로드 실패:", err));
    };
    loadComponent('header-placeholder', 'header.html');
    loadComponent('nav-placeholder', 'nav.html');
});

[span_8](start_span)// 2. AI QUANT 정밀 로그 시스템[span_8](end_span)
function addPrecisionLog(pos, price, profit, signal) {
    const terminal = document.getElementById('terminal');
    const time = new Date().toLocaleTimeString('ko-KR', {hour12: false});
    
    const logRow = `
        <div class="log-line">
            <span style="color:#444;">[${time}]</span>
            <span class="${pos === 'LONG' ? 'pos-long' : 'pos-short'}">${pos}</span>
            <span style="color:#fff; text-align:right;">${Number(price).toLocaleString()}</span>
            <span style="color:#aaa;">${signal} <b style="color:${profit >= 0 ? '#0f0' : '#f00'}">(${profit}%)</b></span>
        </div>`;
    
    terminal.insertAdjacentHTML('afterbegin', logRow); [span_9](start_span)// 최신 정보 상단 배치[span_9](end_span)
}

// 3. 시스템 제어 함수
function startAi() {
    console.log("AI PRO MODE Activated.");
    // 샘플 데이터 실행 (정밀도 확인용)
    addPrecisionLog('SHORT', 12931, 1.10, 'Sentiment analysis: Bearish');
}

function stopAi() {
    alert("EMERGENCY STOP EXECUTED.");
}
