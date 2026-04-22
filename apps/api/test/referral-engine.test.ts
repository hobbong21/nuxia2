/**
 * M3-3: 기준 시나리오 — 1,000,000원 주문 시 C=30k / B=50k / A=170k
 *
 * Also covers:
 *  - 반올림 floor 규칙 (111,111원 / 1원 edge)
 *  - 3대 초과 체인에서 상위 2명 이후는 플랫폼 귀속
 *  - 환불 역정산 (전체 / 부분 / lateRefund 생략)
 */
import { beforeAll, describe, it, expect } from 'vitest'
import { LedgerType, LedgerStatus } from '@prisma/client'
import { prisma } from './_setup'
import {
  makeServices,
  clearAll,
  createUser,
  createOrder,
  confirmPayment,
  getLedgers,
  findGen,
  sumLedgers,
  placePaidOrder,
} from './fixtures'

const svc = makeServices()

describe('Referral Engine — 3세대 배분 (M3-3)', () => {
  beforeAll(async () => {
    await clearAll()
  })

  it('1,000,000원 주문 시 C=30k / B=50k / A=170k 정확 배분', async () => {
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const { ledgers } = await placePaidOrder(svc, D.id, 1_000_000n)
    const earns = ledgers.filter((l) => l.type === LedgerType.EARN)

    expect(earns).toHaveLength(3)

    const g1 = findGen(earns, 1)
    const g2 = findGen(earns, 2)
    const g3 = findGen(earns, 3)

    expect(g1?.beneficiaryUserId).toBe(C.id)
    expect(g1?.amountKrw).toBe(30_000n)
    expect(g1?.rateBps).toBe(300)

    expect(g2?.beneficiaryUserId).toBe(B.id)
    expect(g2?.amountKrw).toBe(50_000n)
    expect(g2?.rateBps).toBe(500)

    expect(g3?.beneficiaryUserId).toBe(A.id)
    expect(g3?.amountKrw).toBe(170_000n)
    expect(g3?.rateBps).toBe(1700)

    expect(sumLedgers(earns)).toBe(250_000n)
  })

  it('111,111원 주문 시 floor 반올림 적용 (gen3 = 18,888원, 차액은 플랫폼 귀속)', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const { ledgers } = await placePaidOrder(svc, D.id, 111_111n)
    const earns = ledgers.filter((l) => l.type === LedgerType.EARN)

    // floor(111_111 * 300 / 10000) = 3333
    expect(findGen(earns, 1)?.amountKrw).toBe(3_333n)
    // floor(111_111 * 500 / 10000) = 5555
    expect(findGen(earns, 2)?.amountKrw).toBe(5_555n)
    // floor(111_111 * 1700 / 10000) = 18888 (실제 18888.87)
    expect(findGen(earns, 3)?.amountKrw).toBe(18_888n)

    // 실제 배분 합은 27,776원이고 25% 상응인 27,777.75원보다 작음 → 차액은 플랫폼 귀속
    expect(sumLedgers(earns)).toBe(27_776n)
  })

  it('1원 주문 시 모든 세대 bps 연산 결과가 0 → 원장 생성 없음', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const { ledgers } = await placePaidOrder(svc, D.id, 1n)
    const earns = ledgers.filter((l) => l.type === LedgerType.EARN)
    expect(earns).toHaveLength(0)
  })

  it('3대 초과(5대 체인)는 D로부터 상위 3명까지만 배분', async () => {
    await clearAll()
    // E→D→C→B→A 체인(5명). A가 최말단 구매자.
    const root = await createUser(svc) // 최상위 (4대)
    const a4 = await createUser(svc, { referrerId: root.id }) // 4대 이상: 제외
    const a3 = await createUser(svc, { referrerId: a4.id }) // gen3
    const a2 = await createUser(svc, { referrerId: a3.id }) // gen2
    const a1 = await createUser(svc, { referrerId: a2.id }) // gen1
    const buyer = await createUser(svc, { referrerId: a1.id })

    const { ledgers } = await placePaidOrder(svc, buyer.id, 1_000_000n)
    const earns = ledgers.filter((l) => l.type === LedgerType.EARN)

    // 정확히 3명(gen1=a1, gen2=a2, gen3=a3)
    expect(earns).toHaveLength(3)
    expect(findGen(earns, 1)?.beneficiaryUserId).toBe(a1.id)
    expect(findGen(earns, 2)?.beneficiaryUserId).toBe(a2.id)
    expect(findGen(earns, 3)?.beneficiaryUserId).toBe(a3.id)

    // 최상위 2명(root, a4)은 수혜자 아님
    const benefIds = new Set(earns.map((l) => l.beneficiaryUserId))
    expect(benefIds.has(root.id)).toBe(false)
    expect(benefIds.has(a4.id)).toBe(false)
  })

  it('결손 세대(gen3 추천인 없음)는 플랫폼 귀속 → 원장 2건만 생성', async () => {
    await clearAll()
    // 체인 B→C→D (A 없음). D 구매 시 gen1=C, gen2=B, gen3 없음.
    const B = await createUser(svc)
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const { ledgers } = await placePaidOrder(svc, D.id, 1_000_000n)
    const earns = ledgers.filter((l) => l.type === LedgerType.EARN)
    expect(earns).toHaveLength(2)
    expect(findGen(earns, 1)?.beneficiaryUserId).toBe(C.id)
    expect(findGen(earns, 2)?.beneficiaryUserId).toBe(B.id)
    expect(findGen(earns, 3)).toBeUndefined()
  })

  it('멱등성: 동일 orderId 재분배 시 UNIQUE 제약으로 원장 중복 생성 없음', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const { order } = await placePaidOrder(svc, D.id, 1_000_000n)
    // 두 번째 호출 — 원장 개수 변함 없어야 함
    await prisma.$transaction(async (tx) => {
      await svc.referral.distribute(tx, order.id)
    })
    const earns = await getLedgers(order.id, 'EARN')
    expect(earns).toHaveLength(3)
    expect(sumLedgers(earns)).toBe(250_000n)
  })
})

