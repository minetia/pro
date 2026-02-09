// 초기 로드 시 연결 효과 시뮬레이션
window.addEventListener('load', () => {
    // 1. 헤더/네비 로드 (필요시 활성화, 현재는 슈퍼헤더가 대체함)
    
    // 2. 연결 상태 시뮬레이션
    const statusText = document.getElementById('connection-status');
    const priceText = document.getElementById('coin-price');
    const latencyVal = document.getElementById('latency-val');
    
    setTimeout(() => {
        statusText.style.color = 'orange';
        statusText.innerText = "SYNCING NODE...";
    }, 1000);

    setTimeout(() => {
        statusText.style.color = '#0f0';
        statusText.classList.remove('blink');
        statusText.innerText = "● SYSTEM ONLINE";
        
        // 가격 표시 시작
        priceText.innerText = "104,769,000";
        startLatencyUpdate();
    }, 2500);
});

// Latency 랜덤 업데이트 (생동감 부여)
function startLatencyUpdate() {
    setInterval(() => {
        const ms = Math.floor(Math.random() * (15 - 8 + 1)) + 8; // 8~15ms
        document.getElementById('latency-val').innerText = ms + "ms";
    }, 2000);
}

// 정밀 로그 시스템
function addPrecisionLog(pos, price, profit, signal) {
    const terminal = document.getElementById('terminal');
    const time = new Date().toLocaleTimeString('ko-KR', {hour12: false});
    
    const logRow = `
        <div class="log-line">
            <span style="color:#555;">[${time}]</span>
            <span class="${pos === 'LONG' ? 'pos-long' : 'pos-short'}">${pos}</span>
            <span style="color:#eee; text-align:right;">${Number(price).toLocaleString()}</span>
            <span style="color:#aaa;">${signal} <b style="color:${profit >= 0 ? '#0f0' : '#f00'}">(${profit}%)</b></span>
        </div>`;
    
    terminal.insertAdjacentHTML('afterbegin', logRow);
}

// 시스템 시작
function startAi() {
    addPrecisionLog('SYSTEM', 0, 0, 'Data Collection Module Activated.');
    setTimeout(() => {
        addPrecisionLog('LONG', 104820000, 0.45, 'Pattern Matched: Golden Cross');
    }, 1000);
}

function stopAi() {
    alert("SYSTEM HALTED.");
}
