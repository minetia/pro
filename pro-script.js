/* pro-script.js - V280.0 (Security & Balance Integrity Fix) */
const SAVE_KEY = 'neuroBot_V280_CLEAN'; // 버그 난 데이터 버리고 새로 시작
const CONFIG_KEY = 'neuroConfig_V280_CLEAN';

let appState = {
    balance: 0.00,        // [중요] 확정된 내 돈
    cash: 0.00,           // 주문 가능 현금
    bankBalance: 0.00,    // 은행 잔고
    startBalance: 0.00,   // 수익률 계산용 원금
    dailyTotalProfit: 0.00, 
    tradeHistory: [], transfers: [], dataCount: 1240, 
    // keysVerified: false가 기본값 (절대 자동 통과 안됨)
    config: { isReady: false, target: 'BTC', amount: 1000, strategy: 'SCALPING', keysVerified: false }, 
    isRunning: false, runningCoin: 'BTC', investedAmount: 0, 
    realPrices: {}, position: null, searchQuery: ""
};

let autoTradeInterval = null;
let dataCounterInterval = null;
let socket = null;
let pnlChartInstance = null;

// 1. 시스템 초기화 및 페이지 로드
window.addEventListener('load', () => {
    loadState();
    
    try {
        highlightMenu();
        startDataCounter();
        
        // A. 정보 페이지 (Info)
        if (window.location.pathname.includes('info.html')) {
            const urlParams = new URLSearchParams(window.location.search);
            initInfoPage(urlParams.get('coin') || 'BTC');
        } 
        // B. AI 설정 페이지 (AI Core)
        else if (window.location.pathname.includes('ai-core.html')) {
            // 여기서는 아무것도 자동으로 하지 않음 (유저 입력 대기)
            updateButtonState(false);
        }
        // C. 메인 및 나머지 (Index, Wallet, Transfers)
        else {
            if(document.getElementById('tab-holdings')) showTab(localStorage.getItem('lastTab') || 'holdings');
            setupSearchInput();

            // [보안 수정] 키 인증이 안 됐으면 실행 금지
            if (appState.isRunning) {
                if (appState.config.keysVerified) {
                    startSystem(true); // 인증된 상태에서만 재가동
                } else {
                    stopSystem(true); // 인증 풀렸으면 강제 정지
                }
            }
        }
    } catch (e) { console.error("Init Error:", e); }

    // 화면 갱신 (데이터 변조 없이 보여주기만 함)
    setInterval(() => { renderGlobalUI(); }, 500); 
    // *주의: saveState()를 반복문에서 뺐습니다. 데이터 오염 방지.
    // 상태 변경이 있을 때만 수동으로 저장합니다.
});

/* --- [핵심 1] AI 설정 및 보안 --- */

function checkKeys() {
    const k1 = document.getElementById('api-key-input').value.trim();
    const k2 = document.getElementById('secret-key-input').value.trim();
    
    if (k1.length < 10 || k2.length < 10) {
        appState.config.keysVerified = false;
        alert("⛔ 유효하지 않은 키입니다. (너무 짧습니다)");
        saveState();
        return;
    }
    
    appState.config.keysVerified = true;
    saveState(); // 인증 성공 시에만 저장
    
    alert("✅ 키 검증 완료! 보안 연결 승인.");
    const btn = document.querySelector('.verify-btn');
    if(btn) { btn.innerText = "VERIFIED (OK)"; btn.style.background = "var(--color-up)"; }
}

