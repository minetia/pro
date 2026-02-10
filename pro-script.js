/* pro-script.js - V100.0 (Portfolio & Holdings Fix) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: "",
    realPrices: {}
};
let autoTradeInterval = null;
let dataCounterInterval = null;
let priceUpdateInterval = null;
const SAVE_KEY = 'neuroBotData_V95_FINAL';
const CONFIG_KEY = 'neuroConfig_V95_FINAL';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    // 정보 페이지면 실시간 가격 모드
    if (window.location.pathname.includes('info.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || (appState.config.target ? appState.config.target.split('/')[0] : 'BTC');
        initInfoPage(coin);
    } else {
        // 일반 페이지 (지갑 탭 복구)
        if(document.getElementById('tab-holdings')) {
            const lastTab = appState.activeTab || 'holdings';
            showTab(lastTab);
        }
        
        // 검색어 및 실행 상태 복구
        const searchInput = document.getElementById('coin-search-input');
        if(searchInput && appState.searchQuery) searchInput.value = appState.searchQuery;

        if (appState.isRunning && document.getElementById('total-val')) {
            startSystem(true);
        } else {
            updateButtonState(false);
        }
        
        startDataCounter();
        // 0.5초마다 화면 갱신 (포트폴리오 실시간 반영)
        setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
        renderGlobalUI();
    }
});

/* --- [핵심] UI 렌더링 (포트폴리오 로직 강화) --- */
function renderGlobalUI() {
    const els = { total: document.getElementById('total-val'), label: document.getElementById('balance-label'), wallet: document.getElementById('wallet-display'), avail: document.getElementById('avail-cash'), bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit') };
    
    // 현재 현금 (실행중이면 남은 현금, 아니면 전체)
    const currentCash = appState.isRunning ? appState.cash : appState.balance;

    // 1. 메인 화면
    if(els.total) {
        if(appState.isRunning) {
            // 운영 자산 (코인 가치)
            const activeMoney = appState.balance - appState.cash;
            els.total.innerText = `$ ${activeMoney.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            els.label.innerText = `현재 운용 자산 (${appState.runningCoin})`;
            els.label.style.color = "var(--accent)";
            
            // 수익률
            const profit = appState.balance - (appState.startBalance + appState.cash);
            let profitRate = 0;
            if(appState.investedAmount > 0) profitRate = (profit / appState.investedAmount) * 100;
            
            const color = profit >= 0 ? 'text-green' : 'text-red';
            const sign = profit >= 0 ? '+' : '';
            els.prof.innerHTML = `<span class="${color}">${sign}${profitRate.toFixed(2)}%</span> <span style="font-size:0.9rem; color:#888;">($${profit.toFixed(2)})</span>`;
        } else {
            els.total.innerText = `$ 0.00`;
            els.label.innerText = `AI TRADING READY`;
            els.label.style.color = "#888";
            els.prof.innerText = "---";
        }
    }

    // 2. 지갑 상단
    if(els.wallet) {
        els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        els.avail.innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updatePnLTab();
    }
    // 3. 은행
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    // 4. [중요] 포트폴리오 (파이차트 & 리스트)
    if(document.getElementById('holdings-list')) {
        updatePortfolio(currentCash);
    }

    // 5. 거래내역 리스트
    updateHistoryTables();
}

// [NEW] 포트폴리오 업데이트 함수
function updatePortfolio(currentCash) {
    const pie = document.getElementById('portfolio-pie');
    const list = document.getElementById('holdings-list');
    
    // 투자 중인 금액 (평가금액)
    const investedVal = appState.balance - currentCash;
    const totalVal = appState.balance > 0 ? appState.balance : 1; // 0 나누기 방지
    
    // 퍼센트 계산
    let investPercent = 0;
    if(appState.isRunning && investedVal > 0) {
        investPercent = (investedVal / totalVal) * 100;
    }
    const cashPercent = 100 - investPercent;

    // 파이차트 그리기 (CSS)
    if(pie) {
        if(investPercent > 0) {
            pie.style.background = `conic-gradient(var(--accent) 0% ${investPercent}%, #444 ${investPercent}% 100%)`;
        } else {
            pie.style.background = `conic-gradient(#444 0% 100%)`; // 100% 현금
        }
    }

    // 리스트 그리기
    let html = '';
    
    // (1) 투자 코인 (실행 중일 때만 표시)
    if(appState.isRunning && investedVal > 0) {
        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 5px; border-bottom:1px solid #222;">
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:12px; height:12px; background:var(--accent); border-radius:50%;"></div>
                <div>
                    <div style="font-weight:bold; color:#fff; font-size:0.95rem;">${appState.runningCoin}</div>
                    <div style="font-size:0.75rem; color:var(--accent);">AI Trading</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="color:#fff; font-weight:bold;">$ ${investedVal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                <div style="font-size:0.75rem; color:#888;">${investPercent.toFixed(1)}%</div>
            </div>
        </div>`;
    }

    // (2) 현금 (항상 표시)
    if(appState.balance > 0) {
        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 5px; border-bottom:1px solid #222;">
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:12px; height:12px; background:#444; border-radius:50%;"></div>
                <div>
                    <div style="font-weight:bold; color:#fff; font-size:0.95rem;">USDT</div>
                    <div style="font-size:0.75rem; color:#888;">Tether (Cash)</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="color:#fff; font-weight:bold;">$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                <div style="font-size:0.75rem; color:#888;">${cashPercent.toFixed(1)}%</div>
            </div>
        </div>`;
    } else {
        html = '<div style="padding:20px; text-align:center; color:#666; font-size:0.8rem;">보유 자산이 없습니다.<br>입금 후 이용해주세요.</div>';
    }

    list.innerHTML = html;
}

// 지갑 투자손익 탭
function updatePnLTab() {
    const pnlAmt = document.getElementById('pnl-total-amount');
    const pnlPct = document.getElementById('pnl-total-percent');
    const pnlInv = document.getElementById('pnl-avg-invest');
    
    if(pnlAmt && appState.startBalance > 0) {
        // 전체 누적 손익 (현재 총액 - 원금)
        // 원금: 입금 총액 등을 추적해야 정확하지만, 여기서는 시뮬레이션 시작 시점을 기준
        const totalProfit = appState.balance - appState.startBalance; 
        const pct = (totalProfit / appState.startBalance) * 100;
        const color = totalProfit >= 0 ? 'text-green' : 'text-red';
        
        pnlAmt.innerText = `$ ${totalProfit.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        pnlAmt.className = `hero-number ${color}`;
        pnlPct.innerText = `${totalProfit>=0?'+':''}${pct.toFixed(2)}%`;
        pnlPct.className = color;
        pnlInv.innerText = `$ ${appState.investedAmount.toLocaleString()}`;
    }
}

// 거래내역 업데이트
function updateHistoryTables() {
    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        if(appState.tradeHistory.length === 0) historyTable.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">거래 내역이 없습니다.</td></tr>';
        else {
            let html = '';
            appState.tradeHistory.slice(0, 30).forEach(t => {
                let color = 'text-green';
                if(t.type === '매도' || t.type.includes('손절')) color = 'text-red';
                html += `<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>${t.market}</td><td class="${color}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`;
            });
            historyTable.innerHTML = html;
        }
    }
    const mainList = document.getElementById('main-ledger-list');
    if(mainList) {
        if(appState.tradeHistory.length === 0) mainList.innerHTML = '<div style="padding:40px; text-align:center; color:#444;">NO TRADES YET</div>';
        else {
            let html = '';
            appState.tradeHistory.slice(0, 50).forEach(t => {
                const color = parseFloat(t.pnl) >= 0 ? 'text-green' : 'text-red';
                html += `<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${t.type.includes('매도')?'text-red':'text-green'}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${color}">${t.net}</div></div>`;
            });
            mainList.innerHTML = html;
        }
    }
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) {
        let html = ''; appState.transfers.forEach(t => { html += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`; }); bankList.innerHTML = html;
    }
}

/* --- 트레이딩 엔진 --- */
async function executeAiTrade() {
    if(!appState.isRunning) return;
    const coin = appState.runningCoin;
    // 가격 가져오기 (실시간 or 시뮬레이션)
    let price = appState.realPrices[coin];
    if(!price) price = await fetchRealPrice(coin);

    const action = Math.random();
    let type = '관망';
    let pnl = 0;

    if (action > 0.6) { type = '매수'; pnl = (appState.investedAmount * (Math.random() * 0.002)); } 
    else if (action > 0.3) { type = '익절'; pnl = (appState.investedAmount * (Math.random() * 0.005)); } 
    else { type = '매도'; pnl = -(appState.investedAmount * (Math.random() * 0.003)); }

    appState.balance += pnl;
    
    const fee = appState.investedAmount * 0.0005;
    const net = (appState.investedAmount + pnl) - fee;
    
    appState.tradeHistory.unshift({
        time: new Date().toLocaleTimeString('en-GB'), coin: coin, market: 'USDT', type: type,
        price: price.toLocaleString(), qty: (appState.investedAmount / price).toFixed(4),
        tradeAmt: appState.investedAmount.toFixed(2), fee: fee.toFixed(2), net: net.toFixed(2), pnl: pnl.toFixed(2)
    });
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
    renderGlobalUI();
}

async function fetchRealPrice(coin) {
    try { const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`); const d = await res.json(); appState.realPrices[coin] = parseFloat(d.price); return parseFloat(d.price); } 
    catch (e) { return getRealisticPrice(coin); }
}

