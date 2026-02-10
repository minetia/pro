/* pro-script.js - V40.0 (Grand Remodel) */
let appState = {
    balance: 0.00,        // 총 자산 (현금 + 코인 평가금)
    cash: 0.00,           // 주문 가능 현금
    bankBalance: 0.00,    // 은행 잔고
    startBalance: 0.00,   // 시작 시점 총 자산 (수익률 계산용)
    
    tradeHistory: [],     // 상세 거래 내역
    openOrders: [],       // 미체결 내역
    transfers: [],        // 입출금 내역
    
    config: {}, 
    isRunning: false,
    runningCoin: null,    // 현재 매수 중인 코인 (BTC, SOL 등)
    investedAmount: 0     // 현재 코인에 들어간 돈 (평가금 아님, 원금)
};

let autoTradeInterval = null;
const SAVE_KEY = 'neuroBotData_V40_KR';
const CONFIG_KEY = 'neuroConfig_V40_KR';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    // 탭 초기화 (지갑 페이지일 경우)
    if(document.getElementById('tab-holdings')) showTab('holdings');

    // 자동 재시작 로직
    if (appState.isRunning) {
        if (appState.balance > 0 && appState.config && appState.config.isReady) {
            startSystem(true);
        } else {
            stopSystem(true);
        }
    } else {
        updateButtonState(false);
    }
    
    setInterval(() => { saveState(); renderGlobalUI(); }, 500);
});

/* --- 시스템 제어 --- */
function startSystem(isSilent = false) {
    if (appState.balance <= 0) return alert("잔고가 부족합니다. 입금해주세요.");
    if (!appState.config || !appState.config.isReady) return alert("AI 설정이 필요합니다.");

    // [중요] 시작 시 투자금 세팅
    // 사용자가 설정한 금액 (예: 100달러)
    let investAmt = appState.config.amount || 1000;
    
    // 만약 가진 돈보다 설정액이 크면, 가진 돈 전부 투자
    if (investAmt > appState.balance) investAmt = appState.balance;

    // 상태 업데이트
    appState.runningCoin = appState.config.target.split('/')[0]; // BTC
    appState.investedAmount = investAmt;
    appState.cash = appState.balance - investAmt; // 나머지는 현금으로 분류
    appState.startBalance = appState.balance; // 수익률 기준점

    // 미체결 주문 생성 (시뮬레이션)
    generateFakeOpenOrders(appState.runningCoin);

    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true; 
    autoTradeInterval = setInterval(executeAiTrade, 1000); 
    
    updateButtonState(true);
    if(!isSilent) console.log(`System Started: ${appState.runningCoin} $${investAmt}`);
    saveState(); 
}

function stopSystem(isSilent = false) {
    appState.isRunning = false;
    appState.runningCoin = null;
    appState.investedAmount = 0;
    appState.cash = appState.balance; // 투자금 회수 -> 전액 현금화
    appState.openOrders = []; // 미체결 취소

    if(autoTradeInterval) clearInterval(autoTradeInterval);
    updateButtonState(false);
    saveState(); 
}

function updateButtonState(isOn) {
    const btn = document.getElementById('btn-main-control');
    if(btn) {
        btn.style.opacity = isOn ? "1" : "0.5";
        btn.innerHTML = isOn ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START';
        // 색상 변경
        btn.style.backgroundColor = isOn ? 'var(--color-up)' : '#2b3139';
    }
}

/* --- 트레이딩 엔진 (핵심) --- */
function executeAiTrade() {
    if(!appState.isRunning) return;

    // 투자금(investedAmount) 만 가지고 수익률 계산
    const isWin = Math.random() > 0.48; 
    const percent = (Math.random() * 0.8) + 0.1; // 0.1% ~ 0.9% 변동
    let pnl = isWin ? (appState.investedAmount * (percent / 100)) : -(appState.investedAmount * (percent / 100) * 0.6);
    
    // 전체 자산에 반영
    appState.balance += pnl;
    // 투자 평가금도 변동 (단, investedAmount 원금 변수는 고정하고 PnL만 따로 계산해도 되지만 여기선 balance로 통합 관리)
    
    // 0원 방어
    if (appState.balance < 0) { appState.balance = 0; stopSystem(); return; }

    // 상세 거래 내역 생성
    const coin = appState.runningCoin;
    const price = getRealisticPrice(coin);
    const type = Math.random() > 0.5 ? '매수' : '매도';
    
    // 거래량 계산 (투자금 / 가격)
    const volume = (appState.investedAmount / price).toFixed(8);
    const total = appState.investedAmount;
    const fee = total * 0.0005; // 0.05% 수수료
    const net = type === '매수' ? total + fee : total - fee;

    const tradeRecord = {
        time: new Date().toLocaleTimeString('en-GB'), // 24시간제
        coin: coin,
        market: 'USDT', // 마켓
        type: type,
        vol: volume,
        price: price.toLocaleString(),
        total: total.toFixed(2),
        fee: fee.toFixed(2),
        net: net.toFixed(2)
    };

    appState.tradeHistory.unshift(tradeRecord);
    if(appState.tradeHistory.length > 100) appState.tradeHistory.pop();
    
    renderGlobalUI();
}

