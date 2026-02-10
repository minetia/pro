/* wallet.js - V320.0 (Tab Switch Fix) */
let pnlChartInstance = null;

window.addEventListener('load', () => {
    updateWalletUI();
    if(document.getElementById('tab-holdings')) {
        const lastTab = localStorage.getItem('lastTab') || 'holdings';
        showTab(lastTab);
    }
});

/* --- [핵심] 탭 전환 기능 (CSS 의존성 제거) --- */
function showTab(t) {
    localStorage.setItem('lastTab', t);
    
    // 1. 버튼 스타일 변경
    document.querySelectorAll('.wallet-tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btn-'+t);
    if(btn) btn.classList.add('active');

    // 2. [강력 수정] 탭 내용 표시/숨김 (직접 스타일 제어)
    document.querySelectorAll('.tab-content').forEach(c => {
        c.style.display = 'none'; // 일단 다 숨김
    });
    
    const targetDiv = document.getElementById('tab-'+t);
    if(targetDiv) {
        targetDiv.style.display = 'block'; // 선택된 것만 보임
    }

    // 3. 투자손익 탭이면 차트 그리기
    if(t === 'pnl') setTimeout(renderPnLChart, 100);
}

/* --- UI 업데이트 --- */
function updateWalletUI() {
    const elBank = document.getElementById('bank-balance-display');
    if (elBank) elBank.innerText = `$ ${formatMoney(appState.bankBalance)}`;
    
    const elWallet = document.getElementById('wallet-display');
    if (elWallet) elWallet.innerText = `$ ${formatMoney(appState.balance)}`;
    
    const elCash = document.getElementById('avail-cash');
    if (elCash) {
        const cash = appState.isRunning ? (appState.balance - appState.investedAmount) : appState.balance;
        elCash.innerText = `$ ${formatMoney(cash)}`;
        updatePortfolio(cash);
        updatePnLTab();
        updateHistoryTables();
    }
    
    const bankList = document.getElementById('bank-history-list');
    if (bankList) {
        let h = '';
        if(appState.transfers.length === 0) h = '<div style="text-align:center; padding:20px; color:#666;">내역 없음</div>';
        else {
            appState.transfers.forEach(t => {
                h += `<div class="ledger-row" style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #222;"><div>${t.date}</div><div>${t.type}</div><div>$${t.amount.toLocaleString()}</div></div>`;
            });
        }
        bankList.innerHTML = h;
    }
}

function updatePortfolio(cash) {
    const list = document.getElementById('holdings-list');
    const pie = document.getElementById('portfolio-pie');
    if(!list) return;

    let investVal = 0;
    if(appState.isRunning && appState.investedAmount > 0) investVal = appState.investedAmount;

    const total = cash + investVal;
    let investPct = total > 0 ? (investVal / total) * 100 : 0;

    if(pie) {
        pie.style.background = investPct > 0 
            ? `conic-gradient(var(--accent) 0% ${investPct}%, #333 ${investPct}% 100%)` 
            : `conic-gradient(#333 0% 100%)`;
    }

    let html = `<div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between;"><div><div style="font-weight:bold; color:#fff;">USDT</div><div style="font-size:0.7rem; color:#888;">Cash</div></div><div style="text-align:right;"><div>$${formatMoney(cash)}</div><div style="font-size:0.7rem;">${(100-investPct).toFixed(1)}%</div></div></div>`;
    
    if(investVal > 0) {
        html += `<div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between;"><div><div style="font-weight:bold; color:#fff;">${appState.runningCoin || 'COIN'}</div><div style="font-size:0.7rem; color:var(--accent);">Holding</div></div><div style="text-align:right;"><div>$${formatMoney(investVal)}</div><div style="font-size:0.7rem;">${investPct.toFixed(1)}%</div></div></div>`;
    }
    list.innerHTML = html;
}

function updatePnLTab() {
    const amtEl = document.getElementById('pnl-total-amount');
    const pctEl = document.getElementById('pnl-total-percent');
    if(amtEl) {
        const profit = appState.balance - appState.startBalance;
        const profitRate = appState.startBalance > 0 ? (profit / appState.startBalance) * 100 : 0;
        const color = profit >= 0 ? '#c84a31' : '#5e81f4';
        amtEl.innerText = `$ ${profit.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        amtEl.style.color = color;
        pctEl.innerText = `${profit>=0?'+':''}${profitRate.toFixed(2)}%`;
        pctEl.style.color = color;
    }
}

function renderPnLChart() {
    const ctx = document.getElementById('pnlChart');
    if (!ctx) return;
    if (pnlChartInstance) pnlChartInstance.destroy();

    const profit = appState.balance - appState.startBalance;
    const data = [0, 0, 0, 0, 0, 0, profit];
    const color = profit >= 0 ? '#c84a31' : '#5e81f4';

    pnlChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['7d', '6d', '5d', '4d', '3d', '2d', 'Now'],
            datasets: [{ label: '누적 손익', data: data, borderColor: color, backgroundColor: 'rgba(0,0,0,0)', borderWidth: 2, tension: 0.1 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { color: '#333' } } } }
    });
}

function updateHistoryTables() {
    const tbody = document.getElementById('history-table-body');
    if(tbody) {
        let html = '';
        if(appState.tradeHistory.length === 0) {
            html = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#666;">내역 없음</td></tr>';
        } else {
            appState.tradeHistory.slice(0, 20).forEach(t => {
                const c = t.pnl >= 0 ? 'text-green' : 'text-red';
                if(t.pnl) {
                    html += `<tr><td style="color:#bbb; font-size:0.7rem;">${t.time}</td><td style="font-weight:bold">${t.coin}</td><td class="${c}">${t.type}</td><td>$${appState.investedAmount.toLocaleString()}</td><td style="font-weight:bold; color:#fff">$${t.pnl}</td></tr>`;
                }
            });
        }
        tbody.innerHTML = html;
    }
}

/* --- 공통 기능 --- */
let currentMode = '';
function openModal(mode) {
    currentMode = mode;
    document.getElementById('transaction-modal').style.display = 'flex';
    document.getElementById('amount-input').value = '';
}
function closeModal() {
    document.getElementById('transaction-modal').style.display = 'none';
}
function processTx() {
    const amt = parseFloat(document.getElementById('amount-input').value);
    if (!amt || amt <= 0) return alert("금액을 확인해주세요.");
    
    if (currentMode === 'deposit') {
        if (appState.bankBalance < amt) return alert("은행 잔고 부족");
        appState.bankBalance -= amt;
        appState.balance += amt;
    } else {
        if (appState.balance < amt) return alert("지갑 잔고 부족");
        appState.balance -= amt;
        appState.bankBalance += amt;
    }
    appState.transfers.unshift({ date: new Date().toLocaleDateString(), type: currentMode.toUpperCase(), amount: amt });
    saveState();
    updateWalletUI();
    closeModal();
    alert("처리되었습니다.");
}

function formatMoney(num) { return num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}); }

setInterval(function() {
    var tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    var h = "";
    // 장부(tradeHistory)에서 데이터 가져오기
    appState.tradeHistory.forEach(function(t) {
        var c = Number(t.pnl) >= 0 ? "text-green" : "text-red";
        h += '<tr><td>' + t.time + '</td><td>' + t.coin + '</td>' +
             '<td class="' + c + '">' + t.type + '</td><td>' + t.pnl + '</td></tr>';
    });
    tbody.innerHTML = h || '<tr><td colspan="4">내역 없음</td></tr>';
}, 1000);
