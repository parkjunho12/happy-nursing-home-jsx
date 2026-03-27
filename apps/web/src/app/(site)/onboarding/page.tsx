'use client';

/**
 * 행복한요양원 녹양역점 – 신규 직원 온보딩
 * Next.js App Router 단일 파일 버전
 *
 * 사용법: app/onboarding/page.tsx 에 이 파일을 그대로 넣으세요.
 */

import { useState, useEffect, useCallback, type ReactNode, type KeyboardEvent } from 'react';

/* ===== CSS (전역 스타일 인라인 주입) ===== */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
  :root {
    --bg:#fdf8f2; --paper:#fffdf9; --border:#e8ddd0;
    --primary:#c97b4b; --primary-d:#a8622f; --primary-l:#f5e6d8;
    --sage:#7a9e7e; --sage-l:#e8f0e9; --beige:#e8ddd0;
    --text:#2c2017; --text-mid:#5a4a3a; --text-soft:#8a7a6a;
    --danger:#c0392b;
    --shadow:0 4px 20px rgba(100,70,30,0.10);
    --shadow-sm:0 2px 8px rgba(100,70,30,0.08);
    --r:16px; --r-sm:10px;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{font-size:18px;scroll-behavior:smooth}
  body{font-family:'Noto Sans KR',sans-serif;background:var(--bg);color:var(--text);line-height:1.8;min-height:100vh}
  :focus-visible{outline:3px solid var(--primary);outline-offset:3px}
  button{cursor:pointer} input,button{font-family:inherit}

  .login-wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;background:linear-gradient(160deg,#fff8f0 0%,#fdf3e7 50%,#f5ede0 100%)}
  .login-card{background:var(--paper);border-radius:var(--r);box-shadow:var(--shadow);border:1.5px solid var(--border);padding:44px 36px 40px;width:100%;max-width:460px}
  .login-logo{text-align:center;margin-bottom:32px}
  .login-logo .emoji{font-size:52px;display:block;margin-bottom:8px}
  .login-logo .facility{font-size:1.15rem;color:var(--text-soft);font-weight:500;letter-spacing:-0.02em}
  .login-logo .title{font-family:'Nanum Myeongjo',serif;font-size:1.7rem;font-weight:800;color:var(--primary);letter-spacing:-0.03em;margin-top:4px}
  .login-form{display:flex;flex-direction:column;gap:20px}
  .form-group{display:flex;flex-direction:column;gap:8px}
  .form-group label{font-size:1.05rem;font-weight:700;color:var(--text-mid)}
  .form-group input{border:2px solid var(--border);border-radius:var(--r-sm);padding:16px 18px;font-size:1.15rem;color:var(--text);background:var(--bg);transition:border-color 0.2s;width:100%;outline:none}
  .form-group input:focus{border-color:var(--primary);background:#fff}
  .form-group input::placeholder{color:var(--text-soft);font-size:1rem}
  .login-btn{background:var(--primary);color:#fff;border:none;border-radius:var(--r-sm);padding:18px;font-size:1.2rem;font-weight:700;letter-spacing:-0.02em;transition:background 0.2s,transform 0.1s;margin-top:8px;width:100%}
  .login-btn:hover{background:var(--primary-d)}
  .login-btn:active{transform:scale(0.98)}
  .login-error{background:#fde8e8;border:1.5px solid #f0b4b4;border-radius:var(--r-sm);padding:14px 18px;color:var(--danger);font-size:1rem;font-weight:600;text-align:center}
  .login-hint{margin-top:28px;background:var(--sage-l);border-radius:var(--r-sm);padding:16px 18px;font-size:0.88rem;color:var(--text-mid);line-height:1.7}
  .login-hint strong{color:var(--sage);font-weight:700;display:block;margin-bottom:4px}

  .app-wrap{max-width:800px;margin:0 auto;padding:0 0 80px}
  .header{background:var(--paper);border-bottom:2px solid var(--border);padding:16px 20px;position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 2px 10px rgba(100,70,30,0.08)}
  .header-left{display:flex;flex-direction:column}
  .header-facility{font-size:0.78rem;color:var(--text-soft);font-weight:500;letter-spacing:-0.01em}
  .header-title{font-size:1.1rem;font-weight:700;color:var(--primary);letter-spacing:-0.03em}
  .header-right{display:flex;gap:8px;align-items:center;flex-shrink:0}
  .btn-outline{border:2px solid var(--border);background:var(--paper);border-radius:var(--r-sm);padding:9px 16px;font-size:0.92rem;font-weight:600;color:var(--text-mid);transition:all 0.18s;white-space:nowrap}
  .btn-outline:hover{border-color:var(--primary);color:var(--primary)}
  .btn-sage{border:2px solid var(--sage);background:var(--sage);border-radius:var(--r-sm);padding:9px 16px;font-size:0.92rem;font-weight:700;color:#fff;transition:all 0.18s;white-space:nowrap}
  .btn-sage:hover{background:#6a8e6e;border-color:#6a8e6e}

  .welcome-banner{background:linear-gradient(135deg,var(--primary) 0%,#e8954a 100%);color:#fff;padding:28px 24px 32px;position:relative;overflow:hidden}
  .welcome-banner::after{content:'🌸';position:absolute;right:20px;top:16px;font-size:64px;opacity:0.22}
  .welcome-name{font-size:1.6rem;font-weight:900;letter-spacing:-0.04em;margin-bottom:4px}
  .welcome-sub{font-size:1rem;opacity:0.92;line-height:1.6}

  .progress-section{background:var(--paper);border-bottom:1.5px solid var(--border);padding:20px 24px}
  .progress-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .progress-label{font-size:1rem;font-weight:700;color:var(--text-mid)}
  .progress-pct{font-size:1.4rem;font-weight:900;color:var(--primary);letter-spacing:-0.04em}
  .progress-bar-wrap{background:var(--beige);border-radius:999px;height:18px;overflow:hidden}
  .progress-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--primary) 0%,var(--sage) 100%);transition:width 0.5s ease}
  .badge-complete{margin-top:14px;background:linear-gradient(90deg,var(--sage) 0%,#5a9e5e 100%);color:#fff;border-radius:var(--r-sm);padding:14px 20px;font-size:1.05rem;font-weight:700;text-align:center;letter-spacing:-0.02em;display:flex;align-items:center;justify-content:center;gap:8px}

  .summary-section{padding:24px 20px 8px}
  .section-heading{font-size:1.08rem;font-weight:700;color:var(--text-mid);margin-bottom:14px;letter-spacing:-0.02em;display:flex;align-items:center;gap:8px}
  .summary-grid{display:grid;grid-template-columns:1fr;gap:12px}
  @media(min-width:560px){.summary-grid{grid-template-columns:1fr 1fr 1fr}}
  .summary-card{background:var(--paper);border:2px solid var(--border);border-radius:var(--r);padding:20px 18px;transition:border-color 0.2s,box-shadow 0.2s}
  .summary-card:hover{border-color:var(--primary);box-shadow:var(--shadow-sm)}
  .summary-card .icon{font-size:2rem;margin-bottom:8px;display:block}
  .summary-card .card-title{font-size:1rem;font-weight:700;color:var(--text);margin-bottom:6px;letter-spacing:-0.02em}
  .summary-card .card-body{font-size:0.88rem;color:var(--text-mid);line-height:1.6}

  .sections-wrap{padding:8px 20px 24px;display:flex;flex-direction:column;gap:12px}
  .accordion{background:var(--paper);border:2px solid var(--border);border-radius:var(--r);overflow:hidden;transition:border-color 0.2s,box-shadow 0.2s}
  .accordion.done{border-color:var(--sage)}
  .accordion:hover{box-shadow:var(--shadow-sm)}
  .accordion-head{display:flex;align-items:center;gap:14px;padding:20px;cursor:pointer;user-select:none;transition:background 0.15s}
  .accordion-head:hover{background:var(--bg)}
  .accordion-icon{font-size:1.7rem;flex-shrink:0}
  .accordion-texts{flex:1}
  .accordion-num{font-size:0.78rem;color:var(--text-soft);font-weight:600;letter-spacing:0.04em;text-transform:uppercase}
  .accordion-name{font-size:1.12rem;font-weight:700;color:var(--text);letter-spacing:-0.03em}
  .accordion-badge{background:var(--sage);color:#fff;border-radius:999px;padding:4px 12px;font-size:0.78rem;font-weight:700;flex-shrink:0}
  .accordion-badge.pending{background:var(--beige);color:var(--text-soft)}
  .accordion-arrow{font-size:1rem;color:var(--text-soft);transition:transform 0.25s;flex-shrink:0}
  .accordion-arrow.open{transform:rotate(180deg)}
  .accordion-body{border-top:1.5px solid var(--border);padding:24px 24px 20px;background:var(--bg)}

  .content-text{font-size:1rem;color:var(--text-mid);line-height:1.9;margin-bottom:16px}
  .content-h3{font-size:1.05rem;font-weight:700;color:var(--text);margin-bottom:10px;margin-top:18px;letter-spacing:-0.02em}
  .content-h3:first-child{margin-top:0}
  .check-list{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
  .check-item{display:flex;align-items:flex-start;gap:12px}
  .check-item input[type=checkbox]{width:24px;height:24px;flex-shrink:0;border-radius:6px;border:2px solid var(--border);accent-color:var(--sage);cursor:pointer;margin-top:2px}
  .check-item label{font-size:0.98rem;color:var(--text-mid);cursor:pointer;line-height:1.7;flex:1}
  .check-item.checked label{text-decoration:line-through;color:var(--text-soft)}

  .highlight-box{background:var(--primary-l);border-left:5px solid var(--primary);border-radius:0 var(--r-sm) var(--r-sm) 0;padding:16px 18px;margin:16px 0;font-size:0.98rem;color:var(--text);line-height:1.8}
  .warn-box{background:#fde8e8;border-left:5px solid var(--danger);border-radius:0 var(--r-sm) var(--r-sm) 0;padding:16px 18px;margin:16px 0;font-size:0.98rem;color:#6b1f1f;line-height:1.8}
  .sage-box{background:var(--sage-l);border-left:5px solid var(--sage);border-radius:0 var(--r-sm) var(--r-sm) 0;padding:16px 18px;margin:16px 0;font-size:0.98rem;color:#1e3d21;line-height:1.8}

  .timeline{display:flex;flex-direction:column;gap:0;margin:12px 0 16px}
  .tl-item{display:flex;gap:16px}
  .tl-line{display:flex;flex-direction:column;align-items:center}
  .tl-dot{width:16px;height:16px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:4px}
  .tl-bar{width:2px;background:var(--beige);flex:1;min-height:20px}
  .tl-item:last-child .tl-bar{display:none}
  .tl-content{padding-bottom:18px;flex:1}
  .tl-title{font-size:1rem;font-weight:700;color:var(--text);margin-bottom:2px;letter-spacing:-0.02em}
  .tl-desc{font-size:0.9rem;color:var(--text-mid)}

  .contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
  .contact-card{background:var(--paper);border:2px solid var(--border);border-radius:var(--r-sm);padding:16px 14px;text-align:center}
  .contact-role{font-size:0.82rem;color:var(--text-soft);font-weight:600;margin-bottom:4px}
  .contact-name{font-size:1.05rem;font-weight:700;color:var(--text);letter-spacing:-0.02em}
  .contact-phone{font-size:0.95rem;color:var(--primary);font-weight:700;margin-top:4px}
  .divider{border:none;border-top:1.5px dashed var(--beige);margin:20px 0}

  .done-btn{width:100%;padding:18px;border-radius:var(--r-sm);border:2.5px solid var(--sage);background:var(--sage-l);color:var(--sage);font-size:1.08rem;font-weight:700;letter-spacing:-0.02em;transition:all 0.2s;margin-top:16px;display:flex;align-items:center;justify-content:center;gap:10px}
  .done-btn:hover{background:var(--sage);color:#fff}
  .done-btn.active{background:var(--sage);color:#fff;cursor:default}

  .faq-list{display:flex;flex-direction:column;gap:0}
  .faq-item{border-bottom:1.5px solid var(--beige);padding:16px 0}
  .faq-item:last-child{border-bottom:none}
  .faq-q{font-size:1rem;font-weight:700;color:var(--text);margin-bottom:6px;letter-spacing:-0.02em}
  .faq-q::before{content:'Q. ';color:var(--primary)}
  .faq-a{font-size:0.95rem;color:var(--text-mid);line-height:1.75}
  .faq-a::before{content:'A. ';color:var(--sage);font-weight:700}

  .print-section{padding:16px 20px;background:var(--paper);border-top:2px solid var(--border);border-bottom:2px solid var(--border);display:flex;gap:12px;flex-wrap:wrap;align-items:center}
  .btn-print{background:var(--text);color:#fff;border:none;border-radius:var(--r-sm);padding:14px 22px;font-size:1rem;font-weight:700;transition:background 0.18s;display:flex;align-items:center;gap:8px}
  .btn-print:hover{background:#111}
  .print-note{font-size:0.88rem;color:var(--text-soft);line-height:1.5}

  .btn-toggle{border:2px solid var(--border);background:var(--paper);border-radius:var(--r-sm);padding:9px 16px;font-size:0.92rem;font-weight:600;color:var(--text-mid);transition:all 0.18s;white-space:nowrap}
  .btn-toggle:hover{border-color:var(--primary);color:var(--primary)}
  .btn-toggle.active{border-color:var(--primary);background:var(--primary-l);color:var(--primary-d)}

  .print-sign{display:none}

  @media print {
    .header,.progress-section .progress-bar-wrap,.print-section,
    .accordion-head .accordion-arrow,.done-btn,.btn-outline,.btn-sage,.btn-print{display:none !important}
    body{background:#fff;font-size:13pt}
    html{font-size:14px}
    .app-wrap{max-width:100%;padding:0}
    .welcome-banner{background:none;color:#000;border-bottom:3pt solid #000;padding:16pt 0 12pt}
    .welcome-name{font-size:20pt}
    .welcome-sub{font-size:12pt}
    .progress-section{background:none;border:none;padding:8pt 0}
    .progress-label{font-size:12pt}
    .progress-pct{font-size:14pt}
    .summary-section,.sections-wrap{padding:8pt 0}
    .summary-grid{grid-template-columns:1fr 1fr 1fr}
    .summary-card{border:1.5pt solid #999;padding:10pt 12pt;break-inside:avoid}
    .accordion{border:1.5pt solid #999;break-inside:avoid;margin-bottom:10pt}
    .accordion-body{display:block !important;padding:10pt 12pt;background:#fff}
    .accordion-head{padding:10pt 12pt}
    .accordion-name{font-size:13pt}
    .highlight-box,.sage-box{border:1pt solid #999;background:#f5f5f5}
    .warn-box{border:1pt solid #c00;background:#fff0f0}
    .badge-complete{border:2pt solid green;background:none;color:green}
    .print-sign{display:block !important;border-top:2pt solid #000;margin-top:20pt;padding-top:10pt;font-size:11pt}
  }

  @media(max-width:480px){
    html{font-size:17px}
    .login-card{padding:32px 20px}
    .accordion-head{padding:16px;gap:10px}
    .accordion-body{padding:18px 16px 16px}
    .welcome-banner{padding:24px 18px 28px}
    .summary-section,.sections-wrap{padding-left:14px;padding-right:14px}
    .contact-grid{grid-template-columns:1fr}
  }
`;

/* ===== 목 직원 데이터 ===== */
const MOCK_USERS = [
  { id: 'u1', name: '김미순', password: '1234', role: '요양보호사' },
  { id: 'u2', name: '김원녀', password: '1234', role: '요양보호사' },
  { id: 'u3', name: '김진숙', password: '1234', role: '요양보호사' },
  { id: 'u4', name: '이오목', password: '1234', role: '요양보호사' },
  { id: 'u5', name: '최숙진', password: '1234', role: '요양보호사' },
];

const SECTION_IDS = ['welcome','checklist','firstday','attitude','hygiene','emergency','faq','confirm'] as const;
type SectionId = typeof SECTION_IDS[number];
type DoneMap = Partial<Record<SectionId, boolean>>;
interface User { id: string; name: string; password: string; role: string; }

const lsKey = (uid: string, k: string) => `hwr_${uid}_${k}`;
function loadUserState(uid: string): DoneMap {
  try { return JSON.parse(localStorage.getItem(lsKey(uid,'sections')) ?? '{}'); } catch { return {}; }
}
function saveUserState(uid: string, state: DoneMap) {
  localStorage.setItem(lsKey(uid,'sections'), JSON.stringify(state));
}
function calcProgress(done: DoneMap) {
  return Math.round(SECTION_IDS.filter(s => done[s]).length / SECTION_IDS.length * 100);
}

/* ===== 로그인 화면 ===== */
function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const handleLogin = () => {
    const u = MOCK_USERS.find(u => u.name === name.trim() && u.password === pw.trim());
    if (u) { setErr(''); onLogin(u); }
    else setErr('이름 또는 비밀번호가 맞지 않습니다. 다시 확인해 주세요.');
  };
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleLogin(); };
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <span className="emoji">🌸</span>
          <div className="facility">행복한요양원 녹양역점</div>
          <div className="title">신규 직원 온보딩</div>
        </div>
        <div className="login-form">
          {err && <div className="login-error" role="alert">⚠️ {err}</div>}
          <div className="form-group">
            <label htmlFor="inp-name">이름</label>
            <input id="inp-name" type="text" placeholder="이름을 입력하세요 (예: 김미순)"
              value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKey}
              aria-label="이름 입력" autoComplete="name" />
          </div>
          <div className="form-group">
            <label htmlFor="inp-pw">비밀번호</label>
            <input id="inp-pw" type="password" placeholder="비밀번호 4자리를 입력하세요"
              value={pw} onChange={e => setPw(e.target.value)} onKeyDown={handleKey}
              aria-label="비밀번호 입력" autoComplete="current-password" />
          </div>
          <button className="login-btn" onClick={handleLogin} aria-label="로그인">로그인 →</button>
        </div>
        <div className="login-hint">
          <strong>💡 테스트 계정 안내</strong>
          이름: <b>김미순</b> / 비밀번호: <b>1234</b><br />
          이름: <b>김원녀</b> / 비밀번호: <b>1234</b>
        </div>
      </div>
    </div>
  );
}

/* ===== 아코디언 ===== */
function Accordion({ sectionId, num, icon, title, done, onDone, children, forceOpen }:
  { sectionId: SectionId; num: number; icon: string; title: string; done: boolean; onDone: (id: SectionId) => void; children: ReactNode; forceOpen?: boolean }) {
  const [open, setOpen] = useState(false);

  // 모두 열기/닫기 버튼에 반응
  useEffect(() => {
    if (forceOpen !== undefined) setOpen(forceOpen);
  }, [forceOpen]);
  return (
    <div className={`accordion${done ? ' done' : ''}`}>
      <div className="accordion-head" onClick={() => setOpen(o => !o)} role="button" aria-expanded={open} tabIndex={0}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') setOpen(o => !o); }}>
        <span className="accordion-icon" aria-hidden="true">{icon}</span>
        <div className="accordion-texts">
          <div className="accordion-num">STEP {num}</div>
          <div className="accordion-name">{title}</div>
        </div>
        <span className={`accordion-badge${done ? '' : ' pending'}`}>{done ? '✅ 완료' : '확인 필요'}</span>
        <span className={`accordion-arrow${open ? ' open' : ''}`} aria-hidden="true">▼</span>
      </div>
      {open && (
        <div className="accordion-body">
          {children}
          <button className={`done-btn${done ? ' active' : ''}`}
            onClick={() => { if (!done) onDone(sectionId); }} disabled={done}
            aria-label={done ? '이미 완료된 항목입니다' : '이 항목 읽음 확인'}>
            {done ? '✅ 확인 완료' : '👍 이 내용을 읽었습니다'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ===== 섹션 콘텐츠들 ===== */
function WelcomeContent() {
  return (
    <>
      <p className="content-text"><b>행복한요양원 녹양역점</b>에 오신 것을 진심으로 환영합니다. 🌸<br />어르신의 하루를 따뜻하고 안전하게 지키는 소중한 일에 함께해 주셔서 진심으로 감사드립니다.</p>
      <div className="highlight-box">우리 요양원의 모든 직원은 <b>한 가족</b>입니다.<br />모르는 것이 있으면 언제든지 선배 직원에게 여쭤보세요.<br />처음이 어색한 것은 당연합니다. 함께 배워가겠습니다. 😊</div>
      <h3 className="content-h3">📋 온보딩 안내 사용 방법</h3>
      <ul className="check-list">
        <li className="check-item"><label>① 각 항목을 위에서 아래로 차례대로 읽어 주세요.</label></li>
        <li className="check-item"><label>② 항목을 다 읽으면 <b>&ldquo;이 내용을 읽었습니다&rdquo;</b> 버튼을 눌러 주세요.</label></li>
        <li className="check-item"><label>③ 8개 항목을 모두 완료하면 온보딩 완료 배지가 나옵니다.</label></li>
        <li className="check-item"><label>④ 필요하면 <b>인쇄하기</b> 버튼으로 종이에 출력하실 수 있습니다.</label></li>
      </ul>
    </>
  );
}

function ChecklistContent({ uid }: { uid: string }) {
  const KEY = lsKey(uid, 'checklist');
  const [checks, setChecks] = useState<Record<string,boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
  });
  const items = [
    { id:'c1', text:'신분증 제출 완료' }, { id:'c2', text:'통장 사본 제출 완료' },
    { id:'c3', text:'편한 실내화 준비' }, { id:'c4', text:'근무복 확인' },
    { id:'c5', text:'필기구 챙기기 (볼펜, 노트)' }, { id:'c6', text:'개인 텀블러 준비 (생수병 가능)' },
    { id:'c7', text:'비상연락망 확인' }, { id:'c8', text:'기본 인수인계 내용 숙지' },
  ];
  const toggle = (id: string) => {
    const n = { ...checks, [id]: !checks[id] };
    setChecks(n); localStorage.setItem(KEY, JSON.stringify(n));
  };
  return (
    <>
      <p className="content-text">첫 출근 전에 아래 항목을 하나씩 확인해 주세요. 체크하면 저장됩니다.</p>
      <ul className="check-list">
        {items.map(it => (
          <li key={it.id} className={`check-item${checks[it.id] ? ' checked' : ''}`}>
            <input type="checkbox" id={it.id} checked={!!checks[it.id]} onChange={() => toggle(it.id)} />
            <label htmlFor={it.id}>{it.text}</label>
          </li>
        ))}
      </ul>
      <div className="highlight-box"><b>📌 복장 안내</b><br />편하고 단정한 복장으로 오시면 됩니다.<br />슬리퍼·샌들·하이힐은 안전상 금지입니다. 운동화 또는 크록스 계열을 권장합니다.</div>
    </>
  );
}

function FirstDayContent() {
  const steps = [
    { title:'08:40 출근 및 체온 확인', desc:'정문 입구에서 체온 체크 후 출근부에 서명합니다.' },
    { title:'08:50 담당자와 인사', desc:'팀장(또는 선임 요양보호사)에게 인사하고 안내를 받습니다.' },
    { title:'09:00 시설 투어', desc:'어르신 생활실, 화장실, 탕비실, 비상구 위치를 확인합니다.' },
    { title:'09:30 직원 소개', desc:'함께 일할 동료들과 인사를 나눕니다.' },
    { title:'10:00 기본 업무 설명', desc:'인수인계 방법, 기록지 작성, 호출벨 사용법을 배웁니다.' },
    { title:'11:00 어르신 현황 파악', desc:'담당 어르신 명단과 케어 특이사항을 확인합니다.' },
    { title:'12:00 점심 식사', desc:'직원 식당(또는 급식실)에서 함께 식사합니다.' },
    { title:'오후 OJT', desc:'선배 직원과 함께 실제 케어 업무를 경험합니다 (보조 역할).' },
  ];
  return (
    <>
      <p className="content-text">첫날 오시면 아래 순서대로 진행됩니다. 미리 알아 두시면 덜 긴장됩니다. 😊</p>
      <div className="timeline">
        {steps.map((s, i) => (
          <div key={i} className="tl-item">
            <div className="tl-line"><div className="tl-dot" /><div className="tl-bar" /></div>
            <div className="tl-content"><div className="tl-title">{s.title}</div><div className="tl-desc">{s.desc}</div></div>
          </div>
        ))}
      </div>
      <div className="sage-box"><b>💡 당일 꼭 기억하세요</b><br />• 모르면 반드시 여쭤보세요. 혼자 판단하지 마세요.<br />• 첫날은 보조 역할입니다. 관찰하고 배우는 것이 우선입니다.<br />• 어르신 이름은 천천히 외워도 됩니다. 급하게 하지 않아도 돼요.</div>
    </>
  );
}

function AttitudeContent() {
  return (
    <>
      <p className="content-text">어르신을 대할 때 가장 중요한 기본 태도입니다. 천천히 읽고 마음에 새겨 주세요.</p>
      <h3 className="content-h3">✅ 반드시 지킬 것</h3>
      <ul className="check-list">
        {['항상 존칭을 사용합니다 ("어르신", "○○ 할머니" 등)','천천히, 또렷하게 말씀드립니다',
          '사생활을 존중합니다 (방문 전 노크, 허락 후 입장)','어르신의 속도에 맞춰 기다려 드립니다',
          '감정적으로 반응하지 않고 차분하게 대응합니다','항상 웃는 얼굴, 밝은 목소리로 인사합니다',
        ].map((t, i) => <li key={i} className="check-item"><label>{t}</label></li>)}
      </ul>
      <h3 className="content-h3" style={{ marginTop:'20px' }}>🚫 절대 하면 안 되는 것</h3>
      <div className="warn-box">
        ❌ 반말 사용 금지<br />❌ 큰소리 또는 화난 말투 금지<br />❌ 다그치거나 재촉하는 행동 금지<br />
        ❌ 어르신 의사를 무시하고 강제로 처치 금지<br />❌ 의약품·영양제 개인 판단으로 투여 절대 금지<br />
        ❌ 어르신 정보를 외부에 누설 금지 (개인정보 보호)
      </div>
      <h3 className="content-h3">📞 근무 기본 수칙</h3>
      <ul className="check-list">
        {['출퇴근 시간 반드시 엄수','인수인계는 구두 + 기록지로 꼼꼼하게',
          '개인 휴대폰은 휴게 시간에만 사용','근무 중 자리 이탈 시 반드시 동료에게 알리기',
          '음식·음료는 지정 공간(탕비실)에서만',
        ].map((t, i) => <li key={i} className="check-item"><label>{t}</label></li>)}
      </ul>
    </>
  );
}

function HygieneContent() {
  return (
    <>
      <p className="content-text">감염 예방과 낙상 예방은 어르신 안전을 지키는 가장 기본입니다.</p>
      <h3 className="content-h3">🧼 감염예방 / 위생수칙</h3>
      <ul className="check-list">
        {['케어 전후 반드시 손 씻기 (30초 이상)','장갑, 마스크 착용 (분비물 접촉 시 필수)',
          '사용한 장갑은 즉시 교체 후 폐기','개인 타월·위생용품 공동 사용 금지',
          '식사 전후 손 위생 철저','발열·기침·설사 등 증상 시 즉시 팀장에게 보고',
        ].map((t, i) => <li key={i} className="check-item"><label>{t}</label></li>)}
      </ul>
      <hr className="divider" />
      <h3 className="content-h3">🛡️ 낙상 예방 수칙</h3>
      <ul className="check-list">
        {['낙상 고위험 어르신 명단 사전 파악','이동 보조 시 항상 곁에서 지지',
          '침상 사이드레일 올리기 (취침·낮잠 시)','휠체어 이동 전 잠금 해제 여부 확인',
          '복도·화장실 바닥 물기 발견 즉시 닦기','야간 화장실 이동 시 반드시 동행',
          '어르신이 혼자 일어서려 하면 즉시 도움',
        ].map((t, i) => <li key={i} className="check-item"><label>{t}</label></li>)}
      </ul>
      <div className="highlight-box"><b>⚠️ 낙상 발생 시</b><br />어르신을 함부로 옮기지 마시고 <b>즉시 팀장·간호사에게 알리세요.</b><br />혼자 판단하여 일으키다가 2차 부상이 생길 수 있습니다.</div>
    </>
  );
}

function EmergencyContent() {
  return (
    <>
      <p className="content-text">이상 징후를 발견하면 <b>즉시, 정확하게</b> 보고해야 합니다. 혼자 판단하지 마세요.</p>
      <h3 className="content-h3">🚨 즉시 보고해야 할 상황</h3>
      <div className="warn-box">
        🔴 어르신이 쓰러지거나 의식이 없을 때<br />🔴 갑자기 호흡이 이상하거나 청색증이 생길 때<br />
        🔴 낙상·골절 의심 상황<br />🔴 갑작스러운 고열(38.5℃ 이상)<br />
        🔴 구토·설사가 반복될 때<br />🔴 보호자로부터 민원·항의를 받을 때<br />🔴 본인 또는 동료의 감염 의심 증상
      </div>
      <h3 className="content-h3">📣 보고 순서</h3>
      <div className="timeline">
        {[
          { title:'1단계: 즉시 현장 확인', desc:'어르신 상태를 간단히 확인합니다. 혼자 처치하지 않습니다.' },
          { title:'2단계: 팀장(선임) 보고', desc:'빠르게 상황을 알립니다. 전화 또는 직접 호출.' },
          { title:'3단계: 간호사 확인', desc:'간호사가 상태를 확인하고 조치를 지시합니다.' },
          { title:'4단계: 응급 시 119 신고', desc:'간호사 지시가 있을 경우 119에 신고합니다.' },
          { title:'5단계: 기록 작성', desc:'상황 발생 시각, 어르신 상태, 조치 내용을 기록합니다.' },
        ].map((s, i) => (
          <div key={i} className="tl-item">
            <div className="tl-line"><div className="tl-dot" /><div className="tl-bar" /></div>
            <div className="tl-content"><div className="tl-title">{s.title}</div><div className="tl-desc">{s.desc}</div></div>
          </div>
        ))}
      </div>
      <h3 className="content-h3">📞 비상 연락처</h3>
      <div className="contact-grid">
        <div className="contact-card"><div className="contact-role">대표</div><div className="contact-name">박준호 원장</div><div className="contact-phone">010-8369-6569</div></div>
        <div className="contact-card"><div className="contact-role">간호조무사 (주간)</div><div className="contact-name">박미순 간호조무사</div><div className="contact-phone">010-9021-0779</div></div>
        <div className="contact-card"><div className="contact-role">시설장</div><div className="contact-name">김제현 시설장</div><div className="contact-phone">010-8882-5474</div></div>
        <div className="contact-card"><div className="contact-role">응급 (119)</div><div className="contact-name">소방서</div><div className="contact-phone" style={{ fontSize:'1.4rem' }}>119</div></div>
      </div>
      <div className="sage-box" style={{ marginTop:'12px', fontSize:'0.88rem' }}>※ 위 연락처는 예시입니다. 실제 연락처는 첫날 팀장에게 확인하세요.</div>
    </>
  );
}

function FAQContent() {
  const faqs = [
    { q:'출근 시간은 몇 시인가요?', a:'일반적으로 08:50까지 입실합니다. 정확한 교대 시간은 팀장에게 확인하세요.' },
    { q:'복장은 어떻게 입어야 하나요?', a:'편하고 단정한 복장이면 됩니다. 슬리퍼·하이힐은 안전상 금지이며, 편한 운동화를 권장합니다.' },
    { q:'식사 시간은 어떻게 되나요?', a:'직원 식사는 어르신 식사 보조 후 교대로 합니다. 보통 오전 12시~오후 1시 사이입니다.' },
    { q:'휴게 시간은 언제인가요?', a:'8시간 근무 기준 1시간 휴게가 있습니다. 팀장과 협의하여 교대로 쉬게 됩니다.' },
    { q:'이상 상황은 누구에게 보고하나요?', a:'먼저 팀장(선임 요양보호사)에게 알리고, 의료적 판단이 필요하면 간호사에게 연결합니다.' },
    { q:'보호자가 민원을 제기하면 어떻게 하나요?', a:'본인이 직접 대응하지 말고, "담당자에게 연결해 드리겠다"고 안내 후 팀장·사회복지사에게 알립니다.' },
    { q:'야간 근무도 있나요?', a:'교대제로 운영되며, 야간 근무 일정은 입사 후 팀장과 조율합니다.' },
    { q:'실수를 했을 때는 어떻게 하나요?', a:'숨기지 말고 즉시 팀장에게 알리세요. 빨리 알릴수록 대처가 쉽습니다. 혼나는 것보다 어르신 안전이 우선입니다.' },
  ];
  return (
    <>
      <p className="content-text">자주 궁금해하시는 내용을 정리했습니다. 더 궁금한 점은 팀장에게 편하게 여쭤보세요.</p>
      <div className="faq-list">
        {faqs.map((f, i) => (
          <div key={i} className="faq-item">
            <div className="faq-q">{f.q}</div>
            <div className="faq-a">{f.a}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function ConfirmContent({ done }: { done: boolean }) {
  return (
    <>
      <p className="content-text">위의 모든 내용을 읽고 이해하셨다면 아래 버튼을 눌러 주세요.</p>
      <div className="highlight-box">
        ✅ 환영 인사 및 온보딩 안내 확인<br />✅ 첫 출근 준비물 체크<br />✅ 첫날 일정 숙지<br />
        ✅ 어르신 응대 태도 및 금지사항 확인<br />✅ 감염예방 및 낙상예방 수칙 확인<br />
        ✅ 응급상황 보고 절차 숙지<br />✅ 자주 묻는 질문 확인
      </div>
      {done && <div className="badge-complete">🎉 온보딩을 모두 완료하셨습니다! 첫 출근을 응원합니다.</div>}
      <div className="print-sign">
        <p style={{ marginTop:'8pt' }}>본인은 행복한요양원 녹양역점 신규 직원 온보딩 내용을 모두 확인하였습니다.</p>
        <p style={{ marginTop:'16pt' }}>확인일: ___년 ___월 ___일 &nbsp;&nbsp;&nbsp; 성명: _______________ (서명: _______________)</p>
      </div>
    </>
  );
}

/* ===== 메인 Page 컴포넌트 ===== */
export default function OnboardingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [done, setDone] = useState<DoneMap>({});
  const [allOpen, setAllOpen] = useState(false); // 모두 열기/닫기 상태

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hwr_session');
      if (saved) { const u: User = JSON.parse(saved); setUser(u); setDone(loadUserState(u.id)); }
    } catch { /* 무시 */ }
  }, []);

  const handleLogin = (u: User) => {
    localStorage.setItem('hwr_session', JSON.stringify(u));
    setUser(u); setDone(loadUserState(u.id));
  };
  const handleLogout = () => {
    localStorage.removeItem('hwr_session'); setUser(null); setDone({});
  };
  const markDone = useCallback((sectionId: SectionId) => {
    if (!user) return;
    setDone(prev => { const next = { ...prev, [sectionId]: true }; saveUserState(user.id, next); return next; });
  }, [user]);

  const pct = calcProgress(done);
  const allDone = pct === 100;

  const sectionProps: { sectionId: SectionId; num: number; icon: string; title: string; content: ReactNode }[] = [
    { sectionId:'welcome',   num:1, icon:'🌸', title:'환영합니다',                  content:<WelcomeContent /> },
    { sectionId:'checklist', num:2, icon:'📋', title:'출근 전 준비물 체크리스트',    content:<ChecklistContent uid={user?.id ?? ''} /> },
    { sectionId:'firstday',  num:3, icon:'🗓️', title:'첫날 오면 바로 하는 일',       content:<FirstDayContent /> },
    { sectionId:'attitude',  num:4, icon:'💛', title:'어르신 응대 태도 & 근무 수칙', content:<AttitudeContent /> },
    { sectionId:'hygiene',   num:5, icon:'🛡️', title:'감염예방 & 낙상예방 수칙',     content:<HygieneContent /> },
    { sectionId:'emergency', num:6, icon:'🚨', title:'응급상황 보고 절차',           content:<EmergencyContent /> },
    { sectionId:'faq',       num:7, icon:'💬', title:'자주 묻는 질문',              content:<FAQContent /> },
    { sectionId:'confirm',   num:8, icon:'✅', title:'모든 내용을 확인했습니다',     content:<ConfirmContent done={allDone} /> },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      {!user ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <div className="app-wrap">
          <header className="header" role="banner">
            <div className="header-left">
              <span className="header-facility">행복한요양원 녹양역점</span>
              <span className="header-title">신규 직원 온보딩</span>
            </div>
            <div className="header-right">
              <button
                className={`btn-toggle${allOpen ? ' active' : ''}`}
                onClick={() => setAllOpen(o => !o)}
                aria-label={allOpen ? '모두 닫기' : '모두 열기'}
              >
                {allOpen ? '🔼 모두 닫기' : '🔽 모두 열기'}
              </button>
              <button className="btn-sage" onClick={() => window.print()} aria-label="인쇄하기">🖨️ 인쇄</button>
              <button className="btn-outline" onClick={handleLogout} aria-label="로그아웃">로그아웃</button>
            </div>
          </header>

          <section className="welcome-banner" aria-label="환영 메시지">
            <div className="welcome-name">{user.name} {user.role}님, 환영합니다! 🎉</div>
            <div className="welcome-sub">2026년 4월 1일 첫 출근을 진심으로 응원합니다.<br />아래 내용을 차례로 읽고 체크해 주세요.</div>
          </section>

          <section className="progress-section" aria-label="온보딩 진행률">
            <div className="progress-row">
              <span className="progress-label">📊 온보딩 진행률</span>
              <span className="progress-pct">{pct}%</span>
            </div>
            <div className="progress-bar-wrap" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-bar-fill" style={{ width:`${pct}%` }} />
            </div>
            {allDone && <div className="badge-complete" role="status">🏅 온보딩 완료! 첫 출근을 응원합니다, {user.name}님!</div>}
          </section>

          <section className="summary-section" aria-label="오늘 꼭 확인할 것">
            <div className="section-heading">📌 오늘 꼭 확인할 것</div>
            <div className="summary-grid">
              <div className="summary-card"><span className="icon">📦</span><div className="card-title">준비물 챙기기</div><div className="card-body">신분증, 통장 사본, 실내화, 필기구를 꼭 가져오세요.</div></div>
              <div className="summary-card"><span className="icon">🕘</span><div className="card-title">08:50까지 입실</div><div className="card-body">정문 체온 체크 후 출근부에 서명해 주세요.</div></div>
              <div className="summary-card"><span className="icon">🙋</span><div className="card-title">팀장에게 인사</div><div className="card-body">도착 즉시 팀장(선임)에게 인사하고 안내를 받으세요.</div></div>
            </div>
          </section>

          <div className="print-section">
            <button className="btn-print" onClick={() => window.print()} aria-label="온보딩 내용 인쇄">🖨️ 인쇄하기</button>
            <span className="print-note">버튼을 누르면 A4 용지에 맞게 출력됩니다.<br />종이 안내문으로도 활용하실 수 있습니다.</span>
          </div>

          <main className="sections-wrap" aria-label="온보딩 내용">
            {sectionProps.map(s => (
              <Accordion key={s.sectionId} sectionId={s.sectionId} num={s.num} icon={s.icon} title={s.title} done={!!done[s.sectionId]} onDone={markDone} forceOpen={allOpen}>
                {s.content}
              </Accordion>
            ))}
          </main>
        </div>
      )}
    </>
  );
}