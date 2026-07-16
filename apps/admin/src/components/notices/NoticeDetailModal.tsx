import { X, ExternalLink, Link2, MessageCircle, MessageSquareText, Pencil, Pin } from 'lucide-react'
import { NOTICE_LEVEL, noticeImageUrl, type InternalNotice } from '@/api/noticeClient'
import { isKakaoShareEnabled, shareNotice, shareNoticeText } from '@/lib/kakaoShare'

const WEB = (import.meta.env.VITE_PUBLIC_WEB_URL || 'https://www.xn--p80bu1t60gba47bg6abm347gsla.com').replace(/\/$/, '')

const fmt = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

const PHONE_RE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/
function renderContent(text: string) {
  return text.split(/(https?:\/\/[^\s<]+|0\d{1,2}-?\d{3,4}-?\d{4})/g).map((part, i) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      const href = part.replace(/[.,)\]}]+$/, '')
      return <span key={i}><a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-orange underline underline-offset-2 break-all">{href}</a>{part.slice(href.length)}</span>
    }
    if (PHONE_RE.test(part)) {
      return <a key={i} href={`tel:${part.replace(/-/g, '')}`} className="text-primary-orange underline underline-offset-2 whitespace-nowrap">{part}</a>
    }
    return <span key={i}>{part}</span>
  })
}

export default function NoticeDetailModal({
  notice, onClose, onEdit, canWrite = false,
}: { notice: InternalNotice; onClose: () => void; onEdit?: (n: InternalNotice) => void; canWrite?: boolean }) {
  const n = notice
  const lv = NOTICE_LEVEL[n.level] ?? NOTICE_LEVEL.info
  const publicUrl = `${WEB}/notice/${n.id}`

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicUrl); alert('공개 링크를 복사했습니다.\n' + publicUrl) }
    catch { prompt('아래 링크를 복사하세요', publicUrl) }
  }
  const share = async () => {
    try { await shareNotice({ title: n.title, content: n.content, level: n.level, link: publicUrl, image: noticeImageUrl(n.image_url) }) }
    catch (e: any) { alert(e?.message ?? '카카오 공유를 열 수 없습니다. 모바일 카카오톡에서 시도해주세요.') }
  }
  const shareText = async () => {
    try { await shareNoticeText({ title: n.title, content: n.content, level: n.level, link: n.public ? publicUrl : undefined }) }
    catch (e: any) { alert(e?.message ?? '카카오 공유를 열 수 없습니다. 모바일 카카오톡에서 시도해주세요.') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 py-4 border-b">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${lv.cls}`}>{lv.label}</span>
              {n.public
                ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">공개</span>
                : <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">내부</span>}
              {n.pinned && <Pin size={12} className="text-primary-orange" />}
            </div>
            <h3 className="font-bold text-gray-900 text-lg leading-snug break-words">{n.title}</h3>
            <p className="text-xs text-gray-400 mt-1">{n.author_name ?? '관리자'} · {fmt(n.created_at)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center shrink-0"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-4 overflow-y-auto">
          {noticeImageUrl(n.image_url) && (
            <img src={noticeImageUrl(n.image_url)!} alt="첨부 이미지" className="w-full rounded-xl border border-gray-100 mb-3" />
          )}
          {n.content
            ? <div className="text-[15px] text-gray-700 leading-[1.8] whitespace-pre-wrap break-words">{renderContent(n.content)}</div>
            : <p className="text-sm text-gray-300 italic">내용이 없습니다.</p>}
        </div>

        {/* 공개 공지 안내 */}
        {n.public && (
          <div className="mx-5 mb-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] text-emerald-700 break-all">
            🔗 공개 링크: {publicUrl}
          </div>
        )}

        {/* 액션 */}
        <div className="flex items-center gap-2 px-5 py-4 border-t flex-wrap">
          {n.public && (
            <>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-orange text-white rounded-xl text-sm font-semibold">
                <ExternalLink size={15} /> 공개 페이지 열기
              </a>
              <button onClick={copyLink} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold">
                <Link2 size={15} /> 링크 복사
              </button>
              {isKakaoShareEnabled() && (
                <button onClick={share} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[#3A1D1D] bg-[#FEE500]">
                  <MessageCircle size={15} /> 카카오 공유
                </button>
              )}
            </>
          )}
          {isKakaoShareEnabled() && (
            <button onClick={shareText} title="글자만 공유 (최대 200자, 카드 없음)"
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold">
              <MessageSquareText size={15} /> 텍스트 공유
            </button>
          )}
          {canWrite && onEdit && (
            <button onClick={() => onEdit(n)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold ml-auto">
              <Pencil size={15} /> 수정
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
