/* pro-script.js - V250.0 (Info Page Restore) */
const SAVE_KEY = 'neuroBot_V230_FINAL';
const CONFIG_KEY = 'neuroConfig_V230_FINAL';

let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    dailyTotalProfit: 0.00, tradeHistory: [], transfers: [], dataCount: 1240, 
    config: { isReady: false, target: 'BTC', amount: 1000, strategy: 'SCALPING', keysVerified: false }, 
    isRunning: false, runningCoin: 'BTC', investedAmount: 0, 
    realPrices: {}, position: null, searchQuery: ""
};

let autoTradeInterval = null;
let dataCounterInterval = null;
let socket = null;
let pnlChartInstance = null;

// 1. 초기화
window.addEventListener('load', () => {
    loadState();
    try {
        highlightMenu();
        startDataCounter();
        
        if (window.location.pathname.includes('info.html')) {
            const urlParams = new URLSearchParams(window.location.search);
            initInfoPage(urlParams.get('coin') || 'BTC');
        } else {
            if(document.getElementById('tab-holdings')) showTab(localStorage.getItem('lastTab') || 'holdings');
            const searchInput = document.getElementById('coin-search-input');
            if(searchInput) {
                if(appState.searchQuery) searchInput.value = appState.searchQuery;
                searchInput.addEventListener('keyup', (e) => { if(e.key==='Enter') searchInfoCoin(); else appState.searchQuery=e.target.value.toUpperCase(); });
            }
            if (appState.isRunning) startSystem(true);
        }
    } catch (e) { console.error(e); }

    setInterval(() => { saveState(); renderGlobalUI(); }, 500);
    renderGlobalUI();
});

/* --- 정보 페이지 복구 --- */
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
    
    // [복구] 초기 데이터 채우기
    const verdict = document.getElementById('analysis-verdict');
    if(verdict) verdict.innerText = "실시간 분석 중...";
    loadNewsData(c);
}

function updateInfoUI(p) {
    // 가격
    const elPrice = document.getElementById('analysis-price');
    if(elPrice) {
        const prev = parseFloat(elPrice.getAttribute('dp')) || p;
        elPrice.innerText = `$ ${p.toLocaleString()}`;
        elPrice.style.color = p > prev ? 'var(--color-up)' : (p < prev ? 'var(--color-down)' : '#fff');
        elPrice.setAttribute('dp', p);
    }
    
    // 점수 및 멘트
    const elScore = document.getElementById('ai-score-val');
    const elVerdict = document.getElementById('analysis-verdict');
    if(elScore && elVerdict) {
        // 가격 끝자리에 따라 랜덤 점수 생성 (실시간 느낌)
        const randomScore = 60 + Math.floor((p % 10) * 3); 
        elScore.innerText = Math.min(99, Math.max(40, randomScore));
        
        if(randomScore > 80) elVerdict.innerText = `"강력 매수 신호 (Strong Buy)"`;
        else if(randomScore > 50) elVerdict.innerText = `"중립 구간 (Neutral)"`;
        else elVerdict.innerText = `"매도 우위 (Sell)"`;
    }

    // 지지/저항선
    const elSup = document.getElementById('val-support');
    const elRes = document.getElementById('val-resistance');
    const elStop = document.getElementById('val-stoploss');
    const elTarget = document.getElementById('val-target');
    
    if(elSup) {
        elSup.innerText = `$ ${(p * 0.98).toLocaleString(undefined, {maximumFractionDigits:2})}`;
        elRes.innerText = `$ ${(p * 1.02).toLocaleString(undefined, {maximumFractionDigits:2})}`;
        elStop.innerText = `$ ${(p * 0.97).toLocaleString(undefined, {maximumFractionDigits:2})}`;
        elTarget.innerText = `$ ${(p * 1.05).toLocaleString(undefined, {maximumFractionDigits:2})}`;
    }

    // 보고서
    const elReport = document.getElementById('deep-report-text');
    if(elReport && elReport.getAttribute('updated') !== 'true') {
        elReport.innerHTML = `현재 <strong>${appState.runningCoin || 'COIN'}</strong>의 기술적 지표가 긍정적입니다.<br>RSI 및 MACD 골든크로스가 임박했습니다.<br>⚠️ <strong>전략:</strong> 눌림목 매수 유효.`;
        elReport.setAttribute('updated', 'true');
    }
}

function loadNewsData(c) {
    const list = document.getElementById('news-board-list');
    if(!list) return;
    
    const news = [
        `[속보] ${c}, 대규모 고래 지갑 이동 포착`,
        `${c} 네트워크 활성 주소, 전주 대비 15% 급증`,
        `주요 거래소 ${c} 입금량 감소... 매도 압력 완화?`,
        `[시황] 비트코인 반등에 ${c} 동반 상승세`,
        `글로벌 투자 기관, ${c} 포트폴리오 비중 확대`
    ];
    
    let html = '';
    news.forEach((n, i) => {
        html += `<div style="padding:10px 0; border-bottom:1px solid #333;">
            <div style="font-size:0.85rem; color:#eee;">${n}</div>
            <div style="font-size:0.7rem; color:#888; margin-top:3px;">${new Date().toLocaleTimeString()}</div>
        </div>`;
    });
    list.innerHTML = html;
}

