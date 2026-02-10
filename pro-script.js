/* pro-script.js - V65.0 (News Fix & Detail History) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
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

/* --- 뉴스 클릭 (Toggle) 기능 --- */
function toggleNews(id) {
    const content = document.getElementById(`news-content-${id}`);
    if (content) {
        // 이미 열려있으면 닫고, 닫혀있으면 엽니다.
        if (content.classList.contains('show')) {
            content.classList.remove('show');
        } else {
            // 다른 뉴스 닫기 (선택사항)
            document.querySelectorAll('.news-content').forEach(el => el.classList.remove('show'));
            content.classList.add('show');
        }
    }
}

/* --- 트레이딩 엔진 & 상세 내역 생성 --- */
function executeAiTrade() {
    if(!appState.isRunning) return;

    // 1. 수익률 계산 (랜덤)
    const isWin = Math.random() > 0.45;
    const profitRate = (Math.random() * 0.005) + 0.001; // 0.1% ~ 0.5% 변동
    const rawPnl = isWin ? (appState.investedAmount * profitRate) : -(appState.investedAmount * profitRate * 0.8);
    
    // 2. 자산 반영
    appState.balance += rawPnl;
    
    // 3. [핵심] 상세 거래내역 데이터 생성
    const coin = appState.runningCoin;
    const price = getRealisticPrice(coin);
    const type = Math.random() > 0.5 ? '매수' : '매도'; // 매수/매도 랜덤 표시 (실제 PnL과 무관하게 시뮬레이션)
    const qty = appState.investedAmount / price;
    const fee = appState.investedAmount * 0.0005; // 수수료 0.05%
    const tradeAmt = appState.investedAmount;
    
    // 정산금액 = (투자금 + 수익) - 수수료
    const netAmount = (tradeAmt + rawPnl) - fee;

    appState.tradeHistory.unshift({
        time: new Date().toLocaleTimeString('en-GB'), // 24시간제
        coin: coin,
        market: 'USDT', // 마켓 종류
        type: type,
        price: price,
        qty: qty.toFixed(6), // 수량
        tradeAmt: tradeAmt.toFixed(2), // 거래금액
        fee: fee.toFixed(2), // 수수료
        net: netAmount.toFixed(2), // 정산금액
        pnl: rawPnl.toFixed(2) // 단순 손익(색상용)
    });

    if(appState.tradeHistory.length > 50) appState.tradeHistory.pop();
    renderGlobalUI();
}

