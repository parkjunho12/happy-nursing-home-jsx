import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

/**
 * 전자서명판 — 휴대폰에서 손가락으로 서명한다.
 * 연차 신청의 근거 서류가 되므로, 빈 서명은 부모가 걸러낼 수 있게 isEmpty를 알려준다.
 */
export default function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = canvasRef.current!
    // 선명하게 — CSS 크기 × 배율로 실제 픽셀 확보
    const scale = window.devicePixelRatio || 1
    const w = c.offsetWidth, h = 140
    c.width = w * scale; c.height = h * scale
    const ctx = c.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
  }, [])

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y); ctx.stroke()
    if (empty) setEmpty(false)
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange(empty ? null : canvasRef.current!.toDataURL('image/png'))
  }
  const clear = () => {
    const c = canvasRef.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 overflow-hidden">
        <canvas ref={canvasRef}
          className="w-full h-[140px] touch-none cursor-crosshair"
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-300 pointer-events-none">
            여기에 손가락으로 서명해주세요
          </p>
        )}
        <button type="button" onClick={clear} aria-label="서명 지우기"
          className="absolute top-2 right-2 p-2 rounded-lg bg-white/80 border border-gray-200 text-gray-400 hover:text-gray-600">
          <Eraser size={14} />
        </button>
      </div>
    </div>
  )
}
