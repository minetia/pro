/* pro-script.js - 통합 제어 시스템 */
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let socket;

// [전역 데이터]
let appState = {
    balance: 50000.00,
    startBalance: 50000.00,
    tradeHistory: [], // 매매 기록
    transfers: [],    // [NEW] 입출금 기록
    logs: [],         // 시스템 로그
    lastLogin: Date.now()
};

window.addEventListener('load', () => {
    loadState();
    
    // 헤더 로드
    fetch('header.html').then(r => r.text()).then(d => {
        const slot = document.getElementById('internal-header-slot');
        if(slot) slot.innerHTML = d;
        highlightMenu();
    });

    // 페이지별 실행
    if (document.getElementById('tv_chart')) {
        // 메인 페이지
        initWebSocket();
        updateLogDisplay();
        renderDashboard();
    } else if (document.getElementById('history-body')) {
        // 지갑 페이지
        renderWalletPage();
        startLiveEffect();
    } else if (document.getElementById('transfer-body')) {
        // [NEW] 입출금 내역 페이지
        renderTransferPage();
    }

    setInterval(saveState, 1000);
});

// 데이터 관리
function saveState() {
    localStorage.setItem('neuroBotData', JSON.stringify(appState));
}
function loadState() {
    const data = localStorage.getItem('neuroBotData');
    if (data) appState = JSON.parse(data);
    else generateInitialData();
}

// 메인 대시보드 로직
function initWebSocket() {
    socket = new WebSocket(BINANCE_WS_URL);
    socket.onmessage = (e) => {
        const d = JSON.parse(e.data);
        const price = parseFloat(d.p);
        const isBuy = !d.m;
        
        // 가격 업데이트
        const priceEl = document.getElementById('coin-price');
        if(priceEl) {
            priceEl.innerText = price.toLocaleString(undefined, {minimumFractionDigits:2});
            priceEl.style.color = isBuy ? '#00ff88' : '#ff3344';
        }

        // 로그 생성 (확률)
        if(Math.random() < 0.05) {
            addSystemLog(isBuy?'LONG':'SHORT', `Price ${price.toFixed(1)}`);
        }
        
        // 자산 변동 효과
        renderDashboard(price);
    };
    socket.onclose = () => setTimeout(initWebSocket, 2000);
}

function renderDashboard(currentPrice) {
    const balEl = document.getElementById('real-balance');
    const profEl = document.getElementById('real-profit');
    
    if(balEl && profEl) {
        // 실시간 변동 연출
        const noise = (Math.random() - 0.5) * 5;
        const liveBal = appState.balance + noise;
        const profit = liveBal - appState.startBalance;

        balEl.innerText = liveBal.toLocaleString(undefined, {minimumFractionDigits:2});
        profEl.innerText = (profit>=0?'+':'') + profit.toLocaleString(undefined, {minimumFractionDigits:2});
        profEl.className = `pnl-value num-font ${profit>=0?'text-green':'text-red'}`;
    }
}

// 로그 시스템
function addSystemLog(type, msg) {
    const time = new Date().toLocaleTimeString('en-US', {hour12:false});
    appState.logs.unshift({time, type, msg});
    if(appState.logs.length > 500) appState.logs.pop();
    
    updateLogDisplay();
}

function updateLogDisplay() {
    const terminal = document.getElementById('terminal');
    const counter = document.getElementById('log-count-display');
    
    if(counter) counter.innerText = appState.logs.length; // 카운터 업데이트

    if(terminal) {
        const log = appState.logs[0]; // 최신 하나만 그림
        if(!log) return;
        const color = log.type==='LONG'?'pos-long':(log.type==='SHORT'?'pos-short':'text-green');
        const row = `<div class="log-line">
            <span style="color:#666">[${log.time}]</span>
            <span class="${color}">${log.type}</span>
            <span style="color:#aaa">${log.msg}</span>
        </div>`;
        terminal.insertAdjacentHTML('afterbegin', row);
        if(terminal.children.length > 50) terminal.removeChild(terminal.lastChild);
    }
}

