@import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap');

/* [기본 테마] */
:root {
    --bg-main: linear-gradient(to bottom, #141824, #0f1118); 
    --bg-card: linear-gradient(145deg, #222836, #1a1e29);
    --border-highlight: 1px solid rgba(255, 255, 255, 0.08);
    --border-soft: #2b3139;
    --text-primary: #f5f6f7;  
    --text-secondary: #9ba3b2;
    --color-up: #2ebd85;
    --color-down: #f6465d;
    --accent: #fcd535;
}

* { box-sizing: border-box; margin: 0; padding: 0; outline: none; -webkit-tap-highlight-color: transparent; }

body { 
    background: var(--bg-main); color: var(--text-primary); 
    font-family: 'Pretendard', sans-serif;
    padding-top: 110px; padding-bottom: 40px; overflow-x: hidden; line-height: 1.5; min-height: 100vh;
}
.num-font { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
.text-green { color: var(--color-up) !important; }
.text-red { color: var(--color-down) !important; }

/* 헤더 & 네비 */
.cyber-header {
    position: fixed; top: 0; left: 0; width: 100%; height: 55px;
    background: rgba(26, 30, 41, 0.95); backdrop-filter: blur(10px); border-bottom: var(--border-highlight);
    z-index: 4000; display: flex; justify-content: space-between; align-items: center; padding: 0 20px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}
.brand-logo { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px; }
.brand-logo span { color: var(--accent); text-shadow: 0 0 10px rgba(252, 213, 53, 0.3); }

.cyber-nav {
    position: fixed; top: 55px; left: 0; width: 100%; height: 50px;
    background: rgba(20, 24, 36, 0.98); border-bottom: 1px solid var(--border-soft);
    z-index: 3900; display: flex; align-items: center; overflow-x: auto; white-space: nowrap; padding: 0 10px;
}
.cyber-nav::-webkit-scrollbar { display: none; }
.nav-item {
    flex-shrink: 0; padding: 0 18px; height: 100%; display: flex; align-items: center;
    color: var(--text-secondary); font-weight: 600; font-size: 0.9rem; text-decoration: none; 
    border-bottom: 3px solid transparent; transition: all 0.3s ease;
}
.nav-item.active { 
    color: var(--text-primary); border-bottom-color: var(--accent); 
    background: linear-gradient(to top, rgba(252, 213, 53, 0.05), transparent);
}
.nav-item i { margin-right: 8px; }

/* 메인 패널 */
.main-content { max-width: 800px; margin: 0 auto; padding: 20px 15px; }
.cyber-panel {
    background: var(--bg-card); border-radius: 16px; padding: 25px; margin-bottom: 20px;
    border: var(--border-highlight); box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
    transition: transform 0.2s;
}
#total-val { text-shadow: 0 0 25px rgba(255, 255, 255, 0.15); letter-spacing: -1px; }

/* [NEW] 대형 데이터 마이닝 패널 스타일 */
.data-mining-panel {
    background: linear-gradient(90deg, rgba(20,24,36,0.8), rgba(20,24,36,0.6));
    border: 1px solid var(--border-soft);
    border-left: 4px solid var(--accent); /* 왼쪽에 노란색 포인트 */
    border-radius: 12px;
    padding: 20px 25px; /* 내부 여백 넉넉하게 */
    margin-bottom: 20px; /* 아래 패널과 간격 */
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.mining-left {
    display: flex;
    flex-direction: column;
}

/* 다운로드 버튼 (크고 눈에 띄게) */
.save-tag.big-btn {
    background: rgba(255,255,255,0.08); 
    height: 50px; 
    padding: 0 25px; 
    font-size: 0.9rem;
    border: 1px solid rgba(255,255,255,0.1);
}
.save-tag.big-btn:hover {
    background: var(--accent);
    color: #000;
    border-color: var(--accent);
}

/* AI HUD (시각화) */
.ai-hud-panel {
    background: rgba(16, 20, 30, 0.95); border: 1px solid rgba(0, 255, 65, 0.2);
    border-radius: 12px; padding: 15px; margin-bottom: 15px; position: relative; overflow: hidden;
    box-shadow: 0 0 20px rgba(0, 255, 65, 0.05);
}
.radar-box { width: 50px; height: 50px; border: 2px solid rgba(0, 243, 255, 0.3); border-radius: 50%; position: relative; display: flex; align-items: center; justify-content: center; }
.radar-scan { width: 100%; height: 100%; border-radius: 50%; background: conic-gradient(from 0deg, transparent 0deg, rgba(0, 243, 255, 0.5) 360deg); animation: radar-spin 2s linear infinite; position: absolute; top: 0; left: 0; opacity: 0.3; }
.radar-dot { width: 6px; height: 6px; background: #fff; border-radius: 50%; position: absolute; top: 10px; right: 10px; box-shadow: 0 0 10px #fff; animation: blink 1s infinite; }
.scan-text-line { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; display: flex; justify-content: space-between; }
.check-pass { color: var(--color-up); font-weight: bold; }
.check-wait { color: var(--accent); }
.confidence-bar-bg { width: 100%; height: 6px; background: #222; border-radius: 3px; margin-top: 8px; overflow: hidden; }
.confidence-bar-fill { height: 100%; width: 0%; background: var(--color-up); border-radius: 3px; transition: width 0.3s; box-shadow: 0 0 10px var(--color-up); }
@keyframes radar-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

/* 기타 공통 */
.status-bar { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
.save-tag { background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border-soft); padding: 0 14px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; border-radius: 8px; cursor: pointer; transition: 0.2s; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
.ctrl-group { display: flex; gap: 12px; margin-top: 20px; }
.cyber-btn { flex: 1; padding: 16px; border: none; border-radius: 12px; font-weight: 700; font-size: 1rem; cursor: pointer; color: #fff; transition: all 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
.btn-auto { background: linear-gradient(135deg, #2ebd85, #20a370); }
.btn-stop { background: linear-gradient(135deg, #2b3139, #1f242b); color: var(--text-secondary); }
.modal-input { width: 100%; padding: 16px; background: rgba(20, 24, 36, 0.8); border: 1px solid var(--border-soft); color: var(--text-primary); border-radius: 12px; font-size: 1rem; margin-bottom: 12px; transition: 0.3s; }
.modal-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(252, 213, 53, 0.1); }
.bank-card-bg { background: linear-gradient(135deg, #1e2330 0%, #141824 100%); border: 1px solid rgba(93, 120, 255, 0.1); box-shadow: 0 10px 30px -5px rgba(93, 120, 255, 0.15); }
.history-table th { padding: 15px 0 10px 15px; font-weight: 600; font-size: 0.75rem; letter-spacing: 0.5px; color: var(--text-secondary); }
.history-table td { padding: 15px 0 15px 15px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.85rem; }
.modal-overlay { backdrop-filter: blur(5px); background: rgba(0,0,0,0.6); display:none; position:fixed; top:0; left:0; width:100%; height:100%; z-index:9999; justify-content:center; align-items:center;}
.modal-box { background: var(--bg-card); border: var(--border-highlight); border-radius: 20px; padding: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); width:90%; max-width:380px;}
