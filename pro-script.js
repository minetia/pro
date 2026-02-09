window.addEventListener('load', () => {
    
    // [NEW] 자체 헤더 파일(header.html) 연동
    fetch('header.html')
        .then(response => {
            if (!response.ok) throw new Error("Header load failed");
            return response.text();
        })
        .then(data => {
            document.getElementById('internal-header-slot').innerHTML = data;
        })
        .catch(error => console.error('Error loading header:', error));

    // 연결 상태 시뮬레이션
    const statusText = document.getElementById('connection-status');
    const priceText = document.getElementById('coin-price');
    
    setTimeout(() => {
        statusText.style.color = 'orange';
        statusText.innerText = "SYNCING NODE...";
    }, 1000);

    setTimeout(() => {
        statusText.style.color = '#0f0';
        statusText.classList.remove('blink');
        statusText.innerText = "● SYSTEM ONLINE";
        priceText.innerText = "104,769,000";
        startLatencyUpdate();
    }, 2500);
});

// Latency 랜덤 업데이트
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
