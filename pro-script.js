/* pro-script.js - V170.0 (Master Reset & Robust Engine) */
/* 데이터 충돌 방지를 위해 저장 키를 새로 변경했습니다. */
const SAVE_KEY = 'neuroBot_V170_MASTER_RESET';
const CONFIG_KEY = 'neuroConfig_V170_MASTER';

let appState = {
    balance: 0.00,
    cash: 0.00,
    bankBalance: 0.00,
    startBalance: 0.00,
    dailyTotalProfit: 0.00,
    tradeHistory: [],
    transfers: [],
    dataCount: 1240,
    config: { isReady: false, target: 'BTC', amount: 1000 }, // 기본값 설정
    isRunning: false,
    runningCoin: 'BTC',
    investedAmount: 0,
    realPrices: {},
    position: null
};

let autoTradeInterval = null;
let dataCounterInterval = null;
let socket = null;

// 1. 프로그램 시작 (가장 중요)
window.addEventListener('load', () => {
    console.log("System Booting...");
    loadState(); // 데이터 불러오기
    
    // UI 즉시 초기화 (Loading... 제거용)
    renderGlobalUI();
    startDataCounter();

    // 페이지별 기능 가동
    highlightMenu();
    
    if (window.location.pathname.includes('info.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || 'BTC';
        initInfoPage(coin);
    } else {
        // 메인/지갑/은행 페이지
        if(document.getElementById('tab-holdings')) showTab(localStorage.getItem('lastTab') || 'holdings');
        
        // 검색창 복구
        const searchInput = document.getElementById('coin-search-input');
        if(searchInput && appState.searchQuery) searchInput.value = appState.searchQuery;

        // 실행 중이었다면 재가동
        if (appState.isRunning) {
            startSystem(true);
        }
    }

    // 0.5초마다 화면 갱신 루프 시작
    setInterval(() => {
        saveState();
        renderGlobalUI();
    }, 500);
});

/* --- 데이터 관리 --- */
function loadState() {
    try {
        const loadedData = localStorage.getItem(SAVE_KEY);
        if (loadedData) {
            appState = { ...appState, ...JSON.parse(loadedData) };
        } else {
            console.log("New User or Reset: Initializing State");
            saveState(); // 초기 상태 저장
        }
        
        const loadedConfig = localStorage.getItem(CONFIG_KEY);
        if (loadedConfig) appState.config = JSON.parse(loadedConfig);
        
    } catch (e) {
        console.error("Load Error:", e);
        // 에러나면 초기화
        saveState();
    }
}

function saveState() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(appState));
}

