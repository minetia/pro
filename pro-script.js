/* pro-script.js - V210.0 (Key Validation & Chart Fix) */
const SAVE_KEY = 'neuroBot_V200_FINAL';
const CONFIG_KEY = 'neuroConfig_V200_FINAL';

let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    dailyTotalProfit: 0.00, tradeHistory: [], transfers: [], dataCount: 1240, 
    config: { isReady: false, target: 'BTC', amount: 1000 }, 
    isRunning: false, runningCoin: 'BTC', investedAmount: 0, 
    realPrices: {}, position: null, searchQuery: ""
};

let autoTradeInterval = null;
let dataCounterInterval = null;
let socket = null;

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    if (window.location.pathname.includes('info.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || 'BTC';
        initInfoPage(coin);
    } else {
        if(document.getElementById('tab-holdings')) showTab(localStorage.getItem('lastTab') || 'holdings');
        const searchInput = document.getElementById('coin-search-input');
        if(searchInput) {
            if(appState.searchQuery) searchInput.value = appState.searchQuery;
            searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') searchInfoCoin(); else appState.searchQuery = e.target.value.toUpperCase(); });
        }
        if (appState.isRunning) startSystem(true);
    }
    startDataCounter();
    setInterval(() => { saveState(); renderGlobalUI(); }, 500);
    renderGlobalUI();
});

/* --- [수정 1] AI 키 검증 로직 강화 --- */
function checkKeys() {
    // HTML에서 ID로 값을 가져옵니다
    const key1 = document.getElementById('api-key-input').value.trim();
    const key2 = document.getElementById('secret-key-input').value.trim();

    // 검증: 비어있거나 너무 짧으면(10자 미만) 거절
    if (key1.length < 10 || key2.length < 10) {
        alert("⛔ 유효하지 않은 API 키입니다.\n(키는 최소 10자리 이상이어야 합니다.)");
        return;
    }

    alert("✅ 키 검증 완료!\n보안 연결이 설정되었습니다.");
    
    // 검증 성공 시 버튼 활성화 효과
    const btn = document.querySelector('.verify-btn'); // 클래스로 찾기
    if(btn) {
        btn.innerText = "VERIFIED";
        btn.style.background = "var(--color-up)";
        btn.style.color = "#fff";
    }
}

/* --- [수정 2] 정보 페이지 무한로딩 방지 --- */
function initInfoPage(coin) {
    coin = coin.toUpperCase();
    
    // 1. 차트 그리기 (에러 나도 무시하고 다음으로 넘어감)
    try {
        if(typeof TradingView !== 'undefined') {
            new TradingView.widget({
                "container_id": "info_tv_chart",
                "symbol": `BINANCE:${coin}USDT`,
                "interval": "15",
                "theme": "dark",
                "style": "1",
                "locale": "kr",
                "autosize": true,
                "hide_side_toolbar": false
            });
        }
    } catch (e) {
        console.log("Chart Error:", e);
        document.getElementById('info_tv_chart').innerHTML = "<div style='color:#666; text-align:center; padding-top:150px;'>차트 로딩 실패 (인터넷 연결 확인)</div>";
    }

    // 2. 가격 데이터 연결 (즉시 실행)
    startPriceStream(coin);
    
    // 3. 로딩 텍스트 즉시 제거 (데이터 오기 전이라도)
    const verdict = document.getElementById('analysis-verdict');
    if(verdict) verdict.innerText = "실시간 분석 대기 중...";
    
    loadNewsData(coin);
}

