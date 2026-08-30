/**
 * node:test / node:assert 최소 타입 선언.
 *
 * @types/node를 쓰면 pnpm 스토어의 버전 고정 경로에 의존하게 되어
 * CI 러너에서 버전이 다르면 깨진다. 테스트가 쓰는 두 모듈만 직접 선언해
 * 의존성 없이 어디서든 컴파일되게 한다.
 */
declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void
}
declare module 'node:assert/strict' {
  interface Assert {
    (value: unknown, message?: string): asserts value
    equal(actual: unknown, expected: unknown, message?: string): void
    deepEqual(actual: unknown, expected: unknown, message?: string): void
    ok(value: unknown, message?: string): asserts value
    match(value: string, regexp: RegExp, message?: string): void
  }
  const assert: Assert
  export default assert
}

/** 검증표를 읽는 데만 쓴다 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string
}
declare const process: { cwd(): string }
