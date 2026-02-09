/* pro-script.js - 데이터 동기화 및 백그라운드 시뮬레이션 엔진 */

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;

// [전역 상태 관리] - 모든 페이지가 이 데이터를 공유합니다.
let appState = {
    balance: 50000.00,       // 총 자산 (USDT)
    startBalance: 50000.00,  // 시작 자산 (수익률 계산용)
    holdings: 0.5,           // 보유 BTC 양
    tradeHistory: [],        // 매매 기록 배열
    logs: [],                // 시스템 로그 배열
    lastLogin: Date.now()    // 마지막 접속 시간
};

// 페이지 로드 시 실행
window.addEventListener('load', () => {
    loadState(); // 1. 저장된 데이터 불러오기
    simulateOfflineTrading(); // 2. 부재중 매매 시뮬레이션 (폰 꺼진 동안의 효과)
    
    // 헤더 로드
    fetch('header.html').then(res => res.text()).then(data => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) {
            slot.innerHTML = data;
            highlightMenu();
        }
    });

    // 페이지별 기능 분기
    if (document.getElementById('tv_chart')) {
        // 메인 대시보드라면 웹소켓 연결
        initWebSocket();
        startLatencyUpdate();
        updateLogCounter();
    } else if (document.getElementById('history-body')) {
        // 지갑 페이지라면 히스토리 렌더링
        renderWalletPage();
    }

    // 1초마다 상태 저장 (데이터 유실 방지)
    setInterval(saveState, 1000);
});

// [1] 데이터 저장/불러오기 (localStorage 사용)
function saveState() {
    appState.lastLogin = Date.now();
    localStorage.setItem('neuroBotData', JSON.stringify(appState));
}

function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) {
        appState = JSON.parse(data);
    } else {
        // 처음 실행 시 기본 데이터 생성
        generateInitialData(); 
    }
    updateGlobalUI();
}

// [2] 부재중 매매 시뮬레이션 (폰 껐다 켰을 때)
function simulateOfflineTrading() {
    const now = Date.now();
    const diff = now - appState.lastLogin;
    const minutesPassed = Math.floor(diff / 1000 / 60);

    if (minutesPassed > 5) { // 5분 이상 자리를 비웠다면
        console.log(`[SYSTEM] ${minutesPassed}분 동안 부재중. 시뮬레이션 가동.`);
        const tradesToSimulate = Math.min(minutesPassed, 50); // 최대 50개 매매 생성
        
        for(let i=0; i<tradesToSimulate; i++) {
            const isWin = Math.random() > 0.4; // 60% 승률
            const profit = (Math.random() * 50) + 10;
            const sign = isWin ? 1 : -1;
            const amount = parseFloat((profit * sign).toFixed(2));
            
            appState.balance += amount;
            
            // 기록 추가
            appState.tradeHistory.unshift({
                time: new Date(now - (i * 60000)).toLocaleTimeString(),
                date: new Date().toLocaleDateString(),
                pos: Math.random() > 0.5 ? 'LONG' : 'SHORT',
                in: 60000 + (Math.random() * 5000),
                out: 60000 + (Math.random() * 5000),
                profit: amount,
                win: isWin
            });
        }
        // 로그 추가
        addSystemLog('SYSTEM', `Background Protocol completed. ${tradesToSimulate} trades executed.`);
        saveState();
        updateGlobalUI();
    }
}

// [3] 바이낸스 웹소켓 (실시간 가격)
function initWebSocket() {
    socket = new WebSocket(BINANCE_WS_URL);
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const currentPrice = parseFloat(data.p);
        const isBuyerMaker = data.m; // 매수/매도 구분
        
        updateDashboard(currentPrice, !isBuyerMaker);
    };
    socket.onclose = () => setTimeout(initWebSocket, 3000);
}

