import { describe, expect, it } from 'vitest';
import {
  assertValidOrderTransition,
  mapOrderStatusToTableStatus,
} from '../../src/services/orderStateMachine.service.js';

const computeBillBreakdown = ({ items, taxPercent = 5, serviceChargePercent = 0, discount = 0, tip = 0, splitWays = 1 }) => {
  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(((taxable * taxPercent) / 100 + Number.EPSILON) * 100) / 100;
  const serviceCharge =
    Math.round(((taxable * serviceChargePercent) / 100 + Number.EPSILON) * 100) / 100;
  const grandTotal = Math.round(taxable + tax + serviceCharge + tip);
  const equalShare = Math.round(((grandTotal / Math.max(1, splitWays)) + Number.EPSILON) * 100) / 100;
  return { subtotal, tax, serviceCharge, grandTotal, equalShare };
};

describe('Order State Machine & Role Transitions', () => {
  it('allows valid PLACED -> CONFIRMED -> PREPARING -> READY -> SERVED transitions', () => {
    expect(() =>
      assertValidOrderTransition({ currentStatus: 'PLACED', nextStatus: 'CONFIRMED', actorRole: 'waiter' })
    ).not.toThrow();
    expect(() =>
      assertValidOrderTransition({ currentStatus: 'CONFIRMED', nextStatus: 'PREPARING', actorRole: 'kitchen' })
    ).not.toThrow();
    expect(() =>
      assertValidOrderTransition({ currentStatus: 'PREPARING', nextStatus: 'READY', actorRole: 'kitchen' })
    ).not.toThrow();
    expect(() =>
      assertValidOrderTransition({ currentStatus: 'READY', nextStatus: 'SERVED', actorRole: 'waiter' })
    ).not.toThrow();
  });

  it('rejects unauthorized role transitions and cancellation after PREPARING', () => {
    expect(() =>
      assertValidOrderTransition({ currentStatus: 'PLACED', nextStatus: 'PREPARING', actorRole: 'waiter' })
    ).toThrow();
    expect(() =>
      assertValidOrderTransition({ currentStatus: 'PREPARING', nextStatus: 'CANCELLED', actorRole: 'admin' })
    ).toThrow();
  });

  it('maps order statuses to corresponding table statuses', () => {
    expect(mapOrderStatusToTableStatus('PLACED')).toBe('WAITING');
    expect(mapOrderStatusToTableStatus('PREPARING')).toBe('PREPARING');
    expect(mapOrderStatusToTableStatus('READY')).toBe('READY');
    expect(mapOrderStatusToTableStatus('SERVED')).toBe('SEATED');
  });
});

describe('Price Calculation & Equal Bill Split', () => {
  it('calculates GST, discount, tip, and equal split accurately', () => {
    const res = computeBillBreakdown({
      items: [
        { price: 250, qty: 2 },
        { price: 300, qty: 1 },
      ],
      taxPercent: 5,
      serviceChargePercent: 5,
      discount: 100,
      tip: 50,
      splitWays: 3,
    });

    expect(res.subtotal).toBe(800);
    expect(res.tax).toBe(35);
    expect(res.serviceCharge).toBe(35);
    expect(res.grandTotal).toBe(870);
    expect(res.equalShare).toBe(290);
  });
});