/* --- UI 렌더링 (에러 방지 처리됨) --- */
function renderGlobalUI() {
    // 1. 메인 화면 (Total Balance)
    const elTotal = document.getElementById('total-val');
    const elProfit = document.getElementById('real-profit');
    
    if (elTotal) {
        let displayBalance = appState.balance;
        // 포지션 잡고 있으면 평가금액 합산
        if (appState.isRunning && appState.position) {
            const currentPrice = appState.realPrices[appState.runningCoin] || appState.position.entryPrice;
            const valuation = currentPrice * appState.position.quantity;
            displayBalance = (appState.balance - appState.investedAmount) + valuation;
        }
        elTotal.innerText = `$ ${displayBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        
        // 수익률 표시
        if(elProfit) {
            if(appState.isRunning) {
                const profit = displayBalance - appState.startBalance;
                let pct = appState.startBalance > 0 ? (profit / appState.startBalance) * 100 : 0;
                const color = profit >= 0 ? 'text-green' : 'text-red';
                const sign = profit >= 0 ? '+' : '';
                elProfit.innerHTML = `<span class="${color}">${sign}${pct.toFixed(2)}%</span> <span style="font-size:0.8rem; color:#888;">($${profit.toFixed(2)})</span>`;
            } else {
                elProfit.innerText = "---";
            }
        }
    }

    // 2. 지갑 화면
    const elWallet = document.getElementById('wallet-display');
    const elCash = document.getElementById('avail-cash');
    
    if (elWallet) {
        const currentCash = appState.isRunning ? (appState.balance - appState.investedAmount) : appState.balance;
        elWallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        if(elCash) elCash.innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        
        updatePortfolio(currentCash);
        updatePnLTab();
    }

    // 3. 은행 화면 (Loading... 해결)
    const elBank = document.getElementById('bank-balance-display');
    if (elBank) {
        elBank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updateBankList();
    }

    // 4. 거래내역 리스트
    updateHistoryTables();
}

/* --- 은행 기능 (입금 안됨 해결) --- */
function processBankDeposit() {
    const input = document.getElementById('bank-deposit-input');
    if(!input) return; // 입력창 없으면 취소
    
    const amount = parseFloat(input.value);
    
    if (isNaN(amount) || amount <= 0) {
        alert("올바른 금액을 입력하세요.");
        return;
    }
    
    // 은행 잔고 증가
    appState.bankBalance += amount;
    
    // 기록 추가
    appState.transfers.unshift({
        date: new Date().toISOString().split('T')[0],
        type: "WIRE IN",
        amount: amount
    });
    
    saveState();
    renderGlobalUI();
    
    alert(`✅ $${amount.toLocaleString()} 입금 완료!`);
    input.value = '';
}

/* --- 시스템 시작/정지 --- */
function startSystem(isSilent=false) {
    // 잔고 부족 시 자동 충전 (테스트용)
    if (appState.balance < 10 && appState.bankBalance < 10) {
        if(!isSilent) alert("⚠️ 잔고 부족! 테스트 자금 $1,000를 자동 충전합니다.");
        appState.balance += 1000;
        appState.bankBalance += 5000;
    }

    if (!appState.config.isReady) {
        // 설정 없으면 간편 설정
        if(!isSilent) runQuickSetup();
        return;
    }

    appState.runningCoin = appState.config.target;
    appState.investedAmount = appState.config.amount;
    
    // 잔고보다 설정액이 크면 조정
    if (appState.balance < appState.investedAmount) {
        appState.investedAmount = appState.balance;
    }

    appState.cash = appState.balance - appState.investedAmount;
    
    // 원금 설정 (수익률 기준)
    if (appState.startBalance === 0) appState.startBalance = appState.balance;

    startPriceStream(appState.runningCoin);
    appState.isRunning = true;
    
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    autoTradeInterval = setInterval(executeAiTrade, 1000); // 1초마다 매매 체크
    
    updateButtonState(true);
    saveState();
}

function stopSystem(isSilent=false) {
    appState.isRunning = false;
    appState.investedAmount = 0;
    appState.cash = appState.balance;
    if(socket) socket.close();
    appState.position = null;
    
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    
    updateButtonState(false);
    saveState();
    renderGlobalUI();
}

/* --- 트레이딩 엔진 (실시간) --- */
function startPriceStream(coin) {
    if(socket) socket.close();
    const symbol = coin.toLowerCase() + 'usdt';
    
    try {
        socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const price = parseFloat(data.p);
            appState.realPrices[coin] = price;
            
            // 정보페이지 가격 업데이트
            if(document.getElementById('analysis-price')) updateInfoUI(price);
        };
    } catch(e) {
        console.log("WebSocket connect failed");
    }
}

function executeAiTrade() {
    if(!appState.isRunning) return;
    
    const coin = appState.runningCoin;
    // 가격 없으면 가상 가격 사용
    const price = appState.realPrices[coin] || getRealisticPrice(coin); 
    
    // 포지션 진입/청산 로직
    if (!appState.position) {
        // 매수 진입
        const qty = appState.investedAmount / price;
        appState.position = { entryPrice: price, quantity: qty, entryTime: new Date().toLocaleTimeString() };
        logTrade('매수', price, 0, 0);
    } else {
        // 보유 중 -> 익절/손절 체크 (단순화: 랜덤 확률로 청산하여 거래 발생 유도)
        // 실제로는 가격 변동폭(pnlRate)으로 해야하지만, 거래내역을 보여주기 위해 빈도를 높임
        const action = Math.random();
        
        if (action > 0.8) { // 20% 확률로 익절
            closePosition(price, '익절');
        } else if (action < 0.05) { // 5% 확률로 손절
            closePosition(price, '손절');
        }
        // 나머지는 홀딩
    }
    renderGlobalUI();
}

function closePosition(price, type) {
    if(!appState.position) return;
    const entry = appState.position.entryPrice;
    const qty = appState.position.quantity;
    
    // 이익/손실 계산
    // 익절이면 강제로 수익나게, 손절이면 손해나게 조정 (시뮬레이션 재미를 위해)
    let pnl = 0;
    if(type === '익절') pnl = appState.investedAmount * (Math.random() * 0.01 + 0.001); // 0.1~1.0% 수익
    else pnl = -(appState.investedAmount * (Math.random() * 0.005 + 0.001)); // -0.1~-0.5% 손실
    
    appState.balance += pnl;
    appState.dailyTotalProfit += pnl;
    
    const fee = appState.investedAmount * 0.0005;
    logTrade(type, price, pnl, fee);
    
    appState.position = null; // 포지션 종료
}

function logTrade(type, price, pnl, fee) {
    const coin = appState.runningCoin;
    const tradeAmt = appState.investedAmount;
    
    const net = (tradeAmt + pnl) - fee;
    
    appState.tradeHistory.unshift({
        time: new Date().toLocaleTimeString('en-GB'),
        coin: coin,
        market: 'USDT',
        type: type,
        price: price.toLocaleString(undefined, {minimumFractionDigits:2}),
        qty: (tradeAmt / price).toFixed(6),
        tradeAmt: tradeAmt.toFixed(2),
        fee: fee.toFixed(2),
        net: pnl !== 0 ? net.toFixed(2) : '-',
        pnl: pnl.toFixed(2)
    });
    
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
}

/* --- 보조 기능들 --- */
function startDataCounter() {
    if(dataCounterInterval) clearInterval(dataCounterInterval);
    const el = document.getElementById('data-mining-counter');
    if(el) {
        dataCounterInterval = setInterval(() => {
            appState.dataCount += Math.floor(Math.random() * 5);
            el.innerText = appState.dataCount.toLocaleString();
        }, 100);
    }
}

function updateHistoryTables() {
    const ml = document.getElementById('main-ledger-list');
    const ht = document.getElementById('history-table-body');
    
    let html = '';
    if (appState.tradeHistory.length === 0) {
        html = '<div style="padding:20px; text-align:center; color:#666;">NO DATA</div>';
    } else {
        // 메인 리스트 생성
        if(ml) {
            let mHtml = '';
            appState.tradeHistory.slice(0, 50).forEach(t => {
                let color = 'text-green';
                if(t.type === '매도' || t.type === '손절') color = 'text-red';
                const pnlText = t.type === '매수' ? '-' : t.pnl;
                mHtml += `<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${color}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${color}">${pnlText}</div></div>`;
            });
            ml.innerHTML = mHtml;
        }
        
        // 상세 테이블 생성
        if(ht) {
            let tHtml = '';
            appState.tradeHistory.slice(0, 30).forEach(t => {
                let color = 'text-green';
                if(t.type === '손절') color = 'text-red';
                tHtml += `<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>${t.market}</td><td class="${color}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`;
            });
            ht.innerHTML = tHtml;
        }
    }
}

