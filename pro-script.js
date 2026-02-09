/* pro-script.js - 데이터 동기화 및 백그라운드 엔진 */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;

// [전역 상태] 모든 페이지가 공유하는 데이터
let appState = {
    balance: 50000.00,       // 현재 자산
    startBalance: 50000.00,  // 원금
    tradeHistory: [],        // 매매 기록
    logs: [],                // 시스템 로그
    lastLogin: Date.now()    // 마지막 접속 시간
};

// 페이지 로드 시 실행
window.addEventListener('load', () => {
    loadState();             // 1. 데이터 불러오기
    simulateOfflineTrading();// 2. 부재중 매매 계산 (앱 껐다 켰을 때)
    
    // 헤더 메뉴 로드
    fetch('header.html').then(res => res.text()).then(data => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) slot.innerHTML = data;
        highlightMenu();
    });

    // 페이지별 기능 분기
    if (document.getElementById('tv_chart')) {
        // 메인 화면일 때
        initWebSocket();
        startLatencyUpdate();
        updateLogDisplay();
    } else if (document.getElementById('history-body')) {
        // 지갑 화면일 때
        renderWalletPage();
        startLiveAssetEffect();
    }

    // 1초마다 자동 저장
    setInterval(saveState, 1000);
});

// [1] 데이터 저장/로드 (LocalStorage)
function saveState() {
    appState.lastLogin = Date.now();
    localStorage.setItem('neuroBotData', JSON.stringify(appState));
}

function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) {
        appState = JSON.parse(data);
    } else {
        generateInitialData(); // 데이터 없으면 초기화
    }
}

// [2] 부재중 매매 시뮬레이션 (폰 꺼진 동안 수익 창출)
function simulateOfflineTrading() {
    const now = Date.now();
    const diffMins = Math.floor((now - appState.lastLogin) / 60000);

    if (diffMins > 1) { // 1분 이상 비웠다면
        const trades = Math.min(diffMins, 50); // 최대 50회 매매 가정
        let offlineProfit = 0;
        
        for(let i=0; i<trades; i++) {
            const isWin = Math.random() > 0.45; // 승률 55%
            const profit = (Math.random() * 50) + 10;
            const sign = isWin ? 1 : -1;
            const amount = parseFloat((profit * sign).toFixed(2));
            
            offlineProfit += amount;
            
            // 기록 추가 (과거 시간으로)
            const tradeTime = new Date(now - ((trades - i) * 60000));
            appState.tradeHistory.unshift({
                date: `${tradeTime.getMonth()+1}/${tradeTime.getDate()}`,
                time: tradeTime.toLocaleTimeString('en-US', {hour12:false}),
                pos: Math.random()>0.5 ? 'LONG' : 'SHORT',
                in: 60000 + (Math.random()*5000),
                out: 60000 + (Math.random()*5000),
                profit: amount,
                win: isWin
            });
        }
        appState.balance += offlineProfit;
        addSystemLog('SYSTEM', `Background Task: ${trades} trades, Profit: $${offlineProfit.toFixed(2)}`);
        saveState();
    }
}

// [3] 바이낸스 웹소켓 (메인 화면용)
function initWebSocket() {
    socket = new WebSocket(BINANCE_WS_URL);
    socket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const price = parseFloat(data.p);
        const isBuy = !data.m;
        updateDashboard(price, isBuy);
    };
    socket.onclose = () => setTimeout(initWebSocket, 2000);
}

