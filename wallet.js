/* wallet.js - V300.0 (Bank & Wallet) */
window.addEventListener('load', () => {
    updateWalletUI();
    
    // 탭 기능 (지갑 페이지용)
    if(document.getElementById('tab-holdings')) {
        showTab('holdings'); // 기본 탭
    }
});

function updateWalletUI() {
    // 1. 은행 잔고
    const elBank = document.getElementById('bank-balance-display');
    if (elBank) elBank.innerText = `$ ${formatMoney(appState.bankBalance)}`;
    
    // 2. 지갑 잔고
    const elWallet = document.getElementById('wallet-display');
    if (elWallet) elWallet.innerText = `$ ${formatMoney(appState.balance)}`;
    
    // 3. 주문가능 현금
    const elCash = document.getElementById('avail-cash');
    if (elCash) {
        const cash = appState.isRunning ? (appState.balance - appState.investedAmount) : appState.balance;
        elCash.innerText = `$ ${formatMoney(cash)}`;
    }
    
    // 4. 내역 리스트 (은행)
    const bankList = document.getElementById('bank-history-list');
    if (bankList) {
        let h = '';
        appState.transfers.forEach(t => {
            h += `<div class="ledger-row" style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #222;"><div>${t.date}</div><div>${t.type}</div><div>$${t.amount}</div></div>`;
        });
        bankList.innerHTML = h;
    }
}

/* --- 은행 기능 --- */
function processBankDeposit() {
    const input = document.getElementById('bank-deposit-input');
    const amt = parseFloat(input.value);
    if (!amt || amt <= 0) return alert("금액 오류");
    
    appState.bankBalance += amt;
    appState.transfers.unshift({ date: new Date().toLocaleDateString(), type: 'WIRE IN', amount: amt });
    saveState();
    updateWalletUI();
    alert("입금 완료");
    input.value = '';
}

/* --- 지갑 이체 기능 --- */
let currentMode = '';
function openModal(mode) {
    currentMode = mode;
    document.getElementById('transaction-modal').style.display = 'flex';
}
function closeModal() {
    document.getElementById('transaction-modal').style.display = 'none';
}
function processTx() {
    const amt = parseFloat(document.getElementById('amount-input').value);
    if (!amt) return;
    
    if (currentMode === 'deposit') { // 은행 -> 지갑
        if (appState.bankBalance < amt) return alert("은행 잔고 부족");
        appState.bankBalance -= amt;
        appState.balance += amt;
    } else { // 지갑 -> 은행
        if (appState.balance < amt) return alert("지갑 잔고 부족");
        appState.balance -= amt;
        appState.bankBalance += amt;
    }
    
    appState.transfers.unshift({ date: new Date().toLocaleDateString(), type: currentMode.toUpperCase(), amount: amt });
    saveState();
    updateWalletUI();
    closeModal();
}

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-'+t).classList.remove('hidden');
}
