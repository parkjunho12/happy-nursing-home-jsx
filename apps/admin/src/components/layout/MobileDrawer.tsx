import Sidebar from './Sidebar'

interface Props {
  open:    boolean
  onClose: () => void
}

export default function MobileDrawer({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* 오버레이 */}
      <button
        className="absolute inset-0 w-full h-full bg-black/40"
        onClick={onClose}
        aria-label="메뉴 닫기"
      />
      {/* Drawer */}
      <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl overflow-y-auto">
        <Sidebar mobile onNavigate={onClose} />
      </div>
    </div>
  )
}
