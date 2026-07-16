import { useState, useEffect } from 'react'
import { X, Send, LayoutTemplate, BookmarkPlus } from 'lucide-react'
import { noticeAPI, NOTICE_LEVEL, type InternalNotice, type NoticeLevel } from '@/api/noticeClient'
import { templateAPI, type NoticeTemplate } from '@/api/templateClient'
import { isKakaoShareEnabled } from '@/lib/kakaoShare'

export default function NoticeModal({ notice, onClose, onSaved }: { notice: InternalNotice | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!notice
  const [title, setTitle] = useState(notice?.title ?? '')
  const [content, setContent] = useState(notice?.content ?? '')
  const [level, setLevel] = useState<NoticeLevel>(notice?.level ?? 'info')
  const [pinned, setPinned] = useState(!!notice?.pinned)
  const [pub, setPub] = useState(!!notice?.public)
  const [push, setPush] = useState(true)          // 신규 등록 시 기본 발송
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [templates, setTemplates] = useState<NoticeTemplate[]>([])

  useEffect(() => { templateAPI.list().then(setTemplates).catch(() => setTemplates([])) }, [])

  const applyTemplate = (t: NoticeTemplate) => {
    if ((title.trim() || content.trim()) && !confirm(`'${t.name}' 템플릿으로 현재 입력을 덮어쓸까요?`)) return
    setLevel(t.level ?? 'info')
    setTitle(t.title ?? '')
    setContent(t.content ?? '')
  }

  const saveAsTemplate = async () => {
    const name = prompt('템플릿 이름을 입력하세요', (title.trim() || '새 템플릿'))
    if (!name || !name.trim()) return
    try {
      await templateAPI.create({ name: name.trim(), level, title: title.trim() || null, content: content.trim() || null })
      setTemplates(await templateAPI.list())
      alert('템플릿으로 저장했습니다.')
    } catch (e: any) { alert(e?.message ?? '템플릿 저장 실패') }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-orange/40'

  const save = async () => {
    if (!title.trim()) { setErr('제목을 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const body = { title: title.trim(), content: content.trim() || null, level, pinned, public: pub }
      if (isEdit) {
        await noticeAPI.update(notice!.id, body)
      } else {
        const created = await noticeAPI.create({ ...body, push })
        // 푸시를 켰는데 보낼 기기가 없거나 실패한 경우 사실대로 알림
        if (push) {
          const p = created.push
          if (!p || p.error) alert('공지는 등록됐지만 푸시 발송에 실패했습니다.' + (p?.error ? `\n(${p.error})` : ''))
          else if (p.tokens === 0) alert('공지가 등록됐습니다.\n다만 직원앱에 등록된 기기가 없어 푸시는 발송되지 않았습니다.')
          else alert(`공지가 등록되고 직원 ${p.recipients}명(${p.sent}대 기기)에게 푸시를 발송했습니다.`)
        }
        if (isKakaoShareEnabled()) {
          // 공유창은 사용자 클릭에서 열어야 안정적 → 자동 실행 대신 목록의 카카오 버튼으로 안내
          setTimeout(() => alert('카카오톡 오픈채팅방에도 올리려면, 공지를 눌러 펼친 뒤 노란 카카오 버튼을 누르세요.'), 100)
        }
      }
      onSaved()
    } catch (e: any) { setErr(e?.message ?? '저장 실패') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900">{isEdit ? '공지 수정' : '내부 공지 등록'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-500 flex items-center gap-1"><LayoutTemplate size={13} /> 템플릿</span>
              <button type="button" onClick={saveAsTemplate}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-orange hover:bg-orange-50 px-1.5 py-1 rounded">
                <BookmarkPlus size={13} /> 현재 내용 저장
              </button>
            </div>
            {templates.length === 0 ? (
              <p className="text-[11px] text-gray-400">저장된 템플릿이 없습니다. 자주 쓰는 공지를 저장해 재사용하세요.</p>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {templates.map(t => (
                  <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-primary-orange hover:text-primary-orange transition-colors">
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">중요도</label>
            <div className="flex gap-1.5">
              {(['info', 'important', 'urgent'] as NoticeLevel[]).map(l => (
                <button key={l} onClick={() => setLevel(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${level === l ? NOTICE_LEVEL[l].cls + ' ring-2 ring-offset-1 ring-gray-200' : 'bg-white text-gray-400 border-gray-200'}`}>
                  {NOTICE_LEVEL[l].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">제목 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inp} autoFocus placeholder="예: 8월 근무표 확정 안내" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">내용</label>
            <textarea rows={4} value={content} onChange={e => setContent(e.target.value)} className={`${inp} resize-none`} placeholder="직원에게 전달할 내용을 입력하세요" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="accent-primary-orange" />
            상단 고정 (핀)
          </label>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">공개 범위</label>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setPub(false)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${!pub ? 'bg-gray-100 text-gray-700 border-gray-300 ring-2 ring-offset-1 ring-gray-200' : 'bg-white text-gray-400 border-gray-200'}`}>
                🔒 내부 (로그인 필요)
              </button>
              <button type="button" onClick={() => setPub(true)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${pub ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-offset-1 ring-emerald-200' : 'bg-white text-gray-400 border-gray-200'}`}>
                🔗 공개 (링크 열람)
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {pub
                ? '카카오톡 공유 링크를 누구나 로그인 없이 열 수 있습니다. 민감한 내용은 피하세요.'
                : '어드민 로그인한 직원만 볼 수 있습니다. 카카오 공유 링크는 로그인 화면으로 연결됩니다.'}
            </p>
          </div>

          {!isEdit && (
            <label className="flex items-start gap-2 text-sm text-gray-600 rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 cursor-pointer">
              <input type="checkbox" checked={push} onChange={e => setPush(e.target.checked)} className="accent-primary-orange mt-0.5" />
              <span>
                <span className="font-semibold text-gray-700 flex items-center gap-1"><Send size={12} /> 직원앱에 푸시 알림 발송</span>
                <span className="block text-[11px] text-gray-400 mt-0.5">등록 즉시 전 직원 휴대폰으로 알림이 갑니다. (작성자 본인 제외)</span>
              </span>
            </label>
          )}
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-semibold">취소</button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-primary-orange hover:bg-primary-orange/90 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
