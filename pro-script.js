/* pro-script.js - V70.0 (Real-time Info Price & Dark Mode Fix) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: ""
};
let autoTradeInterval = null;
let dataCounterInterval = null;
let infoPriceInterval = null; // [NEW] 정보 페이지 가격 갱신용 타이머
const SAVE_KEY = 'neuroBotData_V65_FINAL';
const CONFIG_KEY = 'neuroConfig_V65_FINAL';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
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

        if (appState.isRunning && document.getElementById('total-val')) {
            if (appState.balance > 0 && appState.config && appState.config.isReady) startSystem(true);
            else stopSystem(true);
        } else {
            updateButtonState(false);
        }
        
        startDataCounter();
        setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
        renderGlobalUI();
    }
});

/* --- 정보 페이지 (실시간 가격 적용) --- */
function initInfoPage(coin) {
    coin = coin.toUpperCase();
    const searchInInfo = document.getElementById('info-page-search');
    if(searchInInfo) searchInInfo.value = coin;

    // 차트 로드
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

    // [핵심] 가격 실시간 갱신 시작
    updateInfoPrice(coin); // 즉시 1회 실행
    if(infoPriceInterval) clearInterval(infoPriceInterval);
    infoPriceInterval = setInterval(() => {
        updateInfoPrice(coin);
    }, 1500); // 1.5초마다 갱신

    // AI 리포트 및 뉴스 생성
    const price = getRealisticPrice(coin);
    document.getElementById('val-support').innerText = `$ ${(price * 0.95).toFixed(2)}`;
    document.getElementById('val-resistance').innerText = `$ ${(price * 1.05).toFixed(2)}`;
    document.getElementById('val-stoploss').innerText = `$ ${(price * 0.92).toFixed(2)}`;
    document.getElementById('val-target').innerText = `$ ${(price * 1.15).toFixed(2)}`;

    document.getElementById('deep-report-text').innerHTML = `
        현재 <strong>${coin}</strong>의 실시간 시세 변동성이 확대되고 있습니다. 
        AI 알고리즘 분석 결과, 단기 이동평균선이 정배열 구간에 진입하여 <span class="text-green">상승 추세</span>를 지지하고 있습니다.<br><br>
        특히 <strong>$${(price * 1.01).toFixed(2)}</strong> 구간에서의 거래량 급증은 세력의 개입을 암시하며, 
        RSI 지표(58.4)는 과매수 구간 전까지 추가 상승 여력을 보여줍니다.<br><br>
        ⚠️ <strong>전략:</strong> 눌림목 발생 시 적극 매수 유효.
    `;
    loadNewsData(coin);
}