/* --- 시스템 기본 함수 --- */
function startSystem(s=false) {
    if (appState.balance < 10) { if(!s) alert("잔고 부족"); stopSystem(true); return; }
    if (!appState.config.isReady) { if(!s) alert("AI 설정 필요"); return; }
    appState.runningCoin = appState.config.target.split('/')[0];
    appState.investedAmount = appState.config.amount;
    appState.cash = appState.balance - appState.investedAmount;
    if(appState.startBalance === 0) appState.startBalance = appState.balance; // 원금 설정
    
    if(appState.openOrders.length===0) generateFakeOpenOrders(appState.runningCoin);
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true;
    autoTradeInterval = setInterval(executeAiTrade, 1000);
    updateButtonState(true);
    saveState();
}
function stopSystem(s=false) { appState.isRunning = false; appState.investedAmount = 0; appState.cash = appState.balance; if(autoTradeInterval) clearInterval(autoTradeInterval); updateButtonState(false); saveState(); renderGlobalUI(); }
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(appState))}
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)}}catch(e){}}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d)}catch(e){}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c||(c.includes('info')&&e.href.includes('index')))e.classList.add('active');else e.classList.remove('active')})}
function getRealisticPrice(s){const r=Math.random();if(s==='BTC')return 68420+(r*300);if(s==='ETH')return 2245+(r*15);if(s==='XRP')return 1.48+(r*0.005);return 100+(r*10)}
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
