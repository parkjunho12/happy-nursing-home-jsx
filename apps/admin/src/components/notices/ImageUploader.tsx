import { useRef, useState } from 'react'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import { noticeAPI, noticeImageUrl } from '@/api/noticeClient'

export default function ImageUploader({ value, onChange }: { value?: string | null; onChange: (url: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const preview = noticeImageUrl(value)

  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try { const { url } = await noticeAPI.uploadImage(f); onChange(url) }
    catch (e: any) { alert(e?.message ?? '이미지 업로드 실패') }
    finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }

  return (
    <div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
      {preview ? (
        <div className="relative inline-block w-full">
          <img src={preview} alt="첨부 이미지" className="w-full max-h-44 object-cover rounded-lg border border-gray-200" />
          <button type="button" onClick={() => onChange(null)} aria-label="이미지 제거"
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"><X size={15} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-primary-orange hover:text-primary-orange text-sm font-semibold disabled:opacity-50">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <ImagePlus size={16} />}
          {busy ? '업로드 중...' : '이미지 추가 (선택)'}
        </button>
      )}
    </div>
  )
}
