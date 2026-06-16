// @ts-ignore
import * as XLSX from 'xlsx'
import type { SheetData } from '../types/audit'

export function parseExcelFile(file: File): Promise<SheetData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data   = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb     = XLSX.read(data, { type: 'array', cellDates: true })
        const sheets: SheetData[] = wb.SheetNames.map((name: string) => {
          const ws   = wb.Sheets[name]
          const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
            header: 1, defval: null, raw: false,
          })
          const headers = (rows[0] ?? []).map((h: string|number|null) => String(h ?? ''))
          return { name, rows: rows as (string | number | null)[][], headers }
        })
        resolve(sheets)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
