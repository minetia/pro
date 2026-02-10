/* pro-script.js - V50.0 (Info Center Integration) */
let appState = {
    balance: 0.00, cash: 0.00, bankBalance: 0.00, startBalance: 0.00, 
    tradeHistory: [], openOrders: [], transfers: [], dataCount: 42105, 
    config: {}, isRunning: false, runningCoin: null, investedAmount: 0,
    activeTab: 'holdings', searchQuery: "", currentNewsPage: 1
};
// ... (기존 변수 및 초기화 로직 유지) ...
const SAVE_KEY = 'neuroBotData_V43_FINAL';
const CONFIG_KEY = 'neuroConfig_V43_FINAL';

window.addEventListener('load', () => {
    loadState();
    loadConfig(); 
    highlightMenu();
    
    // [NEW] info.html 페이지 전용 로직
    if (window.location.pathname.includes('info.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const coin = urlParams.get('coin') || (appState.config.target ? appState.config.target.split('/')[0] : 'BTC');
        initInfoPage(coin);
    } 
    // 기존 로직
    else {
        if(document.getElementById('tab-holdings')) {
            const lastTab = appState.activeTab || 'holdings';
            showTab(lastTab);
        }
        if (appState.isRunning && document.getElementById('total-val')) { // 메인일때만
            if (appState.balance > 0 && appState.config && appState.config.isReady) startSystem(true);
            else stopSystem(true);
        } else {
            updateButtonState(false);
        }
        if(document.getElementById('total-val')) { // 메인 및 지갑에서만 갱신
            startDataCounter();
            setInterval(() => { applyBankInterest(); saveState(); renderGlobalUI(); }, 500);
            renderGlobalUI();
        }
    }
});

/* --- [NEW] 정보 페이지 로직 --- */
function initInfoPage(coin) {
    // 1. 트레이딩뷰 차트 로드
    new TradingView.widget({
        "container_id": "info_tv_chart",
        "symbol": `BINANCE:${coin}USDT`,
        "interval": "15",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "autosize": true
    });

    // 2. AI 분석 데이터 생성
    const price = getRealisticPrice(coin);
    const score = Math.floor(Math.random() * (95 - 60) + 60); // 60~95 랜덤 점수
    const isBull = score > 75;
    
    document.getElementById('ai-score-val').innerText = score;
    document.getElementById('analysis-price').innerText = `$ ${price.toLocaleString()}`;
    
    const verdict = document.getElementById('analysis-verdict');
    if (score >= 85) { verdict.innerHTML = `현재 구간은 <span class="text-green" style="font-weight:bold;">강력 매수</span>가 유효합니다.`; }
    else if (score >= 60) { verdict.innerHTML = `현재 구간은 <span style="color:#aaa; font-weight:bold;">중립/관망</span> 구간입니다.`; }
    else { verdict.innerHTML = `현재 구간은 <span class="text-red" style="font-weight:bold;">매도 우위</span>입니다.`; }

    // 지지/저항 라인 시뮬레이션
    document.getElementById('val-support').innerText = `$ ${(price * 0.95).toFixed(2)}`;
    document.getElementById('val-resistance').innerText = `$ ${(price * 1.05).toFixed(2)}`;
    document.getElementById('val-stoploss').innerText = `$ ${(price * 0.92).toFixed(2)}`;
    document.getElementById('val-target').innerText = `$ ${(price * 1.15).toFixed(2)}`;

    // 3. 심층 보고서 텍스트 생성
    const reportText = `
        현재 <strong>${coin}</strong>의 시세 변동성이 확대되고 있습니다. 
        AI 알고리즘 분석 결과, 4시간 봉 기준 <strong>MACD 골든 크로스</strong>가 임박했으며, 
        RSI 지표는 과매도 구간을 탈출하여 상승 다이버전스를 형성 중입니다.<br><br>
        
        특히 온체인 데이터 상에서 <strong>고래 지갑(Whale Wallet)</strong>의 매집 흔적이 포착되었습니다. 
        최근 24시간 내 거래소 유출량이 급증한 것은 스마트 머니의 매집 신호로 해석됩니다. 
        <span style="color:var(--accent);">${price.toLocaleString()}</span> 구간을 강하게 돌파할 경우, 
        숏 스퀴즈(Short Squeeze)를 동반한 급격한 시세 분출이 예상됩니다.<br><br>
        
        ⚠️ <strong>주의:</strong> 비트코인 도미넌스의 변화에 따라 급격한 변동성이 발생할 수 있으니, 
        제시된 손절가(${(price * 0.92).toFixed(2)})를 준수하며 분할 매수로 접근하는 것을 권장합니다.
    `;
    document.getElementById('deep-report-text').innerHTML = reportText;

    // 4. 뉴스 로드
    loadNewsData(coin);
}

// 뉴스 데이터 생성 및 렌더링
let newsData = [];
function loadNewsData(coin) {
    const titles = [
        `[속보] ${coin} 대규모 이체 감지, 5,000만 달러 규모 익명 지갑으로 이동`,
        `${coin} 네트워크 활성 주소 수, 지난달 대비 150% 급증... 투심 회복되나`,
        `美 SEC, 암호화폐 규제 관련 긴급 성명 발표... ${coin} 시장 영향은?`,
        `유명 애널리스트 " ${coin}, 이번 주말이 최대 분수령 될 것"`,
        `[단독] 글로벌 대형 펀드, ${coin} 포트폴리오 비중 확대 검토`,
        `${coin} 선물 미결제 약정 사상 최고치 경신, 변동성 주의보`,
        `주요 거래소 ${coin} 입출금 일시 중단 예정 (네트워크 업그레이드)`,
        `[기술분석] ${coin} 볼린저 밴드 상단 돌파 시도, 상승 모멘텀 강화`,
        `기관 투자자들, 저가 매수세 유입... ${coin} 바닥 다지기 돌입`,
        `알고리즘 트레이딩 봇, ${coin} 매수 시그널 포착`
    ];

    newsData = [];
    for(let i=0; i<20; i++) {
        const title = titles[i % titles.length];
        newsData.push({
            id: i,
            title: title,
            time: new Date(Date.now() - i * 3600000).toLocaleTimeString(),
            isNew: i < 3,
            content: `이 뉴스는 <strong>${coin}</strong> 시장에 중요한 영향을 미칠 수 있습니다.<br>
                      현재 시장 참여자들은 해당 이슈에 민감하게 반응하고 있으며, 거래량이 동반된 시세 변화를 주시해야 합니다.<br>
                      전문가들은 이 뉴스가 단기적인 호재/악재로 작용할 수 있다고 분석합니다.`
        });
    }
    renderNewsBoard(1);
}

function renderNewsBoard(page) {
    appState.currentNewsPage = page;
    const listEl = document.getElementById('news-board-list');
    const start = (page - 1) * 5;
    const end = start + 5;
    const items = newsData.slice(start, end);

    let html = '';
    items.forEach(item => {
        const badge = item.isNew ? '<span class="news-new-badge">NEW</span>' : '';
        html += `
            <div class="news-item" onclick="toggleNews(${item.id})">
                <div class="news-title">${badge} ${item.title}</div>
                <div class="news-meta">
                    <span><i class="far fa-clock"></i> ${item.time}</span>
                    <span><i class="far fa-eye"></i> ${Math.floor(Math.random()*1000)+500}</span>
                </div>
                <div id="news-content-${item.id}" class="news-content">
                    ${item.content}
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;

    // 페이지네이션 렌더링
    const pageEl = document.getElementById('news-pagination');
    let pageHtml = '';
    for(let i=1; i<=4; i++) {
        const active = i === page ? 'active' : '';
        pageHtml += `<div class="page-btn ${active}" onclick="renderNewsBoard(${i})">${i}</div>`;
    }
    pageEl.innerHTML = pageHtml;
}

function toggleNews(id) {
    const el = document.getElementById(`news-content-${id}`);
    if(el.classList.contains('show')) el.classList.remove('show');
    else {
        // 다른 거 다 닫기 (선택사항)
        document.querySelectorAll('.news-content').forEach(c => c.classList.remove('show'));
        el.classList.add('show');
    }
}

/* --- [중요] 메인화면 차트 버튼 연결 --- */
function openInfoPage() {
    // 검색창에 입력된 코인, 없으면 설정된 코인, 그것도 없으면 BTC
    let coin = 'BTC';
    const searchInput = document.getElementById('coin-search-input');
    
    if (searchInput && searchInput.value.trim() !== "") {
        coin = searchInput.value.trim().toUpperCase();
    } else if (appState.runningCoin) {
        coin = appState.runningCoin;
    }
    
    // 페이지 이동 (쿼리 파라미터 전달)
    window.location.href = `info.html?coin=${coin}`;
}

// ... (기존 시스템 함수들: startSystem, stopSystem, executeAiTrade, renderGlobalUI 등 유지) ...
// (기존 코드의 openChartModal 함수는 이제 쓰지 않거나, 유지해도 됩니다. 여기서는 openInfoPage로 대체합니다.)
function startSystem(isSilent=false){/*기존코드*/}
function stopSystem(isSilent=false){/*기존코드*/}
function executeAiTrade(){/*기존코드*/}
function renderGlobalUI(){/*기존코드*/}
function updateButtonState(isOn){/*기존코드*/}
function getRealisticPrice(symbol){/*기존코드*/}
function generateFakeOpenOrders(coin){/*기존코드*/}
function openModal(mode){/*기존코드*/}
function processTx(amt){/*기존코드*/}
function calcPercent(pct){/*기존코드*/}
function closeModal(){/*기존코드*/}
function saveState(){localStorage.setItem(SAVE_KEY, JSON.stringify(appState));}
function loadState(){try{const d=localStorage.getItem(SAVE_KEY);if(d)appState={...appState,...JSON.parse(d)};}catch(e){}}
function loadConfig(){try{const d=localStorage.getItem(CONFIG_KEY);if(d)appState.config=JSON.parse(d);}catch(e){}}
function startDataCounter(){/*기존코드*/}
function applyBankInterest(){if(appState.bankBalance>0)appState.bankBalance+=(appState.bankBalance*0.0000008);}
function highlightMenu(){const cur=window.location.pathname.split("/").pop()||'index.html';document.querySelectorAll('.nav-item').forEach(el=>{if(el.getAttribute('href')===cur)el.classList.add('active');else el.classList.remove('active');});}
function handleEnter(e){if(e.key==='Enter'){const input=document.getElementById('coin-search-input');appState.searchQuery=input.value.trim().toUpperCase();renderGlobalUI();input.blur();}}
function showTab(tabName){appState.activeTab=tabName;saveState();document.querySelectorAll('.wallet-tab-btn').forEach(btn=>btn.classList.remove('active'));document.getElementById(`btn-${tabName}`).classList.add('active');document.querySelectorAll('.tab-content').forEach(content=>content.classList.add('hidden'));document.getElementById(`tab-${tabName}`).classList.remove('hidden');renderGlobalUI();}
function simulateExternalDeposit(){const amt=1000;if(!appState)loadState();appState.bankBalance+=amt;appState.transfers.unshift({date:new Date().toISOString().slice(0,10),type:"WIRE IN",amount:amt});saveState();renderGlobalUI();alert(`✅ $${amt.toLocaleString()} 입금 확인되었습니다.`);}
