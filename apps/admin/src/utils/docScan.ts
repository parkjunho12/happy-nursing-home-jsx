/**
 * 문서 스캔 보정 — 손글씨 기록지 사진을 '스캔한 것처럼' 정리해 AI 판독률을 높인다.
 *
 * 파이프라인
 *  1) EXIF 회전 반영 (휴대폰 사진이 눕는 문제 방지)
 *  2) 긴 변 기준 리사이즈 (판독 디테일은 유지 + 업로드/토큰 절감)
 *  3) 흑백 변환
 *  4) 플랫필드 보정 — 배경(조명) 추정치로 나눠 그림자·조명 불균일 제거
 *  5) 히스토그램 백분위 스트레치 (종이는 하얗게, 글씨는 진하게)
 *  5) 가벼운 감마 보정 — 연필처럼 흐린 글씨가 날아가지 않도록 이진화는 하지 않는다
 */

const MAX_EDGE = 2000          // 손글씨 판독에 충분한 해상도
// 문서 사진은 글씨가 전체 픽셀의 1~3%뿐이라 하위 기준을 아주 낮게 잡아야 잉크를 잡는다
const LOW_PCT = 0.005          // 하위 0.5% → 검정(잉크)
const HIGH_PCT = 0.85          // 상위 15% → 흰색(종이)
const GAMMA = 0.92             // 1 미만 = 살짝 밝게

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // EXIF 회전 자동 반영
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

/** 문서 보정된 JPEG File 을 반환. 실패하면 원본을 그대로 돌려준다(안전). */
export async function scanDocument(file: File): Promise<File> {
  try {
    const bmp = await loadBitmap(file)
    const iw = (bmp as any).width as number
    const ih = (bmp as any).height as number
    if (!iw || !ih) return file

    const scale = Math.min(1, MAX_EDGE / Math.max(iw, ih))
    const w = Math.max(1, Math.round(iw * scale))
    const h = Math.max(1, Math.round(ih * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return file
    ctx.drawImage(bmp as any, 0, 0, w, h)

    // 배경(조명) 추정: 축소 → 확대 = 저비용 강한 블러
    const bw = Math.max(1, Math.round(w / 16))
    const bh = Math.max(1, Math.round(h / 16))
    const small = document.createElement('canvas')
    small.width = bw; small.height = bh
    const sctx = small.getContext('2d')
    let bg: Uint8ClampedArray | null = null
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

    // 흑백 + 플랫필드 보정 + 히스토그램 수집
    const hist = new Uint32Array(256)
    for (let i = 0; i < d.length; i += 4) {
      let g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0
      if (bg) {
        // 배경 밝기로 정규화 → 그늘진 종이도 밝은 종이와 같은 기준이 된다
        const b = (bg[i] * 0.299 + bg[i + 1] * 0.587 + bg[i + 2] * 0.114) | 0
        if (b > 8) g = Math.min(255, (g * 220 / b) | 0)
      }
      d[i] = d[i + 1] = d[i + 2] = g
      hist[g]++
    }

    const total = w * h
    let lo = percentile(hist, total, LOW_PCT)
    let hi = percentile(hist, total, HIGH_PCT)
    if (hi - lo < 8) return file                    // 완전 균일한 이미지만 보정 생략

    // 룩업 테이블(스트레치 + 감마)
    const lut = new Uint8ClampedArray(256)
    const range = Math.max(1, hi - lo)
    for (let v = 0; v < 256; v++) {
      const n = Math.min(1, Math.max(0, (v - lo) / range))
      lut[v] = Math.round(Math.pow(n, GAMMA) * 255)
    }
    for (let i = 0; i < d.length; i += 4) {
      const v = lut[d[i]]
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(img, 0, 0)

    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9))
    if (!blob) return file
    const name = (file.name || 'scan').replace(/\.[^.]+$/, '') + '_scan.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file   // 어떤 이유로든 실패하면 원본 사용
  }
}
