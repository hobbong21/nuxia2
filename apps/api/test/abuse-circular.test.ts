/**
 * M3-4: 어뷰징 A2 — 순환참조
 *
 * 현재 backend 구현상 createUser 안에서만 referrerId를 설정하고 updateReferrer는 없음.
 * 따라서 "순환 참조 시도"는 두 가지 경로로 검증:
 *
 *  (1) A, B 각각 독립 가입 후 Prisma raw 로 B.referrerId=A, A.referrerId=B 로 직접 수정 →
 *      `ancestorPath` 재귀 생성 시 CTE가 무한루프 방지 `gen < 4` 조건으로 상한.
 *  (2) createUser 내부 A2 가드는 ancestorPath.includes(created.id) 를 확인.
 *      정상 경로에선 referrer가 먼저 존재하므로 이 조건은 절대 참이 아니어야 함 (가드가
 *      사후적 안전장치로 작동).
 *
 * 두 측면을 모두 검증.
 */
import { beforeAll, describe, it, expect } from 'vitest'
import { prisma } from './_setup'
import { makeServices, clearAll, createUser } from './fixtures'

const svc = makeServices()

describe('A2 — 순환참조 차단', () => {
  beforeAll(async () => {
    await clearAll()
  })

  it('정상 체인 A→B 가입 후, B를 A의 referrer로 직접 수정해도 ancestors 재귀가 3대에서 종료', async () => {
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })

    // 데이터 공격: A의 referrer를 B로 강제 수정 (실제 API 경로에는 없지만 DB 조작 시뮬레이션)
    await prisma.user.update({
      where: { id: A.id },
      data: { referrerId: B.id },
    })

    // engine.getAncestors 는 `gen < 4` 로 제한되어 무한 루프 없음
    await prisma.$transaction(async (tx) => {
      const ancestors = await svc.referral.getAncestors(tx, A.id)
      // 최대 3세대까지만 반환
      expect(ancestors.length).toBeLessThanOrEqual(3)
      // gen=1 은 B, gen=2 는 A (순환이므로), gen=3 은 다시 B → 3건 이내
      for (const a of ancestors) {
        expect([1, 2, 3]).toContain(a.gen)
      }
    })
  })

  it('createUser 사후 A2 체크: ancestorPath 에 자기 id 포함되지 않음 (정상 가입 경로)', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })

    const cRow = await prisma.user.findUniqueOrThrow({ where: { id: C.id } })
    expect(cRow.ancestorPath).not.toContain(cRow.id)
    expect(cRow.ancestorPath.length).toBeLessThanOrEqual(3)
    expect(cRow.ancestorPath).toEqual([B.id, A.id])
  })

  it('CTE recursion 상한: 인위적 순환(A↔B) 후 getAncestors 는 빠르게 종료 (스택 오버플로 없음)', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    // 양쪽이 서로를 참조하게 수정
    await prisma.user.update({ where: { id: A.id }, data: { referrerId: B.id } })

    const start = Date.now()
    await prisma.$transaction(async (tx) => {
      await svc.referral.getAncestors(tx, A.id)
      await svc.referral.getAncestors(tx, B.id)
    })
    const elapsed = Date.now() - start
    // 5초 안에 끝나야 — 무한루프이면 timeout 발생
    expect(elapsed).toBeLessThan(5_000)
  })
})
