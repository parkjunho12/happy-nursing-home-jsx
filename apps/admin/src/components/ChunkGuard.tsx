import { Component, type ReactNode } from 'react'

/**
 * 화면이 하얗게 남는 것을 막는다.
 *
 * ■ 왜 하얘지는가
 *
 *   이 앱은 페이지마다 파일을 따로 내려받는다(React.lazy). 배포를 하면 옛
 *   파일이 서버에서 지워지는데, 열어 둔 탭은 아직 옛 목록을 들고 있다.
 *   그 상태에서 다른 메뉴로 이동하면 지워진 파일을 부르고, 못 받으면
 *   화면 그리기가 통째로 멈춘다 — 오류 한 줄 없이 하얗게 남는다.
 *
 *   실제로 원장님이 겪으신 '가끔 새로고침해야 하는' 증상이 이것이다.
 *
 * ■ 무엇을 하는가
 *
 *   그 실패를 잡아서 한 번만 자동으로 다시 불러온다. 새 파일 목록을 받아오면
 *   그대로 이어서 쓸 수 있다. 사용자는 잠깐 깜빡이는 것만 본다.
 *
 *   자동 새로고침은 딱 한 번이다. 새로고침해도 계속 실패하는 상황(정말 코드가
 *   깨진 경우)에서 무한히 돌면 화면이 영영 안 뜬다. 두 번째부터는 무슨 일이
 *   일어났는지 적어서 보여주고, 다시 시도할지 사람이 정한다.
 *
 * ■ 왜 '새 버전이 있습니다' 를 먼저 묻지 않는가
 *
 *   묻는 동안 화면은 이미 비어 있다. 이 경우는 되돌릴 것이 없다 — 저장 중이던
 *   내용이 있는 화면이 아니라, 아직 열지도 못한 화면이다. 그래서 바로 받는다.
 */

const RELOAD_KEY = 'chunkGuard.reloadedAt'
const COOLDOWN_MS = 20_000     // 이 시간 안에 또 실패하면 자동 새로고침을 멈춘다

/** 파일을 못 받아서 난 오류인가 — 진짜 코드 오류와 구분한다.
 *
 *  여기서 잘못 판단해 진짜 버그까지 새로고침으로 덮으면, 버그는 그대로 있는데
 *  화면만 계속 껌뻑여서 원인을 영영 못 찾는다. 그래서 문구를 좁게 본다.
 */
export function isChunkLoadError(e: unknown): boolean {
  const msg = String((e as any)?.message ?? e ?? '')
  const name = String((e as any)?.name ?? '')
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    // 서버가 HTML 을 돌려줘 자바스크립트로 못 읽은 경우
    /Unexpected token '<'/.test(msg) ||
    /expected expression, got '<'/i.test(msg)
  )
}

type Props = { children: ReactNode }
type State = { failed: boolean; chunk: boolean; detail: string }

export default class ChunkGuard extends Component<Props, State> {
  state: State = { failed: false, chunk: false, detail: '' }

  static getDerivedStateFromError(e: unknown): State {
    return {
      failed: true,
      chunk: isChunkLoadError(e),
      detail: String((e as any)?.message ?? e ?? '').slice(0, 200),
    }
  }

  componentDidCatch(e: unknown) {
    if (!isChunkLoadError(e)) return
    // 방금 새로고침했는데 또 났다면 멈춘다 — 무한 새로고침이 더 나쁘다
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < COOLDOWN_MS) return
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    window.location.reload()
  }

  render() {
    if (!this.state.failed) return this.props.children

    const { chunk, detail } = this.state
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-3xl mb-3">{chunk ? '🔄' : '⚠️'}</p>
          <h1 className="text-base font-bold text-gray-900 mb-1">
            {chunk ? '새 버전이 올라왔습니다' : '화면을 여는 중 문제가 생겼습니다'}
          </h1>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            {chunk
              ? '프로그램이 업데이트되어 이 화면을 다시 불러와야 합니다. 아래 단추를 눌러주세요.'
              : '잠시 후 다시 시도해 주세요. 계속 같으면 알려주세요.'}
          </p>
          <button
            onClick={() => { sessionStorage.removeItem(RELOAD_KEY); window.location.reload() }}
            className="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700">
            다시 불러오기
          </button>
          {!chunk && detail && (
            <p className="mt-4 text-[11px] text-gray-300 break-all">{detail}</p>
          )}
        </div>
      </div>
    )
  }
}
