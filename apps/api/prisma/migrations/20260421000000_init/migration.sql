-- ============================================================================
-- Nuxia Commerce × 3-Generation Referral — Initial Schema (v0.2.0)
-- Generated snapshot from prisma/schema.prisma (16 models / 9 enums)
-- Policies: T1 T2 T3 T4 T5 T6 T7 T8
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF', 'STAFF_FAMILY', 'ADMIN');

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'WITHDRAWN', 'UNDER_REVIEW', 'MINOR_HOLD');

CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SOLD_OUT', 'HIDDEN', 'ARCHIVED');

CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'PARTIAL_REFUNDED', 'HOLD');

CREATE TYPE "LedgerType" AS ENUM ('EARN', 'REVERT');

CREATE TYPE "LedgerStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SUSPENDED_FOR_REVIEW', 'PAID', 'CLAWBACK_REQUESTED');

CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'WITHHELD', 'PAID', 'FAILED', 'CLAWBACK_REQUESTED');

CREATE TYPE "AbuseKind" AS ENUM ('SELF_REFERRAL', 'ANCESTOR_SELF_REFERRAL', 'CIRCULAR', 'DUPLICATE_CI', 'STAFF_REFERRAL', 'WITHDRAW_REJOIN_COOLDOWN', 'RATE_LIMIT', 'BOT_PATTERN', 'SWAP', 'MULTI_ACCOUNT');

CREATE TYPE "AbuseAction" AS ENUM ('LOGGED', 'BLOCKED', 'HELD', 'SUSPENDED');

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "nickname" TEXT NOT NULL,
    "ci" TEXT,
    "ciHash" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "phoneNumber" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "payoutEligibility" BOOLEAN NOT NULL DEFAULT true,
    "referralCode" TEXT NOT NULL,
    "referrerId" TEXT,
    "ancestorPath" TEXT[],
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Session
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- BankAccount
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountNumberMasked" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- Product
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "listPriceKrw" BIGINT NOT NULL,
    "salePriceKrw" BIGINT NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "brandName" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "images" TEXT[],
    "referralPreviewBps" INTEGER DEFAULT 2500,
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- Cart
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CartItem
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- Order
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalAmountKrw" BIGINT NOT NULL,
    "subtotalAmountKrw" BIGINT NOT NULL DEFAULT 0,
    "couponDiscountKrw" BIGINT NOT NULL DEFAULT 0,
    "pointUsedKrw" BIGINT NOT NULL DEFAULT 0,
    "discountKrw" BIGINT NOT NULL DEFAULT 0,
    "shippingFeeKrw" BIGINT NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentId" TEXT,
    "paymentMethod" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundedAmountKrw" BIGINT NOT NULL DEFAULT 0,
    "shippingAddress" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- OrderItem
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "imageUrlSnapshot" TEXT,
    "optionSummary" TEXT,
    "unitPriceKrw" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineAmountKrw" BIGINT NOT NULL DEFAULT 0,
    "refundedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- Refund
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountKrw" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "ratioBps" INTEGER NOT NULL,
    "lateRefund" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- ReferralLedger
CREATE TABLE "ReferralLedger" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amountKrw" BIGINT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralLedger_pkey" PRIMARY KEY ("id")
);

-- Payout
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "amountGrossKrw" BIGINT NOT NULL,
    "amountTaxKrw" BIGINT NOT NULL DEFAULT 0,
    "amountNetKrw" BIGINT NOT NULL,
    "taxConfigId" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "bankMaskedAccount" TEXT,
    "processedAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- PayoutTaxConfig
CREATE TABLE "PayoutTaxConfig" (
    "id" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "withholdingBps" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutTaxConfig_pkey" PRIMARY KEY ("id")
);

-- AbuseLog
CREATE TABLE "AbuseLog" (
    "id" TEXT NOT NULL,
    "kind" "AbuseKind" NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 3,
    "primaryUserId" TEXT,
    "relatedUserIds" TEXT[],
    "relatedOrderIds" TEXT[],
    "evidence" JSONB NOT NULL,
    "action" "AbuseAction" NOT NULL DEFAULT 'LOGGED',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbuseLog_pkey" PRIMARY KEY ("id")
);

-- AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "reason" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- WebhookEvent
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "eventTimestamp" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureOk" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- Unique indexes
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_ciHash_key" ON "User"("ciHash");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

CREATE UNIQUE INDEX "BankAccount_userId_key" ON "BankAccount"("userId");

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

CREATE UNIQUE INDEX "Order_paymentId_key" ON "Order"("paymentId");

CREATE UNIQUE INDEX "ReferralLedger_orderId_beneficiaryUserId_generation_type_key" ON "ReferralLedger"("orderId", "beneficiaryUserId", "generation", "type");

CREATE UNIQUE INDEX "Payout_userId_periodStart_periodEnd_key" ON "Payout"("userId", "periodStart", "periodEnd");

CREATE UNIQUE INDEX "WebhookEvent_source_externalId_eventType_eventTimestamp_key" ON "WebhookEvent"("source", "externalId", "eventType", "eventTimestamp");

-- ----------------------------------------------------------------------------
-- Non-unique indexes
-- ----------------------------------------------------------------------------

CREATE INDEX "User_referrerId_idx" ON "User"("referrerId");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_role_idx" ON "User"("role");

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_category_idx" ON "Product"("category");

CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_status_idx" ON "Order"("status");

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

CREATE INDEX "ReferralLedger_beneficiaryUserId_createdAt_idx" ON "ReferralLedger"("beneficiaryUserId", "createdAt");
CREATE INDEX "ReferralLedger_status_idx" ON "ReferralLedger"("status");

CREATE INDEX "Payout_status_idx" ON "Payout"("status");

CREATE INDEX "PayoutTaxConfig_effectiveFrom_idx" ON "PayoutTaxConfig"("effectiveFrom");

CREATE INDEX "AbuseLog_kind_detectedAt_idx" ON "AbuseLog"("kind", "detectedAt");
CREATE INDEX "AbuseLog_primaryUserId_idx" ON "AbuseLog"("primaryUserId");

CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_target_idx" ON "AuditLog"("target");

CREATE INDEX "WebhookEvent_processedAt_idx" ON "WebhookEvent"("processedAt");

-- ----------------------------------------------------------------------------
-- Foreign keys
-- ----------------------------------------------------------------------------

ALTER TABLE "User" ADD CONSTRAINT "User_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralLedger" ADD CONSTRAINT "ReferralLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralLedger" ADD CONSTRAINT "ReferralLedger_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_taxConfigId_fkey" FOREIGN KEY ("taxConfigId") REFERENCES "PayoutTaxConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AbuseLog" ADD CONSTRAINT "AbuseLog_primaryUserId_fkey" FOREIGN KEY ("primaryUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
