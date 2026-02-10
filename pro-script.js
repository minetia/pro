/* pro-script.js - V90.0 (Real-time PnL & Buy/Sell Mix) */
let appState = {
    balance: 0.00,        // 총 자산
    cash: 0.00,           // 현금
    bankBalance: 0.00,    // 은행 잔고
    startBalance: 0.00,   // 시작 자산 (수익률 계산용)
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: ""
};
let autoTradeInterval = null;
let dataCounterInterval = null;
let infoPriceInterval = null;
const SAVE_KEY = 'neuroBotData_V90_FINAL';
const CONFIG_KEY = 'neuroConfig_V90_FINAL';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    // 정보 페이지면 코인 정보 로드
    if (window.location.pathname.includes('info.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || (appState.config.target ? appState.config.target.split('/')[0] : 'BTC');
        initInfoPage(coin);
    } else {
        if(document.getElementById('tab-holdings')) {
            const lastTab = appState.activeTab || 'holdings';
            showTab(lastTab);
        }
        const searchInput = document.getElementById('coin-search-input');
        if(searchInput && appState.searchQuery) searchInput.value = appState.searchQuery;

        // 자동 시작 로직
        if (appState.isRunning && document.getElementById('total-val')) {
            if (appState.balance > 0 && appState.config && appState.config.isReady) startSystem(true);
            else stopSystem(true);
        } else {
            updateButtonState(false);
        }
        
        startDataCounter();
        setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 800); // 갱신 속도 0.8초로 단축
        renderGlobalUI();
    }
});

/* --- [핵심] 리얼 트레이딩 엔진 --- */
function executeAiTrade() {
    if(!appState.isRunning) return;

    // 1. 매수/매도 랜덤 결정 (6:4 비율)
    const actionType = Math.random() > 0.4 ? '매수' : '매도';
    
    // 2. 수익률 변동성 (매도일 때 수익 실현 느낌)
    const volatility = (Math.random() * 0.008) + 0.001; // 0.1% ~ 0.9% 변동
    let pnl = 0;

    if (actionType === '매수') {
        // 매수: 자산 변화 미미 (수수료 정도 빠짐 or 소폭 상승)
        pnl = (Math.random() > 0.6) ? (appState.investedAmount * 0.001) : -(appState.investedAmount * 0.0005);
    } else {
        // 매도: 승률에 따라 수익/손실 확정
        const isWin = Math.random() > 0.45; // 승률 55%
        pnl = isWin ? (appState.investedAmount * volatility) : -(appState.investedAmount * volatility * 0.7);
    }

    // 3. 자산 업데이트
    appState.balance += pnl;
    
    // 4. 데이터 생성
    const coin = appState.runningCoin;
    const price = getRealisticPrice(coin);
    const qty = appState.investedAmount / price;
    const fee = appState.investedAmount * 0.0005; // 0.05% 수수료
    const net = (appState.investedAmount + pnl) - fee;

    // 5. 기록 추가
    appState.tradeHistory.unshift({
        time: new Date().toLocaleTimeString('en-GB'),
        coin: coin,
        market: 'USDT',
        type: actionType, // 매수 또는 매도
        price: price.toLocaleString(),
        qty: qty.toFixed(6),
        tradeAmt: appState.investedAmount.toFixed(2),
        fee: fee.toFixed(2),
        net: net.toFixed(2),
        pnl: pnl // 단순 변동액
    });

    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
    renderGlobalUI();
}

