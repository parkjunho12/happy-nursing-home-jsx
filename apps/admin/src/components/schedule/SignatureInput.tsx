import { useEffect, useState } from 'react'
import { Loader2, PenLine, RotateCcw } from 'lucide-react'
import { signatureAPI, signatureUrl } from '@/api/leaveClient'
import SignaturePad from './SignaturePad'

export interface SigValue {
  use_saved: boolean
  signature: string | null   // 새로 그린 경우 data URL
  save: boolean              // 새 서명을 저장해두기
  ok: boolean                // 제출 가능 여부
}

/**
 * 서명 입력 — 한 번 그린 서명을 저장해두고 재사용한다.
 * 신청 때마다 서명을 다시 그리는 게 50대 선생님들의 가장 큰 마찰이라,
 * 저장된 서명이 있으면 그걸 기본으로 보여주고 원할 때만 새로 그리게 한다.
 */
export default function SignatureInput({ label, onChange }: {
  label?: string
  onChange: (v: SigValue) => void
}) {
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawNew, setDrawNew] = useState(false)
  const [data, setData] = useState<string | null>(null)
  const [save, setSave] = useState(true)

  useEffect(() => {
    signatureAPI.get()
      .then(r => setSavedUrl(r.signature_url ?? null))
      .catch(() => setSavedUrl(null))
      .finally(() => setLoading(false))
  }, [])

  // 상태가 바뀔 때마다 부모에게 현재 서명 값을 알린다
  useEffect(() => {
    const useSaved = !!savedUrl && !drawNew
    onChange({
      use_saved: useSaved,
      signature: useSaved ? null : data,
      save: !useSaved && save,
      ok: useSaved || !!data,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedUrl, drawNew, data, save])

  if (loading) {
    return <p className="text-xs text-gray-400 py-2"><Loader2 size={13} className="animate-spin inline mr-1" />서명 확인 중…</p>
  }

  const useSaved = !!savedUrl && !drawNew

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1.5">
        서명 {label && <span className="font-normal text-gray-400">— {label}</span>}
      </p>

      {useSaved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-center gap-3">
            <img src={signatureUrl(savedUrl)!} alt="저장된 서명" className="h-12 bg-white rounded-lg border border-gray-100" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-700">저장된 서명을 사용합니다</p>
              <button onClick={() => { setDrawNew(true); setData(null) }}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700">
                <PenLine size={11} /> 새로 서명하기
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <SignaturePad onChange={setData} />
          <div className="flex items-center justify-between mt-1.5">
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)} className="w-3.5 h-3.5 accent-emerald-600" />
              이 서명을 저장해 다음에도 사용
            </label>
            {savedUrl && (
              <button onClick={() => setDrawNew(false)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-gray-600">
                <RotateCcw size={11} /> 저장된 서명 쓰기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
