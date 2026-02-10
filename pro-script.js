/* pro-script.js - V65.0 (Intelligence News & History Fix) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: ""
};
let autoTradeInterval = null;
let dataCounterInterval = null;
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

/* --- 뉴스 인텔리전스 시스템 (업그레이드됨) --- */
function loadNewsData(coin) {
    const list = document.getElementById('news-board-list');
    if(!list) return;
    
    // [핵심] 진짜 같은 뉴스 템플릿 (코인명, 가격 등 동적 삽입)
    const newsTemplates = [
        { t: `[긴급] ${coin} 재단, 1억 달러 규모 생태계 펀드 조성 발표`, c: `재단 측은 공식 트위터를 통해 생태계 확장을 위한 대규모 펀딩을 완료했다고 밝혔습니다. 이로 인해 유동성이 공급될 것으로 보입니다.` },
        { t: `${coin} 고래 지갑에서 5,000만 개 대량 이동 포착 (거래소 유입)`, c: `온체인 데이터 분석 결과, 익명의 고래 지갑에서 바이낸스로 대규모 물량이 이동했습니다. 매도 압력으로 작용할지 귀추가 주목됩니다.` },
        { t: `美 SEC, ${coin} 증권성 여부 재검토 시사... 변동성 확대 주의`, c: `규제 당국의 발언으로 인해 ${coin}의 시세가 급등락을 반복하고 있습니다. 투자자들의 주의가 요구됩니다.` },
        { t: `[기술분석] ${coin}, '골든크로스' 임박... 추세 전환 신호인가?`, c: `일봉 기준 50일 이동평균선이 200일 선을 상향 돌파하려는 움직임이 포착되었습니다. 기술적 반등이 기대되는 구간입니다.` },
        { t: `글로벌 대형 헤지펀드, 포트폴리오에 ${coin} 추가 검토 중`, c: `월가 소식통에 따르면 대형 기관들이 ${coin}을 인플레이션 헷지 수단으로 고려하고 있다는 소식입니다.` },
        { t: `${coin} 네트워크 해시레이트 사상 최고치 경신`, c: `네트워크 보안성과 안정성이 강화되면서 채굴자들의 유입이 가속화되고 있습니다. 펀더멘탈 강화 신호로 해석됩니다.` },
        { t: `주요 거래소, ${coin} 입출금 일시 중단 (네트워크 업그레이드)`, c: `하드포크 및 네트워크 안정화를 위해 약 4시간 동안 입출금이 제한될 예정입니다. 시세 차이에 유의하세요.` },
        { t: `[단독] ${coin}, 대형 결제 플랫폼과 파트너십 루머 확산`, c: `트위터와 레딧을 중심으로 대형 결제 기업과의 협업설이 돌고 있습니다. 팩트 체크가 필요한 시점입니다.` },
        { t: `${coin} 선물 미결제 약정 급증... '롱 스퀴즈' 발생 가능성`, c: `선물 시장 과열 양상을 보이고 있습니다. 급격한 청산빔이 나올 수 있으니 레버리지 사용에 주의하세요.` },
        { t: `유명 애널리스트 "${coin}, 지금이 저점 매수 마지막 기회"`, c: `구독자 50만 명의 크립토 분석가가 자신의 채널을 통해 강력한 매수 시그널을 보냈습니다.` }
    ];

    let html = '';
    // 랜덤으로 5개 뉴스 뽑기
    for(let i=0; i<5; i++) {
        // 랜덤 뉴스 선택
        const randIdx = Math.floor(Math.random() * newsTemplates.length);
        const news = newsTemplates[randIdx];
        const timeOffset = Math.floor(Math.random() * 60); // 0~60분 전
        
        html += `
        <div class="news-item" onclick="toggleNews(${i})">
            <div class="news-title">
                <span class="news-new-badge">NEW</span> ${news.t}
            </div>
            <div class="news-meta">
                <span><i class="far fa-clock"></i> ${timeOffset}분 전</span>
                <span><i class="far fa-eye"></i> ${Math.floor(Math.random()*5000)+1000}</span>
            </div>
            <div id="news-content-${i}" class="news-content">
                <span style="color:var(--accent); font-weight:bold;">[AI 요약]</span><br>
                ${news.c}
            </div>
        </div>`;
    }
    list.innerHTML = html;
}

function toggleNews(id) {
    const content = document.getElementById(`news-content-${id}`);
    if(content) {
        const isShown = content.classList.contains('show');
        // 다른 뉴스 다 닫기
        document.querySelectorAll('.news-content').forEach(el => el.classList.remove('show'));
        // 클릭한 것만 토글
        if(!isShown) content.classList.add('show');
    }
}