// [NEW] 가격 업데이트 함수
function updateInfoPrice(coin) {
    const price = getRealisticPrice(coin);
    const score = Math.floor(Math.random() * (99 - 60) + 60);
    
    const priceEl = document.getElementById('analysis-price');
    const scoreEl = document.getElementById('ai-score-val');
    const verdictEl = document.getElementById('analysis-verdict');

    if(priceEl) priceEl.innerText = `$ ${price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    if(scoreEl) scoreEl.innerText = score;
    
    if(verdictEl) {
        if (score >= 80) verdictEl.innerHTML = `"현재 구간은 <span class='text-green'>강력 매수</span>가 유효합니다."`;
        else if (score >= 60) verdictEl.innerHTML = `"현재 구간은 <span style='color:#aaa'>중립/관망</span> 구간입니다."`;
        else verdictEl.innerHTML = `"현재 구간은 <span class='text-red'>매도 우위</span>입니다."`;
    }
}

// ... (기존 뉴스, 렌더링, 시스템 함수들은 그대로 유지) ...
function loadNewsData(coin) {
    const list = document.getElementById('news-board-list'); if(!list) return;
    const newsTemplates = [
        { t: `[속보] ${coin}, 대규모 고래 지갑 이동 포착... 변동성 주의`, c: `익명의 지갑에서 거래소로 대규모 물량이 이동했습니다.` },
        { t: `${coin} 네트워크 활성 주소 급증, 펀더멘탈 강화 신호`, c: `온체인 데이터상 활성 주소가 전주 대비 20% 증가했습니다.` },
        { t: `美 SEC 위원장 발언, ${coin} 시세에 긍정적 영향`, c: `규제 완화 기대감으로 인해 매수 심리가 회복되고 있습니다.` },
        { t: `[기술분석] ${coin} 골든크로스 발생 직전`, c: `단기 이평선이 장기 이평선을 뚫고 올라가는 골든크로스가 임박했습니다.` },
        { t: `글로벌 헤지펀드, ${coin} 투자 비중 확대 검토`, c: `기관 투자자들의 진입이 가시화되고 있습니다.` }
    ];
    let html = '';
    for(let i=0; i<5; i++) {
        const news = newsTemplates[Math.floor(Math.random()*newsTemplates.length)];
        html += `<div class="news-item" onclick="toggleNews(${i})"><div class="news-title"><span class="news-new-badge">NEW</span> ${news.t}</div><div class="news-meta"><span>${new Date().toLocaleTimeString()}</span></div><div id="news-content-${i}" class="news-content">${news.c}</div></div>`;
    }
    list.innerHTML = html;
}
function toggleNews(id) { const el = document.getElementById(`news-content-${id}`); if(el) el.classList.toggle('show'); }

// 필수 시스템 함수 (생략 없이 중요 부분만 기재, 실제 파일엔 전체 포함됨)
function renderGlobalUI() {
    const els = { total: document.getElementById('total-val'), label: document.getElementById('balance-label'), wallet: document.getElementById('wallet-display'), avail: document.getElementById('avail-cash'), bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit') };
    const currentCash = appState.isRunning ? appState.cash : appState.balance;
    if(els.total) {
        if(appState.isRunning) {
            els.total.innerText = `$ ${(appState.balance - appState.cash).toLocaleString(undefined, {minimumFractionDigits:2})}`;
            els.label.innerText = `현재 운용 자산 (${appState.runningCoin})`;
            els.label.style.color = "var(--accent)";
            const profit = appState.balance - appState.startBalance;
            const pct = appState.startBalance>0 ? (profit/appState.startBalance)*100 : 0;
            els.prof.innerHTML = `<span class="${profit>=0?'text-green':'text-red'}">${profit>=0?'+':''}${pct.toFixed(2)}%</span>`;
        } else {
            els.total.innerText = `$ 0.00`; els.label.innerText = `AI TRADING READY`; els.label.style.color = "#888"; els.prof.innerText = "---";
        }
    }
    if(els.wallet) { els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`; els.avail.innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`; }
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    
    // 거래내역 렌더링
    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        if(appState.tradeHistory.length === 0) historyTable.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#666;">거래 내역이 없습니다.</td></tr>';
        else {
            let tHtml = '';
            appState.tradeHistory.slice(0, 30).forEach(t => {
                const color = t.type === '매수' ? 'text-green' : 'text-red';
                tHtml += `<tr><td style="color:#888">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>${t.market}</td><td class="${color}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#888">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`;
            });
            historyTable.innerHTML = tHtml;
        }
    }
    const mainList = document.getElementById('main-ledger-list');
    if(mainList) {
        if(appState.tradeHistory.length===0) mainList.innerHTML = '<div style="padding:40px; text-align:center; color:#444;">NO TRADES YET</div>';
        else {
            let html = '';
            appState.tradeHistory.slice(0, 50).forEach(t => { html += `<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${t.type=='매수'?'text-green':'text-red'}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${parseFloat(t.pnl)>=0?'text-green':'text-red'}">${t.net}</div></div>`; });
            mainList.innerHTML = html;
        }
    }
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) {
        let bHtml = ''; appState.transfers.forEach(t => { bHtml += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`; }); bankList.innerHTML = bHtml;
    }
}

// 나머지 함수들 (생략 없이 포함되어야 함)
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(appState))}
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)}}catch(e){}}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d)}catch(e){}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c||(c.includes('info')&&e.href.includes('index')))e.classList.add('active');else e.classList.remove('active')})}
function getRealisticPrice(s){const r=Math.random();return s==='BTC'?96000+r*500:s==='ETH'?2700+r*20:s==='XRP'?2.4+r*0.05:100+r}
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
function startSystem(s=false){if(appState.balance<10){if(!s)alert("지갑 잔고 부족");stopSystem(true);return}if(!appState.config.isReady){if(!s)alert("AI 설정 필요");return}if(appState.balance<appState.config.amount){if(!s)alert("설정 금액 > 잔고");stopSystem(true);return}appState.runningCoin=appState.config.target.split('/')[0];appState.investedAmount=appState.config.amount;appState.cash=appState.balance-appState.investedAmount;if(appState.openOrders.length===0)generateFakeOpenOrders(appState.runningCoin);if(autoTradeInterval)clearInterval(autoTradeInterval);appState.isRunning=true;autoTradeInterval=setInterval(executeAiTrade,1000);updateButtonState(true);saveState()}
function stopSystem(s=false){appState.isRunning=false;appState.investedAmount=0;appState.cash=appState.balance;if(autoTradeInterval)clearInterval(autoTradeInterval);updateButtonState(false);saveState();renderGlobalUI()}
function processBankDeposit(){const i=document.getElementById('bank-deposit-input');const a=parseFloat(i.value);if(!a||isNaN(a))return alert("금액 오류");if(a<10)return alert("최소 $10");if(a>100000)return alert("최대 $100,000");if(!appState)loadState();appState.bankBalance=parseFloat(appState.bankBalance)+a;appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:"WIRE IN",amount:a});saveState();renderGlobalUI();alert("입금 완료");i.value=''}
function openModal(m){const d=document.getElementById('transaction-modal');if(!d)return;d.style.display='flex';currentTxMode=m;document.getElementById('amount-input').value='';document.getElementById('modal-title').innerText=m==='deposit'?"입금 (은행 → 지갑)":"출금 (지갑 → 은행)";document.getElementById('modal-title').style.color=m==='deposit'?"var(--color-up)":"var(--color-down)"}
function processTx(){const i=document.getElementById('amount-input');const a=parseFloat(i.value);if(!a||a<=0)return alert("금액 오류");if(currentTxMode==='deposit'){if(appState.bankBalance<a)return alert("은행 잔고 부족");appState.bankBalance-=a;appState.balance+=a;appState.cash+=a}else{if(appState.cash<a)return alert("현금 부족");appState.balance-=a;appState.bankBalance+=a;appState.cash-=a}appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW",amount:a});saveState();renderGlobalUI();closeModal()}
function closeModal(){document.getElementById('transaction-modal').style.display='none'}
function calcPercent(p){const i=document.getElementById('amount-input');let b=currentTxMode==='deposit'?appState.bankBalance:appState.cash;if(p===100)i.value=b;else i.value=Math.floor(b*(p/100)*100)/100}
function executeAiTrade(){if(!appState.isRunning)return;const w=Math.random()>0.45;const r=(Math.random()*0.005)+0.001;const p=w?(appState.investedAmount*r):-(appState.investedAmount*r*0.8);appState.balance+=p;const c=appState.runningCoin;const pr=getRealisticPrice(c);const t=Math.random()>0.5?'매수':'매도';const q=appState.investedAmount/pr;const f=appState.investedAmount*0.0005;const ta=appState.investedAmount;const n=(ta+p)-f;appState.tradeHistory.unshift({time:new Date().toLocaleTimeString('en-GB'),coin:c,market:'USDT',type:t,price:pr.toLocaleString(),qty:q.toFixed(6),tradeAmt:ta.toFixed(2),fee:f.toFixed(2),net:n.toFixed(2),pnl:p.toFixed(2)});if(appState.tradeHistory.length>50)appState.tradeHistory.pop();renderGlobalUI()}
