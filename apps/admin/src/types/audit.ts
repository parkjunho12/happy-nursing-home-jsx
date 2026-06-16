export type IssueCategory = '날짜' | '바이탈' | '서비스제공' | '서명' | '패턴' | 'AI검토'
export type IssueSeverity = '높음' | '중간' | '낮음'
export type IssueStatus   = '미확인' | '확인완료' | '수정완료'

export interface Issue {
  id:             string
  residentName?:  string
  sheetName:      string
  row:            number
  column?:        number
  date?:          string
  category:       IssueCategory
  severity:       IssueSeverity
  originalValue?: string
  message:        string
  suggestion:     string
  status:         IssueStatus
}

export interface SheetData {
  name:    string
  rows:    (string | number | null)[][]
  headers: string[]
}