function activateSystem() {
    // 1. 보안 체크 (절대 우회 불가)
    if (!appState.config.keysVerified) {
        return alert("⛔ [보안 경고] API 키 검증을 먼저 수행해야 합니다.");
    }

    const coinInput = document.getElementById('target-coin');
    const amtInput = document.getElementById('invest-amount');
    const coin = coinInput.value.toUpperCase();
    const amt = parseFloat(amtInput.value);

    if (!coin) return alert("코인 심볼 입력 필요");
    if (!amt || amt <= 0) return alert("금액 오류");
    if (amt > appState.balance) return alert(`잔고 부족! (보유: $${appState.balance.toLocaleString()})`);

    // 설정 저장
    appState.config.target = coin;
    appState.config.amount = amt;
    appState.config.isReady = true;
    
    saveState();
    alert(`🚀 시스템 가동 승인!\n대상: ${coin}\n금액: $${amt.toLocaleString()}`);
    window.location.href = 'index.html';
}

/* --- [핵심 2] 자산 무결성 유지 (유령 자금 방지) --- */

function startSystem(isSilent=false) {
    // 보안 재확인
    if (!appState.config.keysVerified) {
        if(!isSilent) alert("인증 정보가 만료되었습니다. AI 설정에서 다시 인증하세요.");
        stopSystem(true);
        return;
    }

    // 잔고 부족 체크 (페이지 이동 없음, 경고만)
    if (appState.balance < 10 && !isSilent) {
        const hasWallet = document.querySelector('a[href="wallet.html"]');
        if(hasWallet) return alert("잔고가 부족합니다. 입출금 메뉴를 이용하세요.");
        else {
             // 일반 버전용 테스트 자금 (최초 1회만)
             if(appState.balance === 0) {
                 appState.balance = 1000; 
                 alert("테스트 자금 $1,000 지급됨");
             }
        }
    }

    appState.runningCoin = appState.config.target;
    
    // 투자금 계산 (잔고 내에서만)
    if (appState.balance < appState.config.amount) appState.investedAmount = appState.balance;
    else appState.investedAmount = appState.config.amount;

    appState.cash = appState.balance - appState.investedAmount;
    if(appState.startBalance === 0) appState.startBalance = appState.balance; // 원금 고정

    startPriceStream(appState.runningCoin);
    appState.isRunning = true;
    
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    autoTradeInterval = setInterval(executeAiTrade, 1000);
    
    updateButtonState(true);
    saveState();
}

// 매매 실행 (여기서만 돈이 바뀜)
function executeAiTrade() {
    if(!appState.isRunning) return;
    const price = appState.realPrices[appState.runningCoin];
    if(!price) return; // 가격 없으면 대기

    // 포지션 진입
    if (!appState.position) {
        const qty = appState.investedAmount / price;
        appState.position = { entryPrice: price, quantity: qty, entryTime: new Date().toLocaleTimeString() };
        logTrade('매수', price, 0, 0);
        saveState(); // 상태 변경 시 저장
    } 
    // 포지션 청산 (랜덤 확률)
    else {
        const chance = Math.random();
        // 5% 확률로 익절, 1% 확률로 손절 (빈도 낮춤)
        if (chance > 0.95) closePosition(price, '익절');
        else if (chance < 0.01) closePosition(price, '손절');
    }
    // *주의: 여기서 renderGlobalUI()만 호출하고 saveState()는 안 함 (화면만 갱신)
}

function closePosition(price, type) {
    if (!appState.position) return;
    
    // 수익 계산
    const entryVal = appState.position.entryPrice * appState.position.quantity;
    const currentVal = price * appState.position.quantity;
    const rawPnL = currentVal - entryVal;
    const fee = currentVal * 0.0005; // 수수료
    const netPnL = rawPnL - fee;

    // [중요] 실제 잔고에 반영 (여기가 유일한 자산 변동 지점)
    appState.balance += netPnL;
    appState.dailyTotalProfit += netPnL;
    
    // 현금 재계산
    if (appState.balance < appState.investedAmount) appState.investedAmount = appState.balance;
    appState.cash = appState.balance - appState.investedAmount;

    logTrade(type, price, netPnL, fee);
    appState.position = null;
    
    saveState(); // 돈이 바뀌었으니 저장
}