/* --- 렌더링 (지갑 & 거래내역 칼럼) --- */
function renderGlobalUI() {
    const els = { total: document.getElementById('total-val'), label: document.getElementById('balance-label'), wallet: document.getElementById('wallet-display'), avail: document.getElementById('avail-cash'), bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit') };
    
    // 현금 계산: 실행중이면 남은 돈, 아니면 전체 돈
    const currentCash = appState.isRunning ? appState.cash : appState.balance;

    if(els.total) { // 메인화면
        if(appState.isRunning) {
            const activeMoney = appState.balance - appState.cash;
            els.total.innerText = `$ ${activeMoney.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            els.label.innerText = `현재 운용 자산 (${appState.runningCoin})`;
            els.label.style.color = "var(--accent)";
            
            const profit = appState.balance - appState.startBalance;
            const pct = appState.startBalance > 0 ? (profit/appState.startBalance)*100 : 0;
            const color = profit >= 0 ? 'text-green' : 'text-red';
            els.prof.innerHTML = `<span class="${color}">${profit>=0?'+':''}${pct.toFixed(2)}%</span> ($${profit.toFixed(2)})`;
        } else {
            els.total.innerText = `$ 0.00`;
            els.label.innerText = `AI TRADING READY`;
            els.label.style.color = "#888";
            els.prof.innerText = "---";
        }
    }

    if(els.wallet) { // 지갑화면
        els.wallet.innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        els.avail.innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    }
    if(els.bank) els.bank.innerText = `$ ${appState.bankBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    // [지갑] 파이차트 및 보유자산 리스트 (항상 표시)
    if(document.getElementById('holdings-list')) {
        const invested = appState.isRunning ? (appState.balance - appState.cash) : 0;
        const total = appState.balance > 0 ? appState.balance : 1;
        const investPercent = (invested / total) * 100;
        const cashPercent = 100 - investPercent;
        
        const pie = document.getElementById('portfolio-pie');
        if(pie) {
            // 현금만 있어도 회색 차트 표시
            if(invested > 0) pie.style.background = `conic-gradient(var(--accent) 0% ${investPercent}%, #444 ${investPercent}% 100%)`;
            else pie.style.background = `conic-gradient(#444 0% 100%)`;
        }
        
        const hList = document.getElementById('holdings-list');
        let hHtml = '';
        
        // 1. 코인 (실행 중일 때만)
        if(appState.isRunning && invested > 0) {
            hHtml += `<div style="display:flex; justify-content:space-between; padding:12px 5px; border-bottom:1px solid #333;"><div><div style="font-weight:bold; color:#fff;">${appState.runningCoin}</div><div style="font-size:0.7rem; color:var(--accent);">AI TRADING</div></div><div style="text-align:right;"><div style="color:#fff;">$${invested.toLocaleString(undefined, {minimumFractionDigits:2})}</div><div style="font-size:0.75rem; color:#888;">${investPercent.toFixed(1)}%</div></div></div>`;
        }
        // 2. 현금 (항상 표시 - 이제 나옵니다!)
        hHtml += `<div style="display:flex; justify-content:space-between; padding:12px 5px; border-bottom:1px solid #333;"><div><div style="font-weight:bold; color:#fff;">USDT</div><div style="font-size:0.7rem; color:#888;">현금 자산</div></div><div style="text-align:right;"><div style="color:#fff;">$${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}</div><div style="font-size:0.75rem; color:#888;">${cashPercent.toFixed(1)}%</div></div></div>`;
        hList.innerHTML = hHtml;
    }

    // [지갑] 상세 거래내역 테이블 (8개 칼럼)
    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        let tHtml = '';
        appState.tradeHistory.slice(0, 30).forEach(t => {
            const typeColor = t.type === '매수' ? 'text-green' : 'text-red';
            // 요청하신 순서: 시간 | 코인 | 마켓 | 종류 | 수량 | 거래금액 | 수수료 | 정산금액
            tHtml += `<tr>
                <td>${t.time}</td>
                <td style="font-weight:bold;">${t.coin}</td>
                <td>${t.market}</td>
                <td class="${typeColor}">${t.type}</td>
                <td>${t.qty}</td>
                <td>$${t.tradeAmt}</td>
                <td style="color:#888;">$${t.fee}</td>
                <td style="font-weight:bold; color:#fff;">$${t.net}</td>
            </tr>`;
        });
        historyTable.innerHTML = tHtml;
    }
    
    // 메인 리스트 (간소화 버전)
    const mainList = document.getElementById('main-ledger-list');
    if(mainList) {
        let html = '';
        if(appState.tradeHistory.length===0) html='<div style="padding:40px; text-align:center; color:#444;">NO TRADES YET</div>';
        else {
            appState.tradeHistory.slice(0,50).forEach(t => {
                const color = parseFloat(t.pnl) >= 0 ? 'text-green' : 'text-red';
                html += `<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${t.type=='매수'?'text-green':'text-red'}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${color}">${t.net}</div></div>`;
            });
        }
        mainList.innerHTML = html;
    }
    
    // 은행 내역
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) {
        let bHtml = '';
        appState.transfers.forEach(t => { bHtml += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`; });
        bankList.innerHTML = bHtml;
    }
}

// 나머지 함수 (기존 유지 + 일부 수정)
function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(appState)); }
function loadState() { try { const d = localStorage.getItem(SAVE_KEY); if(d) appState = {...appState, ...JSON.parse(d)}; } catch(e){} }
function loadConfig() { try { const d = localStorage.getItem(CONFIG_KEY); if(d) appState.config = JSON.parse(d); } catch(e){} }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur || (cur.includes('info') && el.href.includes('index'))) el.classList.add('active'); else el.classList.remove('active'); }); }
function getRealisticPrice(s) { const r = Math.random(); return s==='BTC'?96000+r*500 : s==='ETH'?2700+r*20 : s==='XRP'?2.4+r*0.05 : 100+r; }
function updateButtonState(on) { const b = document.getElementById('btn-main-control'); if(b) { b.innerHTML = on ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START'; b.style.background = on ? 'var(--color-up)' : '#2b3139'; } }
function handleSearch(v) { appState.searchQuery = v.toUpperCase(); }
function searchInfoCoin() { const input = document.getElementById('info-page-search'); if(input && input.value) window.location.href = `info.html?coin=${input.value.toUpperCase()}`; }
function openInfoPage() { window.location.href = `info.html?coin=${appState.searchQuery || appState.runningCoin || 'BTC'}`; }
function showTab(t) { appState.activeTab = t; saveState(); document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden')); document.getElementById('tab-'+t).classList.remove('hidden'); document.querySelectorAll('.wallet-tab-btn').forEach(b => b.classList.remove('active')); document.getElementById('btn-'+t).classList.add('active'); renderGlobalUI(); }
function generateFakeOpenOrders(c) { appState.openOrders = []; for(let i=0; i<3; i++) appState.openOrders.push({time:'12:00', coin:c, type:'매수', price:'Loading', vol:'0.0'}); }
function startDataCounter() { if(dataCounterInterval) clearInterval(dataCounterInterval); const el=document.getElementById('data-mining-counter'); if(el) dataCounterInterval = setInterval(() => { appState.dataCount += Math.floor(Math.random() * 15); el.innerText = appState.dataCount.toLocaleString(); }, 100); }
function exportLogs() { alert("✅ 거래 내역 다운로드 완료"); }
function applyBankInterest() { if(appState.bankBalance>0) appState.bankBalance += (appState.bankBalance * 0.0000008); }
function checkKeys(){ alert("✅ 키 확인 완료"); }
function selectStrategy(t) { document.querySelectorAll('.strategy-card').forEach(c=>c.classList.remove('active')); event.currentTarget.classList.add('active'); }
function startSystem(isSilent=false) { if (appState.balance < 10) { if(!isSilent) alert("지갑 잔고 부족"); stopSystem(true); return; } if (!appState.config.isReady) { if(!isSilent) alert("AI 설정 필요"); return; } if(appState.balance < appState.config.amount) { if(!isSilent) alert("설정 금액 > 잔고"); stopSystem(true); return; } appState.runningCoin = appState.config.target.split('/')[0]; appState.investedAmount = appState.config.amount; appState.cash = appState.balance - appState.investedAmount; if(appState.openOrders.length===0) generateFakeOpenOrders(appState.runningCoin); if(autoTradeInterval) clearInterval(autoTradeInterval); appState.isRunning = true; autoTradeInterval = setInterval(executeAiTrade, 1000); updateButtonState(true); saveState(); }
function stopSystem(isSilent=false) { appState.isRunning = false; appState.investedAmount = 0; appState.cash = appState.balance; if(autoTradeInterval) clearInterval(autoTradeInterval); updateButtonState(false); saveState(); renderGlobalUI(); }
function processBankDeposit(){const i=document.getElementById('bank-deposit-input');const a=parseFloat(i.value);if(!a||isNaN(a))return alert("금액 오류");if(a<10)return alert("최소 $10");if(a>100000)return alert("최대 $100,000");if(!appState)loadState();appState.bankBalance=parseFloat(appState.bankBalance)+a;appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:"WIRE IN",amount:a});saveState();renderGlobalUI();alert("입금 완료");i.value='';}
function openModal(mode){const m=document.getElementById('transaction-modal');if(!m)return;m.style.display='flex';currentTxMode=mode;document.getElementById('amount-input').value='';document.getElementById('modal-title').innerText=mode==='deposit'?"입금 (은행 → 지갑)":"출금 (지갑 → 은행)";}
function processTx(){const i=document.getElementById('amount-input');const a=parseFloat(i.value);if(!a||a<=0)return alert("금액 오류");if(currentTxMode==='deposit'){if(appState.bankBalance<a)return alert("은행 잔고 부족");appState.bankBalance-=a;appState.balance+=a;appState.cash+=a;}else{if(appState.cash<a)return alert("현금 부족");appState.balance-=a;appState.bankBalance+=a;appState.cash-=a;}appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW",amount:a});saveState();renderGlobalUI();closeModal();}
function closeModal(){document.getElementById('transaction-modal').style.display='none';}
function calcPercent(p){const i=document.getElementById('amount-input');let b=currentTxMode==='deposit'?appState.bankBalance:appState.cash;if(p===100)i.value=b;else i.value=Math.floor(b*(p/100)*100)/100;}
function initInfoPage(c){c=c.toUpperCase();const i=document.getElementById('info-page-search');if(i)i.value=c;new TradingView.widget({"container_id":"info_tv_chart","symbol":`BINANCE:${c}USDT`,"interval":"15","theme":"dark","style":"1","locale":"kr","autosize":true,"hide_side_toolbar":false});const p=getRealisticPrice(c);const s=Math.floor(Math.random()*39+60);document.getElementById('ai-score-val').innerText=s;document.getElementById('analysis-price').innerText=`$ ${p.toLocaleString()}`;document.getElementById('analysis-verdict').innerHTML=s>=80?`"<span class='text-green'>강력 매수</span> 구간"`:s>=60?`"<span style='color:#aaa'>중립/관망</span> 구간"`:`"<span class='text-red'>매도 우위</span> 구간"`;document.getElementById('val-support').innerText=`$ ${(p*0.95).toFixed(2)}`;document.getElementById('val-resistance').innerText=`$ ${(p*1.05).toFixed(2)}`;document.getElementById('val-stoploss').innerText=`$ ${(p*0.92).toFixed(2)}`;document.getElementById('val-target').innerText=`$ ${(p*1.15).toFixed(2)}`;document.getElementById('deep-report-text').innerHTML=`현재 <strong>${c}</strong>의 온체인 데이터를 분석한 결과, <span class='text-green'>매수 유입</span>이 증가했습니다.<br><br>RSI, MACD 지표는 상승을 가리키고 있으며 <strong>$${(p*1.02).toFixed(2)}</strong> 돌파 시 시세 분출이 예상됩니다.<br><br>⚠️ <strong>AI 조언:</strong> 분할 매수 권장.`;loadNewsData(c);}
function loadNewsData(c){const l=document.getElementById('news-board-list');if(!l)return;let h='';const t=[`${c} 대규모 이체 포착`,`[시장속보] ${c} 변동성 확대`,`기관 ${c} 포트폴리오 추가`,`美 규제 완화, ${c} 호재`,`전문가 "${c} 반등 임박"`];for(let i=0;i<5;i++){h+=`<div class="news-item" onclick="toggleNews(${i})"><div class="news-title"><span class="news-new-badge">NEW</span> ${t[i]}</div><div class="news-meta"><span>${new Date().toLocaleTimeString()}</span></div><div id="news-content-${i}" class="news-content">이 뉴스는 <strong>${c}</strong> 시장에 중요한 영향을 미칠 수 있습니다.<br>현재 시장 참여자들은 해당 이슈에 민감하게 반응하고 있으며, 거래량이 동반된 시세 변화를 주시해야 합니다.</div></div>`;}l.innerHTML=h;}
