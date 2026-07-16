import { useEffect, useState } from 'react'
import { Megaphone, Pin, Plus, Loader2, Pencil, Trash2, Send, MessageCircle } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { noticeAPI, NOTICE_LEVEL, type InternalNotice } from '@/api/noticeClient'
import { isKakaoShareEnabled, shareNotice } from '@/lib/kakaoShare'
import NoticeModal from '@/components/notices/NoticeModal'

// 공개 공지 상세가 열리는 공개 웹 도메인 (카카오 공유 링크에 사용)
const WEB = (import.meta.env.VITE_PUBLIC_WEB_URL || 'https://www.xn--p80bu1t60gba47bg6abm347gsla.com').replace(/\/$/, '')

const rel = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`
  return `${d.getMonth() + 1}.${d.getDate()}`
}

/** 내부 공지사항 (직원용) — 읽기: 전 직원 / 작성: ADMIN·시설장 */
export default function NoticeBoard() {
  const { user } = useAuthStore()
  const canWrite = user?.role === 'ADMIN' || user?.position === '시설장'

  const [list, setList] = useState<InternalNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<InternalNotice | null | undefined>(undefined)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    noticeAPI.list(10).then(setList).catch(() => setList([])).finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary-orange/10 flex items-center justify-center">
            <Megaphone size={14} className="text-primary-orange" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">내부 공지</h2>
          {list.length > 0 && <span className="text-[11px] text-gray-400">{list.length}건</span>}
        </div>
        {canWrite && (
          <button onClick={() => setEditing(null)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-orange hover:bg-orange-50 px-2 py-1 rounded-lg">
            <Plus size={13} /> 공지 등록
          </button>
        )}
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={18} /></div>
        ) : list.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">
            등록된 공지가 없습니다{canWrite && ' — 「공지 등록」으로 직원에게 알릴 내용을 올려보세요'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {list.map(n => {
              const lv = NOTICE_LEVEL[n.level] ?? NOTICE_LEVEL.info
              const open = openId === n.id
              return (
                <li key={n.id} className={`rounded-xl border transition-colors ${n.pinned ? 'border-orange-100 bg-orange-50/40' : 'border-gray-100 hover:bg-gray-50/60'}`}>
                  <div className="flex items-start gap-2 p-2.5 min-h-[44px] cursor-pointer" onClick={() => setOpenId(open ? null : n.id)}>
                    <span className={`shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${lv.cls}`}>{lv.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                        {n.pinned && <Pin size={11} className="text-primary-orange shrink-0" />}
                        {n.public && <span className="shrink-0 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded">공개</span>}
                        <span className={open ? '' : 'truncate'}>{n.title}</span>
                      </p>
                      {open && n.content && (
                        <p className="text-xs text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {n.author_name ?? '관리자'} · {rel(n.created_at)}
                      </p>
                    </div>
                    {open && (
                      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                        {isKakaoShareEnabled() && (
                          <button
                            onClick={async () => {
                              try { await shareNotice({ title: n.title, content: n.content, level: n.level, link: n.public ? `${WEB}/notice/${n.id}` : undefined }) }
                              catch (e: any) { alert(e?.message ?? '카카오 공유를 열 수 없습니다. PC에서는 모바일 카카오톡에서 시도해주세요.') }
                            }}
                            aria-label="카카오톡으로 공유" title="카카오톡 오픈채팅방에 공유"
                            className="p-2.5 md:p-1 text-gray-300 hover:text-[#3A1D1D] hover:bg-[#FEE500] rounded transition-colors">
                            <MessageCircle size={13} />
                          </button>
                        )}
                        {canWrite && (<>
                        <button
                          onClick={async () => {
                            if (!confirm('이 공지를 직원앱에 다시 발송할까요?')) return
                            try {
                              const r = await noticeAPI.push(n.id)
                              alert(r.tokens === 0
                                ? '직원앱에 등록된 기기가 없어 발송되지 않았습니다.'
                                : `직원 ${r.recipients}명(${r.sent}대 기기)에게 발송했습니다.`)
                            } catch (e: any) { alert(e?.message ?? '발송 실패') }
                          }}
                          aria-label="푸시 재발송" title="직원앱에 다시 발송"
                          className="p-2.5 md:p-1 text-gray-300 hover:text-primary-orange rounded"><Send size={13} /></button>
                        <button onClick={() => setEditing(n)} aria-label="수정" className="p-2.5 md:p-1 text-gray-300 hover:text-gray-600 rounded"><Pencil size={13} /></button>
                        <button onClick={async () => { if (confirm('이 공지를 삭제할까요?')) { await noticeAPI.remove(n.id); load() } }}
                          aria-label="삭제" className="p-2.5 md:p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 size={13} /></button>
                        </>)}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {editing !== undefined && (
        <NoticeModal notice={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load() }} />
      )}
    </section>
  )
}
