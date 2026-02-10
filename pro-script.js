/* pro-script.js - V160.0 (Bank Fix & White Bg Fix) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    dailyTotalProfit: 0.00,
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: "",
    realPrices: {}, socket: null, position: null
};
let autoTradeInterval = null;
let dataCounterInterval = null;
const SAVE_KEY = 'neuroBotData_V160_FIX'; // 키 변경으로 초기화
const CONFIG_KEY = 'neuroConfig_V160_FIX';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    // 페이지별 기능 분기
    if (window.location.pathname.includes('info.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || (appState.config.target ? appState.config.target.split('/')[0] : 'BTC');
        initInfoPage(coin);
    } else {
        // 탭 복구
        if(document.getElementById('tab-holdings')) showTab(appState.activeTab || 'holdings');
        
        // 검색어 복구
        const searchInput = document.getElementById('coin-search-input');
        if(searchInput && appState.searchQuery) searchInput.value = appState.searchQuery;

        // 메인 화면이면 실행 상태 체크
        if (document.getElementById('total-val')) {
            if(appState.isRunning) startSystem(true);
            else updateButtonState(false);
        }
        
        startDataCounter();
        // 0.5초마다 UI 갱신 (은행 Loading 해결)
        setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
        renderGlobalUI();
    }
});

/* --- [핵심] 은행 입금 처리 함수 (수정됨) --- */
function processBankDeposit() {
    const input = document.getElementById('bank-deposit-input');
    if(!input) return;
    
    const amt = parseFloat(input.value);

    // 유효성 검사
    if (!amt || isNaN(amt)) return alert("금액을 입력해주세요.");
    if (amt < 10) return alert("⛔ 최소 입금액은 $10 (약 1만원) 입니다.");
    if (amt > 10000000) return alert("⛔ 1회 최대 입금액은 $10,000,000 입니다.");

    // 입금 처리
    appState.bankBalance += amt;
    
    // 내역 기록
    appState.transfers.unshift({
        date: new Date().toISOString().slice(0,10), 
        type: "WIRE IN", 
        amount: amt
    });
    
    saveState(); 
    renderGlobalUI(); 
    
    alert(`✅ $${amt.toLocaleString()} 입금 완료!`);
    input.value = ''; // 입력창 초기화
}

/* --- UI 렌더링 (은행 & 지갑 표시) --- */
function renderGlobalUI() {
    const els = { total: document.getElementById('total-val'), prof: document.getElementById('real-profit') };
    
    // 1. 메인 화면
    if(els.total) {
        if(appState.isRunning) {
            let currentVal = appState.balance; 
            if (appState.position) {
                const currentPrice = appState.realPrices[appState.runningCoin] || appState.position.entryPrice;
                currentVal = (appState.balance - appState.investedAmount) + (currentPrice * appState.position.quantity);
            }
            els.total.innerText = `$ ${currentVal.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            
            const profit = appState.dailyTotalProfit;
            let profitRate = 0;
            if(appState.startBalance > 0) profitRate = (profit / appState.startBalance) * 100;
            
            const color = profit >= 0 ? 'text-green' : 'text-red';
            const sign = profit >= 0 ? '+' : '';
            const status = appState.position ? `<span style="font-size:0.7rem; color:var(--accent);">[HOLDING]</span>` : `<span style="font-size:0.7rem; color:#888;">[WAITING]</span>`;
            
            els.prof.innerHTML = `${status} <span class="${color}">${sign}${profitRate.toFixed(2)}%</span> <span style="font-size:0.8rem; color:#bbb;">($${profit.toFixed(2)})</span>`;
        } else {
            els.total.innerText = `$ 0.00`;
            els.prof.innerText = "---";
        }
    }
    
    // 2. 지갑 화면
    if(document.getElementById('wallet-display')) {
        const currentCash = appState.isRunning ? (appState.balance - appState.investedAmount) : appState.balance;
        document.getElementById('wallet-display').innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        document.getElementById('avail-cash').innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updatePortfolio(currentCash);
        updatePnLTab();
    }

    // 3. [중요] 은행 화면 업데이트
    if(document.getElementById('bank-balance-display')) {
        document.getElementById('bank-balance-display').innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updateBankList();
    }

    // 4. 거래내역 리스트
    updateHistoryTables();
}

/* --- 은행 내역 리스트 업데이트 --- */
function updateBankList() {
    const list = document.getElementById('bank-history-list');
    if(list && appState.transfers) {
        let html = '';
        if(appState.transfers.length === 0) {
            html = '<div style="padding:20px; text-align:center; color:#666;">거래 내역이 없습니다.</div>';
        } else {
            appState.transfers.forEach(t => {
                html += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`;
            });
        }
        list.innerHTML = html;
    }
}