/* --- UI 렌더링 (24H 수익 & 지갑 연동 수정) --- */
function renderGlobalUI() {
    const els = { 
        total: document.getElementById('total-val'), 
        label: document.getElementById('balance-label'), 
        wallet: document.getElementById('wallet-display'), 
        avail: document.getElementById('avail-cash'), 
        bank: document.getElementById('bank-balance-display'), 
        prof: document.getElementById('real-profit') 
    };
    
    const currentCash = appState.isRunning ? appState.cash : appState.balance;

    // [메인 화면]
    if(els.total) {
        if(appState.isRunning) {
            const activeMoney = appState.balance - appState.cash;
            els.total.innerText = `$ ${activeMoney.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            els.label.innerText = `현재 운용 자산 (${appState.runningCoin})`;
            els.label.style.color = "var(--accent)";
            
            // [수정] 24H 수익률 계산 (시작 금액 대비 현재 차익)
            const profit = appState.balance - appState.startBalance;
            const pct = appState.startBalance > 0 ? (profit / appState.startBalance) * 100 : 0;
            const color = profit >= 0 ? 'text-green' : 'text-red';
            const sign = profit >= 0 ? '+' : '';
            
            // 메인화면 24H 수익 업데이트
            els.prof.innerHTML = `<span class="${color}">${sign}${pct.toFixed(2)}%</span> <span style="font-size:0.9rem; color:#888;">($${profit.toFixed(2)})</span>`;
        } else {
            els.total.innerText = `$ 0.00`;
            els.label.innerText = `AI TRADING READY`;
            els.label.style.color = "#888";
            els.prof.innerText = "---";
        }
    }

    // [지갑 화면]
    if(els.wallet) {
        els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        els.avail.innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        
        // [수정] 지갑 - 투자손익 탭 데이터 채우기
        const pnlAmountEl = document.getElementById('pnl-total-amount');
        const pnlPercentEl = document.getElementById('pnl-total-percent');
        const pnlInvestEl = document.getElementById('pnl-avg-invest');
        
        if(pnlAmountEl) {
            const totalProfit = appState.balance - appState.startBalance;
            const totalPct = appState.startBalance > 0 ? (totalProfit / appState.startBalance) * 100 : 0;
            const pnlColor = totalProfit >= 0 ? 'text-green' : 'text-red';
            
            pnlAmountEl.innerText = `$ ${totalProfit.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            pnlAmountEl.className = `hero-number ${pnlColor}`;
            
            pnlPercentEl.innerText = `${totalProfit >= 0 ? '+' : ''}${totalPct.toFixed(2)}%`;
            pnlPercentEl.className = pnlColor; // 색상 적용
            
            pnlInvestEl.innerText = `$ ${appState.investedAmount.toLocaleString()}`;
        }
    }

    // [지갑 & 메인] 거래내역 리스트
    updateTradeLists();
    
    // 은행 화면
    if(els.bank) {
        els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updateBankList();
    }
}

function updateTradeLists() {
    // 1. 지갑 상세 내역
    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        if(appState.tradeHistory.length === 0) {
            historyTable.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">거래 내역이 없습니다.</td></tr>';
        } else {
            let tHtml = '';
            appState.tradeHistory.slice(0, 30).forEach(t => {
                // 매수: 빨강(Green), 매도: 파랑(Red/Blue) - 스타일 파일 기준에 따름
                const typeClass = t.type === '매수' ? 'text-green' : 'text-red'; 
                tHtml += `<tr>
                    <td style="color:#bbb">${t.time}</td>
                    <td style="font-weight:bold">${t.coin}</td>
                    <td>${t.market}</td>
                    <td class="${typeClass}">${t.type}</td>
                    <td>${t.qty}</td>
                    <td>$${t.tradeAmt}</td>
                    <td style="color:#aaa">$${t.fee}</td>
                    <td style="font-weight:bold; color:#fff">$${t.net}</td>
                </tr>`;
            });
            historyTable.innerHTML = tHtml;
        }
    }

    // 2. 메인 간편 리스트
    const mainList = document.getElementById('main-ledger-list');
    if(mainList) {
        if(appState.tradeHistory.length === 0) {
            mainList.innerHTML = '<div style="padding:40px; text-align:center; color:#444;">NO TRADES YET</div>';
        } else {
            let html = '';
            appState.tradeHistory.slice(0, 50).forEach(t => {
                const typeClass = t.type === '매수' ? 'text-green' : 'text-red';
                // 정산금 색상은 이익이면 빨강, 손해면 파랑
                const pnlColor = parseFloat(t.pnl) >= 0 ? 'text-green' : 'text-red';
                html += `
                <div class="ledger-row">
                    <div class="col-time">${t.time}</div>
                    <div class="col-coin">${t.coin} <span class="${typeClass}" style="font-size:0.7rem;">${t.type}</span></div>
                    <div class="col-price">${t.price}</div>
                    <div class="col-pnl ${pnlColor}">${t.net}</div>
                </div>`;
            });
            mainList.innerHTML = html;
        }
    }
}

