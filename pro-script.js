/* pro-script.js - V180.0 (Transfer System Fix) */
const SAVE_KEY = 'neuroBot_V180_FIXED'; // 키 변경 (꼬인 데이터 풀기 위함)
const CONFIG_KEY = 'neuroConfig_V180_FIXED';

let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    dailyTotalProfit: 0.00, tradeHistory: [], transfers: [], dataCount: 1240, 
    config: { isReady: false, target: 'BTC', amount: 1000 }, 
    isRunning: false, runningCoin: 'BTC', investedAmount: 0, 
    realPrices: {}, position: null
};

let autoTradeInterval = null;
let dataCounterInterval = null;
let socket = null;
let currentTxMode = ''; // [중요] 이체 모드 전역 변수 선언

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    // 페이지별 초기화
    if (window.location.pathname.includes('info.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        initInfoPage(urlParams.get('coin') || 'BTC');
    } else {
        if(document.getElementById('tab-holdings')) showTab(localStorage.getItem('lastTab') || 'holdings');
        const searchInput = document.getElementById('coin-search-input');
        if(searchInput && appState.searchQuery) searchInput.value = appState.searchQuery;
        if (appState.isRunning) startSystem(true);
    }

    startDataCounter();
    setInterval(() => { saveState(); renderGlobalUI(); }, 500);
    renderGlobalUI();
});

/* --- [핵심] 지갑 <-> 은행 이체 시스템 --- */

// 1. 모달창 열기
function openModal(mode) {
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const input = document.getElementById('amount-input');
    
    if(!modal) return;
    
    currentTxMode = mode; // 모드 설정 (deposit 또는 withdraw)
    input.value = ''; // 입력창 초기화
    modal.style.display = 'flex';
    
    if(mode === 'deposit') {
        title.innerText = "입금 (은행 → 지갑)";
        title.style.color = "var(--color-up)";
        input.placeholder = `가져올 금액 입력 (은행잔고: $${appState.bankBalance.toLocaleString()})`;
    } else {
        title.innerText = "출금 (지갑 → 은행)";
        title.style.color = "var(--color-down)";
        input.placeholder = `보낼 금액 입력 (보유현금: $${appState.cash.toLocaleString()})`;
    }
}

// 2. 이체 실행 (확인 버튼 클릭 시)
function processTx() {
    const input = document.getElementById('amount-input');
    const amount = parseFloat(input.value);

    if(isNaN(amount) || amount <= 0) return alert("올바른 금액을 입력해주세요.");

    // A. 지갑 입금 (은행 -> 지갑)
    if(currentTxMode === 'deposit') {
        if(appState.bankBalance < amount) {
            return alert(`⛔ 은행 잔고가 부족합니다!\n현재 은행 잔고: $${appState.bankBalance.toLocaleString()}`);
        }
        appState.bankBalance -= amount; // 은행에서 빼고
        appState.balance += amount;     // 지갑 총액 더하고
        appState.cash += amount;        // 지갑 현금 더하고
        alert(`✅ $${amount.toLocaleString()} 가져오기 성공!\n(은행 -> 지갑)`);
    } 
    // B. 지갑 출금 (지갑 -> 은행)
    else {
        if(appState.cash < amount) {
            return alert(`⛔ 출금할 현금이 부족합니다!\n주문가능 현금: $${appState.cash.toLocaleString()}`);
        }
        appState.balance -= amount;     // 지갑 총액 빼고
        appState.cash -= amount;        // 지갑 현금 빼고
        appState.bankBalance += amount; // 은행에 더하고
        alert(`✅ $${amount.toLocaleString()} 보내기 성공!\n(지갑 -> 은행)`);
    }

    // 기록 남기기
    appState.transfers.unshift({
        date: new Date().toISOString().slice(0,10),
        type: currentTxMode === 'deposit' ? "WALLET IMPORT" : "WALLET EXPORT",
        amount: amount
    });

    saveState();
    renderGlobalUI();
    closeModal();
}

// 3. 퍼센트 계산
function calcPercent(percent) {
    const input = document.getElementById('amount-input');
    let baseAmount = 0;
    
    if(currentTxMode === 'deposit') baseAmount = appState.bankBalance;
    else baseAmount = appState.cash;
    
    if(percent === 100) input.value = baseAmount;
    else input.value = Math.floor(baseAmount * (percent / 100));
}

// 4. 모달 닫기
function closeModal() {
    document.getElementById('transaction-modal').style.display = 'none';
}