// ... (나머지 필수 함수들: 기존과 동일) ...
function startSystem(s=false) { if (appState.balance < 10) { if(!s) alert("지갑 잔고 부족! 은행에서 입금하세요."); stopSystem(true); return; } if (!appState.config.isReady) { if(!s) alert("AI 설정 필요"); return; } appState.runningCoin = appState.config.target.split('/')[0]; appState.investedAmount = appState.config.amount; appState.cash = appState.balance - appState.investedAmount; if(appState.startBalance===0) appState.startBalance = appState.balance; startPriceStream(appState.runningCoin); appState.isRunning = true; updateButtonState(true); saveState(); }
function stopSystem(s=false) { appState.isRunning = false; appState.investedAmount = 0; appState.cash = appState.balance; if(appState.socket) appState.socket.close(); appState.position = null; updateButtonState(false); saveState(); renderGlobalUI(); }
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(appState))}
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)}}catch(e){}}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d)}catch(e){}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c||(c.includes('info')&&e.href.includes('index')))e.classList.add('active');else e.classList.remove('active')})}
function updateButtonState(o){const b=document.getElementById('btn-main-control');if(b){b.innerHTML=o?'<i class="fas fa-play"></i> RUNNING':'<i class="fas fa-play"></i> START';b.style.background=o?'#c84a31':'#2b3139'}}
function handleSearch(v){appState.searchQuery=v.toUpperCase()}
function searchInfoCoin(){const i=document.getElementById('info-page-search');if(i&&i.value)window.location.href=`info.html?coin=${i.value.toUpperCase()}`}
function openInfoPage(){window.location.href=`info.html?coin=${appState.searchQuery||appState.runningCoin||'BTC'}`}
function showTab(t){appState.activeTab=t;saveState();document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));document.getElementById('tab-'+t).classList.remove('hidden');document.querySelectorAll('.wallet-tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('btn-'+t).classList.add('active');renderGlobalUI()}
function startDataCounter(){if(dataCounterInterval)clearInterval(dataCounterInterval);const e=document.getElementById('data-mining-counter');if(e)dataCounterInterval=setInterval(()=>{appState.dataCount+=Math.floor(Math.random()*5);e.innerText=appState.dataCount.toLocaleString()},100)}
function exportLogs(){if(appState.tradeHistory.length===0)return alert("저장된 데이터가 없습니다.");let c="Time,Coin,Type,Price,Qty,Total,Fee,Net,PnL\n";appState.tradeHistory.forEach(t=>{c+=`${t.time},${t.coin},${t.type},${t.price},${t.qty},${t.tradeAmt},${t.fee},${t.net},${t.pnl}\n`});const b=new Blob([c],{type:'text/csv'});const u=window.URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`TRADE_DATA_${new Date().getTime()}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a)}
function applyBankInterest(){if(appState.bankBalance>0)appState.bankBalance+=(appState.bankBalance*0.0000008)}
function checkKeys(){alert("✅ 키 확인 완료")}
function selectStrategy(t){document.querySelectorAll('.strategy-card').forEach(c=>c.classList.remove('active'));event.currentTarget.classList.add('active')}
function openModal(m){const d=document.getElementById('transaction-modal');if(!d)return;d.style.display='flex';currentTxMode=m;document.getElementById('amount-input').value='';document.getElementById('modal-title').innerText=m==='deposit'?"입금 (은행 → 지갑)":"출금 (지갑 → 은행)";document.getElementById('modal-title').style.color=m==='deposit'?"var(--color-up)":"var(--color-down)"}
function processTx(){const i=document.getElementById('amount-input');const a=parseFloat(i.value);if(!a||a<=0)return alert("금액 오류");if(currentTxMode==='deposit'){if(appState.bankBalance<a)return alert("은행 잔고 부족");appState.bankBalance-=a;appState.balance+=a;appState.cash+=a}else{if(appState.cash<a)return alert("현금 부족");appState.balance-=a;appState.bankBalance+=a;appState.cash-=a}appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW",amount:a});saveState();renderGlobalUI();closeModal()}
function closeModal(){document.getElementById('transaction-modal').style.display='none'}
function calcPercent(p){const i=document.getElementById('amount-input');let b=currentTxMode==='deposit'?appState.bankBalance:appState.cash;if(p===100)i.value=b;else i.value=Math.floor(b*(p/100)*100)/100}
function updateHistoryTables(){const ml=document.getElementById('main-ledger-list');const ht=document.getElementById('history-table-body');if(ml){if(appState.tradeHistory.length===0)ml.innerHTML='<div style="padding:40px; text-align:center; color:#444;">NO DATA</div>';else{let h='';appState.tradeHistory.slice(0,50).forEach(t=>{let c='text-green';if(t.type==='손절'||t.type==='매도')c='text-red';const p=t.type==='매수'?'-':t.pnl;h+=`<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${c}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${c}">${p}</div></div>`});ml.innerHTML=h}}if(ht){if(appState.tradeHistory.length===0)ht.innerHTML='<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">데이터 수집 중...</td></tr>';else{let h='';appState.tradeHistory.slice(0,30).forEach(t=>{let c='text-green';if(t.type==='손절')c='text-red';h+=`<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>${t.market}</td><td class="${c}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`});ht.innerHTML=h}}}
function updatePortfolio(c){const l=document.getElementById('holdings-list');if(!l)return;let iv=0;if(appState.position){const cp=appState.realPrices[appState.runningCoin]||appState.position.entryPrice;iv=cp*appState.position.quantity}const tv=c+iv;let ip=tv>0?(iv/tv)*100:0;const pie=document.getElementById('portfolio-pie');if(pie)pie.style.background=ip>0?`conic-gradient(var(--accent) 0% ${ip}%, #444 ${ip}% 100%)`:`conic-gradient(#444 0% 100%)`;let h='';if(appState.position){const pp=((iv-appState.investedAmount)/appState.investedAmount)*100;const cl=pp>=0?'text-green':'text-red';h+=`<div style="display:flex; justify-content:space-between; align-items:center; padding:15px 5px; border-bottom:1px solid #222;"><div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; background:var(--accent); border-radius:50%;"></div><div><div style="font-weight:bold; color:#fff; font-size:0.95rem;">${appState.runningCoin}</div><div style="font-size:0.75rem; color:var(--accent);">Holding</div></div></div><div style="text-align:right;"><div style="color:#fff; font-weight:bold;">$ ${iv.toLocaleString(undefined,{minimumFractionDigits:2})}</div><div style="font-size:0.75rem;" class="${cl}">${pp.toFixed(2)}%</div></div></div>`}h+=`<div style="display:flex; justify-content:space-between; align-items:center; padding:15px 5px; border-bottom:1px solid #222;"><div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; background:#444; border-radius:50%;"></div><div><div style="font-weight:bold; color:#fff; font-size:0.95rem;">USDT</div><div style="font-size:0.75rem; color:#888;">Cash</div></div></div><div style="text-align:right;"><div style="color:#fff; font-weight:bold;">$ ${c.toLocaleString(undefined,{minimumFractionDigits:2})}</div><div style="font-size:0.75rem; color:#888;">${(100-ip).toFixed(1)}%</div></div></div>`;l.innerHTML=h}
function updatePnLTab(){const pa=document.getElementById('pnl-total-amount');const pp=document.getElementById('pnl-total-percent');const pi=document.getElementById('pnl-avg-invest');if(pa&&appState.startBalance>0){const p=appState.dailyTotalProfit;const pt=(p/appState.startBalance)*100;const c=p>=0?'text-green':'text-red';pa.innerText=`$ ${p.toLocaleString(undefined,{minimumFractionDigits:2})}`;pa.className=`hero-number ${c}`;pp.innerText=`${p>=0?'+':''}${pt.toFixed(2)}%`;pp.className=c;pi.innerText=`$ ${appState.investedAmount.toLocaleString()}`}}
function startPriceStream(coin){if(appState.socket)appState.socket.close();const symbol=coin.toLowerCase()+'usdt';appState.socket=new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);appState.socket.onmessage=(event)=>{const data=JSON.parse(event.data);const price=parseFloat(data.p);appState.realPrices[coin]=price;if(appState.isRunning)checkStrategy(price);if(document.getElementById('analysis-price'))updateInfoUI(price)};appState.socket.onerror=(e)=>{console.log("WS Error",e)}}
function checkStrategy(currentPrice){if(!appState.isRunning)return;if(appState.position===null){enterPosition(currentPrice);return}const entryPrice=appState.position.entryPrice;const pnlRate=(currentPrice-entryPrice)/entryPrice;const TAKE_PROFIT=0.0015;const STOP_LOSS=-0.0010;if(pnlRate>=TAKE_PROFIT)closePosition(currentPrice,'익절');else if(pnlRate<=STOP_LOSS)closePosition(currentPrice,'손절')}
function enterPosition(price){const qty=appState.investedAmount/price;appState.position={entryPrice:price,quantity:qty,entryTime:new Date().toLocaleTimeString('en-GB')};logTrade('매수',price,0,0)}
function closePosition(price,type){if(!appState.position)return;const entryPrice=appState.position.entryPrice;const qty=appState.position.quantity;const rawPnL=(price*qty)-(entryPrice*qty);const fee=(price*qty)*0.0005;const netPnL=rawPnL-fee;appState.balance+=netPnL;appState.dailyTotalProfit+=netPnL;logTrade(type,price,netPnL,fee);appState.position=null}
function logTrade(type,price,pnl,fee){const coin=appState.runningCoin;const tradeAmt=appState.position?(appState.position.quantity*price):appState.investedAmount;appState.tradeHistory.unshift({time:new Date().toLocaleTimeString('en-GB'),coin:coin,market:'USDT',type:type,price:price.toLocaleString(undefined,{minimumFractionDigits:2}),qty:appState.position?appState.position.quantity.toFixed(6):(appState.investedAmount/price).toFixed(6),tradeAmt:tradeAmt.toFixed(2),fee:fee.toFixed(4),net:pnl!==0?(tradeAmt+pnl).toFixed(2):'-',pnl:pnl.toFixed(2)});if(appState.tradeHistory.length>100)appState.tradeHistory.pop()}
function initInfoPage(c){c=c.toUpperCase();const i=document.getElementById('info-page-search');if(i)i.value=c;new TradingView.widget({"container_id":"info_tv_chart","symbol":`BINANCE:${c}USDT`,"interval":"15","theme":"dark","style":"1","locale":"kr","autosize":true,"hide_side_toolbar":false});startPriceStream(c);document.getElementById('analysis-verdict').innerText="실시간 데이터 연결 중...";loadNewsData(c)}
function updateInfoUI(p){const pe=document.getElementById('analysis-price');const se=document.getElementById('ai-score-val');const ve=document.getElementById('analysis-verdict');if(pe){const pp=parseFloat(pe.getAttribute('data-prev'))||p;const c=p>pp?'var(--color-up)':(p<pp?'var(--color-down)':'#fff');pe.innerText=`$ ${p.toLocaleString(undefined,{minimumFractionDigits:2})}`;pe.style.color=c;pe.setAttribute('data-prev',p)}const ds=60+Math.floor((p%10)*3);if(se)se.innerText=Math.min(99,Math.max(40,ds));if(ve){if(ds>=80)ve.innerHTML=`"강력 매수 신호"`;else if(ds>=50)ve.innerHTML=`"중립/관망 구간"`;else ve.innerHTML=`"매도 압력 증가"`;}document.getElementById('val-support').innerText=`$ ${(p*0.985).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-resistance').innerText=`$ ${(p*1.015).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-stoploss').innerText=`$ ${(p*0.97).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-target').innerText=`$ ${(p*1.05).toLocaleString(undefined,{maximumFractionDigits:2})}`;const re=document.getElementById('deep-report-text');if(re&&re.getAttribute('data-updated')!=='true'){re.innerHTML=`현재 <strong>BINANCE</strong> 실시간 시세 <strong>$${p.toLocaleString()}</strong>.<br>매수 벽이 두터워지며 단기 반등 시도 중.<br>⚠️ <strong>전략:</strong> 변동성 주의.`;re.setAttribute('data-updated','true')}}
function loadNewsData(c){const l=document.getElementById('news-board-list');if(!l)return;const t=[{t:`[속보] ${c}, 대규모 고래 이체 포착`,c:`익명 지갑에서 거래소로 대량 이체가 발생했습니다.`},{t:`${c} 네트워크 활성 주소 급증`,c:`온체인 데이터가 긍정적 신호를 보이고 있습니다.`},{t:`[시황] ${c} 주요 지지선 테스트 중`,c:`변동성이 확대되고 있으니 주의가 필요합니다.`},{t:`글로벌 기관, ${c} 포트폴리오 추가`,c:`기관 자금 유입이 기대됩니다.`},{t:`${c} 선물 미결제 약정 증가`,c:`단기 변동성이 커질 수 있습니다.`}];let h='';for(let i=0;i<5;i++){const n=t[i%t.length];h+=`<div class="news-item" onclick="toggleNews(${i})"><div class="news-title"><span class="news-new-badge">NEW</span> ${n.t}</div><div class="news-meta"><span>${new Date().toLocaleTimeString()}</span></div><div id="news-content-${i}" class="news-content">${n.c}</div></div>`;}l.innerHTML=h;}
function toggleNews(i){const e=document.getElementById(`news-content-${i}`);if(e)e.classList.toggle('show')}