// [수정] 지갑 페이지 렌더링
function renderWalletPage() {
    // 1. 자산
    document.getElementById('total-val').innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    // 2. 승률
    const wins = appState.tradeHistory.filter(t => t.win).length;
    const total = appState.tradeHistory.length;
    const rate = total===0 ? 0 : Math.round((wins/total)*100);
    const winEl = document.getElementById('win-rate-display');
    if(winEl) winEl.innerHTML = `WIN RATE: <span class="text-green">${rate}%</span> (${wins}W ${total-wins}L)`;

    // 3. 리스트 (ID 수정됨)
    const tbody = document.getElementById('history-body');
    if(tbody) {
        let html = '';
        appState.tradeHistory.slice(0, 15).forEach(t => {
            const isWin = t.profit >= 0;
            const sign = isWin ? '+' : '';
            const color = isWin ? 'text-green' : 'text-red';
            html += `
                <tr>
                    <td class="num-font" style="color:#666; font-size:0.75rem;">${t.date}<br>${t.time}</td>
                    <td style="font-weight:bold;" class="${t.pos==='LONG'?'text-green':'text-red'}">${t.pos}</td>
                    <td class="num-font" style="font-size:0.8rem;">IN: ${t.in}<br>OUT: ${t.out}</td>
                    <td style="text-align:right;" class="num-font ${color}">
                        <b>${sign}$${Math.abs(t.profit).toFixed(2)}</b>
                    </td>
                </tr>`;
        });
        tbody.innerHTML = html;
    }
}

// [NEW] 입출금 내역 렌더링
function renderTransferPage() {
    const tbody = document.getElementById('transfer-body');
    if(tbody) {
        let html = '';
        appState.transfers.forEach(t => {
            const isDep = t.type === 'DEPOSIT';
            const color = isDep ? 'text-green' : 'text-red';
            const sign = isDep ? '+' : '-';
            html += `
                <tr>
                    <td class="num-font" style="color:#666;">${t.date}</td>
                    <td style="font-weight:bold; color:#fff;">${t.type}</td>
                    <td style="text-align:right;" class="num-font ${color}">
                        ${sign}$${t.amount.toLocaleString()}
                    </td>
                    <td style="text-align:right; font-size:0.7rem; color:#888;">COMPLETED</td>
                </tr>`;
        });
        tbody.innerHTML = html;
    }
}

// 입출금 프로세스
function processTransaction(amount) {
    if(!amount || amount <= 0) return alert("Invalid Amount");
    
    const type = amount > 0 ? 'DEPOSIT' : 'WITHDRAW'; // 양수면 입금, 음수 처리 전 확인 필요하지만 여기선 호출시 결정
    
    // 출금 시 잔액 확인
    /* 호출하는 곳에서 부호를 결정해서 넘김. 
       Deposit: positive number
       Withdraw: negative number
    */
    
    const finalAmount = parseFloat(amount);
    
    // 출금인데 잔액 부족시
    if(finalAmount < 0 && (appState.balance + finalAmount) < 0) {
        return alert("INSUFFICIENT FUNDS");
    }

    appState.balance += finalAmount;
    if(finalAmount > 0) appState.startBalance += finalAmount;

    // 내역 저장
    appState.transfers.unshift({
        date: new Date().toLocaleString(),
        type: finalAmount > 0 ? 'DEPOSIT' : 'WITHDRAW',
        amount: Math.abs(finalAmount)
    });

    saveState();
    closeModal();
    
    // 페이지 리프레시
    if(document.getElementById('history-body')) renderWalletPage();
    alert("TRANSACTION SUCCESSFUL");
}

// 모달 제어
function openModal(mode) {
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const btn = document.getElementById('modal-action-btn');
    const input = document.getElementById('amount-input');

    modal.style.display = 'flex';
    input.value = '';
    
    if(mode === 'deposit') {
        title.innerText = "DEPOSIT ASSETS";
        title.style.color = "#0f0";
        btn.innerText = "CONFIRM DEPOSIT";
        btn.onclick = () => processTransaction(parseFloat(input.value));
    } else {
        title.innerText = "WITHDRAW TO BANK";
        title.style.color = "#f00";
        btn.innerText = "CONFIRM WITHDRAW";
        btn.onclick = () => processTransaction(-parseFloat(input.value));
    }
}
function closeModal() {
    document.getElementById('transaction-modal').style.display = 'none';
}

// 유틸
function highlightMenu() {
    const cur = window.location.pathname.split("/").pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
        if(el.getAttribute('href') === cur) el.classList.add('active');
    });
}
function generateInitialData() {
    // 초기 더미 데이터
    appState.tradeHistory = [
        { date:'2/9', time:'14:20', pos:'LONG', in:50100, out:50200, profit:100, win:true },
        { date:'2/9', time:'12:10', pos:'SHORT', in:50200, out:50300, profit:-100, win:false }
    ];
    saveState();
}
function startLiveEffect() { setInterval(() => renderWalletPage(), 2000); }
function exportLogs() { alert("DOWNLOADING CSV..."); }
