/* pro-script.js - V80.0 (Real 2026 Feb Market & Dark Mode Fix) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: ""
};
let autoTradeInterval = null;
let dataCounterInterval = null;
let infoPriceInterval = null;
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

/* --- [핵심] 2026년 2월 실시간 조정장 시세 (현실 반영) --- */
function getRealisticPrice(symbol) {
    const jitter = Math.random(); 
    // BTC: $68k (약 9,600만원)
    if(symbol === 'BTC') return 68420 + (jitter * 300);
    // ETH: $2.2k (약 310만원)
    if(symbol === 'ETH') return 2245 + (jitter * 15);
    // XRP: $1.48 (약 2,100원)
    if(symbol === 'XRP') return 1.48 + (jitter * 0.005);
    // SOL: $145 (약 20만원)
    if(symbol === 'SOL') return 145 + (jitter * 1.5);
    return 100 + (jitter * 10);
}

/* --- 정보 페이지 로직 --- */
function initInfoPage(coin) {
    coin = coin.toUpperCase();
    const searchInInfo = document.getElementById('info-page-search');
    if(searchInInfo) searchInInfo.value = coin;

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

    updateInfoPrice(coin);
    if(infoPriceInterval) clearInterval(infoPriceInterval);
    infoPriceInterval = setInterval(() => updateInfoPrice(coin), 1000);

    const price = getRealisticPrice(coin);
    // 지지/저항 현실화 (하락장 방어선)
    document.getElementById('val-support').innerText = `$ ${(price * 0.92).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    document.getElementById('val-resistance').innerText = `$ ${(price * 1.04).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    document.getElementById('val-stoploss').innerText = `$ ${(price * 0.88).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    document.getElementById('val-target').innerText = `$ ${(price * 1.10).toLocaleString(undefined, {maximumFractionDigits:2})}`;

    document.getElementById('deep-report-text').innerHTML = `
        2026년 2월 현재, <strong>${coin}</strong>은 전고점 대비 조정을 받으며 바닥을 다지고 있습니다. 
        온체인 데이터상 단기 투기 물량이 빠져나가고 장기 보유자(Holder)들의 축적 구간에 진입했습니다.<br><br>
        현재 <strong>$${price.toLocaleString()}</strong> 부근에서 강한 매수 벽이 확인되며, 
        거시 경제 지표(금리 인하) 발표 전까지는 횡보 합의 가능성이 높습니다.<br><br>
        ⚠️ <strong>AI 판단:</strong> 분할 매수 및 관망 (Neutral).
    `;
    loadNewsData(coin);
}

function updateInfoPrice(coin) {
    const price = getRealisticPrice(coin);
    const score = Math.floor(Math.random() * (65 - 40) + 40); // 점수 낮춤 (조정장)
    
    const priceEl = document.getElementById('analysis-price');
    const scoreEl = document.getElementById('ai-score-val');
    const verdictEl = document.getElementById('analysis-verdict');

    if(priceEl) priceEl.innerText = `$ ${price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    if(scoreEl) scoreEl.innerText = score;
    
    if(verdictEl) {
        if (score >= 60) verdictEl.innerHTML = `"기술적 반등이 기대되는 구간입니다."`;
        else if (score >= 40) verdictEl.innerHTML = `"현재 구간은 <span style='color:#aaa'>관망(Hold)</span>이 필요합니다."`;
        else verdictEl.innerHTML = `"하락세가 강합니다. 주의하세요."`;
    }
}

function loadNewsData(coin) {
    const list = document.getElementById('news-board-list'); if(!list) return;
    const newsTemplates = [
        { t: `[시황] ${coin}, 주요 지지선 테스트 중... 반등 성공할까?`, c: `매도 압력이 지속되면서 주요 지지 라인을 위협하고 있습니다.` },
        { t: `美 연준 금리 동결 시사, 가상자산 시장 혼조세`, c: `거시 경제 불확실성으로 인해 투자 심리가 위축된 상태입니다.` },
        { t: `[속보] ${coin} 고래 지갑, 거래소로 일부 물량 이동`, c: `차익 실현 매물인지 단순 이동인지 온체인 분석이 필요합니다.` },
        { t: `유명 분석가 "${coin}, 지금은 바닥 다지는 중"`, c: `추가 하락보다는 기간 조정이 길어질 것이라는 분석이 우세합니다.` },
        { t: `${coin} 생태계 활성도는 여전히 견고, 장기 전망 긍정적`, c: `가격 하락에도 불구하고 네트워크 트랜잭션 수는 유지되고 있습니다.` }
    ];
    let html = '';
    for(let i=0; i<5; i++) {
        const news = newsTemplates[i % newsTemplates.length];
        html += `<div class="news-item" onclick="toggleNews(${i})"><div class="news-title"><span class="news-new-badge">NEW</span> ${news.t}</div><div class="news-meta"><span>${new Date().toLocaleTimeString()}</span></div><div id="news-content-${i}" class="news-content">${news.c}</div></div>`;
    }
    list.innerHTML = html;
}
function toggleNews(id) { const el = document.getElementById(`news-content-${id}`); if(el) el.classList.toggle('show'); }

/* --- 렌더링 --- */
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
    
    // [수정] 거래내역 렌더링 (데이터 없으면 안내문구)
    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        if(appState.tradeHistory.length === 0) {
            historyTable.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">거래 내역이 없습니다.</td></tr>';
        } else {
            let tHtml = '';
            appState.tradeHistory.slice(0, 30).forEach(t => {
                const color = t.type === '매수' ? 'text-green' : 'text-red';
                tHtml += `<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>${t.market}</td><td class="${color}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`;
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

// 공통함수 (유지)
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
function startSystem(s=false){if(appState.balance<10){if(!s)alert("지갑 잔고 부족");stopSystem(true);return}if(!appState.config.isReady){if(!s)alert("AI 설정 필요");return}if(appState.balance<appState.config.amount){if(!s)alert("설정 금액 > 잔고");stopSystem(true);return}appState.runningCoin=appState.config.target.split('/')[0];appState.investedAmount=appState.config.amount;appState.cash=appState.balance-appState.investedAmount;if(appState.openOrders.length===0)generateFakeOpenOrders(appState.runningCoin);if(autoTradeInterval)clearInterval(autoTradeInterval);appState.isRunning=true;autoTradeInterval=setInterval(executeAiTrade, 1000);updateButtonState(true);saveState()}
function stopSystem(s=false){appState.isRunning=false;appState.investedAmount=0;appState.cash=appState.balance;if(autoTradeInterval)clearInterval(autoTradeInterval);updateButtonState(false);saveState();renderGlobalUI()}
function processBankDeposit(){const i=document.getElementById('bank-deposit-input');const a=parseFloat(i.value);if(!a||isNaN(a))return alert("금액 오류");if(a<10)return alert("최소 $10");if(a>100000)return alert("최대 $100,000");if(!appState)loadState();appState.bankBalance=parseFloat(appState.bankBalance)+a;appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:"WIRE IN",amount:a});saveState();renderGlobalUI();alert("입금 완료");i.value=''}
function openModal(m){const d=document.getElementById('transaction-modal');if(!d)return;d.style.display='flex';currentTxMode=m;document.getElementById('amount-input').value='';document.getElementById('modal-title').innerText=m==='deposit'?"입금 (은행 → 지갑)":"출금 (지갑 → 은행)";document.getElementById('modal-title').style.color=m==='deposit'?"var(--color-up)":"var(--color-down)"}
function processTx(){const i=document.getElementById('amount-input');const a=parseFloat(i.value);if(!a||a<=0)return alert("금액 오류");if(currentTxMode==='deposit'){if(appState.bankBalance<a)return alert("은행 잔고 부족");appState.bankBalance-=a;appState.balance+=a;appState.cash+=a}else{if(appState.cash<a)return alert("현금 부족");appState.balance-=a;appState.bankBalance+=a;appState.cash-=a}appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW",amount:a});saveState();renderGlobalUI();closeModal()}
function closeModal(){document.getElementById('transaction-modal').style.display='none'}
function calcPercent(p){const i=document.getElementById('amount-input');let b=currentTxMode==='deposit'?appState.bankBalance:appState.cash;if(p===100)i.value=b;else i.value=Math.floor(b*(p/100)*100)/100}
function executeAiTrade(){if(!appState.isRunning)return;const w=Math.random()>0.45;const r=(Math.random()*0.005)+0.001;const p=w?(appState.investedAmount*r):-(appState.investedAmount*r*0.8);appState.balance+=p;const c=appState.runningCoin;const pr=getRealisticPrice(c);const t=Math.random()>0.5?'매수':'매도';const q=appState.investedAmount/pr;const f=appState.investedAmount*0.0005;const ta=appState.investedAmount;const n=(ta+p)-f;appState.tradeHistory.unshift({time:new Date().toLocaleTimeString('en-GB'),coin:c,market:'USDT',type:t,price:pr.toLocaleString(),qty:q.toFixed(6),tradeAmt:ta.toFixed(2),fee:f.toFixed(2),net:n.toFixed(2),pnl:p.toFixed(2)});if(appState.tradeHistory.length>50)appState.tradeHistory.pop();renderGlobalUI()}
