<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>AI CORE</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link rel="stylesheet" href="pro-style.css?v=230">
</head>
<body>
    <header class="cyber-header">
        <div class="brand-logo">NEURAL <span>CORE</span></div>
    </header>

    <div class="main-content">
        <div class="cyber-panel">
            <div style="color:var(--accent); font-weight:bold; margin-bottom:15px;">
                <i class="fas fa-key"></i> API AUTHENTICATION
            </div>
            
            <div style="font-size:0.7rem; color:#888; margin-bottom:5px;">API KEY</div>
            <input type="text" id="api-key-input" class="modal-input" placeholder="Enter API Key">
            
            <div style="font-size:0.7rem; color:#888; margin-bottom:5px;">SECRET KEY</div>
            <input type="password" id="secret-key-input" class="modal-input" placeholder="Enter Secret Key">
            
            <button class="cyber-btn verify-btn" onclick="checkKeys()" style="background:#2b3139; margin-top:10px;">
                VERIFY KEYS
            </button>
        </div>

        <div class="cyber-panel">
            <div style="color:#fff; font-weight:bold; margin-bottom:15px;">
                <i class="fas fa-sliders-h"></i> TRADING CONFIG
            </div>

            <div style="display:flex; gap:10px;">
                <div style="flex:1;">
                    <div style="font-size:0.7rem; color:#888; margin-bottom:5px;">TARGET COIN</div>
                    <input type="text" id="target-coin" class="modal-input" placeholder="BTC" value="XRP">
                </div>
                <div style="flex:1;">
                    <div style="font-size:0.7rem; color:#888; margin-bottom:5px;">AMOUNT ($)</div>
                    <input type="number" id="invest-amount" class="modal-input" placeholder="1000" value="1000">
                </div>
            </div>
        </div>

        <div class="cyber-panel">
            <div style="color:#fff; font-weight:bold; margin-bottom:15px;">
                <i class="fas fa-chess-board"></i> STRATEGY SELECT
            </div>
            <div class="strategy-container">
                <div class="strategy-card active" onclick="selectStrategy(this, 'SCALPING')">
                    <div class="st-icon"><i class="fas fa-bolt"></i></div>
                    <div style="font-size:0.8rem;">SCALPING</div>
                </div>
                <div class="strategy-card" onclick="selectStrategy(this, 'SWING')">
                    <div class="st-icon"><i class="fas fa-chart-line"></i></div>
                    <div style="font-size:0.8rem;">SWING</div>
                </div>
            </div>
        </div>

        <button class="cyber-btn btn-start" onclick="activateSystem()" style="margin-top:20px; height:50px; font-size:1.1rem;">
            ACTIVATE SYSTEM
        </button>
    </div>

    <nav class="bottom-nav">
        <a href="index.html" class="nav-item"><i class="fas fa-chart-pie"></i><span>거래소</span></a>
        <a href="wallet.html" class="nav-item"><i class="fas fa-wallet"></i><span>투자내역</span></a>
        <a href="ai-core.html" class="nav-item active"><i class="fas fa-brain"></i><span>AI설정</span></a>
        <a href="transfers.html" class="nav-item"><i class="fas fa-university"></i><span>입출금</span></a>
    </nav>

    <script src="pro-script.js?v=230"></script>
</body>
</html>
