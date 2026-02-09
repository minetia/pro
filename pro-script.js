/* pro-script.js - 데이터 동기화 엔진 (V3.0) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;

// [1] 전역 데이터 상태
let appState = {
    balance: 50000.00,
    startBalance: 50000.00,
    tradeHistory: [], // 매매 기록
    transfers: [],    // 입출금 기록
    logs: [],         // 시스템 로그
    lastLogin: Date.now()
};

// 페이지 로드 시 즉시 실행
window.addEventListener('load', () => {
    // 1. 데이터 로드 (없으면 생성)
    loadState(); 
    if(appState.tradeHistory.length === 0) generateInitialData(); // 데이터 없으면 강제 주입

    // 2. 헤더 메뉴 로드
    fetch('header.html').then(r => r.text()).then(d => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) slot.innerHTML = d;
        highlightMenu();
    });

    // 3. 페이지별 렌더링 (즉시 실행)
    renderGlobalUI(); 

    // 4. 기능 실행
    if (document.getElementById('tv_chart')) {
        initWebSocket(); // 메인 화면
    } 
    
    // 5. 1초마다 자동 저장 및 UI 갱신
    setInterval(() => {
        saveState();
        renderGlobalUI(); // 모든 페이지 실시간 갱신
    }, 1000);
});

// 데이터 저장/로드
function saveState() {
    localStorage.setItem('neuroBotData', JSON.stringify(appState));
}
function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) appState = JSON.parse(data);
}

// [핵심] 초기 데이터 강제 생성 (빈 화면 방지)
function generateInitialData() {
    // 가상 매매 기록 15개 생성
    appState.tradeHistory = [];
    for(let i=0; i<15; i++) {
        const isWin = Math.random() > 0.4;
        const profit = (Math.random() * 500) * (isWin ? 1 : -1);
        appState.tradeHistory.push({
            date: `02/${10-Math.floor(i/3)}`,
            time: `${10+i}:30:15`,
            pos: Math.random()>0.5 ? 'LONG' : 'SHORT',
            in: 60000 + (Math.random()*1000),
            out: 60000 + (Math.random()*1000),
            profit: parseFloat(profit.toFixed(2)),
            win: isWin
        });
    }
    // 가상 입출금 기록 2개 생성
    appState.transfers = [
        { date: '2026-02-09 10:00', type: 'DEPOSIT', amount: 50000, status: 'Completed' },
        { date: '2026-02-08 18:30', type: 'WITHDRAW', amount: 2000, status: 'Completed' }
    ];
    saveState();
}

// [통합] 화면 렌더링 함수 (페이지 상관없이 ID 찾아서 그리기)
function renderGlobalUI() {
    // 1. 자산 공통 업데이트
    const els = {
        total: document.getElementById('total-val'),
        bal: document.getElementById('real-balance'),
        prof: document.getElementById('real-profit'),
        win: document.getElementById('win-rate-display')
    };

    if(els.total) els.total.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.bal) els.bal.innerText = appState.balance.toLocaleString(undefined, {minimumFractionDigits:2});
    
    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        els.prof.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }

    // 2. 지갑 페이지 리스트 렌더링
    const histBody = document.getElementById('history-body');
    if(histBody) {
        let html = '';
        appState.tradeHistory.slice(0, 20).forEach(t => { // 최신 20개
            const color = t.profit >= 0 ? 'text-green' : 'text-red';
            html += `
            <tr>
                <td class="num-font" style="color:#888; font-size:0.75rem;">${t.date}<br>${t.time}</td>
                <td style="font-weight:bold;" class="${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</td>
                <td class="num-font" style="font-size:0.8rem;">
                    <span style="color:#aaa">IN:</span> ${t.in.toFixed(0)}<br>
                    <span style="color:#aaa">OUT:</span> ${t.out.toFixed(0)}
                </td>
                <td style="text-align:right;" class="num-font ${color}">
                    <b>${t.profit >= 0 ? '+' : ''}$${t.profit}</b>
                </td>
            </tr>`;
        });
        histBody.innerHTML = html;

        // 승률 업데이트
        if(els.win) {
            const wins = appState.tradeHistory.filter(t => t.win).length;
            const total = appState.tradeHistory.length;
            const rate = total ? Math.round((wins/total)*100) : 0;
            els.win.innerHTML = `WIN RATE: <span class="text-green">${rate}%</span> (${wins}W ${total-wins}L)`;
        }
    }

    // 3. 입출금 페이지 렌더링
    const transBody = document.getElementById('transfer-body');
    if(transBody) {
        let html = '';
        appState.transfers.forEach(t => {
            const isDep = t.type === 'DEPOSIT';
            html += `
            <tr>
                <td class="num-font" style="color:#888; font-size:0.75rem;">${t.date.split(' ')[0]}<br>${t.date.split(' ')[1]}</td>
                <td style="font-weight:bold; color:${isDep?'#0f0':'#f00'}">${t.type}</td>
                <td style="text-align:right;" class="num-font ${isDep?'text-green':'text-red'}">
                    ${isDep?'+':'-'}$${t.amount.toLocaleString()}
                </td>
                <td style="text-align:right; font-size:0.7rem; color:#666;">${t.status}</td>
            </tr>`;
        });
        transBody.innerHTML = html;
    }
    
    // 4. 로그 카운터
    const logCnt = document.getElementById('log-count-display');
    if(logCnt) logCnt.innerText = appState.logs.length;
}

// 입출금 처리 로직
function processTransaction(amount) {
    if(!amount || amount <= 0) return alert("Invalid Amount");
    
    // 출금 시 잔액 체크
    if(amount < 0 && (appState.balance + amount) < 0) return alert("Insufficient Funds");

    appState.balance += amount;
    if(amount > 0) appState.startBalance += amount; // 입금은 원금 증가 처리

    // 내역 저장
    appState.transfers.unshift({
        date: new Date().toISOString().slice(0,16).replace('T', ' '),
        type: amount > 0 ? 'DEPOSIT' : 'WITHDRAW',
        amount: Math.abs(amount),
        status: 'Completed'
    });

    saveState();
    closeModal();
    renderGlobalUI(); // 즉시 갱신
    alert("TRANSACTION COMPLETED");
}

// 모달 제어
function openModal(mode) {
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const input = document.getElementById('amount-input');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    modal.style.display = 'flex';
    input.value = '';
    
    if(mode === 'deposit') {
        title.innerText = "DEPOSIT ASSETS";
        title.style.color = "#0f0";
        confirmBtn.innerText = "DEPOSIT";
        confirmBtn.onclick = () => processTransaction(parseFloat(input.value));
    } else {
        title.innerText = "WITHDRAW ASSETS";
        title.style.color = "#f00";
        confirmBtn.innerText = "WITHDRAW";
        confirmBtn.onclick = () => processTransaction(-parseFloat(input.value));
    }
}
function closeModal() { document.getElementById('transaction-modal').style.display = 'none'; }

// 메인 차트 및 웹소켓
function initWebSocket() {
    socket = new WebSocket(BINANCE_WS_URL);
    socket.onmessage = (e) => {
        const d = JSON.parse(e.data);
        const price = parseFloat(d.p);
        const isBuy = !d.m;
        
        const priceEl = document.getElementById('coin-price');
        if(priceEl) {
            priceEl.innerText = price.toLocaleString(undefined, {minimumFractionDigits:2});
            priceEl.style.color = isBuy ? '#00ff88' : '#ff3344';
        }
        
        // 자산 변동 연출
        const noise = (Math.random()-0.5)*5;
        const dispBal = appState.balance + noise;
        const balEl = document.getElementById('real-balance');
        if(balEl) balEl.innerText = dispBal.toLocaleString(undefined, {minimumFractionDigits:2});

        // 로그 생성
        if(Math.random() < 0.05) addLog(isBuy?'LONG':'SHORT', `Price ${price.toFixed(1)} Executed`);
    };
    socket.onclose = () => setTimeout(initWebSocket, 2000);
}

function addLog(type, msg) {
    const time = new Date().toLocaleTimeString('en-US',{hour12:false});
    appState.logs.unshift({time, type, msg});
    if(appState.logs.length > 500) appState.logs.pop();
    
    const terminal = document.getElementById('terminal');
    if(terminal) {
        const color = type==='LONG'?'pos-long':'pos-short';
        const row = `<div class="log-line"><span style="color:#666">[${time}]</span> <span class="${color}">${type}</span> <span style="color:#aaa">${msg}</span></div>`;
        terminal.insertAdjacentHTML('afterbegin', row);
        if(terminal.children.length > 50) terminal.removeChild(terminal.lastChild);
    }
}

// 로그 저장
function exportLogs() {
    if(appState.logs.length === 0) return alert("No logs.");
    let csv = "Time,Type,Message\n";
    appState.logs.forEach(l => csv += `${l.time},${l.type},${l.msg}\n`);
    const blob = new Blob([csv], {type:'text/csv'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TradeLog_${Date.now()}.csv`;
    link.click();
}

function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active');
        else el.classList.remove('active');
    });
}
