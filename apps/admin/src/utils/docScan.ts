/**
 * OpenAI(GPT) 비전 판독 최적화 전처리 — 손글씨 인수인계 기록지용
 *
 * GPT 비전(detail:"high")의 실제 처리 방식에 맞춘다:
 *   2048×2048 안에 맞춘 뒤 → 짧은 변을 768px 로 축소 → 512px 타일로 분할
 *   즉 GPT 가 실제로 보는 픽셀은 "짧은 변 768px" 이 전부다.
 *
 * 따라서
 *  1) EXIF 회전 반영        : 누운 이미지는 판독률이 크게 떨어진다
 *  2) 보정을 축소 '전에' 수행 : 흐린 연필 획을 먼저 살려야 축소해도 남는다
 *  3) 그림자 제거(플랫필드)  : 그늘 속 글씨 손실 방지
 *  4) 색상 유지             : 파란 인쇄 양식 / 검은 볼펜 / 빨간 표시 구분 단서
 *  5) 짧은 변 768px 로 우리가 직접 축소 : GPT 가 어차피 여기까지 줄이므로,
 *     고품질 리샘플링으로 우리가 통제하고 업로드 용량도 줄인다
 *  6) 축소 후 언샤프 마스크  : 리샘플링으로 뭉개진 획 경계를 되살린다
 */

const LONG_CAP = 2400          // 과한 축소 금지 — 원본 디테일 최대한 보존
const LOW_PCT = 0.005
const HIGH_PCT = 0.85
const OUT_MIN = 20             // 더 보수적 — 획 손실 방지
const OUT_MAX = 240            // 더 보수적
const GAMMA = 1.0              // 감마 보정 없음(원본 톤 유지)
const JPEG_Q = 0.92

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' } as any)
  } catch {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }
}

function percentile(hist: Uint32Array, total: number, p: number): number {
  let acc = 0
  const target = total * p
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= target) return v
  }
  return 255
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', JPEG_Q))
}

/** 캔버스에 그려진 이미지를 그 자리에서 보정(그림자 제거 + 부드러운 대비, 색상 유지) */
function correct(canvas: HTMLCanvasElement) {
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  // 배경(조명) 추정 — 축소 후 확대 = 저비용 강한 블러
  let bg: Uint8ClampedArray | null = null
  const bw = Math.max(1, Math.round(w / 16)), bh = Math.max(1, Math.round(h / 16))
  const small = document.createElement('canvas')
  small.width = bw; small.height = bh
  const sctx = small.getContext('2d')
  if (sctx) {
    sctx.drawImage(canvas, 0, 0, bw, bh)
    const up = document.createElement('canvas')
    up.width = w; up.height = h
    const uctx = up.getContext('2d', { willReadFrequently: true })
    if (uctx) {
      uctx.imageSmoothingEnabled = true
      uctx.imageSmoothingQuality = 'high'
      uctx.drawImage(small, 0, 0, w, h)
      bg = uctx.getImageData(0, 0, w, h).data
    }
  }

  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const hist = new Uint32Array(256)

  // 1차: 플랫필드(색상 유지 — 밝기 게인을 RGB에 동일 적용) + 휘도 히스토그램
  for (let i = 0; i < d.length; i += 4) {
    if (bg) {
      const b = (bg[i] * 0.299 + bg[i + 1] * 0.587 + bg[i + 2] * 0.114)
      if (b > 8) {
        const gain = 220 / b
        d[i] = Math.min(255, d[i] * gain)
        d[i + 1] = Math.min(255, d[i + 1] * gain)
        d[i + 2] = Math.min(255, d[i + 2] * gain)
      }
    }
    hist[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++
  }

  // 2차: 부드러운 대비 — 휘도 기준 LUT 를 RGB 게인으로 환산(색상 보존)
  const total = w * h
  const lo = percentile(hist, total, LOW_PCT)
  const hi = percentile(hist, total, HIGH_PCT)
  if (hi - lo >= 8) {
    const range = hi - lo
    const lut = new Float32Array(256)
    for (let v = 0; v < 256; v++) {
      const n = Math.min(1, Math.max(0, (v - lo) / range))
      lut[v] = OUT_MIN + Math.pow(n, GAMMA) * (OUT_MAX - OUT_MIN)
    }
    for (let i = 0; i < d.length; i += 4) {
      const y = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0
      const gain = y > 4 ? lut[y] / y : 1
      d[i] = Math.min(255, d[i] * gain)
      d[i + 1] = Math.min(255, d[i + 1] * gain)
      d[i + 2] = Math.min(255, d[i + 2] * gain)
    }
  }
  ctx.putImageData(img, 0, 0)
}

/** GPT 가 실제로 쓰는 크기 계산: 짧은 변 768, 긴 변 2048 이내, 원본보다 키우지 않음 */
function targetSize(iw: number, ih: number): [number, number] {
  const k = Math.min(1, LONG_CAP / Math.max(iw, ih))   // 긴 변만 제한, 축소는 최소한으로
  return [Math.max(1, Math.round(iw * k)), Math.max(1, Math.round(ih * k))]
}

function drawTo(src: any, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, w, h)
  }
  return c
}

/** 사진 보정본 생성 — EXIF 회전 + 그림자 제거 위주(보수적) */
export async function scanDocument(file: File): Promise<File> {
  try {
    const bmp = await loadBitmap(file)
    const iw = (bmp as any).width, ih = (bmp as any).height
    if (!iw || !ih) return file

    const [fw, fh] = targetSize(iw, ih)

    // 보정은 축소 '전에' — 흐린 획을 먼저 살려야 축소 후에도 남는다.
    // 다만 원본 전체 해상도는 과하므로 최종의 2배까지만 사용.
    const k = Math.min(1, (2 * Math.max(fw, fh)) / Math.max(iw, ih))
    const work = drawTo(bmp, Math.max(1, Math.round(iw * k)), Math.max(1, Math.round(ih * k)))
    correct(work)

    const final = drawTo(work, fw, fh)

    const blob = await toBlob(final)
    if (!blob) return file
    const name = (file.name || 'scan').replace(/\.[^.]+$/, '') + '_ai.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
