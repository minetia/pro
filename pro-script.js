// 1. 상하단 인클루드 마법
window.addEventListener('load', () => {
    const fetchUI = (id, file) => {
        fetch(`https://minetia.github.io/${file}`)
            .then(res => res.text())
            .then(data => document.getElementById(id).innerHTML = data)
            .catch(err => console.error(`${file} 로드 실패`, err));
    };
    fetchUI('header-placeholder', 'header.html');
    fetchUI('nav-placeholder', 'nav.html');
});

// 2. 정밀 로그 생성 함수 (AI QUANT 스타일 접목)
function addPrecisionLog(pos, price, profit, signal) {
    const terminal = document.getElementById('terminal');
    const time = new Date().toLocaleTimeString('ko-KR', {hour12: false});
    
    const logRow = `
        <div class="log-line">
            <span class="log-time">[${time}]</span>
            <span class="${pos === 'LONG' ? 'pos-long' : 'pos-short'}">${pos}</span>
            <span style="color:#fff; text-align:right;">${Number(price).toLocaleString()}</span>
            <span style="color:#aaa;">${signal} <b style="color:${profit >= 0 ? '#0f0' : '#f00'}">(${profit}%)</b></span>
        </div>`;
    
    terminal.insertAdjacentHTML('afterbegin', logRow);
}

// 기존 startAi() 함수 내부에 예시 호출 추가
function startAi() {
    console.log("AI System Starting...");
    // 예시: 실시간 데이터 수신 시 호출
    addPrecisionLog('LONG', 104769000, 1.18, 'Whale movement detected');
}