describe('환불 역정산 (T2 포함)', () => {
  it('전체 환불 시 REVERT 3개 생성, 순액 0', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const { order } = await placePaidOrder(svc, D.id, 1_000_000n)
    await svc.payment.refundFull(order.id, 'customer_request')

    const ledgers = await getLedgers(order.id)
    const earns = ledgers.filter((l) => l.type === LedgerType.EARN)
    const reverts = ledgers.filter((l) => l.type === LedgerType.REVERT)

    expect(earns).toHaveLength(3)
    expect(reverts).toHaveLength(3)
    // 순액(합) = 0
    expect(sumLedgers(ledgers)).toBe(0n)
    // REVERT 레코드는 모두 음수
    for (const r of reverts) expect(r.amountKrw < 0n).toBe(true)
  })

  it('50% 부분 환불 시 REVERT 금액이 EARN의 정확히 -50%', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const { order } = await placePaidOrder(svc, D.id, 1_000_000n)
    await svc.payment.refundPartial(order.id, 5_000, 'partial')

    const ledgers = await getLedgers(order.id)
    const earns = ledgers.filter((l) => l.type === LedgerType.EARN)
    const reverts = ledgers.filter((l) => l.type === LedgerType.REVERT)

    expect(earns).toHaveLength(3)
    expect(reverts).toHaveLength(3)

    for (const e of earns) {
      const matching = reverts.find(
        (r) => r.generation === e.generation && r.beneficiaryUserId === e.beneficiaryUserId,
      )
      expect(matching).toBeDefined()
      // floor(earn * 5000 / 10000)
      const expectedRevert = -((e.amountKrw * 5_000n) / 10_000n)
      expect(matching!.amountKrw).toBe(expectedRevert)
    }
  })

  it('유보기간 경과(lateRefund=true) 환불은 REVERT 생략', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const { order } = await placePaidOrder(svc, D.id, 1_000_000n)

    // confirmedAt 을 HOLD_DAYS(7일) 이전으로 강제 설정 → late=true 분기
    const past = new Date(Date.now() - 10 * 86_400_000)
    await prisma.order.update({
      where: { id: order.id },
      data: { confirmedAt: past },
    })

    await svc.payment.refundFull(order.id, 'late')
    const ledgers = await getLedgers(order.id)
    const earns = ledgers.filter((l) => l.type === LedgerType.EARN)
    const reverts = ledgers.filter((l) => l.type === LedgerType.REVERT)

    expect(earns).toHaveLength(3)
    expect(reverts).toHaveLength(0) // 역정산 생략
  })
})
