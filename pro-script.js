/* pro-script.js - V61.0 (Custom Bank Deposit) */
let appState = {
    balance: 0.00,        // 지갑 총 자산
    cash: 0.00,           // 지갑 현금
    bankBalance: 0.00,    // 은행 잔고
    startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: ""
};
let autoTradeInterval = null;
let dataCounterInterval = null;
const SAVE_KEY = 'neuroBotData_V60_FIX';
const CONFIG_KEY = 'neuroConfig_V60_FIX';

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

/* --- 1. [NEW] 사용자 지정 은행 입금 --- */
function processBankDeposit() {
    const input = document.getElementById('bank-deposit-input');
    const amt = parseFloat(input.value);

    // 유효성 검사
    if (!amt || isNaN(amt)) return alert("금액을 입력해주세요.");
    
    // 한도 체크 ($10 ~ $100,000)
    if (amt < 10) return alert("⛔ 최소 입금액은 $10 (약 1만원) 입니다.");
    if (amt > 100000) return alert("⛔ 최대 입금액은 $100,000 (약 1억원) 입니다.");

    if(!appState) loadState();
    
    // 은행 잔고 증가
    appState.bankBalance = parseFloat(appState.bankBalance) + amt;
    
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

/* --- 2. 지갑 입출금 (은행 <-> 지갑) --- */
let currentTxMode = '';
function openModal(mode) {
    const modal = document.getElementById('transaction-modal'); if(!modal) return; 
    modal.style.display = 'flex'; currentTxMode = mode;
    document.getElementById('amount-input').value = '';
    const title = document.getElementById('modal-title');
    title.innerText = mode === 'deposit' ? "입금 (은행 → 지갑)" : "출금 (지갑 → 은행)";
    title.style.color = mode === 'deposit' ? "var(--color-up)" : "var(--color-down)";
}

function processTx() {
    const input = document.getElementById('amount-input');
    const amt = parseFloat(input.value);
    if(!amt || amt <= 0) return alert("금액을 확인해주세요.");

    if(currentTxMode === 'deposit') {
        if(appState.bankBalance < amt) return alert("은행 잔고가 부족합니다.");
        appState.bankBalance -= amt;
        appState.balance += amt;
        appState.cash += amt; 
    } else {
        if(appState.cash < amt) return alert("지갑 내 출금 가능 현금이 부족합니다.");
        appState.balance -= amt;
        appState.bankBalance += amt;
        appState.cash -= amt;
    }
    
    appState.transfers.unshift({
        date: new Date().toISOString().slice(0,10), 
        type: currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW", 
        amount: amt
    });
    
    saveState(); renderGlobalUI(); closeModal();
}

/* --- 3. 렌더링 --- */
function renderGlobalUI() {
    const els = { 
        total: document.getElementById('total-val'), 
        label: document.getElementById('balance-label'), 
        wallet: document.getElementById('wallet-display'), 
        avail: document.getElementById('avail-cash'), 
        bank: document.getElementById('bank-balance-display'),
        prof: document.getElementById('real-profit')
    };
    
    if(els.total) {
        if(appState.isRunning) {
            const activeMoney = (appState.balance - appState.cash); 
            els.total.innerText = `$ ${activeMoney.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            els.label.innerText = `현재 운용 자산 (${appState.runningCoin})`;
            els.label.style.color = "var(--accent)";
            
            const profit = appState.balance - appState.startBalance;
            const profitPercent = appState.startBalance > 0 ? (profit / appState.startBalance) * 100 : 0;
            const pnlColor = profit >= 0 ? 'text-green' : 'text-red';
            els.prof.innerHTML = `<span class="${pnlColor}">${profit>=0?'+':''}${profitPercent.toFixed(2)}%</span> ($${profit.toFixed(2)})`;
        } else {
            els.total.innerText = `$ 0.00`;
            els.label.innerText = `AI TRADING READY`;
            els.label.style.color = "var(--text-secondary)";
            els.prof.innerText = "---";
        }
    }

    if(els.wallet) {
        els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        els.avail.innerText = `$ ${appState.cash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    }

    if(els.bank) {
        els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    }
    
    const mainList = document.getElementById('main-ledger-list');
    if(mainList) {
        if(appState.tradeHistory.length === 0) mainList.innerHTML = '<div style="padding:40px; text-align:center; color:#444;">NO TRADES YET</div>';
        else {
            let html = '';
            appState.tradeHistory.slice(0, 50).forEach(t => {
                const color = t.net >= 0 ? 'text-green' : 'text-red';
                html += `<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${t.type=='매수'?'text-green':'text-red'}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${color}">${t.net}</div></div>`;
            });
            mainList.innerHTML = html;
        }
    }
    
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) {
        let bHtml = '';
        appState.transfers.forEach(t => {
            bHtml += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`;
        });
        bankList.innerHTML = bHtml;
    }
}

/* --- 4. 정보 페이지 및 기타 --- */
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
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "save_image": false,
        "autosize": true
    });

    const price = getRealisticPrice(coin);
    const score = Math.floor(Math.random() * (99 - 60) + 60);
    
    document.getElementById('ai-score-val').innerText = score;
    document.getElementById('analysis-price').innerText = `$ ${price.toLocaleString()}`;
    
    const verdict = document.getElementById('analysis-verdict');
    if (score >= 80) verdict.innerHTML = `"현재 구간은 <span class='text-green'>강력 매수</span>가 유효합니다."`;
    else if (score >= 60) verdict.innerHTML = `"현재 구간은 <span style='color:#aaa'>중립/관망</span> 구간입니다."`;
    else verdict.innerHTML = `"현재 구간은 <span class='text-red'>매도 우위</span>입니다."`;

    document.getElementById('val-support').innerText = `$ ${(price * 0.95).toFixed(2)}`;
    document.getElementById('val-resistance').innerText = `$ ${(price * 1.05).toFixed(2)}`;
    document.getElementById('val-stoploss').innerText = `$ ${(price * 0.92).toFixed(2)}`;
    document.getElementById('val-target').innerText = `$ ${(price * 1.15).toFixed(2)}`;

    const reportHTML = `
        현재 <strong>${coin}</strong>의 온체인 데이터를 분석한 결과, 
        <span class="text-green">매수 유입</span>이 전일 대비 12% 증가했습니다.<br><br>
        기술적 지표(RSI, MACD)는 상승 다이버전스를 가리키고 있으며, 
        <strong>$${(price * 1.02).toFixed(2)}</strong> 저항선 돌파 시 강한 시세 분출이 예상됩니다.<br><br>
        ⚠️ <strong>AI 조언:</strong> 현 구간 분할 매수 권장.
    `;
    document.getElementById('deep-report-text').innerHTML = reportHTML;
    loadNewsData(coin);
}

function loadNewsData(coin) {
    const list = document.getElementById('news-board-list');
    if(!list) return;
    let html = '';
    const newsTitles = [ `${coin} 고래 지갑 대규모 이동 포착`, `[시장속보] ${coin} 거래량 급증, 변동성 확대`, `글로벌 투자사, ${coin} 포트폴리오 추가 검토`, `美 규제 완화 기대감, ${coin} 상승 동력 되나`, `전문가 "${coin} 지지선 구축 완료, 반등 임박"` ];
    for(let i=0; i<5; i++) {
        html += `<div style="padding:12px 5px; border-bottom:1px solid #333;"><div style="font-size:0.85rem; margin-bottom:4px; color:#ddd;"><span style="background:var(--color-up); font-size:0.6rem; padding:2px 4px; border-radius:2px; margin-right:5px;">NEW</span>${newsTitles[i]}</div><div style="font-size:0.7rem; color:#666;">${new Date().toLocaleTimeString()}</div></div>`;
    }
    list.innerHTML = html;
}

/* --- 공통 유틸리티 --- */
function startSystem(isSilent=false) {
    if (appState.balance < 10) { if(!isSilent) alert("지갑 잔고 부족 (최소 $10)"); stopSystem(true); return; }
    if (!appState.config.isReady) { if(!isSilent) alert("AI 설정 필요"); return; }
    if(appState.balance < appState.config.amount) { if(!isSilent) alert("설정 금액이 현재 잔고보다 큽니다."); stopSystem(true); return; }

    appState.runningCoin = appState.config.target.split('/')[0];
    appState.investedAmount = appState.config.amount;
    appState.cash = appState.balance - appState.investedAmount;
    
    if(appState.openOrders.length===0) generateFakeOpenOrders(appState.runningCoin);
    if(autoTradeInterval) clearInterval(autoTradeInterval);
    appState.isRunning = true;
    autoTradeInterval = setInterval(executeAiTrade, 1000);
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

function executeAiTrade() {
    if(!appState.isRunning) return;
    const isWin = Math.random() > 0.45;
    const pnl = isWin ? (appState.investedAmount * 0.005) : -(appState.investedAmount * 0.003);
    appState.balance += pnl;
    const coin = appState.runningCoin;
    const price = getRealisticPrice(coin);
    appState.tradeHistory.unshift({ time: new Date().toLocaleTimeString('en-GB'), coin: coin, type: Math.random()>0.5?'매수':'매도', price: price.toLocaleString(), net: pnl.toFixed(2), vol: (appState.investedAmount/price).toFixed(4), total: appState.investedAmount.toFixed(2) });
    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
    renderGlobalUI();
}

function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(appState)); }
function loadState() { try { const d = localStorage.getItem(SAVE_KEY); if(d) appState = {...appState, ...JSON.parse(d)}; } catch(e){} }
function loadConfig() { try { const d = localStorage.getItem(CONFIG_KEY); if(d) appState.config = JSON.parse(d); } catch(e){} }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur || (cur.includes('info') && el.href.includes('index'))) el.classList.add('active'); else el.classList.remove('active'); }); }
function getRealisticPrice(s) { const r = Math.random(); return s==='BTC'?96000+r*500 : s==='ETH'?2700+r*20 : s==='XRP'?2.4+r*0.05 : 100+r; }
function updateButtonState(on) { const b = document.getElementById('btn-main-control'); if(b) { b.innerHTML = on ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START'; b.style.background = on ? 'var(--color-up)' : '#2b3139'; } }
function handleSearch(v) { appState.searchQuery = v.toUpperCase(); }
function searchInfoCoin() { const input = document.getElementById('info-page-search'); if(input && input.value) window.location.href = `info.html?coin=${input.value.toUpperCase()}`; }
function openInfoPage() { window.location.href = `info.html?coin=${appState.searchQuery || appState.runningCoin || 'BTC'}`; }
function showTab(t) { appState.activeTab = t; saveState(); document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden')); document.getElementById('tab-'+t).classList.remove('hidden'); document.querySelectorAll('.wallet-tab-btn').forEach(b => b.classList.remove('active')); document.getElementById('btn-'+t).classList.add('active'); }
function generateFakeOpenOrders(c) { appState.openOrders = []; for(let i=0; i<3; i++) appState.openOrders.push({time:'12:00', coin:c, type:'매수', price:'Loading', vol:'0.0'}); }
function startDataCounter() { if(dataCounterInterval) clearInterval(dataCounterInterval); const el=document.getElementById('data-mining-counter'); if(el) dataCounterInterval = setInterval(() => { appState.dataCount += Math.floor(Math.random() * 15); el.innerText = appState.dataCount.toLocaleString(); }, 100); }
function exportLogs() { alert("✅ 거래 내역 다운로드 완료"); }
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function checkKeys(){ alert("✅ 키 확인 완료"); }
function selectStrategy(t) { document.querySelectorAll('.strategy-card').forEach(c=>c.classList.remove('active')); event.currentTarget.classList.add('active'); }
function closeModal() { document.getElementById('transaction-modal').style.display='none'; }
function calcPercent(pct) { const input = document.getElementById('amount-input'); let base = currentTxMode==='deposit' ? appState.bankBalance : appState.cash; if(pct===100) input.value = base; else input.value = Math.floor(base * (pct/100)*100)/100; }