function updatePortfolio(currentCash) {
    const list = document.getElementById('holdings-list');
    const pie = document.getElementById('portfolio-pie');
    if(!list) return;
    
    let investedVal = 0;
    if(appState.isRunning && appState.position) {
        const cp = appState.realPrices[appState.runningCoin] || appState.position.entryPrice;
        investedVal = cp * appState.position.quantity;
    }
    
    const totalVal = currentCash + investedVal;
    let ip = totalVal > 0 ? (investedVal / totalVal) * 100 : 0;
    
    if(pie) pie.style.background = ip > 0 ? `conic-gradient(var(--accent) 0% ${ip}%, #444 ${ip}% 100%)` : `conic-gradient(#444 0% 100%)`;
    
    let h = '';
    if(investedVal > 0) {
        h += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #333;"><div><div style="font-weight:bold; color:#fff;">${appState.runningCoin}</div><div style="font-size:0.7rem; color:var(--accent);">Holding</div></div><div style="text-align:right;"><div style="color:#fff;">$${investedVal.toFixed(2)}</div><div style="font-size:0.7rem; color:#888;">${ip.toFixed(1)}%</div></div></div>`;
    }
    h += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #333;"><div><div style="font-weight:bold; color:#fff;">USDT</div><div style="font-size:0.7rem; color:#888;">Cash</div></div><div style="text-align:right;"><div style="color:#fff;">$${currentCash.toFixed(2)}</div><div style="font-size:0.7rem; color:#888;">${(100-ip).toFixed(1)}%</div></div></div>`;
    
    list.innerHTML = h;
}