function generateFakeOpenOrders(coin) {
    appState.openOrders = [];
    const price = getRealisticPrice(coin);
    for(let i=0; i<3; i++) {
        appState.openOrders.push({
            time: new Date().toLocaleTimeString('en-GB'),
            coin: coin,
            type: Math.random()>0.5 ? '매수' : '매도',
            price: (price * (1 + (Math.random()*0.01 - 0.005))).toFixed(2), // 현재가 근처
            vol: (Math.random() * 2).toFixed(4)
        });
    }
}

function getRealisticPrice(symbol) {
    const jitter = Math.random();
    if(symbol === 'BTC') return 96000 + (jitter * 500);
    if(symbol === 'ETH') return 2700 + (jitter * 20);
    if(symbol === 'SOL') return 145 + (jitter * 2);
    if(symbol === 'XRP') return 2.40 + (jitter * 0.05);
    return 100 + (jitter * 10);
}

/* --- 탭 기능 --- */
function showTab(tabName) {
    // 버튼 스타일
    document.querySelectorAll('.wallet-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${tabName}`).classList.add('active');

    // 내용 표시
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    renderGlobalUI(); // 탭 바뀔 때 즉시 렌더링
}

/* --- 입출금 모달 --- */
let currentTxMode = '';
function openModal(mode) {
    const modal = document.getElementById('transaction-modal'); if(!modal) return;
    modal.style.display = 'flex'; currentTxMode = mode;
    const input = document.getElementById('amount-input'); input.value = ''; input.focus();
    const btn = document.getElementById('modal-confirm-btn');
    const title = document.getElementById('modal-title');
    
    if(mode==='deposit') { title.innerText="입금 (Bank -> Wallet)"; btn.onclick=()=>processTx(parseFloat(input.value)); }
    else { title.innerText="출금 (Wallet -> Bank)"; btn.onclick=()=>processTx(-parseFloat(input.value)); }
}
function processTx(amt) {
    if(!amt || amt===0) return alert("금액을 확인해주세요.");
    if(amt>0) { 
        if(appState.bankBalance < amt) return alert("은행 잔고 부족");
        appState.bankBalance -= amt; appState.balance += amt; 
        appState.cash += amt; // 입금된 돈은 현금으로
    } else {
        const abs = Math.abs(amt);
        if(appState.cash < abs) return alert("출금 가능 현금 부족 (투자중인 금액 제외)");
        appState.balance -= abs; appState.bankBalance += abs;
        appState.cash -= abs;
    }
    saveState(); renderGlobalUI(); document.getElementById('transaction-modal').style.display='none';
}
function calcPercent(pct) { 
    const input = document.getElementById('amount-input'); 
    let base = currentTxMode==='deposit' ? appState.bankBalance : appState.cash; // 출금 시엔 '현금'만 기준
    if(pct===100) input.value = base; else input.value = Math.floor(base * (pct/100)*100)/100; 
}
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }

