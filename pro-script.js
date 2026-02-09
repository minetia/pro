/* pro-script.js - 데이터 동기화 엔진 (로그 리미트 버전) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;

// [1] 전역 데이터 상태
let appState = {
    balance: 50000.00,
    startBalance: 50000.00,
    tradeHistory: [], // 매매 기록
    transfers: [],    // 입출금 기록
    logs: [],         // 시스템 로그 배열
    totalLogCount: 0, // [NEW] 로그 누적 카운터 (최대 1,000,000)
    lastLogin: Date.now()
};

// 페이지 로드 시 실행
window.addEventListener('load', () => {
    loadState(); 
    if(appState.tradeHistory.length === 0) generateInitialData(); 

    // 헤더 로드
    fetch('header.html').then(r => r.text()).then(d => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) slot.innerHTML = d;
        highlightMenu();
    });

    renderGlobalUI(); 

    if (document.getElementById('tv_chart')) {
        initWebSocket(); // 메인 화면
    } 
    
    setInterval(() => {
        saveState();
        renderGlobalUI();
    }, 1000);
});

// 데이터 저장/로드
function saveState() {
    localStorage.setItem('neuroBotData', JSON.stringify(appState));
}
function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) {
        appState = JSON.parse(data);
        // 기존 데이터에 카운터가 없으면 초기화
        if(appState.totalLogCount === undefined) appState.totalLogCount = appState.logs.length;
    }
}

// 초기 데이터
function generateInitialData() {
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
    appState.transfers = [
        { date: '2026-02-09 10:00', type: 'DEPOSIT', amount: 50000, status: 'Completed' }
    ];
    saveState();
}

// [통합] 화면 렌더링
function renderGlobalUI() {
    // 자산 공통
    const els = {
        total: document.getElementById('total-val'),
        bal: document.getElementById('real-balance'),
        prof: document.getElementById('real-profit'),
        win: document.getElementById('win-rate-display'),
        logCnt: document.getElementById('log-count-display') // 로그 카운터 ID
    };

    if(els.total) els.total.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(els.bal) els.bal.innerText = appState.balance.toLocaleString(undefined, {minimumFractionDigits:2});
    
    if(els.prof) {
        const profit = appState.balance - appState.startBalance;
        els.prof.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        els.prof.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }

    // [NEW] 로그 카운터 업데이트 (100만 도달 시 빨간색 경고)
    if(els.logCnt) {
        els.logCnt.innerText = `[${appState.totalLogCount.toLocaleString()}]`;
        if(appState.totalLogCount >= 1000000) {
            els.logCnt.style.color = '#ff003c'; // RED (FULL)
            els.logCnt.innerText += " FULL";
        } else {
            els.logCnt.style.color = '#fff';
        }
    }

    // 지갑 리스트
    const histBody = document.getElementById('history-body');
    if(histBody) {
        let html = '';
        appState.tradeHistory.slice(0, 20).forEach(t => { 
            const color = t.profit >= 0 ? 'text-green' : 'text-red';
            html += `<tr>
                <td class="num-font" style="color:#888; font-size:0.75rem;">${t.date}<br>${t.time}</td>
                <td style="font-weight:bold;" class="${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</td>
                <td class="num-font" style="font-size:0.8rem;">IN:${t.in.toFixed(0)}<br>OUT:${t.out.toFixed(0)}</td>
                <td style="text-align:right;" class="num-font ${color}"><b>${t.profit>=0?'+':''}$${t.profit}</b></td>
            </tr>`;
        });
        histBody.innerHTML = html;

        if(els.win) {
            const wins = appState.tradeHistory.filter(t => t.win).length;
            const total = appState.tradeHistory.length;
            const rate = total ? Math.round((wins/total)*100) : 0;
            els.win.innerHTML = `WIN RATE: <span class="text-green">${rate}%</span> (${wins}W ${total-wins}L)`;
        }
    }

    // 입출금 리스트
    const transBody = document.getElementById('transfer-body');
    if(transBody) {
        let html = '';
        appState.transfers.forEach(t => {
            const isDep = t.type === 'DEPOSIT';
            html += `<tr>
                <td class="num-font" style="color:#888; font-size:0.75rem;">${t.date.split(' ')[0]}<br>${t.date.split(' ')[1]}</td>
                <td style="font-weight:bold; color:${isDep?'#0f0':'#f00'}">${t.type}</td>
                <td style="text-align:right;" class="num-font ${isDep?'text-green':'text-red'}">${isDep?'+':'-'}$${t.amount.toLocaleString()}</td>
                <td style="text-align:right; font-size:0.7rem; color:#666;">${t.status}</td>
            </tr>`;
        });
        transBody.innerHTML = html;
    }
}

// 입출금 로직
function processTransaction(amount) {
    if(!amount || amount <= 0) return alert("Invalid Amount");
    if(amount < 0 && (appState.balance + amount) < 0) return alert("Insufficient Funds");

    appState.balance += amount;
    if(amount > 0) appState.startBalance += amount; 

    appState.transfers.unshift({
        date: new Date().toISOString().slice(0,16).replace('T', ' '),
        type: amount > 0 ? 'DEPOSIT' : 'WITHDRAW',
        amount: Math.abs(amount),
        status: 'Completed'
    });

    saveState();
    closeModal();
    renderGlobalUI(); 
    alert("TRANSACTION COMPLETED");
}

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

// 메인 웹소켓
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
        
        const noise = (Math.random()-0.5)*5;
        const dispBal = appState.balance + noise;
        const balEl = document.getElementById('real-balance');
        if(balEl) balEl.innerText = dispBal.toLocaleString(undefined, {minimumFractionDigits:2});

        // 랜덤 로그 생성 (확률)
        if(Math.random() < 0.05) addLog(isBuy?'LONG':'SHORT', `Price ${price.toFixed(1)} Executed`);
    };
    socket.onclose = () => setTimeout(initWebSocket, 2000);
}

// [핵심] 로그 추가 및 한계 설정 (100만 제한)
function addLog(type, msg) {
    // 100만 건 도달 시 로그 생성 중단
    if (appState.totalLogCount >= 1000000) return;

    const time = new Date().toLocaleTimeString('en-US',{hour12:false});
    
    // 로그 데이터 추가
    appState.logs.unshift({time, type, msg});
    appState.totalLogCount++; // 카운터 증가

    // 메모리 관리를 위해 배열 자체는 500개만 유지 (카운터는 계속 올라감)
    if(appState.logs.length > 500) appState.logs.pop();
    
    // UI 업데이트 (터미널)
    const terminal = document.getElementById('terminal');
    if(terminal) {
        const color = type==='LONG'?'pos-long':'pos-short';
        const row = `<div class="log-line"><span style="color:#666">[${time}]</span> <span class="${color}">${type}</span> <span style="color:#aaa">${msg}</span></div>`;
        terminal.insertAdjacentHTML('afterbegin', row);
        if(terminal.children.length > 50) terminal.removeChild(terminal.lastChild);
    }
}

// [핵심] 로그 저장 및 카운터 초기화 (Reset)
function exportLogs() {
    if(appState.logs.length === 0) return alert("No logs to save.");
    
    // CSV 생성
    let csv = "Time,Type,Message\n";
    appState.logs.forEach(l => csv += `${l.time},${l.type},${l.msg}\n`);
    const blob = new Blob([csv], {type:'text/csv'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `NeuroLog_${Date.now()}.csv`;
    link.click();

    // [초기화] 저장 후 카운터와 로그 삭제
    appState.logs = [];
    appState.totalLogCount = 0;
    saveState();
    
    // 터미널 화면도 비우기
    const terminal = document.getElementById('terminal');
    if(terminal) terminal.innerHTML = '';
    
    renderGlobalUI(); // 카운터 0으로 갱신
    alert("DATA SAVED. LOG COUNTER RESET TO 0.");
}

function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active');
        else el.classList.remove('active');
    });
}