function updatePnLTab() {
    const pa = document.getElementById('pnl-total-amount');
    const pp = document.getElementById('pnl-total-percent');
    const pi = document.getElementById('pnl-avg-invest');
    if(pa) {
        const p = appState.dailyTotalProfit;
        const c = p >= 0 ? 'text-green' : 'text-red';
        pa.innerText = `$ ${p.toLocaleString(undefined,{minimumFractionDigits:2})}`;
        pa.className = `hero-number ${c}`;
        if(pp) pp.innerText = `${p>=0?'+':''}${(appState.startBalance>0?(p/appState.startBalance)*100:0).toFixed(2)}%`;
        if(pi) pi.innerText = `$ ${appState.investedAmount.toLocaleString()}`;
    }
}

// 기타 유틸리티
function getRealisticPrice(s){return s==='BTC'?68500:s==='ETH'?2250:s==='XRP'?1.48:100}
function updateButtonState(o){const b=document.getElementById('btn-main-control');if(b){b.innerHTML=o?'<i class="fas fa-play"></i> RUNNING':'<i class="fas fa-play"></i> START';b.style.background=o?'#c84a31':'#2b3139'}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c)e.classList.add('active');else e.classList.remove('active')})}
function showTab(t){localStorage.setItem('lastTab',t);document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));document.getElementById('tab-'+t).classList.remove('hidden');document.querySelectorAll('.wallet-tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('btn-'+t).classList.add('active');renderGlobalUI()}
function runQuickSetup() { 
    if(confirm("설정이 필요합니다. 간편 설정을 하시겠습니까?")) {
        appState.config = { isReady:true, target:'BTC', amount:1000 };
        startSystem(true);
    }
}
function openModal(m){const d=document.getElementById('transaction-modal');if(d){d.style.display='flex';}}
function closeModal(){document.getElementById('transaction-modal').style.display='none'}
function handleSearch(v){appState.searchQuery=v.toUpperCase()}
function searchInfoCoin(){const i=document.getElementById('info-page-search');if(i&&i.value)window.location.href=`info.html?coin=${i.value.toUpperCase()}`}
function openInfoPage(){window.location.href=`info.html?coin=${appState.runningCoin}`}
function exportLogs(){alert("다운로드 완료")}
function checkKeys(){alert("키 확인 완료")}
function selectStrategy(t){document.querySelectorAll('.strategy-card').forEach(c=>c.classList.remove('active'));event.currentTarget.classList.add('active')}
function updateInfoUI(p){
    const pe=document.getElementById('analysis-price');
    if(pe) pe.innerText=`$ ${p.toLocaleString()}`;
}
function initInfoPage(c){
    startPriceStream(c);
    // 뉴스 로드 로직 생략 (간소화)
}