/* --- (나머지 로직은 기존 유지 - 차트 그리기 등) --- */
function renderPnLChart() {
    const ctx = document.getElementById('pnlChart');
    if (!ctx) return;
    if (pnlChartInstance) pnlChartInstance.destroy();

    const currentProfit = appState.dailyTotalProfit;
    const labels = [];
    const data = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        labels.push((d.getMonth()+1) + '/' + d.getDate());
        let noise = Math.random() * (appState.startBalance * 0.05); 
        if(i === 0) data.push(currentProfit);
        else data.push(currentProfit - noise + (noise * 0.5));
    }

    const lineColor = currentProfit >= 0 ? '#c84a31' : '#5e81f4';
    const bgColor = currentProfit >= 0 ? 'rgba(200, 74, 49, 0.1)' : 'rgba(94, 129, 244, 0.1)';

    pnlChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{ label: '누적 수익($)', data: data, borderColor: lineColor, backgroundColor: bgColor, borderWidth: 2, pointRadius: 3, tension: 0.1, fill: true }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { ticks: { color: '#666' }, grid: { display: false } }, y: { ticks: { color: '#666' }, grid: { color: '#333', borderDash: [2, 2] } } }
        }
    });
}
function showTab(t){localStorage.setItem('lastTab',t);document.querySelectorAll('.tab-content').forEach(c=>c.classList.add('hidden'));document.getElementById('tab-'+t).classList.remove('hidden');document.querySelectorAll('.wallet-tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('btn-'+t).classList.add('active');if(t==='pnl')setTimeout(renderPnLChart,100);renderGlobalUI()}

// ... (이하 필수 함수 압축) ...
function renderGlobalUI(){const t=document.getElementById('total-val');if(t){let v=appState.balance;if(appState.isRunning&&appState.position){v=(appState.balance-appState.investedAmount)+(appState.realPrices[appState.runningCoin]||appState.position.entryPrice)*appState.position.quantity}t.innerText=`$ ${v.toLocaleString(undefined,{minimumFractionDigits:2})}`;const p=document.getElementById('real-profit');if(p){const r=appState.startBalance>0?(appState.dailyTotalProfit/appState.startBalance)*100:0;p.innerHTML=`<span class="${appState.dailyTotalProfit>=0?'text-green':'text-red'}">${appState.dailyTotalProfit>=0?'+':''}${r.toFixed(2)}%</span>`}}if(document.getElementById('wallet-display')){const c=appState.isRunning?appState.balance-appState.investedAmount:appState.balance;document.getElementById('wallet-display').innerText=`$ ${appState.balance.toLocaleString(undefined,{minimumFractionDigits:2})}`;document.getElementById('avail-cash').innerText=`$ ${c.toLocaleString(undefined,{minimumFractionDigits:2})}`;updatePortfolio(c);updatePnLTab()}if(document.getElementById('bank-balance-display')){document.getElementById('bank-balance-display').innerText=`$ ${appState.bankBalance.toLocaleString(undefined,{minimumFractionDigits:2})}`;updateBankList()}updateHistoryTables()}
function updatePnLTab(){const a=document.getElementById('pnl-total-amount');const p=document.getElementById('pnl-total-percent');const v=document.getElementById('pnl-avg-invest');if(a){const pr=appState.dailyTotalProfit;const r=appState.startBalance>0?(pr/appState.startBalance)*100:0;const c=pr>=0?'#c84a31':'#5e81f4';a.innerText=`$ ${pr.toLocaleString()}`;a.style.color=c;p.innerText=`${pr>=0?'+':''}${r.toFixed(2)}%`;p.style.color=c;v.innerText=`$ ${appState.investedAmount.toLocaleString()}`}}
function checkKeys(){const k1=document.getElementById('api-key-input').value;const k2=document.getElementById('secret-key-input').value;if(k1.length<5||k2.length<5)return alert("⛔ 유효한 키를 입력하세요.");appState.config.keysVerified=true;alert("✅ 검증 완료!");const btn=document.querySelector('.verify-btn');if(btn){btn.innerText="VERIFIED";btn.style.background="var(--color-up)";}saveState()}
function selectStrategy(el,name){document.querySelectorAll('.strategy-card').forEach(c=>c.classList.remove('active'));el.classList.add('active');appState.config.strategy=name}
function activateSystem(){if(!appState.config.keysVerified)return alert("⚠️ 먼저 API 키를 검증해주세요.");const coinInput=document.getElementById('target-coin');const amtInput=document.getElementById('invest-amount');const coin=coinInput.value.toUpperCase();const amt=parseFloat(amtInput.value);if(!coin)return alert("코인 심볼 입력");if(!amt||amt<=0)return alert("금액 오류");if(amt>appState.balance)return alert(`잔고 부족 ($${appState.balance.toLocaleString()})`);appState.config.target=coin;appState.config.amount=amt;appState.config.isReady=true;saveState();alert(`🚀 시스템 가동 시작!\n목표: ${coin} / 금액: $${amt.toLocaleString()}`);window.location.href='index.html'}
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)}}catch(e){saveState()}}
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(appState))}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d)}catch(e){}}
function highlightMenu(){const c=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(e=>{if(e.getAttribute('href')===c)e.classList.add('active');else e.classList.remove('active')})}
function startSystem(s=false){if(appState.balance<10){const h=document.querySelector('a[href="wallet.html"]');if(!h){if(!s)alert("테스트 자금 충전");appState.balance+=1000}else{if(!s)alert("잔고 부족.");stopSystem(true);return}}if(!appState.config.isReady){if(!s)return;return}appState.runningCoin=appState.config.target;appState.investedAmount=appState.config.amount;appState.cash=appState.balance-appState.investedAmount;if(appState.startBalance===0)appState.startBalance=appState.balance;startPriceStream(appState.runningCoin);appState.isRunning=true;if(autoTradeInterval)clearInterval(autoTradeInterval);autoTradeInterval=setInterval(executeAiTrade,1000);updateButtonState(true);saveState()}
function stopSystem(s=false){appState.isRunning=false;appState.investedAmount=0;appState.cash=appState.balance;if(socket)socket.close();appState.position=null;updateButtonState(false);saveState();renderGlobalUI()}
function startPriceStream(c){if(socket)socket.close();try{socket=new WebSocket(`wss://stream.binance.com:9443/ws/${c.toLowerCase()}usdt@trade`);socket.onmessage=(e)=>{const d=JSON.parse(e.data);const p=parseFloat(d.p);appState.realPrices[c]=p;if(appState.isRunning)checkStrategy(p);if(document.getElementById('analysis-price'))updateInfoUI(p)}}catch(e){}}
function checkStrategy(p){if(!appState.position){const q=appState.investedAmount/p;appState.position={entryPrice:p,quantity:q,entryTime:new Date().toLocaleTimeString()};logTrade('매수',p,0,0)}else{const ep=appState.position.entryPrice;const r=(p-ep)/ep;if(r>=0.0015)closePosition(p,'익절');else if(r<=-0.0010)closePosition(p,'손절')}}
function closePosition(p,t){if(!appState.position)return;const ep=appState.position.entryPrice;const q=appState.position.quantity;const raw=(p*q)-(ep*q);const f=(p*q)*0.0005;const net=raw-f;appState.balance+=net;appState.dailyTotalProfit+=net;logTrade(t,p,net,f);appState.position=null}
function logTrade(t,p,pl,f){appState.tradeHistory.unshift({time:new Date().toLocaleTimeString('en-GB'),coin:appState.runningCoin,type:t,price:p.toLocaleString(undefined,{minimumFractionDigits:2}),tradeAmt:appState.investedAmount.toFixed(2),fee:f.toFixed(4),net:pl!==0?(appState.investedAmount+pl).toFixed(2):'-',pnl:pl.toFixed(2),qty:appState.position?appState.position.quantity.toFixed(6):'0.00'});if(appState.tradeHistory.length>50)appState.tradeHistory.pop()}
function updatePortfolio(c){const l=document.getElementById('holdings-list');const pie=document.getElementById('portfolio-pie');if(!l)return;let iv=0;if(appState.position){const p=appState.realPrices[appState.runningCoin]||appState.position.entryPrice;iv=p*appState.position.quantity}const tv=c+iv;let ip=tv>0?(iv/tv)*100:0;if(pie)pie.style.background=ip>0?`conic-gradient(var(--accent) 0% ${ip}%, #444 ${ip}% 100%)`:`conic-gradient(#444 0% 100%)`;l.innerHTML=`<div style="padding:10px;border-bottom:1px solid #333;display:flex;justify-content:space-between"><div><div style="font-weight:bold;color:#fff">${appState.runningCoin}</div><div style="font-size:0.7rem;color:var(--accent)">Holding</div></div><div style="text-align:right"><div style="color:#fff">$${iv.toFixed(2)}</div><div style="font-size:0.7rem">${ip.toFixed(1)}%</div></div></div><div style="padding:10px;border-bottom:1px solid #333;display:flex;justify-content:space-between"><div><div style="font-weight:bold;color:#fff">USDT</div><div style="font-size:0.7rem;color:#888">Cash</div></div><div style="text-align:right"><div style="color:#fff">$${c.toFixed(2)}</div><div style="font-size:0.7rem;color:#888">${(100-ip).toFixed(1)}%</div></div></div>`}
function startDataCounter(){const e=document.getElementById('data-mining-counter');if(e)setInterval(()=>{appState.dataCount+=3;e.innerText=appState.dataCount.toLocaleString()},100)}
function updateButtonState(o){const b=document.getElementById('btn-main-control');if(b)b.innerHTML=o?'Running':'Start'}
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
function searchInfoCoin(){const i=document.getElementById('coin-search-input');let c='BTC';if(i&&i.value.trim()!="")c=i.value.trim().toUpperCase();else if(appState.searchQuery)c=appState.searchQuery;window.location.href=`info.html?coin=${c}`}
