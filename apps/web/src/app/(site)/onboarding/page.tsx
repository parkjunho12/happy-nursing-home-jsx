'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';

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

  .app-wrap{max-width:800px;margin:0 auto;padding:0 0 80px}
  .header{background:var(--paper);border-bottom:2px solid var(--border);padding:16px 20px;position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 2px 10px rgba(100,70,30,0.08)}
  .header-left{display:flex;flex-direction:column}
  .header-facility{font-size:0.78rem;color:var(--text-soft);font-weight:500;letter-spacing:-0.01em}
  .header-title{font-size:1.1rem;font-weight:700;color:var(--primary);letter-spacing:-0.03em}
  .header-right{display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap}
  .btn-sage{border:2px solid var(--sage);background:var(--sage);border-radius:var(--r-sm);padding:9px 16px;font-size:0.92rem;font-weight:700;color:#fff;transition:all 0.18s;white-space:nowrap}
  .btn-sage:hover{background:#6a8e6e;border-color:#6a8e6e}
  .btn-warm{border:2px solid var(--primary);background:var(--primary-l);border-radius:var(--r-sm);padding:9px 16px;font-size:0.92rem;font-weight:700;color:var(--primary-d);transition:all 0.18s;white-space:nowrap}
  .btn-warm:hover{background:var(--primary);color:#fff}

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
  .print-sign{display:none}

  @media print {
    .header,.progress-section .progress-bar-wrap,.print-section,
    .accordion-head .accordion-arrow,.done-btn,.btn-sage,.btn-print,.btn-warm{display:none !important}
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
    html{font-size:16px}
    .header{flex-wrap:wrap;padding:12px 16px;gap:8px}
    .header-left{flex:1;min-width:0}
    .header-right{width:100%;justify-content:flex-end;gap:6px}
    .btn-sage,.btn-warm{padding:8px 12px;font-size:0.84rem}
    .welcome-banner{padding:20px 16px 24px}
    .welcome-name{font-size:1.3rem}
    .welcome-sub{font-size:0.9rem}
    .progress-section{padding:16px}
    .progress-pct{font-size:1.2rem}
    .badge-complete{font-size:0.92rem;padding:12px 14px}
    .summary-section{padding:16px 14px 8px}
    .summary-grid{grid-template-columns:1fr}
    .summary-card{padding:14px;display:flex;align-items:center;gap:12px}
    .summary-card .icon{font-size:1.8rem;margin-bottom:0;flex-shrink:0}
    .summary-card .card-title{font-size:0.96rem;margin-bottom:2px}
    .summary-card .card-body{font-size:0.84rem}
    .print-section{padding:12px 14px}
    .btn-print{padding:12px 16px;font-size:0.92rem}
    .sections-wrap{padding:6px 12px 20px;gap:10px}
    .accordion-head{padding:14px;gap:10px}
    .accordion-icon{font-size:1.5rem}
    .accordion-name{font-size:1rem}
    .accordion-num{font-size:0.72rem}
    .accordion-badge{padding:3px 10px;font-size:0.72rem}
    .accordion-body{padding:16px 14px 14px}
    .content-text{font-size:0.95rem}
    .content-h3{font-size:1rem}
    .check-item label{font-size:0.93rem}
    .highlight-box,.warn-box,.sage-box{padding:14px;font-size:0.93rem}
    .done-btn{padding:16px;font-size:1rem}
    .contact-grid{grid-template-columns:1fr}
  }
  @media(max-width:360px){
    html{font-size:15px}
    .accordion-badge{display:none}
    .btn-sage,.btn-warm{padding:7px 10px;font-size:0.8rem}
  }
`;

/* ===== localStorage 유틸 (고정 키 사용) ===== */
const LS_SECTIONS = 'hwr_sections';
const LS_CHECKLIST = 'hwr_checklist';

function loadDone(): DoneMap {
  try { return JSON.parse(localStorage.getItem(LS_SECTIONS) ?? '{}'); } catch { return {}; }
}
function saveDone(state: DoneMap) {
  localStorage.setItem(LS_SECTIONS, JSON.stringify(state));
}
function loadChecks(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_CHECKLIST) ?? '{}'); } catch { return {}; }
}
function saveChecks(state: Record<string, boolean>) {
  localStorage.setItem(LS_CHECKLIST, JSON.stringify(state));
}

/* ===== 타입 ===== */
const SECTION_IDS = ['welcome','checklist','firstday','attitude','hygiene','emergency','faq','confirm'] as const;
type SectionId = typeof SECTION_IDS[number];
type DoneMap = Partial<Record<SectionId, boolean>>;
type OpenMap = Partial<Record<SectionId, boolean>>;

function calcProgress(done: DoneMap) {
  return Math.round(SECTION_IDS.filter(s => done[s]).length / SECTION_IDS.length * 100);
}

/* ===== 아코디언 ===== */
function Accordion({ sectionId, num, icon, title, done, onDone, children, isOpen, onToggle }:
  { sectionId: SectionId; num: number; icon: string; title: string; done: boolean;
    onDone: (id: SectionId) => void; children: ReactNode; isOpen: boolean; onToggle: (id: SectionId) => void }) {
  return (
    <div className={`accordion${done ? ' done' : ''}`}>
      <div className="accordion-head" onClick={() => onToggle(sectionId)} role="button" aria-expanded={isOpen} tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(sectionId); } }}>
        <span className="accordion-icon" aria-hidden="true">{icon}</span>
        <div className="accordion-texts">
          <div className="accordion-num">STEP {num}</div>
          <div className="accordion-name">{title}</div>
        </div>
        <span className={`accordion-badge${done ? '' : ' pending'}`}>{done ? '✅ 완료' : '확인 필요'}</span>
        <span className={`accordion-arrow${isOpen ? ' open' : ''}`} aria-hidden="true">▼</span>
      </div>
      {isOpen && (
        <div className="accordion-body">
          {children}
          <button className={`done-btn${done ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); if (!done) onDone(sectionId); }} disabled={done}
            aria-label={done ? '이미 완료된 항목입니다' : '이 항목 읽음 확인'}>
            {done ? '✅ 확인 완료' : '👍 이 내용을 읽었습니다'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ===== 섹션 콘텐츠 ===== */
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

function ChecklistContent() {
  const [checks, setChecks] = useState<Record<string,boolean>>(() => loadChecks());
  const items = [
    { id:'c1', text:'통장사본 준비' },
    { id:'c2', text:'신분증 사본 준비' },
    { id:'c3', text:'건강검진 결과서 준비 (검진일/판정일/발행일 모두 1년 이내)' },
    { id:'c4', text:'등본 준비' },
    { id:'c5', text:'가족관계증명서 준비' },
    { id:'c6', text:'요양보호사 자격증 사본 준비' },
    { id:'c7', text:'자격득실확인서 준비 (건강보험공단)' },
    { id:'c8', text:'실내화 준비' },
  ];
  const toggle = (id: string) => {
    const n = { ...checks, [id]: !checks[id] };
    setChecks(n); saveChecks(n);
  };
  return (
    <>
      <div className="highlight-box">
        <b>📢 입사 안내</b><br />
        행복한요양원 녹양역점입니다.<br />
        <b>입사일: 2026년 4월 1일</b><br />
        함께 어르신을 섬기게 되어 진심으로 반갑습니다 😊
      </div>
      <h3 className="content-h3">📄 제출 서류 안내</h3>
      <ul className="check-list">
        {items.map(it => (
          <li key={it.id} className={`check-item${checks[it.id] ? ' checked' : ''}`}>
            <input type="checkbox" id={it.id} checked={!!checks[it.id]} onChange={() => toggle(it.id)} />
            <label htmlFor={it.id}>{it.text}</label>
          </li>
        ))}
      </ul>
      <div className="sage-box">
        📌 <b>서류 복사는 요양원에서 가능</b><br />
        원본만 가져오시면 사무실에서 복사 도와드립니다.
      </div>
      <div className="highlight-box">
        <b>🩺 건강검진 서류 안내 (중요)</b><br />
        건강검진 서류는 <b>국민건강보험공단 일반건강검진 수준 이상</b>이면 됩니다.<br /><br />
        📌 <b>아래 날짜 모두 1년 이내여야 인정됩니다.</b><br />
        - 검진일<br />
        - 판정일<br />
        - 발행일
      </div>
      <div className="sage-box">
        <b>✅ 건강검진 결과서 확인 항목</b><br />
        아래 5개 영역이 확인되면 됩니다.<br /><br />
        1. 계측검사<br />
        2. 요검사<br />
        3. 혈액검사<br />
        4. 영상검사 (흉부 X-ray)<br />
        5. 판정 확인
      </div>
      <div className="warn-box">
        <b>⚠️ 가장 중요한 확인 사항</b><br />
        건강검진 결과서의 <b>검진일 / 판정일 / 발행일</b> 중<br />
        하나라도 <b>1년 초과 시 인정되지 않을 수 있습니다.</b><br /><br />
        👉 반드시 날짜를 확인 후 가져오세요.<br />
        👉 헷갈리면 <b>국가건강검진 결과서</b>를 가져오시면 가장 확실합니다.
      </div>
      <div className="highlight-box">
        👟 <b>실내화 꼭 준비해주세요</b><br />
        편한 신발, 미끄럼 방지 기능이 있는 실내화를 권장합니다.
      </div>
      <div className="sage-box">
        📞 궁금한 사항은 언제든지 전화 주세요.<br />
        처음이라 어려운 것은 당연합니다. 편하게 문의하세요 😊
      </div>
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
      <div className="sage-box"><b>💡 당일 꼭 기억하세요</b><br />• 모르면 반드시 여쭤보세요. 혼자 판단하지 마세요.<br />• 첫날은 보조 역할입니다. 관찰하고 배우는 것이 우선입니다.<br />• 어르신 이름은 천천히 외워도 됩니다. 급하게 하지 않아도 됩니다.</div>
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
          '침상 사이드레일 올리기 (취침·낮잠 시)','휠체어 이동 전 잠금 확인',
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
      <div className="sage-box" style={{ marginTop:'12px', fontSize:'0.88rem' }}>※ 실제 연락처는 첫날 팀장에게 다시 확인하세요.</div>
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
    { q:'보호자가 민원을 제기하면 어떻게 하나요?', a:'본인이 직접 대응하지 말고, "담당자에게 연결해 드리겠다"고 안내 후 팀장이나 담당자에게 알립니다.' },
    { q:'야간 근무도 있나요?', a:'교대제로 운영되며, 야간 근무 일정은 입사 후 팀장과 조율합니다.' },
    { q:'실수를 했을 때는 어떻게 하나요?', a:'숨기지 말고 즉시 팀장에게 알리세요. 빨리 알릴수록 대처가 쉽습니다. 어르신 안전이 우선입니다.' },
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
        ✅ 환영 인사 및 온보딩 안내 확인<br />
        ✅ 입사 서류 및 준비물 확인<br />
        ✅ 첫날 일정 숙지<br />
        ✅ 어르신 응대 태도 및 금지사항 확인<br />
        ✅ 감염예방 및 낙상예방 수칙 확인<br />
        ✅ 응급상황 보고 절차 숙지<br />
        ✅ 자주 묻는 질문 확인
      </div>
      {done && <div className="badge-complete">🎉 온보딩을 모두 완료하셨습니다! 첫 출근을 응원합니다.</div>}
      <div className="print-sign">
        <p style={{ marginTop:'8pt' }}>본인은 행복한요양원 녹양역점 신규 직원 온보딩 내용을 모두 확인하였습니다.</p>
        <p style={{ marginTop:'16pt' }}>확인일: ___년 ___월 ___일 &nbsp;&nbsp;&nbsp; 성명: _______________ (서명: _______________)</p>
      </div>
    </>
  );
}

/* ===== 메인 Page ===== */
export default function OnboardingPage() {
  const [done, setDone] = useState<DoneMap>({});
  const [openSections, setOpenSections] = useState<OpenMap>({});

  // 클라이언트에서만 localStorage 접근
  useEffect(() => {
    setDone(loadDone());
  }, []);

  const markDone = useCallback((sectionId: SectionId) => {
    setDone(prev => {
      const next = { ...prev, [sectionId]: true };
      saveDone(next);
      return next;
    });
  }, []);

  const toggleSection = useCallback((sectionId: SectionId) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }, []);

  const toggleAllSections = useCallback(() => {
    const allOpen = SECTION_IDS.every(id => openSections[id]);
    if (allOpen) {
      setOpenSections({});
    } else {
      const next: OpenMap = {};
      SECTION_IDS.forEach(id => { next[id] = true; });
      setOpenSections(next);
    }
  }, [openSections]);

  const pct = calcProgress(done);
  const allDone = pct === 100;
  const allSectionsOpen = SECTION_IDS.every(id => openSections[id]);

  const sectionProps: { sectionId: SectionId; num: number; icon: string; title: string; content: ReactNode }[] = [
    { sectionId:'welcome',   num:1, icon:'🌸', title:'환영합니다',               content:<WelcomeContent /> },
    { sectionId:'checklist', num:2, icon:'📋', title:'입사 서류 및 준비물 안내', content:<ChecklistContent /> },
    { sectionId:'firstday',  num:3, icon:'🗓️', title:'첫날 오면 바로 하는 일',   content:<FirstDayContent /> },
    { sectionId:'attitude',  num:4, icon:'💛', title:'어르신 응대 태도 & 근무 수칙', content:<AttitudeContent /> },
    { sectionId:'hygiene',   num:5, icon:'🛡️', title:'감염예방 & 낙상예방 수칙', content:<HygieneContent /> },
    { sectionId:'emergency', num:6, icon:'🚨', title:'응급상황 보고 절차',        content:<EmergencyContent /> },
    { sectionId:'faq',       num:7, icon:'💬', title:'자주 묻는 질문',           content:<FAQContent /> },
    { sectionId:'confirm',   num:8, icon:'✅', title:'모든 내용을 확인했습니다',  content:<ConfirmContent done={allDone} /> },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <div className="app-wrap">

        {/* 헤더 */}
        <header className="header" role="banner">
          <div className="header-left">
            <span className="header-facility">행복한요양원 녹양역점</span>
            <span className="header-title">신규 직원 온보딩</span>
          </div>
          <div className="header-right">
            <button className="btn-warm" onClick={toggleAllSections}
              aria-label={allSectionsOpen ? '전체 닫기' : '모두 열기'}>
              {allSectionsOpen ? '📂 전체 닫기' : '📖 모두 열기'}
            </button>
            <button className="btn-sage" onClick={() => window.print()} aria-label="인쇄하기">🖨️ 인쇄</button>
          </div>
        </header>

        {/* 환영 배너 */}
        <section className="welcome-banner" aria-label="환영 메시지">
          <div className="welcome-name">신규 직원분, 환영합니다! 🎉</div>
          <div className="welcome-sub">2026년 4월 1일 첫 출근을 진심으로 응원합니다.<br />아래 내용을 차례로 읽고 체크해 주세요.</div>
        </section>

        {/* 진행률 */}
        <section className="progress-section" aria-label="온보딩 진행률">
          <div className="progress-row">
            <span className="progress-label">📊 온보딩 진행률</span>
            <span className="progress-pct">{pct}%</span>
          </div>
          <div className="progress-bar-wrap" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-bar-fill" style={{ width:`${pct}%` }} />
          </div>
          {allDone && <div className="badge-complete" role="status">🏅 온보딩 완료! 첫 출근을 응원합니다!</div>}
        </section>

        {/* 요약 카드 */}
        <section className="summary-section" aria-label="오늘 꼭 확인할 것">
          <div className="section-heading">📌 오늘 꼭 확인할 것</div>
          <div className="summary-grid">
            <div className="summary-card"><span className="icon">📦</span><div className="card-title">입사 서류 준비</div><div className="card-body">신분증, 통장사본, 건강검진 결과서, 자격증 사본, 실내화를 꼭 준비해 주세요.</div></div>
            <div className="summary-card"><span className="icon">🕘</span><div className="card-title">08:50까지 입실</div><div className="card-body">정문 체온 체크 후 출근부에 서명해 주세요.</div></div>
          </div>
        </section>

        {/* 인쇄 버튼 */}
        <div className="print-section">
          <button className="btn-print" onClick={() => window.print()} aria-label="온보딩 내용 인쇄">🖨️ 인쇄하기</button>
          <span className="print-note">버튼을 누르면 A4 용지에 맞게 출력됩니다.<br />종이 안내문으로도 활용하실 수 있습니다.</span>
        </div>

        {/* 온보딩 섹션 */}
        <main className="sections-wrap" aria-label="온보딩 내용">
          {sectionProps.map(s => (
            <Accordion key={s.sectionId} sectionId={s.sectionId} num={s.num} icon={s.icon} title={s.title}
              done={!!done[s.sectionId]} onDone={markDone}
              isOpen={!!openSections[s.sectionId]} onToggle={toggleSection}>
              {s.content}
            </Accordion>
          ))}
        </main>

      </div>
    </>
  );
}