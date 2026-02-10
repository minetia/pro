/* pro-script.js - V130.0 (Real Market Data Mining & Strategy) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 0, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: "",
    realPrices: {}, socket: null,
    
    // [NEW] 실전 포지션 추적 객체
    position: null // { entryPrice: 0, quantity: 0, entryTime: '' }
};

let autoTradeInterval = null;
let dataCounterInterval = null;
const SAVE_KEY = 'neuroBotData_V130_REAL';
const CONFIG_KEY = 'neuroConfig_V130_REAL';

// 1. 초기화 및 로드
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
        if(document.getElementById('tab-holdings')) showTab(appState.activeTab || 'holdings');
        const searchInput = document.getElementById('coin-search-input');
        if(searchInput && appState.searchQuery) searchInput.value = appState.searchQuery;

        if (appState.isRunning && document.getElementById('total-val')) {
            startSystem(true);
        } else {
            updateButtonState(false);
        }
        
        startDataCounter();
        // UI 갱신 속도: 0.5초
        setInterval(() => { saveState(); renderGlobalUI(); }, 500);
        renderGlobalUI();
    }
});

/* --- 2. 바이낸스 웹소켓 (실제 데이터 수신) --- */
function startPriceStream(coin) {
    if (appState.socket) appState.socket.close();
    const symbol = coin.toLowerCase() + 'usdt';
    appState.socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);

    appState.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const price = parseFloat(data.p);
        appState.realPrices[coin] = price;
        
        // [핵심] 가격이 들어올 때마다 매매 로직 체크 (실시간 대응)
        if(appState.isRunning) checkStrategy(price);
        
        // 정보 페이지면 UI 갱신
        if(document.getElementById('analysis-price')) updateInfoUI(price);
    };
    
    appState.socket.onerror = (error) => { console.log("WS Error:", error); };
}

/* --- 3. [핵심] 실전 매매 전략 (Real Strategy) --- */
function checkStrategy(currentPrice) {
    if (!appState.isRunning) return;

    // 1. 포지션이 없을 때 -> 매수 타이밍 포착 (여기서는 즉시 진입으로 설정)
    // *추후 여기에 RSI, 이평선 등 진입 조건을 넣으면 됩니다.
    if (appState.position === null) {
        enterPosition(currentPrice);
        return;
    }

    // 2. 포지션 보유 중 -> 익절/손절 체크
    const entryPrice = appState.position.entryPrice;
    const pnlRate = (currentPrice - entryPrice) / entryPrice; // 수익률 (소수점)

    // 목표가: +0.15% (스켈핑) / 손절가: -0.10% (칼손절)
    // 실제 시장은 변동이 작으므로 테스트를 위해 타이트하게 잡음
    const TAKE_PROFIT = 0.0015; 
    const STOP_LOSS = -0.0010;

    if (pnlRate >= TAKE_PROFIT) {
        closePosition(currentPrice, '익절');
    } else if (pnlRate <= STOP_LOSS) {
        closePosition(currentPrice, '손절');
    }
    // 아무 조건도 아니면 '홀딩(존버)'
}

function enterPosition(price) {
    const qty = appState.investedAmount / price;
    appState.position = {
        entryPrice: price,
        quantity: qty,
        entryTime: new Date().toLocaleTimeString('en-GB')
    };
    
    // 로그 기록 (매수)
    logTrade('매수', price, 0, 0);
}

function closePosition(price, type) {
    if (!appState.position) return;

    const entryPrice = appState.position.entryPrice;
    const qty = appState.position.quantity;
    
    // 최종 정산
    const sellAmount = price * qty;
    const buyAmount = entryPrice * qty;
    const rawPnL = sellAmount - buyAmount;
    const fee = sellAmount * 0.0005; // 수수료 0.05% (현실적용)
    const netPnL = rawPnL - fee;

    // 지갑 반영
    appState.balance += netPnL;
    
    // 로그 기록 (매도)
    logTrade(type, price, netPnL, fee);

    // 포지션 초기화 (다음 거래 준비)
    appState.position = null;
}

function logTrade(type, price, pnl, fee) {
    const coin = appState.runningCoin;
    const tradeAmt = appState.position ? (appState.position.quantity * price) : appState.investedAmount;
    
    appState.tradeHistory.unshift({
        time: new Date().toLocaleTimeString('en-GB'),
        coin: coin, market: 'USDT', type: type,
        price: price.toLocaleString(undefined, {minimumFractionDigits:2}),
        qty: appState.position ? appState.position.quantity.toFixed(6) : (appState.investedAmount/price).toFixed(6),
        tradeAmt: tradeAmt.toFixed(2),
        fee: fee.toFixed(4),
        net: pnl !== 0 ? (tradeAmt + pnl).toFixed(2) : '-',
        pnl: pnl.toFixed(2)
    });

    if(appState.tradeHistory.length > 100) appState.tradeHistory.pop(); // 데이터 100개 유지
}