/* --- 은행 입금 (외부 충전) --- */
function processBankDeposit() {
    const input = document.getElementById('bank-deposit-input');
    if(!input) return;
    const amt = parseFloat(input.value);
    if (!amt || amt <= 0) return alert("금액을 입력하세요.");
    
    appState.bankBalance += amt;
    appState.transfers.unshift({date: new Date().toISOString().slice(0,10), type: "WIRE IN", amount: amt});
    
    saveState(); 
    renderGlobalUI(); 
    alert(`✅ 은행에 $${amt.toLocaleString()} 입금되었습니다.\n이제 '지갑' 메뉴에서 [입금(가져오기)]를 하세요.`);
    input.value = '';
}

/* --- UI 렌더링 --- */
function renderGlobalUI() {
    // 1. 메인 Total
    const elTotal = document.getElementById('total-val');
    const elProf = document.getElementById('real-profit');
    if (elTotal) {
        let val = appState.balance;
        if (appState.isRunning && appState.position) {
            const price = appState.realPrices[appState.runningCoin] || appState.position.entryPrice;
            val = (appState.balance - appState.investedAmount) + (price * appState.position.quantity);
        }
        elTotal.innerText = `$ ${val.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        
        if(elProf) {
            const p = appState.dailyTotalProfit;
            const r = appState.startBalance > 0 ? (p/appState.startBalance)*100 : 0;
            const c = p >= 0 ? 'text-green' : 'text-red';
            elProf.innerHTML = `<span class="${c}">${p>=0?'+':''}${r.toFixed(2)}%</span> <span style="font-size:0.8rem; color:#888;">($${p.toFixed(2)})</span>`;
        }
    }

    // 2. 지갑
    const elWallet = document.getElementById('wallet-display');
    const elCash = document.getElementById('avail-cash');
    if (elWallet) {
        const cash = appState.isRunning ? (appState.balance - appState.investedAmount) : appState.balance;
        elWallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        if(elCash) elCash.innerText = `$ ${cash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updatePortfolio(cash);
        updatePnLTab();
    }

    // 3. 은행
    const elBank = document.getElementById('bank-balance-display');
    if (elBank) {
        elBank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updateBankList();
    }
    
    updateHistoryTables();
}

// ... (나머지 필수 함수들은 기존 유지 - 압축) ...
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)}}catch(e){saveState()}}
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(appState))}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d)}catch(e){}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c)e.classList.add('active');else e.classList.remove('active')})}
function showTab(t){localStorage.setItem('lastTab',t);document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));document.getElementById('tab-'+t).classList.remove('hidden');document.querySelectorAll('.wallet-tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('btn-'+t).classList.add('active');renderGlobalUI()}
function startSystem(s=false){if(appState.balance<10){const hasW=document.querySelector('a[href="wallet.html"]');if(!hasW){if(!s)alert("테스트 자금 자동 충전 ($1,000)");appState.balance+=1000}else{if(!s)alert("지갑 잔고 부족! [입출금] 메뉴에서 은행 입금 후, 지갑으로 가져오세요.");stopSystem(true);return}}if(!appState.config.isReady){if(!s)runQuickSetup();return}appState.runningCoin=appState.config.target;appState.investedAmount=appState.config.amount;if(appState.balance<appState.investedAmount)appState.investedAmount=appState.balance;appState.cash=appState.balance-appState.investedAmount;if(appState.startBalance===0)appState.startBalance=appState.balance;startPriceStream(appState.runningCoin);appState.isRunning=true;if(autoTradeInterval)clearInterval(autoTradeInterval);autoTradeInterval=setInterval(executeAiTrade,1000);updateButtonState(true);saveState()}
function stopSystem(s=false){appState.isRunning=false;appState.investedAmount=0;appState.cash=appState.balance;if(socket)socket.close();appState.position=null;updateButtonState(false);saveState();renderGlobalUI()}
function startPriceStream(c){if(socket)socket.close();const s=c.toLowerCase()+'usdt';try{socket=new WebSocket(`wss://stream.binance.com:9443/ws/${s}@trade`);socket.onmessage=(e)=>{const d=JSON.parse(e.data);const p=parseFloat(d.p);appState.realPrices[c]=p;if(document.getElementById('analysis-price'))updateInfoUI(p)}}catch(e){}}
function executeAiTrade(){if(!appState.isRunning)return;const c=appState.runningCoin;const p=appState.realPrices[c]||68000;if(!appState.position){const q=appState.investedAmount/p;appState.position={entryPrice:p,quantity:q,entryTime:new Date().toLocaleTimeString()};logTrade('매수',p,0,0)}else{const r=Math.random();if(r>0.8)closePosition(p,'익절');else if(r<0.05)closePosition(p,'손절')}renderGlobalUI()}
function closePosition(p,t){if(!appState.position)return;let pl=0;if(t==='익절')pl=appState.investedAmount*(Math.random()*0.01+0.001);else pl=-(appState.investedAmount*(Math.random()*0.005+0.001));appState.balance+=pl;appState.dailyTotalProfit+=pl;const f=appState.investedAmount*0.0005;logTrade(t,p,pl,f);appState.position=null}
function logTrade(t,p,pl,f){appState.tradeHistory.unshift({time:new Date().toLocaleTimeString('en-GB'),coin:appState.runningCoin,type:t,price:p.toLocaleString(),tradeAmt:appState.investedAmount.toFixed(2),fee:f.toFixed(2),net:pl!==0?(appState.investedAmount+pl-f).toFixed(2):'-',pnl:pl.toFixed(2)});if(appState.tradeHistory.length>50)appState.tradeHistory.pop()}
function updateHistoryTables(){const ml=document.getElementById('main-ledger-list');const ht=document.getElementById('history-table-body');let h='';if(appState.tradeHistory.length===0)h='NO DATA';else{if(ml){let mh='';appState.tradeHistory.slice(0,50).forEach(t=>{let c=t.type==='손절'?'text-red':'text-green';mh+=`<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${c}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${c}">${t.type==='매수'?'-':t.pnl}</div></div>`});ml.innerHTML=mh}if(ht){let th='';appState.tradeHistory.slice(0,30).forEach(t=>{let c=t.type==='손절'?'text-red':'text-green';th+=`<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>USDT</td><td class="${c}">${t.type}</td><td>-</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`});ht.innerHTML=th}}}
function updatePortfolio(c){const l=document.getElementById('holdings-list');if(!l)return;let iv=0;if(appState.position){const cp=appState.realPrices[appState.runningCoin]||appState.position.entryPrice;iv=cp*appState.position.quantity}const tv=c+iv;let ip=tv>0?(iv/tv)*100:0;const pie=document.getElementById('portfolio-pie');if(pie)pie.style.background=ip>0?`conic-gradient(var(--accent) 0% ${ip}%, #444 ${ip}% 100%)`:`conic-gradient(#444 0% 100%)`;l.innerHTML=`<div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between;"><div><div style="font-weight:bold; color:#fff;">${appState.runningCoin}</div><div style="font-size:0.7rem; color:var(--accent);">Holding</div></div><div style="text-align:right;"><div>$${iv.toFixed(2)}</div><div style="font-size:0.7rem;">${ip.toFixed(1)}%</div></div></div><div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between;"><div><div style="font-weight:bold; color:#fff;">USDT</div><div style="font-size:0.7rem; color:#888;">Cash</div></div><div style="text-align:right;"><div>$${c.toFixed(2)}</div><div style="font-size:0.7rem;">${(100-ip).toFixed(1)}%</div></div></div>`}
function updateBankList(){const l=document.getElementById('bank-history-list');if(l){let h='';if(appState.transfers.length===0)h='<div style="padding:20px; text-align:center;">내역 없음</div>';else appState.transfers.forEach(t=>{h+=`<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`});l.innerHTML=h}}
function startDataCounter(){const e=document.getElementById('data-mining-counter');if(e)setInterval(()=>{appState.dataCount+=Math.floor(Math.random()*5);e.innerText=appState.dataCount.toLocaleString()},100)}
function updatePnLTab(){const a=document.getElementById('pnl-total-amount');if(a){const p=appState.dailyTotalProfit;a.innerText=`$ ${p.toLocaleString()}`;a.className=`hero-number ${p>=0?'text-green':'text-red'}`}}
function runQuickSetup(){if(confirm("설정 하시겠습니까?")){appState.config={isReady:true,target:'BTC',amount:1000};startSystem(true)}}
function updateButtonState(o){const b=document.getElementById('btn-main-control');if(b)b.innerHTML=o?'Running':'Start'}
function updateInfoUI(p){const e=document.getElementById('analysis-price');if(e)e.innerText=`$ ${p.toLocaleString()}`}
function initInfoPage(c){startPriceStream(c)}
function exportLogs(){alert('다운로드')}
function handleSearch(v){appState.searchQuery=v}
function searchInfoCoin(){}
function openInfoPage(){}
function applyBankInterest(){if(appState.bankBalance>0)appState.bankBalance+=appState.bankBalance*0.0000001}
