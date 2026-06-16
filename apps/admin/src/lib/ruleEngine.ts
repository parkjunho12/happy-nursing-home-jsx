import type { Issue, SheetData } from '../types/audit'

let issueId = 0
const newId = () => String(++issueId)

// ── 키워드 탐색 헬퍼 ──────────────────────────────────────────────────────────
const DATE_PATTERN   = /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$|^\d{1,2}[-./]\d{1,2}$|^\d{1,2}일?$/
const BP_KEYWORDS    = ['혈압', 'BP', '수축기', '이완기']
const TEMP_KEYWORDS  = ['체온', '열', 'Temp', '온도']
const SERVICE_KEYS   = ['식사', '배설', '이동', '신체', '목욕', '산책', '외출', '구강', '투약', '체위']
const SIGN_KEYWORDS  = ['서명', '확인', '작성자', '제공자', '보호자']

function findColIndex(headers: string[], keywords: string[]): number {
  return headers.findIndex(h => keywords.some(k => h.includes(k)))
}

function parseBP(val: string): { sys: number; dia: number } | null {
  const m = val.match(/(\d+)\s*[-/]\s*(\d+)/)
  if (!m) return null
  return { sys: Number(m[1]), dia: Number(m[2]) }
}

function parseTemp(val: string): number | null {
  const m = val.match(/(\d{2,3}(?:\.\d)?)/)
  if (!m) return null
  const t = Number(m[1])
  return t > 30 && t < 45 ? t : null
}

// ── 날짜 규칙 ─────────────────────────────────────────────────────────────────
function checkDates(sheet: SheetData, issues: Issue[]) {
  const dateColIdx = sheet.headers.findIndex(h => DATE_PATTERN.test(h) || h.includes('날짜') || h.includes('일자') || h === '일')
  if (dateColIdx === -1) return

  const dateMap = new Map<string, number[]>()  // date → [rowIdxs]
  sheet.rows.slice(1).forEach((row, i) => {
    const val = String(row[dateColIdx] ?? '').trim()
    if (!val) {
      issues.push({ id: newId(), sheetName: sheet.name, row: i + 2, column: dateColIdx,
        category: '날짜', severity: '높음',
        originalValue: '',
        message: `${i + 2}행: 날짜가 비어 있습니다.`,
        suggestion: '해당 날짜를 입력하거나 해당 행의 제공 여부를 확인하세요.',
        status: '미확인' })
    } else if (DATE_PATTERN.test(val)) {
      const list = dateMap.get(val) ?? []
      list.push(i + 2)
      dateMap.set(val, list)
    }
  })

  dateMap.forEach((rows, date) => {
    if (rows.length > 1) {
      issues.push({ id: newId(), sheetName: sheet.name, row: rows[0], date,
        category: '날짜', severity: '중간',
        originalValue: date,
        message: `날짜 '${date}'가 ${rows.join(', ')}행에 중복 입력되었습니다.`,
        suggestion: '중복 날짜를 확인하고 올바른 날짜로 수정하세요.',
        status: '미확인' })
    }
  })
}

// ── 바이탈 규칙 ──────────────────────────────────────────────────────────────
function checkVitals(sheet: SheetData, issues: Issue[]) {
  const bpCol   = findColIndex(sheet.headers, BP_KEYWORDS)
  const tempCol = findColIndex(sheet.headers, TEMP_KEYWORDS)
  if (bpCol === -1 && tempCol === -1) return

  sheet.rows.slice(1).forEach((row, i) => {
    const rowNum = i + 2

    // 혈압
    if (bpCol !== -1) {
      const bpRaw = String(row[bpCol] ?? '').trim()
      if (!bpRaw) {
        issues.push({ id: newId(), sheetName: sheet.name, row: rowNum, column: bpCol,
          category: '바이탈', severity: '중간',
          originalValue: '',
          message: `${rowNum}행: 혈압이 비어 있습니다.`,
          suggestion: '혈압(수축기-이완기)을 입력하세요. 예: 120-80',
          status: '미확인' })
      } else if (bpRaw === '/') {
        issues.push({ id: newId(), sheetName: sheet.name, row: rowNum, column: bpCol,
          category: '바이탈', severity: '높음',
          originalValue: bpRaw,
          message: `${rowNum}행: 혈압 값이 '/'만 입력되어 있습니다.`,
          suggestion: '혈압 수치를 정확히 입력하세요. 예: 120-80',
          status: '미확인' })
      } else {
        const bp = parseBP(bpRaw)
        if (!bp) {
          issues.push({ id: newId(), sheetName: sheet.name, row: rowNum, column: bpCol,
            category: '바이탈', severity: '중간',
            originalValue: bpRaw,
            message: `${rowNum}행: 혈압 형식이 올바르지 않습니다. (입력값: ${bpRaw})`,
            suggestion: '수축기-이완기 형식으로 입력하세요. 예: 120-80',
            status: '미확인' })
        } else {
          if (bp.sys < 90 || bp.sys >= 160)
            issues.push({ id: newId(), sheetName: sheet.name, row: rowNum, column: bpCol,
              category: '바이탈', severity: bp.sys < 90 ? '높음' : '중간',
              originalValue: bpRaw,
              message: `${rowNum}행: 수축기 혈압 ${bp.sys}mmHg — ${bp.sys < 90 ? '저혈압(90 미만)' : '고혈압(160 이상)'} 범위입니다.`,
              suggestion: '촉탁의사 또는 간호사에게 보고하고 특이사항란에 기록하세요.',
              status: '미확인' })
          if (bp.dia < 60 || bp.dia >= 100)
            issues.push({ id: newId(), sheetName: sheet.name, row: rowNum, column: bpCol,
              category: '바이탈', severity: '중간',
              originalValue: bpRaw,
              message: `${rowNum}행: 이완기 혈압 ${bp.dia}mmHg — ${bp.dia < 60 ? '낮음(60 미만)' : '높음(100 이상)'} 범위입니다.`,
              suggestion: '특이사항란에 이완기 혈압 이상 내용을 기록하세요.',
              status: '미확인' })
        }
      }
    }

    // 체온
    if (tempCol !== -1) {
      const tempRaw = String(row[tempCol] ?? '').trim()
      if (!tempRaw) {
        issues.push({ id: newId(), sheetName: sheet.name, row: rowNum, column: tempCol,
          category: '바이탈', severity: '중간',
          originalValue: '',
          message: `${rowNum}행: 체온이 비어 있습니다.`,
          suggestion: '체온을 입력하세요. 예: 36.5',
          status: '미확인' })
      } else {
        const temp = parseTemp(tempRaw)
        if (temp === null)
          issues.push({ id: newId(), sheetName: sheet.name, row: rowNum, column: tempCol,
            category: '바이탈', severity: '중간',
            originalValue: tempRaw,
            message: `${rowNum}행: 체온 형식이 올바르지 않습니다. (입력값: ${tempRaw})`,
            suggestion: '체온을 숫자로 입력하세요. 예: 36.5',
            status: '미확인' })
        else if (temp < 35.5 || temp > 37.5)
          issues.push({ id: newId(), sheetName: sheet.name, row: rowNum, column: tempCol,
            category: '바이탈', severity: temp < 35.5 ? '높음' : '중간',
            originalValue: tempRaw,
            message: `${rowNum}행: 체온 ${temp}°C — ${temp < 35.5 ? '저체온(35.5 미만)' : '발열(37.5 초과)'} 범위입니다.`,
            suggestion: '즉시 간호사에게 보고하고 특이사항란에 상세 기록하세요.',
            status: '미확인' })
      }
    }
  })
}

