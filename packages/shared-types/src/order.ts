import { z } from 'zod';
import { BigIntStringSchema, IdSchema, IsoDateTimeSchema } from './common';

export const OrderStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'PAID',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'CONFIRMED',
  'REFUNDED',
  'PARTIAL_REFUNDED',
  'CANCELLED',
  'HOLD',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderItemSchema = z.object({
  id: IdSchema,
  orderId: IdSchema,
  productId: IdSchema,
  productNameSnapshot: z.string(),
  imageUrlSnapshot: z.string().url().nullable(),
  unitPriceKrw: BigIntStringSchema,
  quantity: z.number().int().positive(),
  lineAmountKrw: BigIntStringSchema,
  refundedQuantity: z.number().int().min(0).default(0),
  optionSummary: z.string().nullable(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const ShippingAddressSchema = z.object({
  recipientName: z.string().min(1),
  phone: z.string().min(1),
  zipCode: z.string().min(1),
  address1: z.string().min(1),
  address2: z.string().default(''),
  memo: z.string().optional(),
});
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

export const OrderSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  /** 정책 01a T3 — 쿠폰·포인트 차감 후 "레퍼럴 기준 금액" */
  totalAmountKrw: BigIntStringSchema,
  /** 상품 합계 (할인·쿠폰·포인트 전) */
  subtotalAmountKrw: BigIntStringSchema,
  /** 쿠폰 할인액 */
  couponDiscountKrw: BigIntStringSchema,
  /** 정책 01a T4 — 포인트는 현금성으로 분류되나 표시용으로 분리 */
  pointUsedKrw: BigIntStringSchema,
  /** 배송비 */
  shippingFeeKrw: BigIntStringSchema,
  status: OrderStatusSchema,
  paymentId: z.string().nullable(),
  shippingAddress: ShippingAddressSchema.nullable(),
  items: z.array(OrderItemSchema),
  confirmedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Order = z.infer<typeof OrderSchema>;

export const CreateOrderRequestSchema = z.object({
  items: z
    .array(
      z.object({
        productId: IdSchema,
        quantity: z.number().int().positive(),
        optionSummary: z.string().optional(),
      }),
    )
    .min(1),
  couponId: z.string().optional(),
  pointUsedKrw: BigIntStringSchema.default('0'),
  shippingAddress: ShippingAddressSchema,
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export const CreateOrderResponseSchema = z.object({
  orderId: IdSchema,
  totalAmountKrw: BigIntStringSchema,
  paymentId: z.string(),
});
export type CreateOrderResponse = z.infer<typeof CreateOrderResponseSchema>;
