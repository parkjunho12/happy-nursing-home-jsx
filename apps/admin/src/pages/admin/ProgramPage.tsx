import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarRange, Clock3, Download, Eye, EyeOff, History, Loader2, MessageCircle, Pencil, Plus, Printer, Radio, Save, Trash2, Upload, Users, X } from 'lucide-react'
import { programAPI, type ProgramMonthData, type ProgramEntry, type ProgramTime,
  type ProgramPhoto } from '@/api/programClient'
import { broadcastAPI, mediaUrl,
  type ProgramCastConfig, type ProgramCastItem } from '@/api/broadcastClient'
import { useAuthStore } from '@/store/auth'
import { evalResidentsAPI } from '@/api/evalClient'
import GroupEditor from '@/components/program/GroupEditor'
import { isKakaoShareEnabled, shareText } from '@/lib/kakaoShare'

/**
 * 프로그램 관리 — 엑셀로 만들던 월간 프로그램표를 그대로 올려 화면·보호자앱으로.
 *
 * 흐름: 일정표 엑셀 업로드 → 달력 미리보기 확인 → 게시(보호자앱 노출).
 * 분류표(그룹별 명단)는 내부용 — 어르신 개인화("오늘 우리 어머니 프로그램")의 근거.
 */
const GROUP_CLS: Record<string, string> = {
  인지: 'bg-violet-50 text-violet-700 border-violet-200',
  여가: 'bg-sky-50 text-sky-700 border-sky-200',
  신체: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}