function updateDashboard(price, isBuy) {
    const priceEl = document.getElementById('coin-price');
    if(priceEl) {
        priceEl.innerText = price.toLocaleString(undefined, {minimumFractionDigits:2});
        priceEl.style.color = isBuy ? '#00ff88' : '#ff3344';
    }

    // 자산 실시간 변동 연출
    const noise = (Math.random() - 0.5) * 5;
    const currentBal = appState.balance + noise;
    const totalProfit = currentBal - appState.startBalance;

    const balEl = document.getElementById('real-balance');
    if(balEl) balEl.innerText = currentBal.toLocaleString(undefined, {minimumFractionDigits:2});

    const profEl = document.getElementById('real-profit');
    if(profEl) {
        const sign = totalProfit >= 0 ? '+' : '';
        profEl.innerText = `${sign}${totalProfit.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        profEl.className = `value num-font ${totalProfit>=0 ? 'text-green' : 'text-red'}`;
    }

    // 랜덤 로그 생성
    if(Math.random() < 0.05) {
        addSystemLog(isBuy?'LONG':'SHORT', `Price ${price.toFixed(1)} - Signal Executed`);
    }
}

// [4] 로그 시스템
function addSystemLog(type, msg) {
    const time = new Date().toLocaleTimeString('en-US', {hour12:false});
    appState.logs.unshift({time, type, msg});
    if(appState.logs.length > 1000) appState.logs.pop();
    updateLogDisplay();
}

function updateLogDisplay() {
    const terminal = document.getElementById('terminal');
    const counter = document.getElementById('log-count-display');
    
    if(counter) counter.innerText = appState.logs.length;
    
    if(terminal) {
        // 최신 로그 1개만 추가 (성능 최적화)
        const log = appState.logs[0];
        if(!log) return;
        
        const color = log.type==='LONG'?'pos-long':(log.type==='SHORT'?'pos-short':'log-sys');
        const row = `<div class="log-line"><span style="color:#666">[${log.time}]</span> <span class="${color}">${log.type}</span> ${log.msg}</div>`;
        terminal.insertAdjacentHTML('afterbegin', row);
        if(terminal.children.length > 50) terminal.removeChild(terminal.lastChild);
    }
}

// [5] 엑셀 저장 (위치 선택 시도 -> 실패시 다운로드)
async function exportLogs() {
    if(appState.logs.length === 0) return alert("No logs.");
    let csv = "Time,Type,Message\n";
    appState.logs.forEach(l => csv += `${l.time},${l.type},${l.msg}\n`);

    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: `NEURO_LOG_${Date.now()}.csv`,
            types: [{ description: 'CSV File', accept: {'text/csv': ['.csv']} }],
        });
        const writable = await handle.createWritable();
        await writable.write(csv);
        await writable.close();
        alert("SAVED SUCCESSFULLY.");
    } catch (e) {
        // 모바일 등 미지원 시
        const blob = new Blob([csv], {type:'text/csv'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `NEURO_LOG_BACKUP.csv`;
        link.click();
    }
}

// [6] 지갑 페이지 로직
function renderWalletPage() {
    // 자산 표시
    document.getElementById('total-val').innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    // 승률 계산
    const wins = appState.tradeHistory.filter(t => t.win).length;
    const total = appState.tradeHistory.length;
    const rate = total===0 ? 0 : Math.round((wins/total)*100);
    document.getElementById('win-rate-display').innerHTML = `WIN RATE: <span style="color:#fff">${rate}%</span> (${wins}W ${total-wins}L)`;

    // 히스토리 리스트 (최신 10개)
    const tbody = document.getElementById('history-body');
    let html = '';
    appState.tradeHistory.slice(0, 10).forEach(t => {
        const sign = t.profit >= 0 ? '+' : '';
        const color = t.profit >= 0 ? 'text-green' : 'text-red';
        html += `
            <tr>
                <td class="num-font" style="font-size:0.75rem; color:#666;">${t.date}<br>${t.time}</td>
                <td style="font-weight:bold;" class="${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</td>
                <td class="num-font" style="font-size:0.8rem;">IN: ${t.in.toFixed(0)}<br>OUT: ${t.out.toFixed(0)}</td>
                <td style="text-align:right;" class="num-font ${color}">
                    <div style="font-weight:bold;">${sign}$${t.profit.toFixed(2)}</div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// 입출금 처리
function processTransaction(amount) {
    if(!amount) return;
    appState.balance += amount;
    if(amount > 0) appState.startBalance += amount; // 입금시 원금 증가
    addSystemLog('SYSTEM', `${amount>0?'Deposit':'Withdrawal'} $${Math.abs(amount)}`);
    saveState();
    renderWalletPage();
    closeModal();
}

// 유틸
function startLiveEffect() {
    setInterval(() => {
        const noise = (Math.random() - 0.5) * 5;
        const val = appState.balance + noise;
        const el = document.getElementById('total-val');
        if(el) el.innerText = `$ ${val.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    }, 1000);
}

function startLatencyUpdate() {
    setInterval(() => {
        const ms = Math.floor(Math.random()*30)+10;
        document.getElementById('latency-val').innerText = ms + "ms";
    }, 2000);
}

function generateInitialData() {
    appState.tradeHistory = [];
    for(let i=0; i<10; i++) {
        appState.tradeHistory.push({
            date: '2/10', time: '12:00', pos: 'LONG', in: 50000, out: 50100, profit: 100, win: true
        });
    }
    saveState();
}

function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active');
        else el.classList.remove('active');
    });
}

// 모달 관련
function openModal(type) {
    const modal = document.getElementById('transaction-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-action-btn').onclick = () => {
        const val = parseFloat(document.getElementById('amount-input').value);
        if(type === 'withdraw') processTransaction(-val);
        else processTransaction(val);
    };
}
function closeModal() {
    document.getElementById('transaction-modal').style.display = 'none';
}
