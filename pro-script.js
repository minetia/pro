/* pro-script.js - V9.0 (자산 통합 & 무한 회전 패치) */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;
let autoTradeInterval = null;

// [전역 데이터]
let appState = {
    balance: 50000.00,       // 지갑 잔고
    bankBalance: 1000000.00, // 은행 잔고
    startBalance: 50000.00,
    tradeHistory: [],
    transfers: [],
    logs: [],
    totalLogCount: 0,
    isRealMode: false,
    config: {}
};

window.addEventListener('load', () => {
    loadState();
    checkRealModeAndStart(); 

    // 헤더 로드
    fetch('header.html').then(r => r.text()).then(d => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) { slot.innerHTML = d; highlightMenu(); }
    });

    renderGlobalUI();
    if (document.getElementById('tv_chart')) initWebSocket();
    
    // [핵심] 0.5초마다 강제 화면 갱신 (멈춤 방지)
    setInterval(() => { 
        applyBankInterest(); 
        saveState(); 
        renderGlobalUI(); 
    }, 500);
});

// 은행 이자 (계속 숫자가 올라가게 함)
function applyBankInterest() {
    if(appState.bankBalance > 0) {
        const interest = appState.bankBalance * 0.0000008; // 이자율 살짝 높임
        appState.bankBalance += interest;
    }
}

