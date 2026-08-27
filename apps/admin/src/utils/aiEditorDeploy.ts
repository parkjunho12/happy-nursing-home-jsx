/**
 * 병합하면 어디로 가는가 — 화면이 사실대로 말하게 한다.
 *
 * 배포 워크플로는 main 에 올라올 때만 돈다. 그런데 편집기의 기준 브랜치는
 * develop 이라, 병합해도 운영에는 아무것도 반영되지 않는다.
 * 그런데 화면은 이렇게 말하고 있었다.
 *
 *   "병합되면 GitHub Actions 가 운영에 배포합니다"
 *
 * 사실이 아니다. 승인·병합해 놓고 운영에 반영된 줄 알면, 반영되지 않은
 * 것을 반영됐다고 믿게 된다. 어르신·직원이 쓰는 화면에서 그건 위험하다.
 *
 * 기준 브랜치가 배포 브랜치와 같을 때만 '배포된다' 고 말한다.
 */

/** 배포 워크플로가 지켜보는 브랜치 (.github/workflows/deploy-*.yml) */
export const DEPLOY_BRANCH = 'main'

export function deploysOnMerge(baseBranch?: string | null): boolean {
  return !!baseBranch && baseBranch === DEPLOY_BRANCH
}

/** 승인·병합 버튼을 누르기 전에 보여줄 말 */
export function mergeConfirmText(baseBranch?: string | null): string {
  const b = baseBranch || '기준 브랜치'
  return deploysOnMerge(baseBranch)
    ? `승인하고 ${b} 에 병합합니다.\n병합되면 GitHub Actions 가 운영에 배포합니다.\n계속할까요?`
    : `승인하고 ${b} 에 병합합니다.\n\n` +
      `※ 이것만으로는 운영에 반영되지 않습니다.\n` +
      `   배포는 ${DEPLOY_BRANCH} 에 올라갈 때 됩니다.\n\n계속할까요?`
}

/** 자동 승인(사람 확인 없이 병합)을 켤 때 보여줄 주의 문구 */
export function autoDeployNote(baseBranch?: string | null): string {
  return deploysOnMerge(baseBranch)
    ? '검증만 통과하면 사람이 보지 않고 병합됩니다. 그대로 운영 배포까지 이어지니 익숙한 수정에만 쓰세요.'
    : `검증만 통과하면 사람이 보지 않고 ${baseBranch || '기준 브랜치'} 에 병합됩니다. ` +
      `운영 배포는 ${DEPLOY_BRANCH} 에 올릴 때 따로 됩니다.`
}