// [4] 메인 대시보드 UI 업데이트
function updateDashboard(price, isBuy) {
    // 가격 표시
    const priceEl = document.getElementById('coin-price');
    if(priceEl) {
        priceEl.innerText = price.toLocaleString(undefined, {minimumFractionDigits: 2});
        priceEl.style.color = isBuy ? '#00ff88' : '#ff3344';
    }

    // 실시간 자산 변동 연출 (비트코인 가격 따라 내 자산도 흔들림)
    const fluctuation = (Math.random() - 0.5) * 5; 
    const liveBalance = appState.balance + fluctuation;
    
    // 수익금 계산
    const totalProfit = liveBalance - appState.startBalance;
    
    const balEl = document.getElementById('real-balance');
    if(balEl) balEl.innerText = liveBalance.toLocaleString(undefined, {minimumFractionDigits: 2});

    const profEl = document.getElementById('real-profit');
    if(profEl) {
        const sign = totalProfit >= 0 ? '+' : '';
        profEl.innerText = `${sign}${totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        profEl.className = `value ${totalProfit >= 0 ? 'success' : 'fail'}`;
        if(totalProfit < 0) profEl.style.color = '#ff3344';
        else profEl.style.color = '#00ff88';
    }

    // 가끔 매매 로그 추가
    if (Math.random() < 0.1) {
        const signal = isBuy ? 'Buy Signal' : 'Sell Signal';
        addSystemLog(isBuy ? 'LONG' : 'SHORT', `${price.toFixed(2)} - ${signal}`);
    }
}

// [5] 시스템 로그 관리
function addSystemLog(type, msg) {
    const time = new Date().toLocaleTimeString('en-US', {hour12:false});
    const logItem = { time, type, msg };
    
    appState.logs.unshift(logItem); // 배열 앞에 추가
    if(appState.logs.length > 2000) appState.logs.pop(); // 2000개 제한

    // 메인화면이면 터미널에 표시
    const terminal = document.getElementById('terminal');
    if(terminal) {
        const color = type === 'LONG' ? 'pos-long' : (type === 'SHORT' ? 'pos-short' : 'log-sys');
        const row = `<div class="log-line"><span style="color:#666">[${time}]</span> <span class="${color}">${type}</span> ${msg}</div>`;
        terminal.insertAdjacentHTML('afterbegin', row);
        if(terminal.children.length > 50) terminal.removeChild(terminal.lastChild);
    }
    updateLogCounter();
}

function updateLogCounter() {
    const counter = document.getElementById('log-count-display');
    if(counter) counter.innerText = appState.logs.length;
}

// [6] 파일 저장 (위치 선택 가능)
async function exportLogs() {
    if(appState.logs.length === 0) { alert("No logs to save."); return; }

    let csvContent = "Time,Type,Message\n";
    appState.logs.forEach(log => {
        csvContent += `${log.time},${log.type},${log.msg}\n`;
    });

    try {
        // 최신 브라우저: 저장 위치 선택 창 띄우기
        const handle = await window.showSaveFilePicker({
            suggestedName: `NEURO_LOGS_${Date.now()}.csv`,
            types: [{
                description: 'CSV File',
                accept: {'text/csv': ['.csv']},
            }],
        });
        const writable = await handle.createWritable();
        await writable.write(csvContent);
        await writable.close();
        alert("LOGS EXPORTED SUCCESSFULLY.");
    } catch (err) {
        // 지원하지 않거나 취소 시: 일반 다운로드
        console.warn("File System API not supported, using fallback.");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `NEURO_LOGS_BACKUP.csv`;
        link.click();
    }
}

// [7] 지갑 페이지 렌더링 (페이지네이션 & 모달)
let currentPage = 1;
const itemsPerPage = 10;

function renderWalletPage() {
    // 1. 자산 업데이트
    document.getElementById('total-val').innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    // 2. 승률 계산
    const wins = appState.tradeHistory.filter(t => t.win).length;
    const total = appState.tradeHistory.length;
    const rate = total === 0 ? 0 : Math.round((wins/total)*100);
    document.getElementById('win-rate-display').innerHTML = `WIN RATE: <span style="color:#fff">${rate}%</span> (${wins}W ${total-wins}L)`;

    // 3. 히스토리 리스트 (페이지네이션)
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = appState.tradeHistory.slice(start, end);
    
    const tbody = document.getElementById('history-body');
    let html = '';
    
    pageData.forEach(t => {
        const color = t.profit >= 0 ? 'text-green' : 'text-red';
        const sign = t.profit >= 0 ? '+' : '';
        html += `
            <tr>
                <td class="num-font" style="font-size:0.75rem; color:#666;">${t.date}<br>${t.time}</td>
                <td style="font-weight:bold;" class="${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</td>
                <td class="num-font" style="font-size:0.8rem;">IN: ${t.in.toFixed(0)}<br>OUT: ${t.out.toFixed(0)}</td>
                <td style="text-align:right;" class="num-font ${color}">
                    <div style="font-size:0.9rem; font-weight:bold;">${sign}$${t.profit.toFixed(2)}</div>
                    <div style="font-size:0.7rem;">(${sign}${(t.profit/50).toFixed(2)}%)</div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;

    // 페이지네이션 UI
    document.getElementById('page-info').innerText = `PAGE ${currentPage}`;
}

function changePage(direction) {
    const maxPage = Math.ceil(appState.tradeHistory.length / itemsPerPage);
    if (direction === 1 && currentPage < maxPage) currentPage++;
    if (direction === -1 && currentPage > 1) currentPage--;
    renderWalletPage();
}

// [8] 보증금/철회 (모달 로직)
function openModal(type) {
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const btn = document.getElementById('modal-action-btn');
    
    modal.style.display = 'flex';
    if(type === 'deposit') {
        title.innerText = "DEPOSIT ASSETS";
        btn.innerText = "DEPOSIT NOW";
        btn.onclick = () => processTransaction(1);
    } else {
        title.innerText = "WITHDRAW ASSETS";
        btn.innerText = "WITHDRAW NOW";
        btn.onclick = () => processTransaction(-1);
    }
}

function closeModal() {
    document.getElementById('transaction-modal').style.display = 'none';
}

function processTransaction(sign) {
    const input = document.getElementById('amount-input');
    const amount = parseFloat(input.value);
    
    if(!amount || amount <= 0) { alert("Invalid Amount"); return; }
    
    if(sign === -1 && amount > appState.balance) {
        alert("Insufficient Balance!");
        return;
    }

    appState.balance += (amount * sign);
    if(sign === 1) appState.startBalance += amount; // 원금도 증가
    
    // 로그 추가
    addSystemLog('SYSTEM', `${sign===1?'Deposit':'Withdrawal'} of $${amount} confirmed.`);
    
    saveState();
    closeModal();
    input.value = '';
    
    // UI 갱신
    if(document.getElementById('history-body')) renderWalletPage();
    updateGlobalUI();
    alert("TRANSACTION COMPLETED.");
}

// 유틸리티
function updateGlobalUI() {
    // 모든 페이지 공통 UI 갱신 필요 시 사용
}

function highlightMenu() {
    const current = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === current) el.classList.add('active');
        else el.classList.remove('active');
    });
}
function startLatencyUpdate() { /* 기존 동일 */ }

// 초기 데이터 생성기 (처음 한 번만 실행됨)
function generateInitialData() {
    appState.tradeHistory = [];
    for(let i=0; i<20; i++) {
        appState.tradeHistory.push({
            time: "12:00:00", date: "2/10", pos: "LONG", in: 50000, out: 50100, profit: 50, win: true
        });
    }
    saveState();
}