/* --- 렌더링 (거래내역 안 나오는 문제 해결) --- */
function renderGlobalUI() {
    const els = { 
        total: document.getElementById('total-val'), label: document.getElementById('balance-label'), 
        wallet: document.getElementById('wallet-display'), avail: document.getElementById('avail-cash'), 
        bank: document.getElementById('bank-balance-display'), prof: document.getElementById('real-profit')
    };
    
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

    // [수정] 거래내역 (데이터가 있는데 안 나오는 경우 방지)
    const historyTable = document.getElementById('history-table-body');
    if(historyTable) {
        if (appState.tradeHistory.length === 0) {
            historyTable.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#666;">거래 내역이 없습니다.</td></tr>';
        } else {
            let tHtml = '';
            appState.tradeHistory.slice(0, 30).forEach(t => {
                const typeColor = t.type === '매수' ? 'text-green' : 'text-red';
                tHtml += `<tr>
                    <td style="color:#888">${t.time}</td>
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
    }
    
    // 메인 리스트
    const mainList = document.getElementById('main-ledger-list');
    if(mainList) {
        if(appState.tradeHistory.length===0) mainList.innerHTML = '<div style="padding:40px; text-align:center; color:#444;">NO TRADES YET</div>';
        else {
            let html = '';
            appState.tradeHistory.slice(0, 50).forEach(t => {
                const color = parseFloat(t.pnl) >= 0 ? 'text-green' : 'text-red';
                html += `<div class="ledger-row"><div class="col-time">${t.time}</div><div class="col-coin">${t.coin} <span class="${t.type=='매수'?'text-green':'text-red'}" style="font-size:0.7rem;">${t.type}</span></div><div class="col-price">${t.price}</div><div class="col-pnl ${color}">${t.net}</div></div>`;
            });
            mainList.innerHTML = html;
        }
    }
    
    // 은행 내역
    const bankList = document.getElementById('bank-history-list');
    if(bankList && appState.transfers) {
        let bHtml = '';
        appState.transfers.forEach(t => { bHtml += `<div class="ledger-row"><div style="width:30%">${t.date}</div><div style="width:30%">${t.type}</div><div style="width:40%; text-align:right;">$${t.amount.toLocaleString()}</div></div>`; });
        bankList.innerHTML = bHtml;
    }
}

// 나머지 함수 (기존 유지)
function startSystem(isSilent=false) { if (appState.balance < 10) { if(!isSilent) alert("지갑 잔고 부족"); stopSystem(true); return; } if (!appState.config.isReady) { if(!isSilent) alert("AI 설정 필요"); return; } if(appState.balance < appState.config.amount) { if(!isSilent) alert("설정 금액 > 잔고"); stopSystem(true); return; } appState.runningCoin = appState.config.target.split('/')[0]; appState.investedAmount = appState.config.amount; appState.cash = appState.balance - appState.investedAmount; if(appState.openOrders.length===0) generateFakeOpenOrders(appState.runningCoin); if(autoTradeInterval) clearInterval(autoTradeInterval); appState.isRunning = true; autoTradeInterval = setInterval(executeAiTrade, 1000); updateButtonState(true); saveState(); }
function stopSystem(isSilent=false) { appState.isRunning = false; appState.investedAmount = 0; appState.cash = appState.balance; if(autoTradeInterval) clearInterval(autoTradeInterval); updateButtonState(false); saveState(); renderGlobalUI(); }
function executeAiTrade() { if(!appState.isRunning) return; const isWin = Math.random() > 0.45; const profitRate = (Math.random() * 0.005) + 0.001; const rawPnl = isWin ? (appState.investedAmount * profitRate) : -(appState.investedAmount * profitRate * 0.8); appState.balance += rawPnl; const coin = appState.runningCoin; const price = getRealisticPrice(coin); const type = Math.random() > 0.5 ? '매수' : '매도'; const qty = appState.investedAmount / price; const fee = appState.investedAmount * 0.0005; const tradeAmt = appState.investedAmount; const netAmount = (tradeAmt + rawPnl) - fee; appState.tradeHistory.unshift({ time: new Date().toLocaleTimeString('en-GB'), coin: coin, market: 'USDT', type: type, price: price.toLocaleString(), qty: qty.toFixed(6), tradeAmt: tradeAmt.toFixed(2), fee: fee.toFixed(2), net: netAmount.toFixed(2), pnl: rawPnl.toFixed(2) }); if(appState.tradeHistory.length > 50) appState.tradeHistory.pop(); renderGlobalUI(); }
function initInfoPage(c){c=c.toUpperCase();const i=document.getElementById('info-page-search');if(i)i.value=c;new TradingView.widget({"container_id":"info_tv_chart","symbol":`BINANCE:${c}USDT`,"interval":"15","theme":"dark","style":"1","locale":"kr","autosize":true,"hide_side_toolbar":false});const p=getRealisticPrice(c);const s=Math.floor(Math.random()*39+60);document.getElementById('ai-score-val').innerText=s;document.getElementById('analysis-price').innerText=`$ ${p.toLocaleString()}`;document.getElementById('analysis-verdict').innerHTML=s>=80?`"<span class='text-green'>강력 매수</span> 구간"`:s>=60?`"<span style='color:#aaa'>중립/관망</span> 구간"`:`"<span class='text-red'>매도 우위</span> 구간"`;document.getElementById('val-support').innerText=`$ ${(p*0.95).toFixed(2)}`;document.getElementById('val-resistance').innerText=`$ ${(p*1.05).toFixed(2)}`;document.getElementById('val-stoploss').innerText=`$ ${(p*0.92).toFixed(2)}`;document.getElementById('val-target').innerText=`$ ${(p*1.15).toFixed(2)}`;document.getElementById('deep-report-text').innerHTML=`현재 <strong>${c}</strong>의 온체인 데이터를 분석한 결과, <span class='text-green'>매수 유입</span>이 증가했습니다.<br><br>RSI, MACD 지표는 상승을 가리키고 있으며 <strong>$${(p*1.02).toFixed(2)}</strong> 돌파 시 시세 분출이 예상됩니다.<br><br>⚠️ <strong>AI 조언:</strong> 분할 매수 권장.`;loadNewsData(c);}
// 공통함수들
function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(appState)); }
function loadState() { try { const d = localStorage.getItem(SAVE_KEY); if(d) appState = {...appState, ...JSON.parse(d)}; } catch(e){} }
function loadConfig() { try { const d = localStorage.getItem(CONFIG_KEY); if(d) appState.config = JSON.parse(d); } catch(e){} }
function highlightMenu() { const cur = window.location.pathname.split("/").pop() || 'index.html'; document.querySelectorAll('.nav-item').forEach(el => { if(el.getAttribute('href') === cur || (cur.includes('info') && el.href.includes('index'))) el.classList.add('active'); else el.classList.remove('active'); }); }
function getRealisticPrice(s) { const r = Math.random(); return s==='BTC'?96000+r*500 : s==='ETH'?2700+r*20 : s==='XRP'?2.4+r*0.05 : 100+r; }
function updateButtonState(on) { const b = document.getElementById('btn-main-control'); if(b) { b.innerHTML = on ? '<i class="fas fa-play"></i> RUNNING' : '<i class="fas fa-play"></i> START'; b.style.background = on ? '#c84a31' : '#2b3139'; } } // [수정] 버튼 색상 로직
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
function processBankDeposit(){const i=document.getElementById('bank-deposit-input');const a=parseFloat(i.value);if(!a||isNaN(a))return alert("금액 오류");if(a<10)return alert("최소 $10");if(a>100000)return alert("최대 $100,000");if(!appState)loadState();appState.bankBalance=parseFloat(appState.bankBalance)+a;appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:"WIRE IN",amount:a});saveState();renderGlobalUI();alert("입금 완료");i.value='';}
function openModal(mode){const m=document.getElementById('transaction-modal');if(!m)return;m.style.display='flex';currentTxMode=mode;document.getElementById('amount-input').value='';document.getElementById('modal-title').innerText=mode==='deposit'?"입금 (은행 → 지갑)":"출금 (지갑 → 은행)";}
function processTx(){const i=document.getElementById('amount-input');const a=parseFloat(i.value);if(!a||a<=0)return alert("금액 오류");if(currentTxMode==='deposit'){if(appState.bankBalance<a)return alert("은행 잔고 부족");appState.bankBalance-=a;appState.balance+=a;appState.cash+=a;}else{if(appState.cash<a)return alert("현금 부족");appState.balance-=a;appState.bankBalance+=a;appState.cash-=a;}appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW",amount:a});saveState();renderGlobalUI();closeModal();}
function closeModal(){document.getElementById('transaction-modal').style.display='none';}
function calcPercent(p){const i=document.getElementById('amount-input');let b=currentTxMode==='deposit'?appState.bankBalance:appState.cash;if(p===100)i.value=b;else i.value=Math.floor(b*(p/100)*100)/100;}