// ── 서비스 제공 규칙 ─────────────────────────────────────────────────────────
function checkServices(sheet: SheetData, issues: Issue[]) {
  const serviceCols = SERVICE_KEYS
    .map(k => ({ key: k, idx: findColIndex(sheet.headers, [k]) }))
    .filter(s => s.idx !== -1)
  if (serviceCols.length === 0) return

  sheet.rows.slice(1).forEach((row, i) => {
    const rowNum = i + 2
    const emptyServices = serviceCols.filter(s => !String(row[s.idx] ?? '').trim())

    if (emptyServices.length === serviceCols.length) {
      issues.push({ id: newId(), sheetName: sheet.name, row: rowNum,
        category: '서비스제공', severity: '높음',
        message: `${rowNum}행: 서비스 제공 기록이 전체 누락되었습니다.`,
        suggestion: '해당 날짜에 실제 서비스가 제공되었다면 각 항목을 빠짐없이 기록하세요.',
        status: '미확인' })
    } else if (emptyServices.length > 0) {
      emptyServices.forEach(s => {
        issues.push({ id: newId(), sheetName: sheet.name, row: rowNum, column: s.idx,
          category: '서비스제공', severity: '중간',
          originalValue: '',
          message: `${rowNum}행: '${s.key}' 항목이 비어 있습니다.`,
          suggestion: `${s.key} 서비스 제공 여부와 내용을 기록하세요.`,
          status: '미확인' })
      })
    }
  })
}

// ── 서명 규칙 ─────────────────────────────────────────────────────────────────
function checkSignatures(sheet: SheetData, issues: Issue[]) {
  const signCols = SIGN_KEYWORDS
    .map(k => ({ key: k, idx: findColIndex(sheet.headers, [k]) }))
    .filter(s => s.idx !== -1)
  if (signCols.length === 0) return

  sheet.rows.slice(1).forEach((row, i) => {
    const rowNum = i + 2
    signCols.forEach(s => {
      if (!String(row[s.idx] ?? '').trim())
        issues.push({ id: newId(), sheetName: sheet.name, row: rowNum, column: s.idx,
          category: '서명', severity: '높음',
          originalValue: '',
          message: `${rowNum}행: '${s.key}' 서명/확인란이 비어 있습니다.`,
          suggestion: `${s.key}의 서명 또는 확인을 받아 기록하세요.`,
          status: '미확인' })
    })
  })
}

// ── 패턴 이상 ────────────────────────────────────────────────────────────────
function checkPatterns(sheet: SheetData, issues: Issue[]) {
  const textCols = sheet.headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h && !DATE_PATTERN.test(h) && !BP_KEYWORDS.some(k => h.includes(k)))

  textCols.forEach(({ h, i }) => {
    const values = sheet.rows.slice(1)
      .map(row => String(row[i] ?? '').trim())
      .filter(v => v.length > 4)

    const freq = new Map<string, number>()
    values.forEach(v => freq.set(v, (freq.get(v) ?? 0) + 1))

    freq.forEach((count, val) => {
      if (count >= 5)
        issues.push({ id: newId(), sheetName: sheet.name, row: 0,
          category: '패턴', severity: '낮음',
          originalValue: val,
          message: `'${h}' 열에서 "${val}" 문구가 ${count}회 반복됩니다.`,
          suggestion: '실제 어르신 상태에 맞게 구체적으로 작성하세요. 동일 문구 반복은 평가 시 지적될 수 있습니다.',
          status: '미확인' })
    })
  })
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export function runRuleEngine(sheets: SheetData[]): Issue[] {
  issueId = 0
  const issues: Issue[] = []
  sheets.forEach(sheet => {
    if (sheet.rows.length < 2) return
    checkDates(sheet, issues)
    checkVitals(sheet, issues)
    checkServices(sheet, issues)
    checkSignatures(sheet, issues)
    checkPatterns(sheet, issues)
  })
  return issues
}