/* --- 렌더링 (화면 그리기) --- */
function renderGlobalUI() {
    // 1. 공통 상단 정보 (DASHBOARD)
    const elTotal = document.getElementById('total-val');
    const elPnl = document.getElementById('real-profit');
    if(elTotal) elTotal.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    // 수익률 계산
    const base = appState.startBalance > 0 ? appState.startBalance : appState.balance;
    const profit = appState.balance - base;
    const profitPercent = base > 0 ? (profit / base) * 100 : 0;
    const pnlColor = profit >= 0 ? 'text-green' : 'text-red';
    
    if(elPnl) {
        elPnl.innerHTML = `<span class="${pnlColor}">${profit>=0?'+':''}${profitPercent.toFixed(2)}%</span> ($${profit.toFixed(2)})`;
    }

    // 2. 지갑 페이지 렌더링
    if(document.getElementById('wallet-display')) {
        document.getElementById('wallet-display').innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        document.getElementById('avail-cash').innerText = `$ ${appState.cash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        
        // 파이차트 & 보유비중
        const coinVal = appState.isRunning ? (appState.balance - appState.cash) : 0;
        const total = appState.balance > 0 ? appState.balance : 1;
        const coinPercent = (coinVal / total) * 100;
        
        // CSS 파이차트 업데이트
        const pie = document.getElementById('portfolio-pie');
        if(pie) pie.style.background = `conic-gradient(var(--accent) 0% ${coinPercent}%, #333 ${coinPercent}% 100%)`;
        
        // 보유자산 리스트
        const holdingsList = document.getElementById('holdings-list');
        if(holdingsList) {
            let hHtml = '';
            if(appState.isRunning) {
                hHtml += `
                    <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #333;">
                        <div><span style="font-weight:bold; color:#fff;">${appState.runningCoin}</span> <span class="badge badge-buy">보유중</span></div>
                        <div style="text-align:right;">
                            <div style="color:#fff;">$${coinVal.toLocaleString()}</div>
                            <div style="font-size:0.75rem; color:#888;">${coinPercent.toFixed(1)}%</div>
                        </div>
                    </div>
                `;
            }
            // 현금
            const cashPercent = 100 - coinPercent;
            hHtml += `
                <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #333;">
                    <div><span style="font-weight:bold; color:#fff;">USDT (현금)</span></div>
                    <div style="text-align:right;">
                        <div style="color:#fff;">$${appState.cash.toLocaleString()}</div>
                        <div style="font-size:0.75rem; color:#888;">${cashPercent.toFixed(1)}%</div>
                    </div>
                </div>
            `;
            holdingsList.innerHTML = hHtml;
        }

        // 거래내역 (상세 테이블)
        const historyTable = document.getElementById('history-table-body');
        if(historyTable) {
            let tHtml = '';
            appState.tradeHistory.slice(0, 30).forEach(t => {
                const typeColor = t.type === '매수' ? 'text-green' : 'text-red';
                tHtml += `
                    <tr>
                        <td>${t.time}<br><span style="color:#888">${t.market}</span></td>
                        <td><span style="font-weight:bold;">${t.coin}</span></td>
                        <td class="${typeColor}">${t.type}</td>
                        <td>${t.vol}<br><span style="color:#888">${t.price}</span></td>
                        <td>${t.total}<br><span style="color:#888">${t.fee}</span></td>
                        <td><span style="font-weight:bold;">${t.net}</span></td>
                    </tr>
                `;
            });
            historyTable.innerHTML = tHtml;
        }

        // 미체결
        const orderList = document.getElementById('open-orders-list');
        if(orderList) {
            if(appState.openOrders.length === 0) orderList.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">미체결 주문이 없습니다.</div>';
            else {
                let oHtml = '';
                appState.openOrders.forEach(o => {
                    const typeColor = o.type === '매수' ? 'text-green' : 'text-red';
                    oHtml += `
                        <div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between;">
                            <div>
                                <div style="font-weight:bold;">${o.coin} <span style="font-size:0.7rem; color:#888;">/ USDT</span></div>
                                <div style="font-size:0.75rem; color:#888;">${o.time}</div>
                            </div>
                            <div style="text-align:right;">
                                <div class="${typeColor}" style="font-weight:bold;">${o.type}</div>
                                <div style="font-size:0.8rem;">${o.price}</div>
                            </div>
                            <div>
                                <button style="background:none; border:1px solid #555; color:#888; padding:4px 8px; border-radius:4px; cursor:pointer;">취소</button>
                            </div>
                        </div>
                    `;
                });
                orderList.innerHTML = oHtml;
            }
        }
    }
}

/* 유틸 */
function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(appState)); }
function loadState() { try { const d = localStorage.getItem(SAVE_KEY); if(d) appState = {...appState, ...JSON.parse(d)}; } catch(e){} }
function loadConfig() { try { const d = localStorage.getItem(CONFIG_KEY); if(d) appState.config = JSON.parse(d); } catch(e){} }
function highlightMenu() { 
    const cur = window.location.pathname.split("/").pop() || 'index.html'; 
    document.querySelectorAll('.nav-item').forEach(el => { 
        if(el.getAttribute('href') === cur) el.classList.add('active'); 
        else el.classList.remove('active'); 
    }); 
}
function initWebSocket() {} function exportLogs() {} function handleEnter() {}
function openChartModal() { document.getElementById('chart-modal').style.display='flex'; }
function closeChartModal() { document.getElementById('chart-modal').style.display='none'; }
function simulateExternalDeposit() {
    const amt = 1000;
    appState.bankBalance += amt;
    alert(`$${amt} 입금 완료!`);
    saveState(); window.location.reload();
}