const groupCls = (g: string | null) => {
  if (!g) return 'bg-gray-50 text-gray-600 border-gray-200'
  for (const k of Object.keys(GROUP_CLS)) if (g.startsWith(k)) return GROUP_CLS[k]
  return 'bg-amber-50 text-amber-700 border-amber-200'   // 종교·자원봉사 등
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

export default function ProgramPage() {
  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [data, setData] = useState<ProgramMonthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'sch' | null>(null)
  const [tab, setTab] = useState<'schedule' | 'groups' | 'photos'>('schedule')
  // 프로그램 안내방송 — 오늘 프로그램을 골라 TTS 로 내보낸다
  const [castOpen, setCastOpen] = useState(false)
  // 방송 권한은 방송 관리 페이지와 같은 기준이다 — 여기서만 열어주면 눌러도 403 이 난다
  const castUser = useAuthStore(s => s.user)
  const canCast = castUser?.role === 'ADMIN' || ['시설장', '사회복지사'].includes(castUser?.position ?? '')
  const [notesEdit, setNotesEdit] = useState<string | null>(null)   // 편집 중 텍스트(줄 단위)
  const [memoEdit, setMemoEdit] = useState<string | null>(null)     // 보호자 안내 메모 편집
  // 진행 시간 목록('10:00~10:40') — 일자 수정 드롭다운에 쓰인다
  const [times, setTimes] = useState<ProgramTime[]>([])
  const [residents, setResidents] = useState<any[]>([])   // 수급자 등록 기준 분류의 원천
  // 그룹·종교를 이 화면에서 바로 고칠 수 있게 — 기본은 접어 둔다.
  // 늘 펼쳐 두면 보러 온 사람이 잘못 누를 수 있고, 이 탭은 보는 일이 더 많다.
  const [grpEdit, setGrpEdit] = useState(false)
  // 이 화면은 '외부담당'도 메뉴 권한이 있으면 볼 수 있다. 보는 것과 고치는 것은
  // 다르다 — 어르신 기록을 고치는 것은 수급자 관리를 쓰는 안쪽 직원까지만.
  const canEditGroups = castUser?.role === 'ADMIN'
    || ['사회복지사', '시설장', '대표', '이사'].includes(castUser?.position ?? '')
  const [timesOpen, setTimesOpen] = useState(false)
  const [timesDraft, setTimesDraft] = useState<ProgramTime[]>([])
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newCats, setNewCats] = useState<Set<string>>(new Set())   // 복수 선택 — 하나씩 기본 시간으로 등록
  /** 프로그램 분류 — 여기 한 곳에서만 정한다.
   *  같은 목록이 네 군데에 흩어져 있었고, 하나만 고치면 조용히 갈라졌다.
   *  (백엔드 programs.py 의 TIME_CATS 와도 같아야 한다 — 다르면 그 분류로
   *   저장한 시간이 서버에서 소리 없이 버려진다) */
  const CATS = ['인지', '여가', '신체', '맞춤형'] as const
  const catOf = (name?: string | null) => CATS.find(c => (name ?? '').startsWith(c)) ?? null
  // 그룹명(인지A…)에 맞는 기본 시간
  const defaultTimeFor = (group: string | null): string | null => {
    const cat = catOf(group)
    if (!cat) return null
    return times.find(t => t.category === cat)?.time ?? null
  }
  const CAT_BADGE: Record<string, string> = {
    인지: 'bg-violet-100 text-violet-700', 여가: 'bg-sky-100 text-sky-700', 신체: 'bg-emerald-100 text-emerald-700',
    맞춤형: 'bg-amber-100 text-amber-800',
  }
  // 업로드 월 선택 — 엑셀 하단 탭(26.8월, 26.7월…) 중 어느 달을 가져올지
  const [pendFile, setPendFile] = useState<File | null>(null)
  // 오늘 프로그램 카톡 공유
  const [shareOpen, setShareOpen] = useState(false)
  const [shareData, setShareData] = useState<ProgramMonthData | null>(null)   // 이번 달(오늘 기준) 일정
  const [sharePick, setSharePick] = useState<number>(-1)
  const [shareMsg, setShareMsg] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  // 그룹 분류 수정 — 층별 텍스트(이름 띄어쓰기 구분)
  const [availMonths, setAvailMonths] = useState<string[]>([])
  const [pickMonths, setPickMonths] = useState<Set<string>>(new Set())
  const schRef = useRef<HTMLInputElement>(null)
  // 일자별 수정 모달 — 모달은 화면에만 반영(draft), 상단 「저장」으로 한꺼번에 서버 저장
  const [editDay, setEditDay] = useState<{ day: number; entries: ProgramEntry[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<string, ProgramEntry[]>>({})   // day → entries
  // 엑셀 업로드 미리보기 — 「저장」을 눌러야 서버에 반영된다
  const [upPreview, setUpPreview] = useState<Record<string, { days: Record<string, ProgramEntry[]>; notes: string[] }>>({})
  const upPreviewRef = useRef(upPreview)
  upPreviewRef.current = upPreview
  const [commitFile, setCommitFile] = useState<File | null>(null)
  const dirty = Object.keys(draft).length > 0 || Object.keys(upPreview).length > 0
  const dayEntries = (day: number): ProgramEntry[] =>
    draft[String(day)] ?? upPreview[ym]?.days[String(day)] ?? data?.days[String(day)] ?? []
  // 변경 이력
  const [histOpen, setHistOpen] = useState(false)
  const [grpLogsOpen, setGrpLogsOpen] = useState(false)
  const [grpLogs, setGrpLogs] = useState<Awaited<ReturnType<typeof programAPI.groupLogs>> | null>(null)
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof programAPI.logs>> | null>(null)

  const applyDay = () => {   // 모달 → draft (서버 저장은 상단 「저장」에서)
    if (!editDay) return
    setDraft(p => ({ ...p, [String(editDay.day)]: editDay.entries }))
    setEditDay(null)
  }
  const saveAll = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      // 1) 업로드 미리보기 → 실제 저장
      const months = Object.keys(upPreview).sort()
      if (months.length > 0 && commitFile) {
        for (const mm of months) await programAPI.uploadSchedule(commitFile, mm)
      }
      // 2) 일자별 수정 → 저장
      for (const [d, entries] of Object.entries(draft)) {
        await programAPI.editDay(ym, Number(d), entries)
      }
      setDraft({}); setUpPreview({}); upPreviewRef.current = {}; setCommitFile(null)
      load()
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
    finally { setSaving(false) }
  }
  // ── 오늘 프로그램 공유 ──
  const GROUP_KEY: Record<string, string> = { 인지: 'group_cognitive', 여가: 'group_leisure', 신체: 'group_physical' }
  const rosterOf = (group: string | null) => {
    if (!group) return [] as { floor: string; names: string[] }[]
    const cat = catOf(group)
    const grade = cat ? group.slice(cat.length).trim() : ''
    if (!cat || !grade) return []
    const key = GROUP_KEY[cat]
    const mem = residents.filter(r0 => r0.status === 'active' && r0[key] === grade)
    const byFloor = new Map<string, string[]>()
    mem.forEach(r0 => { const f = r0.floor || '층 미지정'; byFloor.set(f, [...(byFloor.get(f) ?? []), r0.name]) })
    return [...byFloor.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([floor, names]) => ({ floor, names: names.sort((a, b) => a.localeCompare(b, 'ko')) }))
  }
  // 내부/외부 구분 — 인지 C·여가 C 그룹과 ♥(자체) 프로그램은 내부, 나머지는 외부 강사
  const sourceOf = (e: ProgramEntry) => {
    if (e.kind === '자체') return '내부'
    const g = (e.group ?? '').replace(/\s/g, '')
    if (g === '인지C' || g === '여가C') return '내부'
    return '외부'
  }
  const shareTemplate = (e: ProgramEntry) => {
    const head = e.group ? `${e.group}그룹 프로그램 입니다` : '오늘의 프로그램 입니다'
    const em = emojiFor(e)
    return [
      `${em}[${sourceOf(e)}] ${head}${em}`,
      `ㅇ 시간/장소 : ${e.time ?? e.slot}`,
      `ㅇ 활동명 : ${e.title || e.group || ''}`,
      '아래 명단에 있는 어르신은 반드시 참여 부탁드립니다',
    ].join('\n')
  }
  const openShare = async () => {
    const now2 = new Date()
    const thisYm = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`
    setShareOpen(true); setSharePick(-1); setShareMsg('')
    const d = thisYm === ym ? data : await programAPI.schedule(thisYm).catch(() => null)
    setShareData(d)
  }
  const todayEntries2 = (): ProgramEntry[] => shareData?.days?.[String(new Date().getDate())] ?? []
  // 범용 명단 이미지 — 프로그램 그룹·종교 공용
  const drawNamesImage = (title: string, subtitle: string, accent: string,
                          roster: { floor: string; names: string[] }[]): Promise<Blob> => {
    const W = 800; const pad = 44
    const cv = document.createElement('canvas')
    const g = cv.getContext('2d')!
    const nameFont = 'bold 34px "Pretendard", "Apple SD Gothic Neo", sans-serif'
    // 줄 계산
    const lines: { kind: 'floor' | 'names'; text: string }[] = []
    g.font = nameFont
    for (const fl of roster) {
      lines.push({ kind: 'floor', text: fl.floor })
      let cur = ''
      for (const n of fl.names) {
        const t = cur ? `${cur}   ${n}` : n
        if (g.measureText(t).width > W - pad * 2 - 20) { lines.push({ kind: 'names', text: cur }); cur = n }
        else cur = t
      }
      if (cur) lines.push({ kind: 'names', text: cur })
    }
    const H = 210 + lines.reduce((a, l) => a + (l.kind === 'floor' ? 62 : 52), 0) + 70
    cv.width = W; cv.height = H
    // 배경·헤더
    g.fillStyle = 'white'; g.fillRect(0, 0, W, H)
    g.fillStyle = accent; g.fillRect(0, 0, W, 130)
    g.fillStyle = 'white'
    g.font = 'bold 44px "Pretendard", "Apple SD Gothic Neo", sans-serif'
    g.fillText(title, pad, 82)
    g.fillStyle = '#374151'
    g.font = '600 30px "Pretendard", "Apple SD Gothic Neo", sans-serif'
    g.fillText(subtitle, pad, 180)
    let y2 = 240
    for (const l of lines) {
      if (l.kind === 'floor') {
        g.fillStyle = accent
        g.font = 'bold 28px "Pretendard", "Apple SD Gothic Neo", sans-serif'
        g.fillText(`▪ ${l.text}`, pad, y2); y2 += 52
      } else {
        g.fillStyle = '#111827'; g.font = nameFont
        g.fillText(l.text, pad + 16, y2); y2 += 52
      }
      if (l.kind === 'floor') y2 += 10
    }
    g.fillStyle = '#9ca3af'; g.font = '500 22px "Pretendard", "Apple SD Gothic Neo", sans-serif'
    g.fillText('행복한요양원 — 명단에 계신 어르신은 꼭 참여 부탁드립니다', pad, H - 34)
    return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('이미지 생성 실패')), 'image/png'))
  }
  const doShareText = async () => {
    try { await shareText(shareMsg) }
    catch (e2: any) { alert(e2?.message ?? '카카오 공유를 열 수 없습니다. 모바일 카카오톡에서 시도해주세요.') }
  }
  const downloadBlob = (blob: Blob, filename: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 3000)
  }
  const ACCENT: Record<string, string> = { 인지: '#7c3aed', 여가: '#0284c7', 신체: '#059669', 맞춤형: '#b45309' }
  const CAT_EMOJI: Record<string, string> = { 인지: '🧩', 여가: '🎨', 신체: '💪', 맞춤형: '🎯' }
  const emojiFor = (e: ProgramEntry) => {
    if (e.kind === '교육') return '📖'
    const cat = catOf(e.group)
    return (cat && CAT_EMOJI[cat]) || '🌸'
  }
  const downloadProgramRoster = async (e: ProgramEntry) => {
    const roster = rosterOf(e.group)
    if (roster.length === 0) { alert('이 그룹의 어르신 명단이 없습니다 — 수급자 관리에서 그룹을 지정해주세요.'); return }
    const cat = catOf(e.group)
    const now3 = new Date()
    setShareBusy(true)
    try {
      const blob = await drawNamesImage(
        `${emojiFor(e)} ${e.group ? e.group + '그룹' : '오늘의 프로그램'} 참여 명단`,
        `${now3.getMonth() + 1}월 ${now3.getDate()}일 · ${e.title || ''}${e.time ? ` · ${e.time}` : ''}`,
        (cat && ACCENT[cat]) || '#0284c7', roster)
      downloadBlob(blob, `${e.group ?? '오늘프로그램'}_명단_${now3.getMonth() + 1}월${now3.getDate()}일.png`)
    } finally { setShareBusy(false) }
  }
  const downloadGroupRoster = async (title: string, accent: string, roster: { floor: string; names: string[] }[]) => {
    if (roster.length === 0) return
    const blob = await drawNamesImage(title, `총 ${roster.reduce((a, f) => a + f.names.length, 0)}명 · ${new Date().toLocaleDateString('ko-KR')} 기준`, accent, roster)
    downloadBlob(blob, `${title.replace(/[🌸✝️📿🪷⭕🕊️🔖\s]/g, '')}.png`)
  }

  const openHist = async () => {
    setHistOpen(true); setLogs(null)
    try { setLogs(await programAPI.logs(ym)) } catch { setLogs([]) }
  }
  const openGrpLogs = async () => {
    setGrpLogsOpen(true); setGrpLogs(null)
    try { setGrpLogs(await programAPI.groupLogs()) } catch { setGrpLogs([]) }
  }

  /** 편집 표에서 한 칸 바뀌었을 때 — 목록을 다시 부르지 않고 그 분만 고친다.
   *  다시 부르면 표가 잠깐 비었다가 다시 그려져, 연달아 누르던 손을 놓치게 된다. */
  const patchResident = (id: string, patch: Record<string, string>) =>
    setResidents(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))

  const load = () => {
    setLoading(true)
    Promise.all([
      programAPI.schedule(ym).catch(() => null),
      programAPI.times().catch(() => [] as ProgramTime[]),
      evalResidentsAPI.list().catch(() => []),
    ]).then(([s, t, rs]) => {
      const pv = upPreviewRef.current[ym]
      setData(pv ? { month: ym, days: pv.days, notes: pv.notes, published: s?.published ?? false } : s)
      setTimes(t); setResidents(rs)
    }).finally(() => setLoading(false))
  }
  useEffect(load, [ym])

  const move = (d: number) => {
    if (Object.keys(draft).length > 0 && !confirm('저장하지 않은 일자 수정이 있습니다. 버리고 이동할까요?')) return
    setDraft({})
    const [y, m] = ym.split('-').map(Number)
    const nd = new Date(y, m - 1 + d, 1)
    setYm(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`)
  }

  const onSchedule = async (f: File | null) => {
    if (!f) return
    setBusy('sch')
    try {
      const months = await programAPI.peekSchedule(f)
      setPendFile(f)
      setAvailMonths(months)
      // 기본 선택: 지금 보고 있는 달이 엑셀에 있으면 그 달, 없으면 최신 시트
      setPickMonths(new Set([months.includes(ym) ? ym : months[0]]))
    } catch (e: any) { alert(e?.response?.data?.detail ?? '엑셀을 읽지 못했습니다') }
    finally { setBusy(null) }
  }
  const doImport = async () => {
    if (!pendFile || pickMonths.size === 0) return
    setBusy('sch')
    const done: string[] = []
    try {
      const pv: typeof upPreview = { ...upPreview }
      for (const mm of [...pickMonths].sort()) {
        const r = await programAPI.uploadSchedule(pendFile, mm, true)   // 미리보기 — 저장 안 함
        pv[r.month] = { days: r.days ?? {}, notes: r.notes ?? [] }
        done.push(`${Number(r.month.slice(5, 7))}월 ${r.day_count}일치`)
      }
      setUpPreview(pv); upPreviewRef.current = pv
      setCommitFile(pendFile)
      const last = [...pickMonths].sort().pop()!
      setPendFile(null); setYm(last)
      const first = pv[last]
      setData({ month: last, days: first.days, notes: first.notes, published: false })
      alert(`화면에 불러왔습니다 — ${done.join(', ')}.\n내용 확인 후 상단 「저장」을 눌러야 실제로 반영됩니다.`)
    } catch (e: any) { alert(e?.response?.data?.detail ?? '업로드 실패') }
    finally { setBusy(null) }
  }

  const togglePublish = async () => {
    if (!data) return
    const next = !data.published
    if (next && !confirm(`${Number(ym.slice(5, 7))}월 프로그램표를 게시할까요?\n보호자앱에서 볼 수 있게 됩니다.`)) return
    try { await programAPI.publish(ym, next); load() }
    catch (e: any) { alert(e?.response?.data?.detail ?? '처리 실패') }
  }

  // 달력 그리드
  const [y, m] = ym.split('-').map(Number)
  const total = new Date(y, m, 0).getDate()
  const firstDow = new Date(y, m - 1, 1).getDay()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <input ref={schRef} type="file" accept=".xlsx" className="hidden" onChange={e => { onSchedule(e.target.files?.[0] ?? null); e.target.value = '' }} />

      <div className="flex items-center gap-2 flex-wrap mb-1">
        <CalendarRange size={20} className="text-violet-600" />
        <h1 className="text-xl font-bold text-gray-900">프로그램 관리</h1>
        {data && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${data.published ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {data.published ? '게시 중 — 보호자앱 노출' : '비공개 (초안)'}
          </span>
        )}
        {upPreview[ym] && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 animate-pulse">
            저장 전 미리보기 — 「저장」을 눌러야 반영
          </span>
        )}
        <div className="ml-auto flex gap-1.5">
          {tab === 'schedule' && isKakaoShareEnabled() && (
            <button onClick={openShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FEE500] hover:brightness-95 text-[#3A1D1D] text-sm font-bold">
              <MessageCircle size={13} /> 오늘 프로그램 공유
            </button>
          )}
          <button onClick={() => schRef.current?.click()} disabled={busy === 'sch'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50">
            {busy === 'sch' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} 일정표 엑셀 업로드
          </button>
          {tab === 'schedule' && (
            <button onClick={saveAll} disabled={!dirty || saving}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold ${dirty ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'border border-gray-200 text-gray-300'}`}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 저장{(() => {
                const parts: string[] = []
                const um = Object.keys(upPreview).length
                if (um) parts.push(`업로드 ${um}개월`)
                if (Object.keys(draft).length) parts.push(`${Object.keys(draft).length}일`)
                return parts.length ? ` (${parts.join(' + ')})` : ''
              })()}
            </button>
          )}
          {tab === 'schedule' && (
            <button onClick={() => { setTimesDraft(times); setNewStart(''); setNewEnd(''); setNewCats(new Set()); setTimesOpen(true) }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50">
              <Clock3 size={13} /> 시간 관리
            </button>
          )}
          {tab === 'schedule' && data && (
            <button onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50">
              <Printer size={13} /> 출력
            </button>
          )}
          {/* 프로그램표가 없어도 문구를 직접 적어 방송할 수 있으므로 탭과 무관하게 보인다 */}
          {canCast && (
          <button onClick={() => setCastOpen(true)}
            title="오늘 프로그램을 음성 안내로 방송합니다"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100">
            <Radio size={13} /> 방송
          </button>
          )}
          <button onClick={tab === 'groups' ? openGrpLogs : openHist}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50">
            <History size={13} /> 이력
          </button>
          {data && (
            <button onClick={togglePublish}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold ${data.published ? 'border border-gray-200 text-gray-500 hover:bg-gray-50' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
              {data.published ? <><EyeOff size={13} /> 게시 내리기</> : <><Eye size={13} /> 게시</>}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        쓰시던 엑셀 그대로 올리면 됩니다 — 최근 월 시트를 자동으로 읽습니다 · 게시해야 보호자앱에 보여요
      </p>

      {/* 탭 — 일정표(게시 대상) / 그룹 분류(내부용) */}
      <div className="flex gap-1.5 mb-3">
        {([['schedule', '월간 일정표'], ['groups', '그룹 분류 (내부용)'], ['photos', '프로그램 사진 (내부용)']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${tab === v ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      <style>{`@media print {
        @page { size: A4 landscape; margin: 7mm; }
        body * { visibility: hidden; }
        #pg-sheet, #pg-sheet * { visibility: visible; }
        #pg-sheet { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
        #pg-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }`}</style>

      {tab === 'schedule' && <div>
      {/* 월 이동 */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button onClick={() => move(-1)} className="p-2 rounded-xl border border-gray-200 text-gray-500 print:hidden">‹</button>
        <span className="text-base font-bold text-gray-800">{y}년 {m}월</span>
        <button onClick={() => move(1)} className="p-2 rounded-xl border border-gray-200 text-gray-500 print:hidden">›</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="text-sm">{m}월 일정표가 아직 없습니다 — 「일정표 엑셀 업로드」로 시작하세요.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DOW.map((d, i) => (
              <div key={d} className={`py-2 text-center text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => (
              <div key={i}
                onClick={day !== null ? () => setEditDay({ day, entries: dayEntries(day).map(e => ({ ...e })) }) : undefined}
                title={day !== null ? '클릭해서 이날 프로그램 수정' : undefined}
                className={`min-h-[92px] border-b border-r border-gray-50 p-1.5 ${day === null ? 'bg-gray-50/50' : 'cursor-pointer hover:bg-violet-50/40'}`}>
                {day !== null && (
                  <>
                    <p className={`text-[11px] font-bold mb-1 ${i % 7 === 0 ? 'text-red-500' : i % 7 === 6 ? 'text-blue-500' : 'text-gray-600'}`}>{day}</p>
                    <div className="space-y-0.5">
                      {dayEntries(day).filter(e => e.kind !== '교육').map((e: ProgramEntry, j: number) => (
                        <div key={j} className={`text-[10px] leading-tight px-1 py-0.5 rounded border ${groupCls(e.group)}`}>
                          {e.time && <b className="mr-0.5">{e.time}</b>}{e.group && <b>[{e.group}]</b>} {e.title}
                          {e.kind === '자체' && <span className="text-red-500 font-bold"> ♥</span>}
                        </div>
                      ))}
                      {dayEntries(day).filter(e => e.kind === '교육').map((e: ProgramEntry, j: number) => (
                        <div key={`edu${j}`} className="text-[10px] leading-tight px-1 py-0.5 rounded border bg-pink-50 text-pink-700 border-pink-200 font-semibold">
                          {e.time && <b className="mr-0.5">{e.time}</b>}📖 {e.title}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────── 인쇄 전용 시트 (화면에는 안 보임) ───────── */}
      {data && (() => {
        const weeks: (number | null)[][] = []
        const all = [...cells]
        while (all.length % 7 !== 0) all.push(null)
        for (let i = 0; i < all.length; i += 7) weeks.push(all.slice(i, i + 7))
        const chipStyle = (g: string | null): React.CSSProperties => {
          if (!g) return { background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' }
          if (g.startsWith('인지')) return { background: '#f3e8ff', color: '#6d28d9', borderColor: '#e9d5ff' }
          if (g.startsWith('여가')) return { background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }
          if (g.startsWith('신체')) return { background: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' }
          return { background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }
        }
        return (
          <div id="pg-sheet" className="hidden bg-white" style={{ fontFamily: 'inherit' }}>
            {/* 머리글 */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '3px solid #7c3aed', paddingBottom: '6px', marginBottom: '8px' }}>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 800, color: '#7c3aed', letterSpacing: '0.2em', margin: 0 }}>행복한요양원 · 어르신과 함께하는 한 달</p>
                <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#1f2937', margin: '2px 0 0' }}>{y}년 {m}월 프로그램 계획표</h1>
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '9px', color: '#4b5563', alignItems: 'center' }}>
                <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: '#f3e8ff', border: '1px solid #d8b4fe', marginRight: 3, verticalAlign: 'middle' }} />인지</span>
                <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: '#e0f2fe', border: '1px solid #7dd3fc', marginRight: 3, verticalAlign: 'middle' }} />여가</span>
                <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: '#dcfce7', border: '1px solid #86efac', marginRight: 3, verticalAlign: 'middle' }} />신체</span>
                <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: '#fce7f3', border: '1px solid #f9a8d4', marginRight: 3, verticalAlign: 'middle' }} />의무교육</span>
                <span style={{ color: '#dc2626', fontWeight: 800 }}>♥ <span style={{ color: '#4b5563', fontWeight: 400 }}>자체 프로그램</span></span>
              </div>
            </div>
            {/* 달력 표 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {DOW.map((d, i) => (
                    <th key={d} style={{
                      padding: '4px 0', fontSize: '11px', fontWeight: 800, border: '1px solid #e5e7eb',
                      background: i === 0 ? '#fef2f2' : i === 6 ? '#eff6ff' : '#faf5ff',
                      color: i === 0 ? '#dc2626' : i === 6 ? '#2563eb' : '#6d28d9',
                    }}>{d}요일</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((wk, wi) => (
                  <tr key={wi}>
                    {wk.map((day, di) => (
                      <td key={di} style={{
                        border: '1px solid #e5e7eb', verticalAlign: 'top', padding: '3px 4px',
                        height: `${Math.max(24, Math.floor(150 / weeks.length))}mm`,
                        background: day === null ? '#fafafa' : 'white',
                      }}>
                        {day !== null && (
                          <>
                            <p style={{
                              fontSize: '13px', fontWeight: 900, margin: '0 0 3px',
                              color: di === 0 ? '#dc2626' : di === 6 ? '#2563eb' : '#374151',
                            }}>{day}</p>
                            {dayEntries(day).filter(e2 => e2.kind !== '교육').map((e2, j) => (
                              <div key={j} style={{
                                fontSize: '8.5px', lineHeight: 1.35, padding: '2px 4px', borderRadius: 4,
                                border: '1px solid', marginBottom: 2, ...chipStyle(e2.group),
                              }}>
                                {e2.time && <b style={{ marginRight: 2 }}>{e2.time}</b>}
                                {e2.group && <b>[{e2.group}]</b>} {e2.title}
                                {e2.kind === '자체' && <span style={{ color: '#dc2626', fontWeight: 800 }}> ♥</span>}
                              </div>
                            ))}
                            {dayEntries(day).filter(e2 => e2.kind === '교육').map((e2, j) => (
                              <div key={`e${j}`} style={{
                                fontSize: '8.5px', lineHeight: 1.35, padding: '2px 4px', borderRadius: 4,
                                border: '1px solid #f9a8d4', background: '#fce7f3', color: '#be185d',
                                fontWeight: 700, marginBottom: 2,
                              }}>
                                📖 {e2.title}
                              </div>
                            ))}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {/* 안내 푸터 */}
            {(data.notes ?? []).length > 0 && (
              <div style={{ marginTop: '6px', padding: '6px 10px', background: '#faf5ff', border: '1px solid #ede9fe', borderRadius: 8, columnCount: 2, columnGap: '18px' }}>
                {(data.notes ?? []).map((n, i2) => (
                  <p key={i2} style={{ fontSize: '8.5px', color: '#4b5563', margin: '0 0 2px', breakInside: 'avoid' }}>{n}</p>
                ))}
              </div>
            )}
            <p style={{ fontSize: '8px', color: '#9ca3af', textAlign: 'right', margin: '4px 2px 0' }}>
              ※ 프로그램은 요양원 사정·기후에 따라 변경될 수 있습니다 · 행복한요양원
            </p>
          </div>
        )
      })()}

      {data && (
        <p className="mt-2 text-[11px] text-gray-400 flex items-center gap-3">
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-pink-200 mr-1 align-middle" />분홍 = 의무교육</span>
          <span><span className="text-red-500 font-bold">♥</span> = 자체 프로그램 (외부강사 아님)</span>
        </p>
      )}

      {/* 보호자 안내 메모 — 보호자앱·공식 웹에 노출되는 건 이것뿐 */}
      {data && (
        <div className="mt-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-bold text-emerald-800">보호자 안내 메모</h2>
            <span className="text-[10px] font-bold text-emerald-600 bg-white border border-emerald-200 px-1.5 py-0.5 rounded-full">보호자앱 · 웹 노출</span>
            <button onClick={() => setMemoEdit((data as any).public_memo ?? '')}
              className="ml-auto text-[11px] font-semibold text-emerald-600 hover:underline print:hidden">수정</button>
          </div>
          {((data as any).public_memo ?? '').trim() === ''
            ? <p className="text-xs text-gray-400">아직 없음 — 보호자님께 보여드릴 안내를 적어주세요 (예: 이번 달 특별 프로그램, 준비물)</p>
            : <div className="space-y-0.5">{String((data as any).public_memo).split('\n').filter(Boolean).map((n, i) => (
                <p key={i} className="text-xs text-gray-700 leading-relaxed">{n}</p>
              ))}</div>}
        </div>
      )}

      {/* 운영 규칙 안내 — 내부 참고용, 외부 비노출 */}
      {data && (
        <div className="mt-3 bg-violet-50/50 border border-violet-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-bold text-violet-800">운영 규칙 안내</h2>
            <span className="text-[10px] font-bold text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full">내부용 — 보호자에게 안 보임</span>
            <button onClick={() => setNotesEdit((data.notes ?? []).join('\n'))}
              className="ml-auto text-[11px] font-semibold text-violet-500 hover:underline print:hidden">수정</button>
          </div>
          {(data.notes ?? []).length === 0
            ? <p className="text-xs text-gray-400">안내 없음 — 수정을 눌러 적을 수 있어요</p>
            : <ul className="space-y-0.5">{(data.notes ?? []).map((n, i) => (
                <li key={i} className="text-xs text-gray-600 leading-relaxed">{n}</li>
              ))}</ul>}
        </div>
      )}
      </div>}

      {shareOpen && (() => {
        const list = todayEntries2()
        const now4 = new Date()
        return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShareOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[88vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={15} className="text-[#3A1D1D]" />
              <h3 className="text-sm font-bold text-gray-800">오늘 프로그램 카톡 공유 <span className="font-normal text-gray-400">— {now4.getMonth() + 1}월 {now4.getDate()}일</span></h3>
              <button onClick={() => setShareOpen(false)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">오늘 등록된 프로그램이 없습니다.</p>
            ) : (
              <>
                <p className="text-[11px] text-gray-400 mb-2">공유할 프로그램을 고르세요.</p>
                <div className="space-y-1.5 mb-3">
                  {list.map((e, i) => (
                    <button key={i} type="button"
                      onClick={() => { setSharePick(i); setShareMsg(shareTemplate(e)) }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
                        sharePick === i ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${groupCls(e.group)}`}>{e.slot}</span>
                      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${sourceOf(e) === '내부' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-sky-50 text-sky-700 border border-sky-200'}`}>{sourceOf(e)}</span>
                      {e.group && <b>[{e.group}]</b>} {e.title}
                      {e.time && <span className="ml-auto text-xs text-gray-400">{e.time}</span>}
                    </button>
                  ))}
                </div>
                {sharePick >= 0 && (
                  <>
                    <p className="text-[11px] font-bold text-gray-500 mb-1">보낼 내용 <span className="font-normal text-gray-400">— 고쳐도 됩니다</span></p>
                    <textarea value={shareMsg} onChange={e => setShareMsg(e.target.value)} rows={5}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl leading-relaxed mb-2" />
                    {(() => {
                      const roster = rosterOf(list[sharePick]?.group ?? null)
                      const n = roster.reduce((a, f) => a + f.names.length, 0)
                      return roster.length > 0 ? (
                        <div className="mb-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                          <p className="text-[11px] font-bold text-gray-500 mb-1">함께 보낼 명단 사진 미리보기 <span className="font-normal text-gray-400">{n}명</span></p>
                          {roster.map(f => (
                            <p key={f.floor} className="text-[11px] text-gray-600"><b>{f.floor}</b> {f.names.join(' · ')}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="mb-3 text-[11px] text-amber-600">이 그룹의 어르신 명단이 없습니다 — 수급자 관리에서 그룹을 지정하면 명단 사진도 함께 보낼 수 있어요.</p>
                      )
                    })()}
                    <div className="flex gap-1.5">
                      <button onClick={doShareText}
                        className="flex-1 py-2.5 rounded-xl bg-[#FEE500] text-[#3A1D1D] text-sm font-bold hover:brightness-95 inline-flex items-center justify-center gap-1.5">
                        <MessageCircle size={14} /> 카톡으로 글 공유
                      </button>
                      <button onClick={() => downloadProgramRoster(list[sharePick])}
                        disabled={shareBusy || rosterOf(list[sharePick]?.group ?? null).length === 0}
                        className="flex-1 py-2.5 rounded-xl border-2 border-gray-700 text-gray-800 text-sm font-bold disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
                        {shareBusy ? <Loader2 size={14} className="animate-spin" /> : <><Download size={14} /> 명단 사진 저장</>}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-gray-400">저장한 명단 사진은 카톡방에 직접 첨부해서 올려주세요</p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        )
      })()}

      {pendFile && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPendFile(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Upload size={15} className="text-violet-500" />
              <h3 className="text-sm font-bold text-gray-800">어느 달을 가져올까요?</h3>
              <button onClick={() => setPendFile(null)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">엑셀 하단 탭에서 찾은 달입니다 — 여러 달을 한 번에 가져올 수 있어요. 이미 있는 달은 덮어씁니다.</p>
            <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto mb-3">
              {availMonths.map(mm => {
                const on = pickMonths.has(mm)
                return (
                  <button key={mm} type="button"
                    onClick={() => setPickMonths(p => { const n = new Set(p); if (n.has(mm)) n.delete(mm); else n.add(mm); return n })}
                    className={`px-2 py-2 rounded-xl text-sm font-bold border ${on ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                    {mm.slice(2, 4)}년 {Number(mm.slice(5, 7))}월
                  </button>
                )
              })}
            </div>
            <button onClick={doImport} disabled={pickMonths.size === 0 || busy === 'sch'}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50">
              {busy === 'sch' ? <Loader2 size={14} className="animate-spin mx-auto" /> : `${pickMonths.size}개 달 가져오기`}
            </button>
          </div>
        </div>
      )}

      {timesOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setTimesOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Clock3 size={15} className="text-violet-500" />
              <h3 className="text-sm font-bold text-gray-800">프로그램 진행 시간 관리</h3>
              <button onClick={() => setTimesOpen(false)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              분류를 고르고 추가하면 그 그룹의 <b>기본 시간</b>이 됩니다(여러 개 고르면 한 번에 등록). 아무것도 안 고르면 일반 시간으로 목록에만 나옵니다. 시간은 몇 개든 추가할 수 있어요.
            </p>
            <ul className="space-y-1 mb-3">
              {timesDraft.map((t, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/50">
                  <span className="text-sm font-semibold text-gray-700">{t.time}</span>
                  {t.category && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CAT_BADGE[t.category] ?? 'bg-gray-100 text-gray-500'}`}>{t.category} 기본</span>}
                  <button onClick={() => setTimesDraft(p => p.filter((_, xi) => xi !== i))}
                    className="ml-auto text-gray-300 hover:text-red-500 p-1"><Trash2 size={13} /></button>
                </li>
              ))}
              {timesDraft.length === 0 && <li className="text-xs text-gray-300 text-center py-3">등록된 시간이 없습니다</li>}
            </ul>
            <div className="flex items-center gap-1.5 mb-2">
              <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)}
                className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-xl" />
              <span className="text-gray-400 text-sm">~</span>
              <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-xl" />
            </div>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {CATS.map(c => {
                const on = newCats.has(c)
                return (
                  <button key={c} type="button"
                    onClick={() => setNewCats(p => { const n = new Set(p); if (n.has(c)) n.delete(c); else n.add(c); return n })}
                    className={`py-1.5 rounded-xl text-xs font-bold border ${on ? `${CAT_BADGE[c]} border-transparent` : 'text-gray-400 border-gray-200'}`}>
                    {c}{on && ' ✓'}
                  </button>
                )
              })}
            </div>
            <div className="mb-3">
              <button type="button" disabled={!newStart || !newEnd}
                onClick={() => {
                  const t = `${newStart}~${newEnd}`
                  const cats: (string | null)[] = newCats.size === 0 ? [null] : [...newCats]
                  setTimesDraft(p => {
                    let next = [...p]
                    for (const c of cats) {
                      // 같은 (시간, 카테고리) 중복 제거 + 카테고리 기본 시간은 하나만
                      next = next.filter(x => !(x.time === t && (x.category ?? null) === c))
                      if (c) next = next.map(x => x.category === c ? { ...x, category: null } : x)
                      next.push({ time: t, category: c })
                    }
                    return next.sort((a, b) => a.time.localeCompare(b.time) || String(a.category ?? '').localeCompare(String(b.category ?? '')))
                  })
                  setNewStart(''); setNewEnd(''); setNewCats(new Set())
                }}
                className="w-full py-2 rounded-xl border border-violet-300 bg-violet-50 text-violet-700 text-sm font-bold hover:bg-violet-100 disabled:opacity-40">
                목록에 추가
              </button>
            </div>
            <button onClick={async () => {
              try { setTimes(await programAPI.saveTimes(timesDraft)); setTimesOpen(false) }
              catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
            }} className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold">저장</button>
          </div>
        </div>
      )}

      {tab === 'schedule' && memoEdit !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setMemoEdit(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800 mb-1">보호자 안내 메모</h3>
            <p className="text-[11px] text-gray-400 mb-2">보호자앱과 공식 웹 프로그램표 아래에 그대로 보입니다 — 내부 규칙은 적지 마세요.</p>
            <textarea value={memoEdit} onChange={e => setMemoEdit(e.target.value)} rows={8}
              placeholder={'예)\n이번 달에는 가을 소풍 프로그램이 있어요 🍂\n프로그램은 날씨에 따라 변경될 수 있습니다'}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl leading-relaxed" />
            <div className="flex gap-2 mt-3">
              <button onClick={async () => {
                try { await programAPI.editPublicMemo(ym, memoEdit); setMemoEdit(null); load() }
                catch (e2: any) { alert(e2?.response?.data?.detail ?? '저장 실패') }
              }} className="flex-1 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-bold">저장</button>
              <button onClick={() => setMemoEdit(null)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">취소</button>
            </div>
          </div>
        </div>
      )}
      {tab === 'schedule' && notesEdit !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setNotesEdit(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800 mb-2">운영 규칙 안내 수정 <span className="font-normal text-gray-400">— 한 줄에 하나씩</span></h3>
            <textarea value={notesEdit} onChange={e => setNotesEdit(e.target.value)} rows={12}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl leading-relaxed" />
            <button onClick={async () => {
              try { await programAPI.editNotes(ym, notesEdit.split('\n')); setNotesEdit(null); load() }
              catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
            }} className="mt-2 w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold">저장</button>
          </div>
        </div>
      )}

      {/* 일자별 수정 */}
      {editDay && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditDay(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-gray-800">{m}월 {editDay.day}일 프로그램 수정</h3>
              <button onClick={() => setEditDay(null)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            <div className="space-y-1.5">
              {editDay.entries.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <select value={e.slot}
                    onChange={ev => setEditDay(p => p && { ...p, entries: p.entries.map((x, xi) => xi === i ? { ...x, slot: ev.target.value as '오전' | '오후' } : x) })}
                    className="w-16 px-1.5 py-2 text-xs border border-gray-200 rounded-lg">
                    <option>오전</option><option>오후</option>
                  </select>
                  <select value={e.time ?? ''}
                    onChange={ev => setEditDay(p => p && { ...p, entries: p.entries.map((x, xi) => xi === i ? { ...x, time: ev.target.value || null } : x) })}
                    className="w-[7rem] px-1 py-2 text-xs border border-gray-200 rounded-lg" title="진행 시간 — 「시간 관리」에서 등록">
                    <option value="">시간 없음</option>
                    {(() => {
                      const m2 = new Map<string, string[]>()
                      times.forEach(t => { m2.set(t.time, [...(m2.get(t.time) ?? []), ...(t.category ? [t.category] : [])]) })
                      const opts = [...m2.entries()].map(([v, cats]) => ({ v, label: cats.length ? `${v} (${cats.join('·')})` : v }))
                      if (e.time && !m2.has(e.time)) opts.unshift({ v: e.time, label: e.time })
                      return opts.map(x2 => <option key={x2.v} value={x2.v}>{x2.label}</option>)
                    })()}
                  </select>
                  <input value={e.group ?? ''} placeholder="그룹"
                    list="pg-groups"
                    onChange={ev => setEditDay(p => p && { ...p, entries: p.entries.map((x, xi) => {
                      if (xi !== i) return x
                      const g = ev.target.value || null
                      // 그룹을 고르면 그 카테고리 기본 시간을 자동으로 — 이미 시간을 골랐다면 그대로 둔다
                      return { ...x, group: g, time: x.time || defaultTimeFor(g) }
                    }) })}
                    className="w-20 px-2 py-2 text-xs border border-gray-200 rounded-lg" />
                  <input value={e.title} placeholder="프로그램명"
                    onChange={ev => setEditDay(p => p && { ...p, entries: p.entries.map((x, xi) => xi === i ? { ...x, title: ev.target.value } : x) })}
                    className="flex-1 px-2 py-2 text-xs border border-gray-200 rounded-lg" />
                  <button type="button"
                    onClick={() => setEditDay(p => p && { ...p, entries: p.entries.map((x, xi) => xi === i ? { ...x, kind: x.kind === '교육' ? '자체' : x.kind === '자체' ? null : '교육' } : x) })}
                    className={`shrink-0 text-[10px] font-bold px-1.5 py-1.5 rounded-lg border ${
                      e.kind === '교육' ? 'bg-pink-50 text-pink-700 border-pink-300'
                      : e.kind === '자체' ? 'bg-red-50 text-red-600 border-red-200'
                      : 'text-gray-300 border-gray-200'}`}
                    title="누를 때마다 일반 → 교육 → 자체♥ 순환">
                    {e.kind === '자체' ? '자체♥' : '교육'}</button>
                  <button onClick={() => setEditDay(p => p && { ...p, entries: p.entries.filter((_, xi) => xi !== i) })}
                    className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={13} /></button>
                </div>
              ))}
              <datalist id="pg-groups">
                {['맞춤형', '인지A', '인지B', '인지C', '여가A', '여가B', '여가C', '신체A', '신체B', '신체C', '기독교', '천주교', '자원봉사', '사회적응'].map(g => <option key={g} value={g} />)}
              </datalist>
              <button onClick={() => setEditDay(p => p && { ...p, entries: [...p.entries, { slot: '오후', group: null, title: '' }] })}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 text-violet-700 text-sm font-bold hover:bg-violet-50">
                <Plus size={14} /> 프로그램 추가
              </button>
            </div>
            <button onClick={applyDay}
              className="mt-3 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold">
              적용 — 상단 「저장」을 눌러야 최종 저장됩니다
            </button>
          </div>
        </div>
      )}

      {/* 변경 이력 */}
      {histOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setHistOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <History size={15} className="text-gray-500" />
              <h2 className="text-sm font-bold text-gray-800">{m}월 프로그램 변경 이력</h2>
              <button onClick={() => setHistOpen(false)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            {logs === null ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={16} /></div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">이력이 없습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {logs.map(l => (
                  <li key={l.id} className="text-xs text-gray-600 border-b border-gray-50 pb-1.5">
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mr-1 ${
                      l.action === '수정' ? 'bg-violet-50 text-violet-700' : l.action === '업로드' ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>{l.action}{l.day ? ` ${Number(l.day)}일` : ''}</span>
                    {l.summary}
                    <span className="block text-[10px] text-gray-300">
                      {l.changed_by ?? ''} · {l.at ? new Date(l.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 분류(그룹·종교) 변경 이력 */}
      {grpLogsOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setGrpLogsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <History size={15} className="text-gray-500" />
              <h2 className="text-sm font-bold text-gray-800">그룹 · 종교 변경 이력</h2>
              <button onClick={() => setGrpLogsOpen(false)} className="ml-auto text-gray-300"><X size={16} /></button>
            </div>
            {grpLogs === null ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={16} /></div>
            ) : grpLogs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">이력이 없습니다 — 수급자 관리에서 그룹·종교를 바꾸면 여기에 남습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {grpLogs.map(l => {
                  const FIELD_CLS: Record<string, string> = {
                    인지: 'bg-violet-50 text-violet-700', 여가: 'bg-sky-50 text-sky-700',
                    신체: 'bg-emerald-50 text-emerald-700', 종교: 'bg-amber-50 text-amber-700',
                  }
                  const fmt = (v: string | null) => v ?? '미지정'
                  return (
                    <li key={l.id} className="text-xs text-gray-600 border-b border-gray-50 pb-1.5">
                      <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mr-1 ${FIELD_CLS[l.field] ?? 'bg-gray-100 text-gray-500'}`}>{l.field}</span>
                      <b>{l.resident_name}</b> — {fmt(l.before)} <span className="text-gray-300">→</span> <b>{fmt(l.after)}</b>
                      <span className="block text-[10px] text-gray-300">
                        {l.changed_by ?? ''} · {l.at ? new Date(l.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 그룹 분류 (내부용) */}
      {tab === 'photos' && (
        <ProgramPhotoTab ym={ym} onMove={move} days={data?.days ?? {}} draft={draft} />
      )}

      {tab === 'groups' && (() => {
        const act = residents.filter(r0 => r0.status === 'active')
        const CATS = [
          ['인지', 'group_cognitive', 'bg-violet-50 text-violet-700 border-violet-200'],
          ['여가', 'group_leisure', 'bg-sky-50 text-sky-700 border-sky-200'],
          ['신체', 'group_physical', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
        ] as const
        const byKo = (a: any, b: any) => String(a.name).localeCompare(String(b.name), 'ko')
        const floorLabel = (r0: any) => r0.floor || '층 미지정'
        const REL_META: Record<string, { emoji: string; cls: string }> = {
          기독교: { emoji: '✝️', cls: 'bg-sky-50 border-sky-200 text-sky-800' },
          천주교: { emoji: '📿', cls: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
          불교: { emoji: '🪷', cls: 'bg-orange-50 border-orange-200 text-orange-800' },
          원불교: { emoji: '⭕', cls: 'bg-stone-50 border-stone-200 text-stone-700' },
          무교: { emoji: '🕊️', cls: 'bg-gray-50 border-gray-200 text-gray-600' },
          기타: { emoji: '🔖', cls: 'bg-gray-50 border-gray-200 text-gray-600' },
        }
        const relMap = new Map<string, any[]>()
        act.forEach(r0 => { if (r0.religion) relMap.set(r0.religion, [...(relMap.get(r0.religion) ?? []), r0]) })
        const relOrder = ['기독교', '천주교', '불교', '원불교', '무교', '기타']
        const rels = [...relMap.entries()].sort((a, b) => {
          const ia = relOrder.indexOf(a[0]); const ib = relOrder.indexOf(b[0])
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        })
        const anyData = act.some(r0 => r0.religion || r0.group_cognitive || r0.group_leisure || r0.group_physical)
        return (
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Users size={15} className="text-teal-600" />
            <h2 className="text-sm font-bold text-gray-800">수급자 등록 기준 <span className="font-normal text-gray-400">— 수급자 관리에서 입력한 그룹·종교 (실시간)</span></h2>
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {CATS.map(([c, key, cls]) => (
                <span key={c} className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${cls}`}>
                  {c} {act.filter(r0 => r0[key]).length}명
                  <span className="font-semibold opacity-60"> / 미지정 {act.filter(r0 => !r0[key]).length}</span>
                </span>
              ))}
              {canEditGroups && <button onClick={() => setGrpEdit(o => !o)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${grpEdit ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-teal-200 text-teal-700 hover:bg-teal-50'}`}>
                <Pencil size={12} /> {grpEdit ? '바꾸기 닫기' : '그룹 · 종교 바꾸기'}
              </button>}
            </div>
          </div>
          {grpEdit && canEditGroups && <GroupEditor residents={residents} onSaved={patchResident} />}
          {!anyData ? (
            <p className="text-xs text-gray-400 text-center py-6">
              아직 입력된 데이터가 없습니다 — {canEditGroups
                ? '위 「그룹 · 종교 바꾸기」를 눌러 이 화면에서 바로 채우실 수 있습니다.'
                : '수급자 관리에서 어르신 수정을 열어 종교·그룹을 선택해주세요.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {CATS.map(([c, key, cls]) => (
                  <div key={c} className="space-y-1.5">
                    {['A', 'B', 'C'].map(gr => {
                      const mem = act.filter(r0 => r0[key] === gr).sort(byKo)
                      if (mem.length === 0) return null
                      const byFloor = new Map<string, any[]>()
                      mem.forEach(r0 => { const f = floorLabel(r0); byFloor.set(f, [...(byFloor.get(f) ?? []), r0]) })
                      const roster = [...byFloor.entries()].sort((a2, b2) => a2[0].localeCompare(b2[0]))
                        .map(([floor, ms]) => ({ floor, names: ms.map((r0: any) => r0.name) }))
                      return (
                        <div key={gr} className={`rounded-xl border p-2.5 ${cls}`}>
                          <div className="flex items-center mb-1">
                            <p className="text-xs font-extrabold">{c} {gr}그룹 <span className="font-semibold opacity-70">{mem.length}명</span></p>
                            <button onClick={() => downloadGroupRoster(`${({ 인지: '🧩', 여가: '🎨', 신체: '💪' } as Record<string, string>)[c] ?? '🌸'} ${c}${gr}그룹 어르신 명단`, ACCENT[c] ?? '#0284c7', roster)}
                              title="명단 사진으로 저장" className="ml-auto opacity-40 hover:opacity-100 p-0.5"><Download size={12} /></button>
                          </div>
                          {[...byFloor.keys()].sort().map(f => (
                            <div key={f} className="flex gap-1.5 items-start mb-0.5">
                              <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-white/70">{f}</span>
                              <p className="text-[11px] leading-relaxed flex-1">{byFloor.get(f)!.map(r0 => r0.name).join(' · ')}</p>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              {/* 종교 — 한눈에 들어오는 카드 */}
              {rels.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-gray-500 mb-1.5">종교 활동</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {rels.map(([name, mem]) => {
                      const meta = REL_META[name] ?? REL_META.기타
                      const byFl = new Map<string, string[]>()
                      ;[...mem].sort(byKo).forEach((r0: any) => { const f = r0.floor || '층 미지정'; byFl.set(f, [...(byFl.get(f) ?? []), r0.name]) })
                      const roster = [...byFl.entries()].sort((a2, b2) => a2[0].localeCompare(b2[0])).map(([floor, ns]) => ({ floor, names: ns }))
                      return (
                        <div key={name} className={`rounded-xl border p-2.5 ${meta.cls}`}>
                          <div className="flex items-center mb-1">
                            <p className="text-xs font-extrabold">
                              <span className="text-base mr-1 align-middle">{meta.emoji}</span>
                              {name} <span className="font-semibold opacity-70">{mem.length}명</span>
                            </p>
                            <button onClick={() => downloadGroupRoster(`${meta.emoji} ${name} 어르신 명단`, '#b45309', roster)}
                              title="명단 사진으로 저장" className="ml-auto opacity-40 hover:opacity-100 p-0.5"><Download size={12} /></button>
                          </div>
                          <p className="text-[11px] leading-relaxed">{[...mem].sort(byKo).map((r0: any) => r0.name).join(' · ')}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        )
      })()}

      {castOpen && (
        // 다른 달을 보고 있을 때 그 달 같은 날짜를 '오늘'로 내보내면 안 된다
        <ProgramCastModal
          entries={ym === curYm ? dayEntries(new Date().getDate()) : []}
          onClose={() => setCastOpen(false)} />
      )}
    </div>
  )
}


/* ── 프로그램 안내방송 ─────────────────────────────────────────
 * 오늘 프로그램을 골라 음성 안내로 내보낸다.
 * 어르신들이 생활하는 공간이라, 문구를 확인하고 미리 들어본 뒤에만
 * 스피커로 나가게 한다. 바로 방송되는 버튼은 한 번 더 묻는다.
 */
/** '13:30' → '오후 1시 30분'. 그대로 읽히면 '십삼시 삼십분'이 된다. */
function speakTime(hhmm?: string | null): string {
  const m = /^(\d{1,2})\s*[:시]\s*(\d{1,2})?/.exec((hhmm ?? '').split('~')[0].trim())
  if (!m) return ''
  const h = Number(m[1]), mi = Number(m[2] ?? 0)
  if (h > 23 || mi > 59) return ''
  const hh = h % 12 || 12
  return `${h < 12 ? '오전' : '오후'} ${hh}시${mi ? ` ${mi}분` : ''}`
}

/** 자동 예약과 같은 말투를 쓴다 — 서버 program_broadcast.DEFAULT_TEMPLATE 와 맞춘 것.
 *  어르신이 아니라 모셔가는 선생님께 하는 안내다. */
function announceText(e: ProgramEntry): string {
  const t = speakTime(e.time)
  const when = t ? `${t}부터 ` : ''
  const what = e.title || e.group || '프로그램'
  const who = e.group ? `${e.group} 그룹 어르신들을` : '어르신들을'
  return `안내 말씀드립니다. 잠시 후 ${when}${what} 프로그램이 시작됩니다. `
       + `담당 선생님들께서는 ${who} 프로그램실로 모셔 주시기 바랍니다. 감사합니다.`
}

function ProgramCastModal({ entries, onClose }: {
  entries: ProgramEntry[]; onClose: () => void
}) {
  const [mode, setMode] = useState<'now' | 'auto'>('now')
  const [picked, setPicked] = useState<number | null>(entries.length ? 0 : null)
  const [text, setText] = useState(entries.length ? announceText(entries[0]) : '')
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState<'preview' | 'cast' | null>(null)
  const [err, setErr] = useState('')

  const pick = (i: number) => {
    setPicked(i); setText(announceText(entries[i])); setPreview(null); setErr('')
  }

  const makePreview = async () => {
    if (!text.trim()) { setErr('문구를 입력해주세요.'); return }
    setBusy('preview'); setErr('')
    try {
      const r = await broadcastAPI.announce({
        title: '프로그램 안내', text, preview_only: true })
      setPreview(r.url)
    } catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '음성 생성 실패') }
    finally { setBusy(null) }
  }

  const cast = async () => {
    if (!text.trim()) { setErr('문구를 입력해주세요.'); return }
    if (!confirm('건물 전체 스피커로 지금 방송합니다.\n\n' + text)) return
    setBusy('cast'); setErr('')
    try {
      await broadcastAPI.announce({ title: '프로그램 안내', text })
      alert('방송을 요청했습니다. (방송 PC가 온라인일 때 나갑니다)')
      onClose()
    } catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '방송 실패') }
    finally { setBusy(null) }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-5"
        onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Radio size={18} className="text-indigo-600" />
          <h3 className="font-bold text-gray-900">프로그램 안내방송</h3>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-500"><X size={18} /></button>
        </div>

        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
          {([['now', '지금 방송'], ['auto', '자동 예약']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                mode === k ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'auto' ? <ProgramAutoCast /> : <>

        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            오늘 등록된 프로그램이 없습니다.<br />
            <span className="text-xs">아래에 문구를 직접 적어 방송할 수 있어요.</span>
          </p>
        ) : (
          <div className="space-y-1.5 mb-4">
            <p className="text-xs font-semibold text-gray-500">오늘 프로그램</p>
            {entries.map((e, i) => (
              <button key={i} onClick={() => pick(i)}
                className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                  picked === i ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                {e.time && <b className="mr-1.5 text-indigo-700">{e.time}</b>}
                {e.group && <span className="text-xs font-bold text-gray-500 mr-1">[{e.group}]</span>}
                {e.title}
              </button>
            ))}
          </div>
        )}

        <label className="block text-xs font-semibold text-gray-600 mb-1.5">방송 문구 (고칠 수 있어요)</label>
        <textarea value={text} onChange={ev => { setText(ev.target.value); setPreview(null) }} rows={4}
          placeholder="예) 안내 말씀드립니다. 잠시 후 오전 10시부터 색칠공부 프로그램이 시작됩니다."
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />

        {preview && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-[11px] font-bold text-gray-500 mb-1.5">
              미리듣기 — <span className="font-normal">이 PC에서만 들립니다 (스피커로 안 나감)</span>
            </p>
            <audio controls autoPlay src={mediaUrl(preview)} className="w-full h-9" />
          </div>
        )}

        {err && <p className="text-xs text-rose-600 mt-2">{err}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={makePreview} disabled={busy !== null}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            {busy === 'preview' && <Loader2 size={14} className="animate-spin" />} 미리듣기
          </button>
          <button onClick={cast} disabled={busy !== null}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            {busy === 'cast' && <Loader2 size={14} className="animate-spin" />} 스피커로 방송
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2 text-center">
          어르신들이 계신 공간입니다 — 미리듣기로 확인한 뒤 내보내세요.
        </p>
        </>}
      </div>
    </div>
  )
}


/* ── 프로그램 시간표 자동 예약 ───────────────────────────────────
 * 시간이 적힌 프로그램마다 시작 몇 분 전에 안내방송이 자동으로 나가게 한다.
 * 사람 손 없이 스피커가 울리는 기능이라, 먼저 「이렇게 나갑니다」를 보여주고
 * 확인한 뒤 켜게 한다. 끄면 잡아둔 예약을 실제로 걷어낸다.
 */
function ProgramAutoCast() {
  const [cfg, setCfg] = useState<ProgramCastConfig | null>(null)
  const [items, setItems] = useState<ProgramCastItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const r = await broadcastAPI.programPlan(7)
      setCfg(r.config); setItems(r.items)
    } catch (e: any) { setErr(e?.message ?? '불러오지 못했습니다') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const save = async (patch: Partial<ProgramCastConfig>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    setSaving(true); setErr(''); setMsg('')
    try {
      const r = await broadcastAPI.programSave(patch)
      setCfg(r.config)
      const x = r.result
      setMsg(x?.enabled === false
        ? `자동 예약을 껐습니다. 잡아둔 ${x.removed}건을 취소했습니다.`
        : `예약 ${x?.created ?? 0}건 생성 · ${x?.updated ?? 0}건 수정 · ${x?.removed ?? 0}건 취소`)
      const p = await broadcastAPI.programPlan(7)
      setItems(p.items)
    } catch (e: any) { setErr(e?.response?.data?.detail ?? e?.message ?? '저장 실패') }
    finally { setSaving(false) }
  }

  if (loading || !cfg) return <p className="text-sm text-gray-400 text-center py-10">불러오는 중…</p>

  const live = items.filter(i => !i.skip)
  const byDate = live.reduce<Record<string, ProgramCastItem[]>>((a, i) => {
    (a[i.date] ??= []).push(i); return a
  }, {})

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-3 ${cfg.enabled
        ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {cfg.enabled ? '자동 예약 켜짐' : '자동 예약 꺼짐'}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {cfg.enabled
                ? `시간이 적힌 프로그램마다 ${cfg.lead_min}분 전에 안내방송이 나갑니다.`
                : '지금은 프로그램 시간에 아무 방송도 나가지 않습니다.'}
            </p>
          </div>
          <button disabled={saving}
            onClick={() => save({ enabled: !cfg.enabled }, cfg.enabled
              ? '자동 예약을 끕니다.\n잡아둔 안내방송 예약이 모두 취소됩니다.'
              : `자동 예약을 켭니다.\n\n앞으로 7일간 ${live.length}건의 안내방송이 스피커로 나갑니다.\n어르신들이 계신 공간입니다 — 아래 목록을 확인하셨나요?`)}
            className={`ml-auto shrink-0 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50 ${
              cfg.enabled ? 'border border-gray-200 bg-white text-gray-600'
                          : 'bg-indigo-600 text-white'}`}>
            {saving ? '…' : cfg.enabled ? '끄기' : '켜기'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">몇 분 전에</span>
          <select value={cfg.lead_min} disabled={saving}
            onChange={e => save({ lead_min: Number(e.target.value) })}
            className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 rounded-xl bg-white">
            {[0, 5, 10, 15, 20, 30, 40].map(v => <option key={v} value={v}>{v === 0 ? '정각' : `${v}분 전`}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-500">음량</span>
          <select value={cfg.volume} disabled={saving}
            onChange={e => save({ volume: Number(e.target.value) })}
            className="w-full mt-1 px-2.5 py-2 text-sm border border-gray-200 rounded-xl bg-white">
            {[30, 50, 70, 85, 100].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <p className="text-[11px] text-gray-400 -mt-2">
        {cfg.quiet_start}~{cfg.quiet_end} 안에서만 나갑니다. 이 시간대 밖 프로그램은 건너뜁니다.
        {cfg.exclude_kinds.length > 0 && ` ${cfg.exclude_kinds.join('·')}는 제외합니다.`}
      </p>

      {msg && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-xs font-bold text-gray-600">앞으로 7일 — 이렇게 나갑니다</p>
          <span className="text-[11px] text-gray-400">{live.length}건</span>
          <button onClick={load} className="ml-auto text-[11px] text-gray-400 hover:text-gray-600">새로고침</button>
        </div>
        {live.length === 0 ? (
          <p className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl py-6 text-center">
            나갈 안내방송이 없습니다.<br />
            프로그램표에 <b>시간</b>이 적혀 있어야 예약됩니다.
          </p>
        ) : (
          <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-56 overflow-y-auto">
            {Object.entries(byDate).map(([d, list]) => (
              <div key={d} className="px-3 py-2">
                <p className="text-[11px] font-bold text-gray-400 mb-1">
                  {new Date(d + 'T00:00:00').toLocaleDateString('ko-KR',
                    { month: 'long', day: 'numeric', weekday: 'short' })}
                </p>
                {list.map(i => (
                  <div key={i.source_key} className="flex gap-2 text-xs py-0.5">
                    <b className="text-indigo-700 shrink-0 w-11">{i.at.slice(11, 16)}</b>
                    <span className="text-gray-600 truncate" title={i.text}>
                      {i.titles.join(', ')}
                      <span className="text-gray-400"> · {i.program_time} 시작</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {items.some(i => i.skip) && (
          <p className="text-[11px] text-gray-400 mt-1.5">
            건너뛴 것 {items.filter(i => i.skip).length}건 — {
              Array.from(new Set(items.filter(i => i.skip).map(i => i.skip))).join(', ')}
          </p>
        )}
      </div>

      {live[0] && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-[11px] font-bold text-gray-500 mb-1">이런 문구로 나갑니다</p>
          <p className="text-xs text-gray-600 leading-relaxed">{live[0].text}</p>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center">
        프로그램표를 고치면 예약도 자동으로 다시 맞춰집니다.<br />
        만들어진 예약은 방송 관리 페이지에서 볼 수 있습니다.
      </p>
    </div>
  )
}


/* ── 프로그램 사진 ──────────────────────────────────────────────
 * 그날 그 프로그램을 찍은 사진을 올려 둔다. 파일은 R2 에 저장한다 —
 * 서버 디스크에 쌓이면 방송 음원·업로드와 같이 차올라 어느 날 저장이 멈춘다.
 *
 * 흐름: 한 달을 골라 사진을 한꺼번에 올리면, 사진에 박힌 찍은 시각(EXIF)으로
 * 날짜 폴더에 저절로 담긴다. 어느 프로그램인지는 그 다음에 붙인다.
 * 스무 장을 올리며 사람이 일일이 날짜를 고르는 것은 현실적이지 않다.
 */
function ProgramPhotoTab({ ym, onMove, days, draft }: {
  ym: string
  onMove: (delta: number) => void
  days: Record<string, ProgramEntry[]>
  draft: Record<string, ProgramEntry[]>
}) {
  const [rows, setRows] = useState<ProgramPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [openDay, setOpenDay] = useState<number | null>(null)
  // 고른 사진들 — 스무 장을 한 장씩 지우게 하지 않는다
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [zipping, setZipping] = useState<number | 'all' | null>(null)
  const [viewer, setViewer] = useState<ProgramPhoto | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [y, m] = ym.split('-').map(Number)

  const load = () => {
    setLoading(true)
    programAPI.photos(ym).then(setRows).catch(() => setRows([])).finally(() => setLoading(false))
  }
  useEffect(load, [ym])

  /** 그 달 프로그램 목록 — 사진에 붙일 후보 */
  const progsOf = (day: number) => {
    const all = { ...days, ...draft }
    return (all[String(day)] ?? []).filter(e => (e.title || '').trim())
  }

  const byDay = useMemo(() => {
    const m2 = new Map<number, ProgramPhoto[]>()
    rows.forEach(p => { (m2.get(p.day) ?? m2.set(p.day, []).get(p.day)!).push(p) })
    return [...m2.entries()].sort((a, b) => a[0] - b[0])
  }, [rows])

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setErr(''); setMsg('')
    try {
      // 날짜·프로그램을 비워 보낸다 — 서버가 찍은 시각으로 날짜를 정한다
      const r = await programAPI.uploadPhotos({ month: ym, files: Array.from(files) })
      if (r.failed.length) setErr(`올리지 못한 파일: ${r.failed.join(', ')}`)
      const ds = Array.from(new Set(r.uploaded.map(x => x.day))).sort((a, b) => a - b)
      if (r.uploaded.length) setMsg(`${r.uploaded.length}장을 ${ds.map(d => `${d}일`).join(', ')} 폴더에 담았습니다.`)
      load()
    } catch (e: any) { setErr(e?.response?.data?.detail ?? '업로드 실패') }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const patch = async (p: ProgramPhoto, b: { day?: number; title?: string; grp?: string }) => {
    try {
      const n = await programAPI.updatePhoto(p.id, b)
      setRows(prev => prev.map(x => x.id === p.id ? n : x))
      setViewer(v => v?.id === p.id ? n : v)
    } catch (e: any) { alert(e?.response?.data?.detail ?? '저장 실패') }
  }

  /** 지우기 — 한 장이든 여러 장이든 여기 하나로.
   *  저장소에서 정말 지워지므로 되돌릴 수 없다. 그래서 몇 장인지 밝히고 한 번만 묻는다. */
  const removeMany = async (ids: string[]) => {
    if (ids.length === 0) return
    if (!confirm(ids.length === 1
      ? '이 사진을 지울까요?\n저장소에서도 지워지며 되돌릴 수 없습니다.'
      : `고른 사진 ${ids.length}장을 지울까요?\n저장소에서도 지워지며 되돌릴 수 없습니다.`)) return
    setDeleting(true)
    try {
      await programAPI.deletePhotos(ids)
      const gone = new Set(ids)
      setRows(prev => prev.filter(x => !gone.has(x.id)))
      setSel(prev => { const n = new Set(prev); ids.forEach(i => n.delete(i)); return n })
      setViewer(v => (v && gone.has(v.id)) ? null : v)
      setMsg(`${ids.length}장을 지웠습니다.`)
    } catch (e: any) { setErr(e?.response?.data?.detail ?? '삭제 실패') }
    finally { setDeleting(false) }
  }

  /** 묶어서 내려받기 — 사진이 많으면 몇 초 걸린다. 무엇을 받는 중인지 표시한다. */
  const download = async (day?: number) => {
    setZipping(day ?? 'all'); setErr(''); setMsg('')
    try {
      const n = await programAPI.downloadPhotos(ym, day)
      setMsg(`${n}장을 내려받았습니다.`)
    } catch (e: any) { setErr('내려받기에 실패했습니다. 잠시 후 다시 시도해주세요.') }
    finally { setZipping(null) }
  }

  const thumb = (p: ProgramPhoto) => p.thumbnail_url || p.file_url
  const hm = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''
  const dow = (d: number) => ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
        onChange={e => onFiles(e.target.files)} />

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
        <p className="text-xs font-bold text-gray-700">내부용 — 보호자앱에는 보이지 않습니다</p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          일정표를 「게시」해도 이 사진들은 함께 나가지 않습니다.
          보호자에게 보여드릴 사진은 <b>보호자 앨범</b>에 올려주세요.
        </p>
      </div>

      {/* 월 이동 + 올리기 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
          <button onClick={() => onMove(-1)} className="px-2.5 py-2 hover:bg-gray-50 text-gray-500">‹</button>
          <span className="px-3 text-sm font-bold text-gray-800">{m}월</span>
          <button onClick={() => onMove(1)} className="px-2.5 py-2 hover:bg-gray-50 text-gray-500">›</button>
        </div>
        <span className="text-[11px] text-gray-400">{y}년 · 사진 {rows.length}장</span>
        {rows.length > 0 && (
          <button onClick={() => download()} disabled={zipping !== null}
            title={`${m}월 사진 ${rows.length}장 전부 받기`}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {zipping === 'all' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            이 달 전부 받기
          </button>
        )}
        <button disabled={busy} onClick={() => { setErr(''); setMsg(''); fileRef.current?.click() }}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50 ${rows.length ? '' : 'ml-auto'}`}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          사진 올리기
        </button>
      </div>
      <p className="text-[11px] text-gray-400 -mt-2">
        한 번에 20장까지 · 한 장 25MB까지. 사진에 찍힌 시각을 보고 <b>날짜 폴더</b>에 저절로 담깁니다.
        시각을 알 수 없으면 <b>올린 날</b>에 담깁니다 (지난달을 정리하는 중이면 1일).
        날짜가 틀렸으면 폴더를 열어 옮길 수 있어요.
      </p>

      {msg && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}
      {err && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{err}</p>}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-16">불러오는 중…</p>
      ) : byDay.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">
          {m}월에 올린 사진이 없습니다.<br />
          <span className="text-xs">사진을 올리면 찍은 날짜별로 담깁니다.</span>
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {byDay.map(([d, list]) => {
            const untagged = list.filter(p => !p.title).length
            return (
              <div key={d} className="group relative bg-white rounded-2xl border border-gray-100 hover:border-violet-300 transition-colors overflow-hidden">
              <div className="absolute top-1.5 right-1.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => download(d)} disabled={zipping !== null}
                  title={`${m}월 ${d}일 사진 ${list.length}장 한 번에 받기`}
                  className="p-1.5 rounded-lg bg-white/85 text-gray-400 hover:text-violet-600 disabled:opacity-40">
                  {zipping === d ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                </button>
                <button onClick={() => removeMany(list.map(p => p.id))} disabled={deleting}
                  title={`${m}월 ${d}일 사진 ${list.length}장 전부 지우기`}
                  className="p-1.5 rounded-lg bg-white/85 text-gray-400 hover:text-rose-600 disabled:opacity-40">
                  <Trash2 size={13} />
                </button>
              </div>
              <button onClick={() => { setSel(new Set()); setOpenDay(d) }}
                className="block w-full text-left">
                <div className="aspect-[4/3] bg-gray-50 grid grid-cols-2 gap-px">
                  {list.slice(0, 4).map(p => (
                    <img key={p.id} src={thumb(p)} alt="" loading="lazy"
                      className={`w-full h-full object-cover ${list.length === 1 ? 'col-span-2 row-span-2' : ''}`} />
                  ))}
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-bold text-gray-800">
                    {m}월 {d}일 <span className="text-gray-400 font-semibold">({dow(d)})</span>
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {list.length}장
                    {untagged > 0 && <span className="text-amber-600 font-bold"> · 프로그램 미지정 {untagged}</span>}
                  </p>
                </div>
              </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 날짜 폴더 열기 */}
      {openDay !== null && (() => {
      const dayRows = rows.filter(p => p.day === openDay)
      const picked = dayRows.filter(p => sel.has(p.id)).map(p => p.id)
      const allPicked = dayRows.length > 0 && picked.length === dayRows.length
      return (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpenDay(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-bold text-gray-900">{m}월 {openDay}일 ({dow(openDay)})</h3>
              <span className="text-xs text-gray-400">{dayRows.length}장</span>
              {dayRows.length > 0 && (
                <button onClick={() => download(openDay)} disabled={zipping !== null}
                  className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  {zipping === openDay ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                  전부 받기
                </button>
              )}
              <button onClick={() => setOpenDay(null)}
                className={`text-gray-300 hover:text-gray-500 ${dayRows.length > 0 ? '' : 'ml-auto'}`}>
                <X size={18} />
              </button>
            </div>

            {/* 고르기 막대 — 여러 장을 한 번에 지울 때 쓴다 */}
            {dayRows.length > 0 && (
              <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white z-10 py-1">
                <button onClick={() => setSel(allPicked ? new Set() : new Set(dayRows.map(p => p.id)))}
                  className="text-[11px] font-bold text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg border border-gray-200">
                  {allPicked ? '선택 해제' : '전체 선택'}
                </button>
                {picked.length > 0 && (
                  <>
                    <span className="text-[11px] font-bold text-violet-700">{picked.length}장 선택</span>
                    <button onClick={() => removeMany(picked)} disabled={deleting}
                      className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold disabled:opacity-50">
                      {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      선택 삭제
                    </button>
                  </>
                )}
                {picked.length === 0 && (
                  <span className="ml-auto text-[11px] text-gray-400">사진을 골라 한 번에 지울 수 있어요</span>
                )}
              </div>
            )}
            <div className="space-y-2">
              {dayRows.map(p => (
                <div key={p.id}
                  className={`group flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${
                    sel.has(p.id) ? 'border-violet-300 bg-violet-50/60' : 'border-gray-100'}`}>
                  <input type="checkbox" checked={sel.has(p.id)}
                    onChange={() => setSel(prev => {
                      const n = new Set(prev)
                      n.has(p.id) ? n.delete(p.id) : n.add(p.id)
                      return n
                    })}
                    className="shrink-0 w-4 h-4 accent-violet-600 cursor-pointer" />
                  <button onClick={() => setViewer(p)} className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-50">
                    {p.media_type === 'video'
                      ? <video src={p.file_url} className="w-full h-full object-cover" />
                      : <img src={thumb(p)} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 mb-1">
                      {p.taken_at ? `${hm(p.taken_at)} 촬영` : '촬영 시각 없음'}
                      {p.uploaded_by && ` · ${p.uploaded_by}`}
                    </p>
                    <select value={p.title ?? ''}
                      onChange={e => {
                        const t = e.target.value
                        const g = progsOf(openDay).find(x => (x.title || '').trim() === t)?.group ?? ''
                        patch(p, { title: t, grp: g })
                      }}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
                      <option value="">프로그램 지정 안 함</option>
                      {progsOf(openDay).map((e2, i) => (
                        <option key={i} value={(e2.title || '').trim()}>
                          {e2.time ? `${e2.time.split('~')[0]} ` : ''}{e2.title}{e2.group ? ` (${e2.group})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <select value={p.day}
                    onChange={e => patch(p, { day: Number(e.target.value) })}
                    title="다른 날로 옮기기"
                    className="shrink-0 px-1.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
                    {Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}일</option>
                    ))}
                  </select>
                  <button onClick={() => removeMany([p.id])} disabled={deleting}
                    title="이 사진 지우기"
                    className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {dayRows.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">이 날의 사진이 없습니다.</p>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-3 text-center">
              어느 프로그램인지 골라주세요. 날짜가 틀렸으면 오른쪽에서 옮길 수 있어요.
            </p>
          </div>
        </div>
      )})()}

      {viewer && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewer(null)}>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            {viewer.media_type === 'video'
              ? <video src={viewer.file_url} controls autoPlay className="w-full max-h-[75vh] rounded-xl" />
              : <img src={viewer.file_url} alt="" className="w-full max-h-[75vh] object-contain rounded-xl" />}
            <div className="flex items-center gap-2 mt-3 text-white">
              <p className="text-sm font-bold">
                {m}월 {viewer.day}일{viewer.title ? ` · ${viewer.title}` : ''}
              </p>
              {viewer.taken_at && <span className="text-xs text-white/50">{hm(viewer.taken_at)} 촬영</span>}
              <a href={viewer.file_url} target="_blank" rel="noreferrer"
                className="ml-auto text-xs font-bold text-white/70 hover:text-white">원본 열기</a>
              <button onClick={() => removeMany([viewer.id])} disabled={deleting}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold disabled:opacity-50">
                <Trash2 size={12} /> 삭제
              </button>
              <button onClick={() => setViewer(null)} className="text-white/60 hover:text-white">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