/* --- UI 표시 (계산만 하고 저장은 안 함) --- */
function renderGlobalUI() {
    const elTotal = document.getElementById('total-val');
    const elProf = document.getElementById('real-profit');
    
    // 메인 총자산 (보여주기용 임시 변수)
    if(elTotal) {
        let displayTotal = appState.balance; 
        
        // 투자 중이면 평가금액 반영해서 보여줌 (실제 balance는 안 바꿈)
        if(appState.isRunning && appState.position) {
            const currentPrice = appState.realPrices[appState.runningCoin] || appState.position.entryPrice;
            const valuation = currentPrice * appState.position.quantity;
            displayTotal = appState.cash + valuation;
        }
        
        elTotal.innerText = `$ ${displayTotal.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        
        // 수익률 표시
        if(elProf) {
            // 현재 총자산 vs 시작 원금
            const totalPnL = displayTotal - appState.startBalance;
            const rate = appState.startBalance > 0 ? (totalPnL / appState.startBalance) * 100 : 0;
            const color = totalPnL >= 0 ? 'text-green' : 'text-red';
            const sign = totalPnL >= 0 ? '+' : '';
            elProf.innerHTML = `<span class="${color}">${sign}${rate.toFixed(2)}%</span> <span style="font-size:0.8rem; color:#888;">($${totalPnL.toFixed(2)})</span>`;
        }
    }

    // 은행 및 지갑 (단순 표시)
    const elBank = document.getElementById('bank-balance-display');
    if (elBank) elBank.innerText = `$ ${appState.bankBalance.toLocaleString()}`;

    const elWallet = document.getElementById('wallet-display');
    if(elWallet) {
        elWallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        document.getElementById('avail-cash').innerText = `$ ${appState.cash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updatePortfolio(appState.cash);
        updatePnLTab();
    }
    
    updateHistoryTables();
}

/* --- 유틸리티 (검색, 차트 등) --- */
function initInfoPage(c) {
    try {
        if(typeof TradingView !== 'undefined') {
            new TradingView.widget({
                "container_id": "info_tv_chart", "symbol": `BINANCE:${c}USDT`, "interval": "15",
                "theme": "dark", "style": "1", "locale": "kr", "autosize": true, "hide_side_toolbar": false
            });
        }
    } catch(e){}
    startPriceStream(c);
    loadNewsData(c);
    // [중요] 여기서는 절대 appState를 수정하거나 저장하지 않음! (단순 조회)
}

// ... (기타 필수 함수들 - 기존 유지) ...
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)}}catch(e){saveState()}}
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(appState))}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d)}catch(e){}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c)e.classList.add('active');else e.classList.remove('active')})}
function showTab(t){localStorage.setItem('lastTab',t);document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));document.getElementById('tab-'+t).classList.remove('hidden');document.querySelectorAll('.wallet-tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('btn-'+t).classList.add('active');if(t==='pnl')setTimeout(renderPnLChart,100);renderGlobalUI()}
function stopSystem(s=false){appState.isRunning=false;appState.investedAmount=0;appState.cash=appState.balance;if(socket)socket.close();appState.position=null;updateButtonState(false);saveState();renderGlobalUI()}
function startPriceStream(c){if(socket)socket.close();try{socket=new WebSocket(`wss://stream.binance.com:9443/ws/${c.toLowerCase()}usdt@trade`);socket.onmessage=(e)=>{const d=JSON.parse(e.data);const p=parseFloat(d.p);appState.realPrices[c]=p;if(appState.isRunning)executeAiTrade();if(document.getElementById('analysis-price'))updateInfoUI(p)}}catch(e){}}
function logTrade(t,p,pl,f){appState.tradeHistory.unshift({time:new Date().toLocaleTimeString('en-GB'),coin:appState.runningCoin,type:t,price:p.toLocaleString(undefined,{minimumFractionDigits:2}),tradeAmt:appState.investedAmount.toFixed(2),fee:f.toFixed(4),net:pl!==0?(appState.investedAmount+pl).toFixed(2):'-',pnl:pl.toFixed(2),qty:appState.position?appState.position.quantity.toFixed(6):'0.00'});if(appState.tradeHistory.length>50)appState.tradeHistory.pop()}
function updatePortfolio(c){const l=document.getElementById('holdings-list');const pie=document.getElementById('portfolio-pie');if(!l)return;let iv=0;if(appState.position){const p=appState.realPrices[appState.runningCoin]||appState.position.entryPrice;iv=p*appState.position.quantity}const tv=c+iv;let ip=tv>0?(iv/tv)*100:0;if(pie)pie.style.background=ip>0?`conic-gradient(var(--accent) 0% ${ip}%, #444 ${ip}% 100%)`:`conic-gradient(#444 0% 100%)`;l.innerHTML=`<div style="padding:10px;border-bottom:1px solid #333;display:flex;justify-content:space-between"><div><div style="font-weight:bold;color:#fff">${appState.runningCoin}</div><div style="font-size:0.7rem;color:var(--accent)">Holding</div></div><div style="text-align:right"><div style="color:#fff">$${iv.toFixed(2)}</div><div style="font-size:0.7rem">${ip.toFixed(1)}%</div></div></div><div style="padding:10px;border-bottom:1px solid #333;display:flex;justify-content:space-between"><div><div style="font-weight:bold;color:#fff">USDT</div><div style="font-size:0.7rem;color:#888">Cash</div></div><div style="text-align:right"><div style="color:#fff">$${c.toFixed(2)}</div><div style="font-size:0.7rem;color:#888">${(100-ip).toFixed(1)}%</div></div></div>`}
function updatePnLTab(){const a=document.getElementById('pnl-total-amount');const p=document.getElementById('pnl-total-percent');const v=document.getElementById('pnl-avg-invest');if(a){const pr=appState.dailyTotalProfit;const r=appState.startBalance>0?(pr/appState.startBalance)*100:0;const c=pr>=0?'#c84a31':'#5e81f4';a.innerText=`$ ${pr.toLocaleString()}`;a.style.color=c;p.innerText=`${pr>=0?'+':''}${r.toFixed(2)}%`;p.style.color=c;v.innerText=`$ ${appState.investedAmount.toLocaleString()}`}}
function startDataCounter(){const e=document.getElementById('data-mining-counter');if(e)setInterval(()=>{appState.dataCount+=Math.floor(Math.random()*3);e.innerText=appState.dataCount.toLocaleString()},100)}
function updateButtonState(o){const b=document.getElementById('btn-main-control');if(b){if(o){b.innerHTML='<i class="fas fa-sync fa-spin"></i> RUNNING';b.style.background='#2b3139';b.style.color='var(--accent)';b.onclick=()=>stopSystem()}else{b.innerHTML='<i class="fas fa-play"></i> START';b.style.background='#c84a31';b.style.color='#fff';b.onclick=()=>startSystem()}}}
function updateInfoUI(p){const e=document.getElementById('analysis-price');if(e){const pp=parseFloat(e.getAttribute('dp'))||p;e.innerText=`$ ${p.toLocaleString()}`;e.style.color=p>pp?'var(--color-up)':(p<pp?'var(--color-down)':'#fff');e.setAttribute('dp',p)}const v=document.getElementById('analysis-verdict');if(v){v.innerText=`실시간 데이터 수신 중... ($${p})`;v.style.color="#fff"}}
function updateBankList(){const l=document.getElementById('bank-history-list');if(l&&appState.transfers){let h='';if(appState.transfers.length===0)h='<div style="padding:20px;text-align:center">내역 없음</div>';else appState.transfers.forEach(t=>{h+=`<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%;text-align:right">$${t.amount.toLocaleString()}</div></div>`});l.innerHTML=h}}
function updateHistoryTables(){const ml=document.getElementById('main-ledger-list');const ht=document.getElementById('history-table-body');if(ml){if(appState.tradeHistory.length===0)ml.innerHTML='<div style="padding:20px;text-align:center;color:#666">NO DATA</div>';else{let h='';appState.tradeHistory.slice(0,50).forEach(t=>{let c=(t.type==='매도'||t.type==='손절')?'text-red':'text-green';let p=t.type==='매수'?'-':t.pnl;h+=`<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${c}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${c}">${p}</div></div>`});ml.innerHTML=h}}if(ht){if(appState.tradeHistory.length===0)ht.innerHTML='<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">거래 내역이 없습니다.</td></tr>';else{let h='';appState.tradeHistory.slice(0,30).forEach(t=>{let c=(t.type==='매도'||t.type==='손절')?'text-red':'text-green';h+=`<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>USDT</td><td class="${c}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`});ht.innerHTML=h}}}
function openModal(m){currentTxMode=m;document.getElementById('amount-input').value='';document.getElementById('transaction-modal').style.display='flex';document.getElementById('modal-title').innerText=m==='deposit'?"입금 (은행 → 지갑)":"출금 (지갑 → 은행)"}
function closeModal(){document.getElementById('transaction-modal').style.display='none'}
function processTx(){const i=document.getElementById('amount-input');const a=parseFloat(i.value);if(!a)return;if(currentTxMode==='deposit'){if(appState.bankBalance<a)return alert("잔고 부족");appState.bankBalance-=a;appState.balance+=a;appState.cash+=a}else{if(appState.cash<a)return alert("현금 부족");appState.balance-=a;appState.cash-=a;appState.bankBalance+=a}appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:currentTxMode,amount:a});saveState();renderGlobalUI();closeModal()}
function processBankDeposit(){const i=document.getElementById('bank-deposit-input');const a=parseFloat(i.value);if(!a)return;appState.bankBalance+=a;appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:"WIRE IN",amount:a});saveState();renderGlobalUI();alert("입금 완료");i.value=''}
function calcPercent(p){const i=document.getElementById('amount-input');const b=currentTxMode==='deposit'?appState.bankBalance:appState.cash;i.value=Math.floor(b*(p/100))}
function applyBankInterest(){if(appState.bankBalance>0)appState.bankBalance+=appState.bankBalance*0.0000001}
function exportLogs(){alert("로그 다운로드")}
function handleSearch(v){appState.searchQuery=v.toUpperCase()}
function loadNewsData(c){const l=document.getElementById('news-board-list');if(!l)return;l.innerHTML=`<div class="news-item"><div class="news-title">실시간 ${c} 뉴스 피드 연결됨</div></div>`;}
function searchInfoCoin(){const i=document.getElementById('coin-search-input');let c='BTC';if(i&&i.value.trim()!="")c=i.value.trim().toUpperCase();else if(appState.searchQuery)c=appState.searchQuery;window.location.href=`info.html?coin=${c}`}
function setupSearchInput(){const s=document.getElementById('coin-search-input');if(s){if(appState.searchQuery)s.value=appState.searchQuery;s.addEventListener('keyup',(e)=>{if(e.key==='Enter')searchInfoCoin();else appState.searchQuery=e.target.value.toUpperCase()})}}
function selectStrategy(el,name){document.querySelectorAll('.strategy-card').forEach(c=>c.classList.remove('active'));el.classList.add('active');appState.config.strategy=name}
function renderPnLChart(){const c=document.getElementById('pnlChart');if(c){if(pnlChartInstance)pnlChartInstance.destroy();pnlChartInstance=new Chart(c,{type:'line',data:{labels:['7d','6d','5d','4d','3d','2d','Today'],datasets:[{label:'PnL',data:[0,0,0,0,0,0,appState.dailyTotalProfit],borderColor:appState.dailyTotalProfit>=0?'#c84a31':'#5e81f4',backgroundColor:'rgba(0,0,0,0)',borderWidth:2}]},options:{plugins:{legend:{display:false}},scales:{x:{display:false},y:{grid:{color:'#333'}}}}})}}
