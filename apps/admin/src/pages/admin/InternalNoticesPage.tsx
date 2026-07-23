import { useEffect, useMemo, useState, useCallback } from 'react'
import { Megaphone, Plus, Pin, Loader2, Pencil, Trash2, Send, MessageCircle, Link2, Search, Eye, LayoutTemplate } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { noticeAPI, NOTICE_LEVEL, noticeImageUrl, type InternalNotice, type NoticeLevel } from '@/api/noticeClient'
import { isKakaoShareEnabled, shareNotice } from '@/lib/kakaoShare'
import NoticeModal from '@/components/notices/NoticeModal'
import NoticeDetailModal from '@/components/notices/NoticeDetailModal'
import TemplateManagerModal from '@/components/notices/TemplateManagerModal'

const WEB = (import.meta.env.VITE_PUBLIC_WEB_URL || 'https://www.xn--p80bu1t60gba47bg6abm347gsla.com').replace(/\/$/, '')

const fmt = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function InternalNoticesPage() {
  const { user } = useAuthStore()
  // 등록·수정·템플릿 — 백엔드 _can_write와 동일 기준 (관리자·시설장·사회복지사)
  const canWrite = user?.role === 'ADMIN' || user?.position === '시설장' || user?.position === '사회복지사'

  const [list, setList] = useState<InternalNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<InternalNotice | null | undefined>(undefined)
  const [viewing, setViewing] = useState<InternalNotice | null>(null)
  const [tplOpen, setTplOpen] = useState(false)

  const [q, setQ] = useState('')
  const [levelF, setLevelF] = useState<'all' | NoticeLevel>('all')
  const [scopeF, setScopeF] = useState<'all' | 'public' | 'internal'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try { setList(await noticeAPI.list(200)) } catch { setList([]) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    total: list.length,
    open: list.filter(n => n.public).length,
    urgent: list.filter(n => n.level === 'urgent').length,
  }), [list])

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return list.filter(n => {
      if (levelF !== 'all' && n.level !== levelF) return false
      if (scopeF === 'public' && !n.public) return false
      if (scopeF === 'internal' && n.public) return false
      if (kw && !(`${n.title} ${n.content ?? ''}`.toLowerCase().includes(kw))) return false
      return true
    })
  }, [list, q, levelF, scopeF])

  const copyLink = async (id: string) => {
    const url = `${WEB}/notice/${id}`
    try { await navigator.clipboard.writeText(url); alert('공개 링크를 복사했습니다.\n' + url) }
    catch { prompt('아래 링크를 복사하세요', url) }
  }

  const doPush = async (id: string) => {
    if (!confirm('이 공지를 직원앱에 다시 발송할까요?')) return
    try {
      const r = await noticeAPI.push(id)
      alert(r.tokens === 0 ? '직원앱에 등록된 기기가 없어 발송되지 않았습니다.'
        : `직원 ${r.recipients}명(${r.sent}대 기기)에게 발송했습니다.`)
    } catch (e: any) { alert(e?.message ?? '발송 실패') }
  }

  const doDelete = async (id: string) => {
    if (!confirm('이 공지를 삭제할까요? 되돌릴 수 없습니다.')) return
    try { await noticeAPI.remove(id); load() } catch (e: any) { alert(e?.message ?? '삭제 실패') }
  }

  const inp = 'px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-orange/40'

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary-orange/10 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-primary-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">내부 공지 관리</h1>
            <p className="text-xs text-gray-400">직원 공지를 모아 관리합니다. 공개 공지는 링크·카카오로 공유할 수 있어요.</p>
          </div>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <button onClick={() => setTplOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-600 hover:border-primary-orange hover:text-primary-orange rounded-xl font-semibold text-sm">
              <LayoutTemplate className="w-4 h-4" /> 템플릿 관리
            </button>
            <button onClick={() => setEditing(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-orange hover:bg-primary-orange/90 text-white rounded-xl font-semibold text-sm shadow-sm">
              <Plus className="w-4 h-4" /> 공지 등록
            </button>
          </div>
        )}
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { label: '전체 공지', value: stats.total, cls: 'text-gray-900' },
          { label: '공개 공지', value: stats.open, cls: 'text-emerald-600' },
          { label: '긴급', value: stats.urgent, cls: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-[11px] text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="제목·내용 검색"
            className={`${inp} pl-8 w-56`} />
        </div>
        <select value={levelF} onChange={e => setLevelF(e.target.value as any)} className={inp}>
          <option value="all">전체 중요도</option>
          <option value="urgent">긴급</option>
          <option value="important">중요</option>
          <option value="info">안내</option>
        </select>
        <select value={scopeF} onChange={e => setScopeF(e.target.value as any)} className={inp}>
          <option value="all">전체 공개범위</option>
          <option value="public">공개 (링크)</option>
          <option value="internal">내부</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length}건</span>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">조건에 맞는 공지가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map(n => {
              const lv = NOTICE_LEVEL[n.level] ?? NOTICE_LEVEL.info
              return (
                <li key={n.id} className={n.pinned ? 'bg-orange-50/30' : ''}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0 cursor-pointer group" onClick={() => setViewing(n)}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${lv.cls}`}>{lv.label}</span>
                        {n.public
                          ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">공개</span>
                          : <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">내부</span>}
                        {n.pinned && <Pin size={11} className="text-primary-orange" />}
                        <span className="text-sm font-semibold text-gray-800 truncate group-hover:text-primary-orange">{n.title}</span>
                      </div>
                      {n.content && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{n.content}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{n.author_name ?? '관리자'} · {fmt(n.created_at)}</p>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => setViewing(n)} title="공지 열기"
                        className="p-2 text-gray-300 hover:text-primary-orange rounded"><Eye size={14} /></button>
                      {n.public && isKakaoShareEnabled() && (
                        <button onClick={async () => {
                          try { await shareNotice({ title: n.title, content: n.content, level: n.level, link: `${WEB}/notice/${n.id}`, image: noticeImageUrl(n.image_url) }) }
                          catch (e: any) { alert(e?.message ?? '카카오 공유를 열 수 없습니다. 모바일 카카오톡에서 시도해주세요.') }
                        }} title="카카오톡 공유"
                          className="p-2 text-gray-300 hover:text-[#3A1D1D] hover:bg-[#FEE500] rounded"><MessageCircle size={14} /></button>
                      )}
                      {n.public && (
                        <button onClick={() => copyLink(n.id)} title="공개 링크 복사"
                          className="p-2 text-gray-300 hover:text-emerald-600 rounded"><Link2 size={14} /></button>
                      )}
                      {canWrite && (<>
                        <button onClick={() => doPush(n.id)} title="직원앱에 재발송"
                          className="p-2 text-gray-300 hover:text-primary-orange rounded"><Send size={14} /></button>
                        <button onClick={() => setEditing(n)} title="수정"
                          className="p-2 text-gray-300 hover:text-gray-600 rounded"><Pencil size={14} /></button>
                        <button onClick={() => doDelete(n.id)} title="삭제"
                          className="p-2 text-gray-300 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                      </>)}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {viewing && (
        <NoticeDetailModal
          notice={viewing}
          canWrite={canWrite}
          onClose={() => setViewing(null)}
          onEdit={(n) => { setViewing(null); setEditing(n) }}
        />
      )}

      {editing !== undefined && (
        <NoticeModal notice={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load() }} />
      )}

      {tplOpen && <TemplateManagerModal onClose={() => setTplOpen(false)} />}
    </div>
  )
}
