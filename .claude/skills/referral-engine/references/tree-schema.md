# Referral Tree Schema — 저장 방식 비교 및 쿼리

## 1. Adjacent List (기본 권장)

```prisma
model User {
  id         String  @id
  referrerId String?
  referrer   User?   @relation("Referral", fields: [referrerId], references: [id])
  referees   User[]  @relation("Referral")

  @@index([referrerId])
}
```

### 3세대 조회 (재귀 CTE)

```sql
WITH RECURSIVE chain AS (
  SELECT id, "referrerId", 1 AS gen
    FROM "User" WHERE id = $1
  UNION ALL
  SELECT u.id, u."referrerId", c.gen + 1
    FROM "User" u JOIN chain c ON u.id = c."referrerId"
   WHERE c.gen < 4
)
SELECT "referrerId" AS ancestor_id, gen
  FROM chain
 WHERE "referrerId" IS NOT NULL AND gen BETWEEN 1 AND 3
 ORDER BY gen;
```

**장점:** 간단, 쓰기 단순
**단점:** 트리가 깊어지면 조회 부담. 3세대만 필요하므로 실제로는 큰 문제 아님.

## 2. Materialized Path

```prisma
model User {
  id   String @id
  path String    // 예: '/root/userA/userB/userC'
}
```

### 3세대 조회

```sql
-- path = '/root/A/B/C'
-- parent = '/root/A/B' (1대)
-- grandparent = '/root/A' (2대)
-- great-grandparent = '/root' (3대)

SELECT u.id, 4 - nlevel(u.path) AS gen  -- 개념 예시
  FROM "User" u
 WHERE starts_with('/root/A/B/C', u.path)
   AND u.path <> '/root/A/B/C';
```

**장점:** 한 번의 `LIKE` 또는 prefix 매치로 조회
**단점:** 사용자가 옮겨지거나 재구성 시 모든 하위 path를 갱신해야 함 — 커머스 레퍼럴은 트리 재구성이 없으므로 단점 거의 없음

## 3. PostgreSQL ltree

```sql
CREATE EXTENSION IF NOT EXISTS ltree;

ALTER TABLE "User" ADD COLUMN tree_path ltree;
CREATE INDEX idx_user_tree_path_gist ON "User" USING GIST (tree_path);
```

### 3세대 조회

```sql
-- C의 ancestors 3개
SELECT id
  FROM "User"
 WHERE tree_path @> (SELECT tree_path FROM "User" WHERE id = $1)
   AND nlevel(tree_path) >= nlevel(
     (SELECT tree_path FROM "User" WHERE id = $1)
   ) - 3;
```

**장점:** 고속 계층 질의, 풍부한 연산자
**단점:** extension 설치 필요, 관리 비용 추가

## 선택 가이드

| 상황 | 권장 |
|------|------|
| MVP, 트리 ≤ 10만 노드 | Adjacent List + 재귀 CTE |
| 트리 조회가 빈번(수익 대시보드 등), 10만+ 노드 | Materialized Path |
| 복잡한 계층 쿼리 필요 | ltree |

## 가입 시 무결성 검증 (순환참조 방지)

```ts
async function assertNoCycle(newReferrerId: string, newUserId: string) {
  const ancestors = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE chain AS (
      SELECT id, "referrerId" FROM "User" WHERE id = ${newReferrerId}
      UNION ALL
      SELECT u.id, u."referrerId"
        FROM "User" u JOIN chain c ON u.id = c."referrerId"
       WHERE c.id IS NOT NULL
    )
    SELECT id FROM chain WHERE id = ${newUserId}
  `
  if (ancestors.length > 0) throw new Error('Circular referral detected')
}
```

트랜잭션 내에서 호출하고, 실패 시 가입 롤백.

## 쓰기 부하 최적화

3세대 조회가 빈번한 읽기 패턴이므로:

1. **캐시**: `User.ancestorIds[]` 컬럼에 3세대 id 배열을 비정규화하여 저장
   - 가입 시 1회 계산 후 저장
   - 조회는 배열 읽기로 O(1)
2. **무효화**: 추천인 변경이 불가능한 정책이면 캐시는 영구 유효
