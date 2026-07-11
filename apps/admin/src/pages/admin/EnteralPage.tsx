import DateField from '@/components/ui/DateField'
import { useEffect, useState } from 'react'
import { enteralAPI, downloadBlob, type EnteralProduct, type EnteralTx, type TxType, type ProductInput, type ResidentCost, type EnteralResident } from '@/api/enteralClient'
import { Download } from 'lucide-react'

const today = () => new Date().toISOString().slice(0, 10)
const won = (n?: number | null) => (n || n === 0 ? `${(n || 0).toLocaleString()}원` : '-')
const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '')
function DownloadBtn({ onClick, label = '엑셀 내보내기' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border border-green-200 text-green-700 hover:bg-green-50">
      <Download className="w-4 h-4" /> {label}
    </button>
  )
}
const fmtDate = (s?: string | null) => s || '-'
const fmtDT = (s?: string | null) => (s ? new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-')

export default function EnteralPage() {
  const [view, setView] = useState<'stock' | 'tx' | 'cost'>('stock')
  const [products, setProducts] = useState<EnteralProduct[]>([])
  const [error, setError] = useState('')

  const loadProducts = async () => {
    try { setProducts(await enteralAPI.products()) }
    catch (e: any) { setError(e?.message ?? '제품을 불러오지 못했습니다.') }
  }
  useEffect(() => { loadProducts() }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">경관식 재고 관리</h1>
        <p className="text-sm text-gray-500 mt-1">입소 어르신 경관식 종류와 입출고(반출) 내역을 관리합니다.</p>
      </div>

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="flex items-center gap-2 mb-5">
        {([['stock', '재고 현황'], ['tx', '입출고 내역'], ['cost', '어르신별 비용']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border ${view === v ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'stock' && <StockTab products={products} reload={loadProducts} setError={setError} />}
      {view === 'tx' && <TxTab products={products} reloadProducts={loadProducts} setError={setError} />}
      {view === 'cost' && <CostTab setError={setError} />}
    </div>
  )
}

function stockStyle(stock: number) {
  if (stock <= 0) return 'bg-red-50 text-red-600'
  if (stock <= 5) return 'bg-amber-50 text-amber-700'
  return 'bg-green-50 text-green-700'
}

/* ─────────────────── 재고 현황 ─────────────────── */
function StockTab({ products, reload, setError }: { products: EnteralProduct[]; reload: () => Promise<void>; setError: (s: string) => void }) {
  const [editing, setEditing] = useState<EnteralProduct | null>(null)
  const [creating, setCreating] = useState(false)
  const [txPreset, setTxPreset] = useState<{ product: EnteralProduct; type: TxType } | null>(null)

  const remove = async (p: EnteralProduct) => {
    if (!confirm(`'${p.name}' 제품을 삭제할까요? (입출고 내역은 남습니다)`)) return
    try { await enteralAPI.deleteProduct(p.id); await reload() }
    catch (e: any) { setError(e?.message ?? '삭제 실패') }
  }

  const totalStock = products.reduce((a, p) => a + p.stock, 0)
  const lowCount = products.filter(p => p.stock <= 5).length

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Kpi label="등록 제품" value={`${products.length}종`} />
        <Kpi label="총 재고" value={`${totalStock.toLocaleString()}`} />
        <Kpi label="부족/소진(≤5)" value={`${lowCount}종`} color={lowCount > 0 ? 'text-amber-600' : 'text-gray-900'} />
      </div>

      <div className="flex justify-end gap-2 mb-3">
        <DownloadBtn label="재고 엑셀" onClick={async () => { const b = await enteralAPI.exportBlob('stock'); downloadBlob(b, `재고현황_${stamp()}.xlsx`) }} />
        <button onClick={() => setCreating(true)} className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-900 text-white hover:bg-black">+ 경관식 종류 추가</button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {['제품명', '브랜드', '규격', '단위', '단가', '현재고', '입출고', '관리'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">등록된 경관식이 없습니다. ‘경관식 종류 추가’로 시작하세요.</td></tr>
            )}
            {products.map(p => (
              <tr key={p.id} className="border-t border-gray-50 hover:bg-orange-50/30">
                <td className="px-4 py-3 font-semibold text-gray-900">{p.name}{!p.is_active && <span className="ml-2 text-xs text-gray-400">(비활성)</span>}</td>
                <td className="px-4 py-3 text-gray-600">{p.brand || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{p.spec || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{p.unit || '-'}</td>
                <td className="px-4 py-3 text-gray-600 tabular-nums">{won(p.unit_price)}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${stockStyle(p.stock)}`}>{p.stock.toLocaleString()}{p.unit || ''}</span></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button onClick={() => setTxPreset({ product: p, type: 'in' })} className="px-2.5 py-1 rounded-lg text-xs font-bold border border-green-200 text-green-700 hover:bg-green-50 mr-1.5">입고</button>
                  <button onClick={() => setTxPreset({ product: p, type: 'out' })} className="px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-200 text-blue-700 hover:bg-blue-50">출고/반출</button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button onClick={() => setEditing(p)} className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 mr-1.5">수정</button>
                  <button onClick={() => remove(p)} className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-100 text-red-500 hover:bg-red-50">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <ProductModal initial={editing} onClose={() => { setEditing(null); setCreating(false) }} onSaved={async () => { setEditing(null); setCreating(false); await reload() }} />
      )}
      {txPreset && (
        <TxModal products={[txPreset.product]} presetType={txPreset.type} lockProduct
          onClose={() => setTxPreset(null)} onSaved={async () => { setTxPreset(null); await reload() }} />
      )}
    </div>
  )
}

function Kpi({ label, value, color = 'text-gray-900' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function ProductModal({ initial, onClose, onSaved }: { initial: EnteralProduct | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ProductInput>(initial ? { ...initial } : { name: '', brand: '', unit: '팩', spec: '', memo: '', unit_price: undefined, is_active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof ProductInput, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name?.trim()) { setError('제품명을 입력해주세요.'); return }
    setSaving(true); setError('')
    try {
      if (initial) await enteralAPI.updateProduct(initial.id, form)
      else await enteralAPI.createProduct(form)
      onSaved()
    } catch (e: any) { setError(e?.message ?? '저장 실패'); setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300'
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1'

  return (
    <Modal title={initial ? '경관식 종류 수정' : '경관식 종류 추가'} onClose={onClose}>
      {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="space-y-3">
        <div><label className={labelCls}>제품명 *</label><input value={form.name ?? ''} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="예) 그린비아 / 뉴케어" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>브랜드</label><input value={form.brand ?? ''} onChange={e => set('brand', e.target.value)} className={inputCls} placeholder="제조사" /></div>
          <div><label className={labelCls}>단위</label><input value={form.unit ?? ''} onChange={e => set('unit', e.target.value)} className={inputCls} placeholder="팩/캔/통" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>규격/열량</label><input value={form.spec ?? ''} onChange={e => set('spec', e.target.value)} className={inputCls} placeholder="예) 200ml" /></div>
          <div><label className={labelCls}>기본 단가(원/{form.unit || '단위'})</label><input type="number" min={0} value={form.unit_price ?? ''} onChange={e => set('unit_price', e.target.value === '' ? null : parseInt(e.target.value))} className={inputCls} placeholder="예) 1800" /></div>
        </div>
        <div><label className={labelCls}>메모</label><textarea value={form.memo ?? ''} onChange={e => set('memo', e.target.value)} rows={2} className={inputCls} /></div>
        {initial && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={!!form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 accent-orange-500" /> 활성
          </label>
        )}
      </div>
      <ModalFooter onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  )
}

/* ─────────────────── 입출고 내역 ─────────────────── */
function TxTab({ products, reloadProducts, setError }: { products: EnteralProduct[]; reloadProducts: () => Promise<void>; setError: (s: string) => void }) {
  const [items, setItems] = useState<EnteralTx[]>([])
  const [summary, setSummary] = useState<{ in: number; out: number; in_amount: number; out_amount: number; count: number }>({ in: 0, out: 0, in_amount: 0, out_amount: 0, count: 0 })
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('')
  const [productId, setProductId] = useState('')
  const [resident, setResident] = useState('')
  const [adding, setAdding] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await enteralAPI.transactions({
        tx_type: type || undefined, product_id: productId || undefined, resident: resident || undefined,
      })
      setItems(d.items); setSummary(d.summary)
    } catch (e: any) { setError(e?.message ?? '내역을 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [type, productId, resident])

  const remove = async (t: EnteralTx) => {
    if (!confirm('이 내역을 삭제할까요?')) return
    try { await enteralAPI.deleteTransaction(t.id); await load(); await reloadProducts() }
    catch (e: any) { setError(e?.message ?? '삭제 실패') }
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="입고 합계" value={`+${summary.in.toLocaleString()}`} color="text-green-600" />
        <Kpi label="출고/반출 합계" value={`-${summary.out.toLocaleString()}`} color="text-blue-600" />
        <Kpi label="출고 금액" value={won(summary.out_amount)} />
        <Kpi label="내역 수" value={`${summary.count.toLocaleString()}건`} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm mb-4 flex flex-wrap items-center gap-2">
        {([['', '전체'], ['in', '입고'], ['out', '출고/반출']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setType(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${type === v ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{label}</button>
        ))}
        <select value={productId} onChange={e => setProductId(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">전체 제품</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={resident} onChange={e => setResident(e.target.value)} placeholder="어르신 이름" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-32" />
        <div className="flex-1" />
        <DownloadBtn label="내역 엑셀" onClick={async () => { const b = await enteralAPI.exportBlob('transactions', { tx_type: type || undefined, product_id: productId || undefined, resident: resident || undefined }); downloadBlob(b, `입출고내역_${stamp()}.xlsx`) }} />
        <button onClick={() => setAdding(true)} className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-900 text-white hover:bg-black">+ 입출고 등록</button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {['거래일', '구분', '제품', '수량', '단가', '금액', '어르신', '메모', '작성자', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">{loading ? '불러오는 중…' : '내역이 없습니다.'}</td></tr>
            )}
            {items.map(t => (
              <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                <td className="px-4 py-3 text-gray-600 tabular-nums whitespace-nowrap">{fmtDate(t.tx_date)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${t.tx_type === 'in' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{t.tx_type === 'in' ? '입고' : '출고'}</span>
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900">{t.product_name}</td>
                <td className={`px-4 py-3 font-bold tabular-nums ${t.tx_type === 'in' ? 'text-green-600' : 'text-blue-600'}`}>{t.tx_type === 'in' ? '+' : '-'}{t.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500 tabular-nums">{won(t.unit_price)}</td>
                <td className="px-4 py-3 font-semibold text-gray-700 tabular-nums">{won(t.amount)}</td>
                <td className="px-4 py-3 text-gray-600">{t.resident_name || '-'}</td>
                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={t.note ?? ''}>{t.note || '-'}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{t.created_by || '-'}<span className="block text-[10px]">{fmtDT(t.created_at)}</span></td>
                <td className="px-4 py-3"><button onClick={() => remove(t)} className="text-xs text-red-400 hover:text-red-600">삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <TxModal products={products} onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await load(); await reloadProducts() }} />
      )}
    </div>
  )
}

function TxModal({ products, presetType, lockProduct, onClose, onSaved }: {
  products: EnteralProduct[]; presetType?: TxType; lockProduct?: boolean; onClose: () => void; onSaved: () => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [txType, setTxType] = useState<TxType>(presetType ?? 'in')
  const [quantity, setQuantity] = useState<number>(1)
  const [resident, setResident] = useState('')
  const [residentId, setResidentId] = useState<string | null>(null)
  const [residents, setResidents] = useState<EnteralResident[]>([])
  const [residentMode, setResidentMode] = useState<'list' | 'manual'>('list')
  const [txDate, setTxDate] = useState(today())
  const [unitPrice, setUnitPrice] = useState<number>(products[0]?.unit_price ?? 0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const p = products.find(x => x.id === productId)
    if (p && p.unit_price != null) setUnitPrice(p.unit_price)
  }, [productId])

  useEffect(() => {
    enteralAPI.residents().then(setResidents).catch(() => setResidents([]))
  }, [])

  const save = async () => {
    if (!productId) { setError('제품을 선택해주세요.'); return }
    if (!quantity || quantity <= 0) { setError('수량을 1 이상 입력해주세요.'); return }
    setSaving(true); setError('')
    try {
      await enteralAPI.createTransaction({
        product_id: productId, tx_type: txType, quantity: Number(quantity),
        unit_price: unitPrice || null,
        resident_name: txType === 'out' ? (resident.trim() || null) : null,
        resident_id: txType === 'out' ? residentId : null,
        tx_date: txDate, note: note.trim() || null,
      })
      onSaved()
    } catch (e: any) { setError(e?.message ?? '저장 실패'); setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300'
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1'
  const cur = products.find(p => p.id === productId)

  return (
    <Modal title="입출고 등록" onClose={onClose}>
      {error && <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(['in', 'out'] as TxType[]).map(t => (
            <button key={t} onClick={() => setTxType(t)}
              className={`py-2 rounded-lg text-sm font-bold border ${txType === t ? (t === 'in' ? 'bg-green-600 text-white border-green-600' : 'bg-blue-600 text-white border-blue-600') : 'bg-white text-gray-600 border-gray-200'}`}>
              {t === 'in' ? '입고' : '출고/반출'}
            </button>
          ))}
        </div>
        <div>
          <label className={labelCls}>제품 *</label>
          <select value={productId} onChange={e => setProductId(e.target.value)} disabled={lockProduct} className={`${inputCls} disabled:bg-gray-100`}>
            {products.length === 0 && <option value="">제품을 먼저 등록하세요</option>}
            {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.brand ? ` (${p.brand})` : ''} · 재고 {p.stock}</option>)}
          </select>
          {cur && <p className="mt-1 text-xs text-gray-400">현재고 {cur.stock}{cur.unit || ''}{txType === 'out' && quantity > 0 ? ` → 출고 후 ${cur.stock - quantity}${cur.unit || ''}` : ''}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>수량 *</label><input type="number" min={1} value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} className={inputCls} /></div>
          <div><label className={labelCls}>거래일</label><DateField value={txDate} onChange={v => setTxDate(v)} className={inputCls} clearable={false} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>{txType === 'in' ? '매입 단가' : '단가'} (원/1{cur?.unit || '단위'})</label><input type="number" min={0} value={unitPrice} onChange={e => setUnitPrice(parseInt(e.target.value) || 0)} className={inputCls} /></div>
          <div><label className={labelCls}>금액</label><div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 tabular-nums">{(quantity * unitPrice).toLocaleString()}원</div></div>
        </div>
        {txType === 'in' && <p className="text-[11px] text-gray-400">입고 단가를 입력하면 이 제품의 기본 단가로 저장되어 이후 출고 원가에 자동 적용됩니다.</p>}
        {txType === 'out' && (
          <div>
            <label className={labelCls}>어르신(반출 대상)</label>
            {residentMode === 'list' && residents.length > 0 ? (
              <select value={resident} onChange={e => { setResident(e.target.value); setResidentId(residents.find(x => x.name === e.target.value)?.id ?? null) }} className={inputCls}>
                <option value="">어르신 선택</option>
                {residents.map(r => <option key={r.id} value={r.name}>{r.name}{r.room_name ? ` · ${r.room_name}` : ''}</option>)}
              </select>
            ) : (
              <input value={resident} onChange={e => { setResident(e.target.value); setResidentId(null) }} className={inputCls} placeholder="성함" />
            )}
            {residents.length > 0 && (
              <button type="button" onClick={() => setResidentMode(m => (m === 'list' ? 'manual' : 'list'))} className="mt-1 text-xs text-gray-400 hover:text-gray-600">
                {residentMode === 'list' ? '목록에 없으면 직접 입력 →' : '← 목록에서 선택'}
              </button>
            )}
          </div>
        )}
        <div><label className={labelCls}>메모</label><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={inputCls} placeholder="비고" /></div>
      </div>
      <ModalFooter onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  )
}

/* ─────────────────── 공용 모달 ─────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
function ModalFooter({ onClose, onSave, saving }: { onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50">취소</button>
      <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold bg-primary-orange text-white hover:bg-primary-orange/90 disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
    </div>
  )
}

/* ─────────────────── 어르신별 비용 ─────────────────── */
function CostTab({ setError }: { setError: (s: string) => void }) {
  const [items, setItems] = useState<ResidentCost[]>([])
  const [total, setTotal] = useState(0)
  const [period, setPeriod] = useState<'this' | 'last' | 'all'>('this')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const range = (): { start_date?: string; end_date?: string } => {
    if (period === 'all') return {}
    const now = new Date()
    const base = period === 'this' ? now : new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const y = base.getFullYear(), m = base.getMonth()
    const pad = (n: number) => String(n).padStart(2, '0')
    const last = new Date(y, m + 1, 0)
    return { start_date: `${y}-${pad(m + 1)}-01`, end_date: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}` }
  }

  const load = async () => {
    setLoading(true)
    try {
      const d = await enteralAPI.residentCosts(range())
      setItems(d.items); setTotal(d.total)
    } catch (e: any) { setError(e?.message ?? '비용을 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [period])

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Kpi label="총 출고 비용" value={won(total)} color="text-blue-600" />
        <Kpi label="대상 어르신" value={`${items.length}명`} />
        <Kpi label="기간" value={period === 'this' ? '이번 달' : period === 'last' ? '지난 달' : '전체'} />
      </div>

      <div className="flex items-center gap-2 mb-4">
        {([['this', '이번 달'], ['last', '지난 달'], ['all', '전체']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setPeriod(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${period === v ? 'bg-primary-orange text-white border-primary-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{label}</button>
        ))}
        <div className="flex-1" />
        <DownloadBtn label="비용 엑셀" onClick={async () => { const b = await enteralAPI.exportBlob('resident-costs', range() as Record<string, string | undefined>); downloadBlob(b, `어르신별비용_${stamp()}.xlsx`) }} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {['어르신', '출고 수량', '비용', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">{loading ? '불러오는 중…' : '출고(반출) 내역이 없습니다.'}</td></tr>
            )}
            {items.map(r => (
              <FragmentRow key={r.resident_name} r={r} open={!!open[r.resident_name]} toggle={() => setOpen(o => ({ ...o, [r.resident_name]: !o[r.resident_name] }))} />
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-100 bg-gray-50/50">
                <td className="px-4 py-3 font-bold text-gray-900">합계</td>
                <td className="px-4 py-3 font-bold tabular-nums text-gray-700">{items.reduce((a, x) => a + x.qty, 0).toLocaleString()}</td>
                <td className="px-4 py-3 font-bold tabular-nums text-blue-700">{won(total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">※ 비용은 출고(반출) 내역의 단가 × 수량으로 계산됩니다. 단가는 입고 시 입력값 또는 제품 기본 단가가 적용됩니다.</p>
    </div>
  )
}

function FragmentRow({ r, open, toggle }: { r: ResidentCost; open: boolean; toggle: () => void }) {
  return (
    <>
      <tr className="border-t border-gray-50 hover:bg-orange-50/30 cursor-pointer" onClick={toggle}>
        <td className="px-4 py-3 font-semibold text-gray-900">{r.resident_name}</td>
        <td className="px-4 py-3 tabular-nums text-gray-600">{r.qty.toLocaleString()}</td>
        <td className="px-4 py-3 tabular-nums font-bold text-blue-700">{won(r.amount)}</td>
        <td className="px-4 py-3 text-xs text-gray-400">{open ? '▲ 접기' : `▼ 제품 ${r.products.length}종`}</td>
      </tr>
      {open && r.products.map(p => (
        <tr key={p.product_name} className="bg-gray-50/40 text-xs">
          <td className="px-8 py-2 text-gray-500">└ {p.product_name}</td>
          <td className="px-4 py-2 tabular-nums text-gray-500">{p.qty.toLocaleString()}</td>
          <td className="px-4 py-2 tabular-nums text-gray-600">{won(p.amount)}</td>
          <td />
        </tr>
      ))}
    </>
  )
}
