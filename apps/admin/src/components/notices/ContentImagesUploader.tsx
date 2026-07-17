import { useRef, useState } from 'react'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import { noticeAPI, noticeImageUrl } from '@/api/noticeClient'

export default function ContentImagesUploader({ value, onChange }: { value?: string[] | null; onChange: (urls: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const list = value ?? []

  const pick = async (files?: FileList | null) => {
    if (!files || !files.length) return
    setBusy(true)
    try {
      const uploaded: string[] = []
      for (const f of Array.from(files)) {
        const { url } = await noticeAPI.uploadImage(f)
        uploaded.push(url)
      }
      onChange([...list, ...uploaded])
    } catch (e: any) { alert(e?.message ?? '이미지 업로드 실패') }
    finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }
  const remove = (i: number) => onChange(list.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const next = [...list];[next[i], next[j]] = [next[j], next[i]]; onChange(next)
  }

  return (
    <div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={e => pick(e.target.files)} />
      {list.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {list.map((u, i) => (
            <div key={i} className="relative group">
              <img src={noticeImageUrl(u)!} alt={`본문 이미지 ${i + 1}`} className="w-full h-20 object-cover rounded-lg border border-gray-200" />
              <button type="button" onClick={() => remove(i)} aria-label="삭제"
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center"><X size={12} /></button>
              <div className="absolute bottom-1 left-1 flex gap-0.5">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-5 h-5 rounded bg-black/40 text-white text-[10px] disabled:opacity-30">◀</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} className="w-5 h-5 rounded bg-black/40 text-white text-[10px] disabled:opacity-30">▶</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-primary-orange hover:text-primary-orange text-sm font-semibold disabled:opacity-50">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <ImagePlus size={16} />}
        {busy ? '업로드 중...' : list.length ? '이미지 더 추가' : '본문 이미지 추가 (여러 장 선택 가능)'}
      </button>
    </div>
  )
}