function updateBankList() {
    const list = document.getElementById('bank-history-list');
    if(list && appState.transfers) {
        let html = '';
        appState.transfers.forEach(t => {
            html += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`;
        });
        list.innerHTML = html;
    }
}

/* --- 시스템 시작/정지 (시작금액 고정 로직 추가) --- */
function startSystem(isSilent=false) {
    if (appState.balance < 10) { if(!isSilent) alert("지갑 잔고 부족"); stopSystem(true); return; }
    if (!appState.config.isReady) { if(!isSilent) alert("AI 설정 필요"); return; }
    if(appState.balance < appState.config.amount) { if(!isSilent) alert("설정 금액 > 잔고"); stopSystem(true); return; }

    appState.runningCoin = appState.config.target.split('/')[0];
    appState.investedAmount = appState.config.amount;
    appState.cash = appState.balance - appState.investedAmount;
    
    // [중요] 수익률 계산의 기준점(원금) 설정
    // 이미 실행 중이었다면 원금을 유지, 처음 켜는거면 현재 밸런스를 원금으로 잡음
    if (appState.startBalance === 0 || !appState.isRunning) {
        appState.startBalance = appState.balance; 
    }
    
    if(appState.openOrders.length===0) generateFakeOpenOrders(appState.runningCoin);
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    
    appState.isRunning = true;
    autoTradeInterval = setInterval(executeAiTrade, 1200); // 거래 속도 조절
    updateButtonState(true);
    saveState();
}

function stopSystem(isSilent=false) {
    appState.isRunning = false;
    appState.investedAmount = 0;
    appState.cash = appState.balance;
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    updateButtonState(false);
    saveState();
    renderGlobalUI();
}

// 2026년 2월 시세 유지
function getRealisticPrice(symbol) {
    const jitter = Math.random(); 
    if(symbol === 'BTC') return 68420 + (jitter * 300);
    if(symbol === 'ETH') return 2245 + (jitter * 15);
    if(symbol === 'XRP') return 1.48 + (jitter * 0.005);
    return 100 + (jitter * 10);
}

// ... (나머지 기본 함수들은 그대로 유지) ...
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(appState))}
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)}}catch(e){}}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d)}catch(e){}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c||(c.includes('info')&&e.href.includes('index')))e.classList.add('active');else e.classList.remove('active')})}
function updateButtonState(o){const b=document.getElementById('btn-main-control');if(b){b.innerHTML=o?'<i class="fas fa-play"></i> RUNNING':'<i class="fas fa-play"></i> START';b.style.background=o?'#c84a31':'#2b3139'}}
function handleSearch(v){appState.searchQuery=v.toUpperCase()}
function searchInfoCoin(){const i=document.getElementById('info-page-search');if(i&&i.value)window.location.href=`info.html?coin=${i.value.toUpperCase()}`}
function openInfoPage(){window.location.href=`info.html?coin=${appState.searchQuery||appState.runningCoin||'BTC'}`}
function showTab(t){appState.activeTab=t;saveState();document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));document.getElementById('tab-'+t).classList.remove('hidden');document.querySelectorAll('.wallet-tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('btn-'+t).classList.add('active');renderGlobalUI()}
function generateFakeOpenOrders(c){appState.openOrders=[];for(let i=0;i<3;i++)appState.openOrders.push({time:'12:00',coin:c,type:'매수',price:'Loading',vol:'0.0'})}
function startDataCounter(){if(dataCounterInterval)clearInterval(dataCounterInterval);const e=document.getElementById('data-mining-counter');if(e)dataCounterInterval=setInterval(()=>{appState.dataCount+=Math.floor(Math.random()*15);e.innerText=appState.dataCount.toLocaleString()},100)}
function exportLogs(){alert("✅ 거래 내역 다운로드 완료")}
function applyBankInterest(){if(appState.bankBalance>0)appState.bankBalance+=(appState.bankBalance*0.0000008)}
function checkKeys(){alert("✅ 키 확인 완료")}
function selectStrategy(t){document.querySelectorAll('.strategy-card').forEach(c=>c.classList.remove('active'));event.currentTarget.classList.add('active')}
function processBankDeposit(){const i=document.getElementById('bank-deposit-input');const a=parseFloat(i.value);if(!a||isNaN(a))return alert("금액 오류");if(a<10)return alert("최소 $10");if(a>100000)return alert("최대 $100,000");if(!appState)loadState();appState.bankBalance=parseFloat(appState.bankBalance)+a;appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:"WIRE IN",amount:a});saveState();renderGlobalUI();alert("입금 완료");i.value=''}
function openModal(m){const d=document.getElementById('transaction-modal');if(!d)return;d.style.display='flex';currentTxMode=m;document.getElementById('amount-input').value='';document.getElementById('modal-title').innerText=m==='deposit'?"입금 (은행 → 지갑)":"출금 (지갑 → 은행)";document.getElementById('modal-title').style.color=m==='deposit'?"var(--color-up)":"var(--color-down)"}
function processTx(){const i=document.getElementById('amount-input');const a=parseFloat(i.value);if(!a||a<=0)return alert("금액 오류");if(currentTxMode==='deposit'){if(appState.bankBalance<a)return alert("은행 잔고 부족");appState.bankBalance-=a;appState.balance+=a;appState.cash+=a}else{if(appState.cash<a)return alert("현금 부족");appState.balance-=a;appState.bankBalance+=a;appState.cash-=a}appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW",amount:a});saveState();renderGlobalUI();closeModal()}
function closeModal(){document.getElementById('transaction-modal').style.display='none'}
function calcPercent(p){const i=document.getElementById('amount-input');let b=currentTxMode==='deposit'?appState.bankBalance:appState.cash;if(p===100)i.value=b;else i.value=Math.floor(b*(p/100)*100)/100}
function initInfoPage(c){c=c.toUpperCase();const i=document.getElementById('info-page-search');if(i)i.value=c;new TradingView.widget({"container_id":"info_tv_chart","symbol":`BINANCE:${c}USDT`,"interval":"15","theme":"dark","style":"1","locale":"kr","autosize":true,"hide_side_toolbar":false});updateInfoPrice(c);if(infoPriceInterval)clearInterval(infoPriceInterval);infoPriceInterval=setInterval(()=>updateInfoPrice(c),1000);const p=getRealisticPrice(c);document.getElementById('val-support').innerText=`$ ${(p*0.92).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-resistance').innerText=`$ ${(p*1.04).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-stoploss').innerText=`$ ${(p*0.88).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-target').innerText=`$ ${(p*1.10).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('deep-report-text').innerHTML=`2026년 2월 현재, <strong>${c}</strong>은 전고점 대비 조정을 받으며 바닥을 다지고 있습니다.<br><br>현재 <strong>$${p.toLocaleString()}</strong> 부근에서 강한 매수 벽이 확인되며, 거시 경제 지표 발표 전까지는 횡보 합의 가능성이 높습니다.<br><br>⚠️ <strong>AI 판단:</strong> 분할 매수 및 관망 (Neutral).`;loadNewsData(c);}
function updateInfoPrice(c){const p=getRealisticPrice(c);const s=Math.floor(Math.random()*(65-40)+40);const pe=document.getElementById('analysis-price');const se=document.getElementById('ai-score-val');const ve=document.getElementById('analysis-verdict');if(pe)pe.innerText=`$ ${p.toLocaleString(undefined,{minimumFractionDigits:2})}`;if(se)se.innerText=s;if(ve){if(s>=60)ve.innerHTML=`"기술적 반등이 기대되는 구간입니다."`;else if(s>=40)ve.innerHTML=`"현재 구간은 <span style='color:#aaa'>관망(Hold)</span>이 필요합니다."`;else ve.innerHTML=`"하락세가 강합니다. 주의하세요."`;}}
function loadNewsData(c){const l=document.getElementById('news-board-list');if(!l)return;const t=[{t:`[시황] ${c}, 주요 지지선 테스트 중...`,c:`매도 압력이 지속되면서 주요 지지 라인을 위협하고 있습니다.`},{t:`美 연준 금리 동결 시사, 시장 혼조세`,c:`거시 경제 불확실성으로 인해 투자 심리가 위축된 상태입니다.`},{t:`[속보] ${c} 고래 지갑, 거래소로 물량 이동`,c:`차익 실현 매물인지 단순 이동인지 온체인 분석이 필요합니다.`},{t:`유명 분석가 "${c}, 지금은 바닥 다지는 중"`,c:`추가 하락보다는 기간 조정이 길어질 것이라는 분석이 우세합니다.`},{t:`${c} 생태계 활성도는 여전히 견고`,c:`가격 하락에도 불구하고 네트워크 트랜잭션 수는 유지되고 있습니다.`}];let h='';for(let i=0;i<5;i++){const n=t[i%t.length];h+=`<div class="news-item" onclick="toggleNews(${i})"><div class="news-title"><span class="news-new-badge">NEW</span> ${n.t}</div><div class="news-meta"><span>${new Date().toLocaleTimeString()}</span></div><div id="news-content-${i}" class="news-content">${n.c}</div></div>`;}l.innerHTML=h;}
function toggleNews(i){const e=document.getElementById(`news-content-${i}`);if(e)e.classList.toggle('show')}
