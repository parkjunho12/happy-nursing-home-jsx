import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEPLOY_BRANCH, deploysOnMerge, mergeConfirmText, autoDeployNote,
} from '../src/utils/aiEditorDeploy'

/**
 * 화면이 이렇게 말하고 있었다 — "병합되면 GitHub Actions 가 운영에 배포합니다".
 * 그런데 편집기의 기준 브랜치는 develop 이고, 배포 워크플로는 main 에서만 돈다.
 * 병합해도 운영에는 아무것도 반영되지 않는데 반영됐다고 믿게 만든다.
 */

test('배포 브랜치와 같을 때만 배포된다고 말한다', () => {
  assert.equal(deploysOnMerge(DEPLOY_BRANCH), true)
  assert.equal(deploysOnMerge('develop'), false)
  assert.equal(deploysOnMerge(''), false)
  assert.equal(deploysOnMerge(null), false)
  assert.equal(deploysOnMerge(undefined), false)
})

test('develop 이면 "운영에 반영된다" 고 말하지 않는다', () => {
  const t = mergeConfirmText('develop')
  assert.ok(!/운영에 배포합니다/.test(t), '없는 배포를 있다고 하면 안 된다')
  assert.match(t, /운영에 반영되지 않습니다/)
  assert.match(t, new RegExp(DEPLOY_BRANCH))
  assert.match(t, /develop/)
})

test('main 이면 배포된다고 분명히 말한다', () => {
  const t = mergeConfirmText(DEPLOY_BRANCH)
  assert.match(t, /운영에 배포합니다/)
})

test('브랜치를 모를 때도 배포된다고 하지 않는다', () => {
  for (const b of [null, undefined, '']) {
    assert.ok(!/운영에 배포합니다/.test(mergeConfirmText(b)),
      `모르면 배포된다고 하면 안 된다: ${String(b)}`)
  }
})

test('자동 승인 주의 문구도 같은 기준을 따른다', () => {
  assert.match(autoDeployNote(DEPLOY_BRANCH), /운영 배포까지 이어지니/)
  const d = autoDeployNote('develop')
  assert.match(d, /develop/)
  assert.match(d, /따로/)
})