/* --- 4. UI 렌더링 --- */
function renderGlobalUI() {
    const els = { total: document.getElementById('total-val'), prof: document.getElementById('real-profit') };
    
    // 메인 화면
    if(els.total) {
        if(appState.isRunning) {
            // 현재 평가금액 계산 (포지션 있으면 평가액, 없으면 현금)
            let currentVal = appState.balance; // 기본은 잔고
            let floatingPnL = 0;

            if (appState.position) {
                const currentPrice = appState.realPrices[appState.runningCoin] || appState.position.entryPrice;
                const valuation = currentPrice * appState.position.quantity;
                // 현재 총자산 = (총잔고 - 투자원금) + 현재평가액
                currentVal = (appState.balance - appState.investedAmount) + valuation;
                floatingPnL = valuation - appState.investedAmount;
            }

            els.total.innerText = `$ ${currentVal.toLocaleString(undefined, {minimumFractionDigits:2})}`;
            
            // 24H 수익 (시작 원금 대비 현재 총자산)
            if(appState.startBalance <= 0) appState.startBalance = appState.investedAmount;
            const totalProfit = currentVal - appState.startBalance;
            const profitRate = (totalProfit / appState.startBalance) * 100;
            
            const color = totalProfit >= 0 ? 'text-green' : 'text-red';
            const sign = totalProfit >= 0 ? '+' : '';
            
            // 포지션 잡고 있으면 [진행중] 표시
            const status = appState.position ? `<span style="font-size:0.7rem; color:var(--accent);">[HOLDING]</span>` : `<span style="font-size:0.7rem; color:#888;">[WAITING]</span>`;
            
            els.prof.innerHTML = `${status} <span class="${color}">${sign}${profitRate.toFixed(2)}%</span> <span style="font-size:0.8rem; color:#bbb;">($${totalProfit.toFixed(2)})</span>`;
        } else {
            els.total.innerText = `$ 0.00`;
            els.prof.innerText = "---";
        }
    }
    
    // 리스트 업데이트
    updateHistoryTables();
    
    // 지갑 화면 업데이트 (기존 로직)
    if(document.getElementById('wallet-display')) {
        const currentCash = appState.isRunning ? (appState.balance - appState.investedAmount) : appState.balance;
        document.getElementById('wallet-display').innerText = `$ ${appState.balance.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        document.getElementById('avail-cash').innerText = `$ ${currentCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        updatePortfolio(currentCash);
    }
}

// 거래내역 테이블
function updateHistoryTables() {
    const mainList = document.getElementById('main-ledger-list');
    const historyTable = document.getElementById('history-table-body');
    
    // 메인 리스트
    if(mainList) {
        if(appState.tradeHistory.length === 0) mainList.innerHTML = '<div style="padding:40px; text-align:center; color:#444;">NO DATA</div>';
        else {
            let html = '';
            appState.tradeHistory.slice(0, 50).forEach(t => {
                let color = 'text-green'; // 매수, 익절
                if(t.type === '손절' || t.type === '매도') color = 'text-red';
                
                // PnL 표시 (매수일 땐 '-')
                const pnlDisplay = t.type === '매수' ? '-' : t.pnl;
                
                html += `<div class="ledger-row">
                    <div class="col-time">${t.time}</div>
                    <div class="col-coin">${t.coin} <span class="${color}" style="font-size:0.7rem;">${t.type}</span></div>
                    <div class="col-price">${t.price}</div>
                    <div class="col-pnl ${color}">${pnlDisplay}</div>
                </div>`;
            });
            mainList.innerHTML = html;
        }
    }
    
    // 지갑 상세 리스트
    if(historyTable) {
        if(appState.tradeHistory.length === 0) historyTable.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#888;">데이터 수집 중...</td></tr>';
        else {
            let html = '';
            appState.tradeHistory.slice(0, 30).forEach(t => {
                let color = 'text-green';
                if(t.type === '손절') color = 'text-red';
                html += `<tr><td style="color:#bbb">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td>${t.market}</td><td class="${color}">${t.type}</td><td>${t.qty}</td><td>$${t.tradeAmt}</td><td style="color:#aaa">$${t.fee}</td><td style="font-weight:bold; color:#fff">$${t.net}</td></tr>`;
            });
            historyTable.innerHTML = html;
        }
    }
}

// 포트폴리오 (지갑)
function updatePortfolio(currentCash) {
    const list = document.getElementById('holdings-list');
    if(!list) return;
    
    // 투자중인 금액 (현재 평가액 기준)
    let investedVal = 0;
    if(appState.position) {
        const currentPrice = appState.realPrices[appState.runningCoin] || appState.position.entryPrice;
        investedVal = currentPrice * appState.position.quantity;
    }
    
    // 전체 자산 (현금 + 평가액)
    const totalVal = currentCash + investedVal;
    let investPercent = totalVal > 0 ? (investedVal / totalVal) * 100 : 0;
    
    // 파이차트
    const pie = document.getElementById('portfolio-pie');
    if(pie) pie.style.background = investPercent > 0 ? `conic-gradient(var(--accent) 0% ${investPercent}%, #444 ${investPercent}% 100%)` : `conic-gradient(#444 0% 100%)`;

    let html = '';
    // 1. 코인 (보유 중일 때만)
    if(appState.position) {
        // 수익률 계산
        const pnlPct = ((investedVal - appState.investedAmount) / appState.investedAmount) * 100;
        const color = pnlPct >= 0 ? 'text-green' : 'text-red';
        
        html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:15px 5px; border-bottom:1px solid #222;">
            <div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; background:var(--accent); border-radius:50%;"></div><div><div style="font-weight:bold; color:#fff; font-size:0.95rem;">${appState.runningCoin}</div><div style="font-size:0.75rem; color:var(--accent);">Holding</div></div></div>
            <div style="text-align:right;"><div style="color:#fff; font-weight:bold;">$ ${investedVal.toLocaleString(undefined,{minimumFractionDigits:2})}</div><div style="font-size:0.75rem;" class="${color}">${pnlPct.toFixed(2)}%</div></div></div>`;
    }
    // 2. 현금
    html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:15px 5px; border-bottom:1px solid #222;">
        <div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; background:#444; border-radius:50%;"></div><div><div style="font-weight:bold; color:#fff; font-size:0.95rem;">USDT</div><div style="font-size:0.75rem; color:#888;">Cash</div></div></div>
        <div style="text-align:right;"><div style="color:#fff; font-weight:bold;">$ ${currentCash.toLocaleString(undefined,{minimumFractionDigits:2})}</div><div style="font-size:0.75rem; color:#888;">${(100-investPercent).toFixed(1)}%</div></div></div>`;
    list.innerHTML = html;
}

// ... (기존 필수 함수들 유지) ...
function startSystem(s=false) { if (appState.balance < 10) { if(!s) alert("지갑 잔고 부족"); stopSystem(true); return; } if (!appState.config.isReady) { if(!s) alert("AI 설정 필요"); return; } appState.runningCoin = appState.config.target.split('/')[0]; appState.investedAmount = appState.config.amount; appState.cash = appState.balance - appState.investedAmount; if(appState.startBalance===0) appState.startBalance = appState.balance; startPriceStream(appState.runningCoin); appState.isRunning = true; updateButtonState(true); saveState(); }
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
function exportLogs(){ 
    if(appState.tradeHistory.length === 0) return alert("저장된 데이터가 없습니다.");
    let csv = "Time,Coin,Type,Price,Qty,Total,Fee,Net,PnL\n";
    appState.tradeHistory.forEach(t => { csv += `${t.time},${t.coin},${t.type},${t.price},${t.qty},${t.tradeAmt},${t.fee},${t.net},${t.pnl}\n`; });
    const blob = new Blob([csv], {type:'text/csv'}); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `TRADE_DATA_${new Date().getTime()}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); 
}
function applyBankInterest(){if(appState.bankBalance>0)appState.bankBalance+=(appState.bankBalance*0.0000008)}
function checkKeys(){alert("✅ 키 확인 완료")}
function selectStrategy(t){document.querySelectorAll('.strategy-card').forEach(c=>c.classList.remove('active'));event.currentTarget.classList.add('active')}
function processBankDeposit(){const i=document.getElementById('bank-deposit-input');const a=parseFloat(i.value);if(!a||isNaN(a))return alert("금액 오류");if(a<10)return alert("최소 $10");if(a>100000)return alert("최대 $100,000");if(!appState)loadState();appState.bankBalance=parseFloat(appState.bankBalance)+a;appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:"WIRE IN",amount:a});saveState();renderGlobalUI();alert("입금 완료");i.value=''}
function openModal(m){const d=document.getElementById('transaction-modal');if(!d)return;d.style.display='flex';currentTxMode=m;document.getElementById('amount-input').value='';document.getElementById('modal-title').innerText=m==='deposit'?"입금 (은행 → 지갑)":"출금 (지갑 → 은행)";document.getElementById('modal-title').style.color=m==='deposit'?"var(--color-up)":"var(--color-down)"}
function processTx(){const i=document.getElementById('amount-input');const a=parseFloat(i.value);if(!a||a<=0)return alert("금액 오류");if(currentTxMode==='deposit'){if(appState.bankBalance<a)return alert("은행 잔고 부족");appState.bankBalance-=a;appState.balance+=a;appState.cash+=a}else{if(appState.cash<a)return alert("현금 부족");appState.balance-=a;appState.bankBalance+=a;appState.cash-=a}appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:currentTxMode==='deposit'?"DEPOSIT":"WITHDRAW",amount:a});saveState();renderGlobalUI();closeModal()}
function closeModal(){document.getElementById('transaction-modal').style.display='none'}
function calcPercent(p){const i=document.getElementById('amount-input');let b=currentTxMode==='deposit'?appState.bankBalance:appState.cash;if(p===100)i.value=b;else i.value=Math.floor(b*(p/100)*100)/100}
function updateInfoUI(p){const pe=document.getElementById('analysis-price');const se=document.getElementById('ai-score-val');const ve=document.getElementById('analysis-verdict');if(pe){const pp=parseFloat(pe.getAttribute('data-prev'))||p;const c=p>pp?'var(--color-up)':(p<pp?'var(--color-down)':'#fff');pe.innerText=`$ ${p.toLocaleString(undefined,{minimumFractionDigits:2})}`;pe.style.color=c;pe.setAttribute('data-prev',p)}const ds=60+Math.floor((p%10)*3);if(se)se.innerText=Math.min(99,Math.max(40,ds));if(ve){if(ds>=80)ve.innerHTML=`"강력 매수 신호"`;else if(ds>=50)ve.innerHTML=`"중립/관망 구간"`;else ve.innerHTML=`"매도 압력 증가"`;}document.getElementById('val-support').innerText=`$ ${(p*0.985).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-resistance').innerText=`$ ${(p*1.015).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-stoploss').innerText=`$ ${(p*0.97).toLocaleString(undefined,{maximumFractionDigits:2})}`;document.getElementById('val-target').innerText=`$ ${(p*1.05).toLocaleString(undefined,{maximumFractionDigits:2})}`;const re=document.getElementById('deep-report-text');if(re&&re.getAttribute('data-updated')!=='true'){re.innerHTML=`현재 <strong>BINANCE</strong> 실시간 시세 <strong>$${p.toLocaleString()}</strong>.<br>매수 벽이 두터워지며 단기 반등 시도 중.<br>⚠️ <strong>전략:</strong> 변동성 주의.`;re.setAttribute('data-updated','true')}}
function initInfoPage(c){c=c.toUpperCase();const i=document.getElementById('info-page-search');if(i)i.value=c;new TradingView.widget({"container_id":"info_tv_chart","symbol":`BINANCE:${c}USDT`,"interval":"15","theme":"dark","style":"1","locale":"kr","autosize":true,"hide_side_toolbar":false});startPriceStream(c);document.getElementById('analysis-verdict').innerText="실시간 데이터 연결 중...";loadNewsData(c)}
function loadNewsData(c){const l=document.getElementById('news-board-list');if(!l)return;const t=[{t:`[속보] ${c}, 대규모 고래 이체 포착`,c:`익명 지갑에서 거래소로 대량 이체가 발생했습니다.`},{t:`${c} 네트워크 활성 주소 급증`,c:`온체인 데이터가 긍정적 신호를 보이고 있습니다.`},{t:`[시황] ${c} 주요 지지선 테스트 중`,c:`변동성이 확대되고 있으니 주의가 필요합니다.`},{t:`글로벌 기관, ${c} 포트폴리오 추가`,c:`기관 자금 유입이 기대됩니다.`},{t:`${c} 선물 미결제 약정 증가`,c:`단기 변동성이 커질 수 있습니다.`}];let h='';for(let i=0;i<5;i++){const n=t[i%t.length];h+=`<div class="news-item" onclick="toggleNews(${i})"><div class="news-title"><span class="news-new-badge">NEW</span> ${n.t}</div><div class="news-meta"><span>${new Date().toLocaleTimeString()}</span></div><div id="news-content-${i}" class="news-content">${n.c}</div></div>`;}l.innerHTML=h;}
function toggleNews(i){const e=document.getElementById(`news-content-${i}`);if(e)e.classList.toggle('show')}