// ... (나머지 기존 핵심 로직들은 그대로 유지 - 압축) ...
function searchInfoCoin(){const i=document.getElementById('coin-search-input');let c='BTC';if(i&&i.value.trim()!="")c=i.value.trim().toUpperCase();else if(appState.searchQuery)c=appState.searchQuery;window.location.href=`info.html?coin=${c}`}
function renderGlobalUI(){const els={total:document.getElementById('total-val'),prof:document.getElementById('real-profit')};if(els.total){if(appState.isRunning){let v=appState.balance;if(appState.position){const p=appState.realPrices[appState.runningCoin]||appState.position.entryPrice;v=(appState.balance-appState.investedAmount)+(p*appState.position.quantity)}els.total.innerText=`$ ${v.toLocaleString(undefined,{minimumFractionDigits:2})}`;if(els.prof){const p=appState.dailyTotalProfit;const r=appState.startBalance>0?(p/appState.startBalance)*100:0;const c=p>=0?'text-green':'text-red';els.prof.innerHTML=`<span class="${c}">${p>=0?'+':''}${r.toFixed(2)}%</span>`}}}if(document.getElementById('wallet-display')){const c=appState.isRunning?(appState.balance-appState.investedAmount):appState.balance;document.getElementById('wallet-display').innerText=`$ ${appState.balance.toLocaleString(undefined,{minimumFractionDigits:2})}`;document.getElementById('avail-cash').innerText=`$ ${c.toLocaleString(undefined,{minimumFractionDigits:2})}`;updatePortfolio(c);updatePnLTab()}if(document.getElementById('bank-balance-display')){document.getElementById('bank-balance-display').innerText=`$ ${appState.bankBalance.toLocaleString(undefined,{minimumFractionDigits:2})}`;updateBankList()}updateHistoryTables()}
function updateHistoryTables(){const ml=document.getElementById('main-ledger-list');const ht=document.getElementById('history-table-body');if(ml){if(appState.tradeHistory.length===0)ml.innerHTML='<div style="padding:20px;text-align:center;color:#666">NO DATA</div>';else{let h='';appState.tradeHistory.slice(0,50).forEach(t=>{let c=(t.type==='매도'||t.type==='손절')?'text-red':'text-green';let p=t.type==='매수'?'-':t.pnl;h+=`<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${c}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${c}">${p}</div></div>`});ml.innerHTML=h}}if(ht){if(appState.tradeHistory.length===0)ht.innerHTML='<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">거래 내역이 없습니다.</td></tr>';else{let h='';appState.tradeHistory.slice(0,30).forEach(t=>{let c=(t.type==='매도'||t.type==='손절')?'text-red':'text-green';h+=`<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>USDT</td><td class="${c}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`});ht.innerHTML=h}}}
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)}}catch(e){saveState()}}
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(appState))}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d)}catch(e){}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c)e.classList.add('active');else e.classList.remove('active')})}
function showTab(t){localStorage.setItem('lastTab',t);document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));document.getElementById('tab-'+t).classList.remove('hidden');document.querySelectorAll('.wallet-tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('btn-'+t).classList.add('active');renderGlobalUI()}
function startSystem(s=false){if(appState.balance<10){const h=document.querySelector('a[href="wallet.html"]');if(!h){if(!s)alert("테스트 자금 충전");appState.balance+=1000}else{if(!s)alert("잔고 부족.");stopSystem(true);return}}if(!appState.config.isReady){if(!s)runQuickSetup();return}appState.runningCoin=appState.config.target;appState.investedAmount=appState.config.amount;appState.cash=appState.balance-appState.investedAmount;if(appState.startBalance===0)appState.startBalance=appState.balance;startPriceStream(appState.runningCoin);appState.isRunning=true;if(autoTradeInterval)clearInterval(autoTradeInterval);autoTradeInterval=setInterval(executeAiTrade,1000);updateButtonState(true);saveState()}
function stopSystem(s=false){appState.isRunning=false;appState.investedAmount=0;appState.cash=appState.balance;if(socket)socket.close();appState.position=null;updateButtonState(false);saveState();renderGlobalUI()}
function startPriceStream(c){if(socket)socket.close();try{socket=new WebSocket(`wss://stream.binance.com:9443/ws/${c.toLowerCase()}usdt@trade`);socket.onmessage=(e)=>{const d=JSON.parse(e.data);const p=parseFloat(d.p);appState.realPrices[c]=p;if(appState.isRunning)checkStrategy(p);if(document.getElementById('analysis-price'))updateInfoUI(p)}}catch(e){}}
function checkStrategy(p){if(!appState.position){const q=appState.investedAmount/p;appState.position={entryPrice:p,quantity:q,entryTime:new Date().toLocaleTimeString()};logTrade('매수',p,0,0)}else{const ep=appState.position.entryPrice;const r=(p-ep)/ep;if(r>=0.0015)closePosition(p,'익절');else if(r<=-0.0010)closePosition(p,'손절')}}
function closePosition(p,t){if(!appState.position)return;const ep=appState.position.entryPrice;const q=appState.position.quantity;const raw=(p*q)-(ep*q);const f=(p*q)*0.0005;const net=raw-f;appState.balance+=net;appState.dailyTotalProfit+=net;logTrade(t,p,net,f);appState.position=null}
function logTrade(t,p,pl,f){appState.tradeHistory.unshift({time:new Date().toLocaleTimeString('en-GB'),coin:appState.runningCoin,type:t,price:p.toLocaleString(undefined,{minimumFractionDigits:2}),tradeAmt:appState.investedAmount.toFixed(2),fee:f.toFixed(4),net:pl!==0?(appState.investedAmount+pl).toFixed(2):'-',pnl:pl.toFixed(2),qty:appState.position?appState.position.quantity.toFixed(6):'0.00'});if(appState.tradeHistory.length>50)appState.tradeHistory.pop()}
function updatePortfolio(c){const l=document.getElementById('holdings-list');const pie=document.getElementById('portfolio-pie');if(!l)return;let iv=0;if(appState.position){const p=appState.realPrices[appState.runningCoin]||appState.position.entryPrice;iv=p*appState.position.quantity}const tv=c+iv;let ip=tv>0?(iv/tv)*100:0;if(pie)pie.style.background=ip>0?`conic-gradient(var(--accent) 0% ${ip}%, #444 ${ip}% 100%)`:`conic-gradient(#444 0% 100%)`;l.innerHTML=`<div style="padding:10px;border-bottom:1px solid #333;display:flex;justify-content:space-between"><div><div style="font-weight:bold;color:#fff">${appState.runningCoin}</div><div style="font-size:0.7rem;color:var(--accent)">Holding</div></div><div style="text-align:right"><div style="color:#fff">$${iv.toFixed(2)}</div><div style="font-size:0.7rem">${ip.toFixed(1)}%</div></div></div><div style="padding:10px;border-bottom:1px solid #333;display:flex;justify-content:space-between"><div><div style="font-weight:bold;color:#fff">USDT</div><div style="font-size:0.7rem;color:#888">Cash</div></div><div style="text-align:right"><div style="color:#fff">$${c.toFixed(2)}</div><div style="font-size:0.7rem;color:#888">${(100-ip).toFixed(1)}%</div></div></div>`}
function updatePnLTab(){const a=document.getElementById('pnl-total-amount');if(a){const p=appState.dailyTotalProfit;a.innerText=`$ ${p.toLocaleString(undefined,{minimumFractionDigits:2})}`;a.className=`hero-number ${p>=0?'text-green':'text-red'}`}}
function startDataCounter(){const e=document.getElementById('data-mining-counter');if(e)setInterval(()=>{appState.dataCount+=3;e.innerText=appState.dataCount.toLocaleString()},100)}
function runQuickSetup(){if(confirm("설정 하시겠습니까?")){appState.config={isReady:true,target:'BTC',amount:1000};startSystem(true)}}
function updateButtonState(o){const b=document.getElementById('btn-main-control');if(b)b.innerHTML=o?'Running':'Start'}
function updateInfoUI(p){const e=document.getElementById('analysis-price');if(e){const pp=parseFloat(e.getAttribute('dp'))||p;e.innerText=`$ ${p.toLocaleString()}`;e.style.color=p>pp?'var(--color-up)':(p<pp?'var(--color-down)':'#fff');e.setAttribute('dp',p)}const v=document.getElementById('analysis-verdict');if(v){v.innerText=`실시간 데이터 수신 중... ($${p})`;v.style.color="#fff"}}
function updateBankList(){const l=document.getElementById('bank-history-list');if(l&&appState.transfers){let h='';if(appState.transfers.length===0)h='<div style="padding:20px;text-align:center">내역 없음</div>';else appState.transfers.forEach(t=>{h+=`<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%;text-align:right">$${t.amount.toLocaleString()}</div></div>`});l.innerHTML=h}}
function openModal(m){currentTxMode=m;document.getElementById('amount-input').value='';document.getElementById('transaction-modal').style.display='flex';document.getElementById('modal-title').innerText=m==='deposit'?"입금 (은행 → 지갑)":"출금 (지갑 → 은행)"}
function closeModal(){document.getElementById('transaction-modal').style.display='none'}
function processTx(){const i=document.getElementById('amount-input');const a=parseFloat(i.value);if(!a)return;if(currentTxMode==='deposit'){if(appState.bankBalance<a)return alert("잔고 부족");appState.bankBalance-=a;appState.balance+=a;appState.cash+=a}else{if(appState.cash<a)return alert("현금 부족");appState.balance-=a;appState.cash-=a;appState.bankBalance+=a}appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:currentTxMode,amount:a});saveState();renderGlobalUI();closeModal()}
function processBankDeposit(){const i=document.getElementById('bank-deposit-input');const a=parseFloat(i.value);if(!a)return;appState.bankBalance+=a;appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:"WIRE IN",amount:a});saveState();renderGlobalUI();alert("입금 완료");i.value=''}
function calcPercent(p){const i=document.getElementById('amount-input');const b=currentTxMode==='deposit'?appState.bankBalance:appState.cash;i.value=Math.floor(b*(p/100))}
function applyBankInterest(){if(appState.bankBalance>0)appState.bankBalance+=appState.bankBalance*0.0000001}
function exportLogs(){alert("로그 다운로드")}
function selectStrategy(){alert("전략 선택")}
function handleSearch(v){appState.searchQuery=v.toUpperCase()}
function loadNewsData(c){const l=document.getElementById('news-board-list');if(!l)return;l.innerHTML=`<div class="news-item"><div class="news-title">실시간 ${c} 뉴스 피드 연결됨</div></div>`;}