// [핵심] UI 렌더링 (모든 페이지 금액 통일)
function renderGlobalUI() {
    // 1. 총 자산 계산 (지갑 + 은행)
    const totalAssets = appState.balance + (appState.bankBalance || 0);

    // 2. 모든 페이지의 '큰 숫자' ID를 다 찾음
    const displayTargets = [
        document.getElementById('total-val'),           // 대시보드 메인
        document.getElementById('bank-balance-display') // 은행/지갑 메인
    ];

    // 3. 찾은 곳에 전부 '총 자산'을 박아넣음 (금액 통일)
    displayTargets.forEach(el => {
        if(el) {
            // 천단위 콤마 + 소수점 2자리
            el.innerText = `$ ${totalAssets.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            // 숫자가 튈 때 시각적 효과
            el.style.color = "#fff"; 
        }
    });

    // 4. 수익금 표시 (대시보드)
    const profEl = document.getElementById('real-profit');
    if(profEl) {
        const profit = appState.balance - appState.startBalance;
        const arrow = profit >= 0 ? '▲' : '▼';
        profEl.innerText = `${arrow} $${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits:2})}`;
        profEl.className = `num-font ${profit>=0?'text-green':'text-red'}`;
    }

    // 5. 로그 카운터 (제한 없이 계속 올라감)
    const logCnt = document.getElementById('log-count-display');
    if(logCnt) logCnt.innerText = `[${appState.totalLogCount.toLocaleString()}]`;

    // 6. 테이블 그리기 (무한 회전)
    renderTables();
}

// 테이블 렌더링 (멈춤 해결)
function renderTables() {
    // 매매 내역 (지갑/메인)
    const histBody = document.getElementById('history-body');
    if(histBody) {
        let html = '';
        // 최신 15개만 잘라서 보여줌
        appState.tradeHistory.slice(0, 15).forEach(t => { 
            const color = t.profit >= 0 ? 'text-green' : 'text-red';
            html += `<tr>
                <td class="num-font" style="color:var(--text-secondary); font-size:0.75rem;">${t.time}</td>
                <td style="font-weight:600;" class="${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</td>
                <td class="num-font" style="text-align:right;">${t.profit>=0?'+':''}$${t.profit.toFixed(2)}</td>
            </tr>`;
        });
        histBody.innerHTML = html;
        
        // 승률 업데이트
        const winEl = document.getElementById('win-rate-display');
        if(winEl) {
            const wins = appState.tradeHistory.filter(t => t.win).length;
            const total = appState.tradeHistory.length;
            const rate = total ? Math.round((wins/total)*100) : 0;
            winEl.innerHTML = `WIN RATE: <span class="text-green">${rate}%</span>`;
        }
    }

    // 이체 내역 (은행)
    const transBody = document.getElementById('transfer-body');
    if(transBody) {
        let html = '';
        appState.transfers.slice(0, 10).forEach(t => {
            const isDep = t.type === 'DEPOSIT';
            html += `<tr>
                <td class="num-font" style="color:var(--text-secondary);">${t.date.split(' ')[0]}</td>
                <td style="font-weight:600;">${t.type}</td>
                <td style="text-align:right;" class="num-font ${isDep?'text-green':'text-red'}">$${t.amount.toLocaleString()}</td>
            </tr>`;
        });
        transBody.innerHTML = html;
    }
}

// [핵심] AI 트레이딩 (무한 실행)
function executeAiTrade(config) {
    // 1. 승패 결정
    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 0.8) + 0.1; 
    const pnl = isWin ? (parseFloat(config.amount) * (percent / 100)) : -(parseFloat(config.amount) * (percent / 100) * 0.6);
    
    // 2. 지갑 잔고 변경 -> 총 자산도 같이 변경됨
    appState.balance += pnl;
    
    // 3. 기록 추가 (배열 앞쪽에 추가 = unshift)
    const currentPrice = 69000 + (Math.random() * 1000);
    const pos = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    const now = new Date();
    
    const newTrade = {
        date: `${now.getMonth()+1}/${now.getDate()}`,
        time: now.toLocaleTimeString('en-US',{hour12:false}),
        pos: pos, 
        in: currentPrice, 
        out: currentPrice + (isWin ? 50 : -50), 
        profit: pnl, 
        win: isWin
    };

    // [중요] 배열에 넣고 오래된 거 빼기 (회전 효과)
    appState.tradeHistory.unshift(newTrade);
    if(appState.tradeHistory.length > 30) appState.tradeHistory.pop(); // 30개만 유지하며 계속 돎

    // 4. 로그 업데이트
    const msg = `AI: ${pos} ${config.target || 'BTC/USDT'} | PNL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    if(window.addSystemLog) window.addSystemLog(pos, msg);
    
    appState.totalLogCount++; // 카운터 무한 증가
}

function checkRealModeAndStart() {
    const config = JSON.parse(localStorage.getItem('neuroConfig') || '{}');
    appState.config = config;
    if(config.apiKey && config.mode === 'REAL') {
        appState.isRealMode = true;
        updateRealModeUI(config);
        
        // 기존 인터벌 제거 후 재시작 (중복 방지)
        if(autoTradeInterval) clearInterval(autoTradeInterval);
        
        // 1.2초마다 매매 실행 (속도 빠름)
        autoTradeInterval = setInterval(() => { executeAiTrade(config); }, 1200);
    }
}

// 강제 실행 버튼
function forceStartTrade() {
    alert("FORCING ENGINE START...");
    checkRealModeAndStart();
    // 설정이 없으면 임시 설정으로라도 돌림
    if(!appState.config.target) {
        executeAiTrade({target:'BTC/USDT', amount:1000});
        autoTradeInterval = setInterval(() => { executeAiTrade({target:'BTC/USDT', amount:1000}); }, 1200);
    }
}

/* --- 기본 유지 --- */
function saveState() { localStorage.setItem('neuroBotData', JSON.stringify(appState)); }
function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) { appState = JSON.parse(data); if(!appState.bankBalance) appState.bankBalance = 1000000; }
}
function updateRealModeUI(config) {
    const btn = document.getElementById('btn-status');
    if(btn) { btn.innerText = "AI TRADING ACTIVE"; btn.classList.add('btn-auto'); }
}
function initWebSocket() { socket = new WebSocket(BINANCE_WS_URL); socket.onmessage = (e) => {
    const d = JSON.parse(e.data);
    const p = parseFloat(d.p);
    const el = document.getElementById('coin-price');
    if(el) { el.innerText = p.toLocaleString(undefined,{minimumFractionDigits:2}); el.style.color = !d.m ? '#0ecb81' : '#f6465d'; }
};}
function processTransaction(amount) {
    if(!amount) return;
    if(amount > 0) { 
        if(appState.bankBalance < amount) return alert("잔고 부족");
        appState.bankBalance -= amount; appState.balance += amount;
    } else { 
        if(appState.balance < Math.abs(amount)) return alert("잔고 부족");
        appState.balance -= Math.abs(amount); appState.bankBalance += Math.abs(amount);
    }
    appState.transfers.unshift({date: new Date().toISOString().slice(0,16).replace('T',' '), type: amount>0?'DEPOSIT':'WITHDRAW', amount: Math.abs(amount), status:'Done'});
    saveState(); closeModal(); renderGlobalUI();
}
function openModal(mode) {
    const m = document.getElementById('transaction-modal'); m.style.display='flex';
    document.getElementById('amount-input').value='';
    const btn = document.getElementById('modal-confirm-btn');
    if(mode==='deposit') { document.getElementById('modal-title').innerText="DEPOSIT"; btn.onclick=()=>processTransaction(parseFloat(document.getElementById('amount-input').value)); }
    else { document.getElementById('modal-title').innerText="WITHDRAW"; btn.onclick=()=>processTransaction(-parseFloat(document.getElementById('amount-input').value)); }
}
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }
function exportLogs() { /* 생략 */ }
function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active'); else el.classList.remove('active');
    });
}
