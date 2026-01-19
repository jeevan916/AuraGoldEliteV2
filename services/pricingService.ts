import { JewelryDetail, GlobalSettings, Order, OrderStatus, ProtectionStatus, Milestone } from '../types';

export const pricingService = {
  /**
   * Standard Rounding to 0 decimals for Indian Rupee Billing.
   * Prevents 0.999999999 floating point errors.
   */
  round(val: number): number {
    return Math.round(val);
  },

  calculateItemPrice(item: Partial<JewelryDetail>, goldRate24K: number, settings: GlobalSettings) {
    const purity = item.purity || '22K';
    let rate = goldRate24K;

    if (purity === '22K') rate = goldRate24K * settings.purityFactor22K;
    else if (purity === '18K') rate = goldRate24K * settings.purityFactor18K;

    const metalValue = (item.netWeight || 0) * rate;
    const wastageValue = metalValue * ((item.wastagePercentage || 0) / 100);
    const laborValue = (item.makingChargesPerGram || 0) * (item.netWeight || 0);
    const stoneTotal = (item.stoneEntries || []).reduce((acc, s) => acc + (s.total || 0), 0);
    
    const subTotal = metalValue + wastageValue + laborValue + stoneTotal;
    const tax = subTotal * (settings.defaultTaxRate / 100);

    return {
      metalValue: this.round(metalValue),
      wastageValue: this.round(wastageValue),
      laborValue: this.round(laborValue),
      stoneTotal: this.round(stoneTotal),
      tax: this.round(tax),
      total: this.round(subTotal + tax)
    };
  },

  repopulateOrderAtMarketRate(order: Order, currentRate24K: number, settings: GlobalSettings): Order {
    // 1. Recalculate Items
    const updatedItems = order.items.map(item => {
      const p = this.calculateItemPrice(item, currentRate24K, settings);
      return {
        ...item,
        baseMetalValue: p.metalValue,
        wastageValue: p.wastageValue,
        totalLaborValue: p.laborValue,
        stoneCharges: p.stoneTotal,
        taxAmount: p.tax,
        finalAmount: p.total
      };
    });

    const newCartTotal = updatedItems.reduce((s, i) => s + i.finalAmount, 0);
    const newNetPayable = Math.max(0, newCartTotal - (order.exchangeValue || 0));
    
    const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
    const remainingBalance = newNetPayable - totalPaid;

    // 2. Adjust Milestones
    const paidMilestones = order.paymentPlan.milestones.filter(m => m.status === 'PAID');
    const pendingMilestones = order.paymentPlan.milestones.filter(m => m.status !== 'PAID');

    if (pendingMilestones.length === 0 && remainingBalance > 0) {
      pendingMilestones.push({
        id: `ADJ-${Date.now()}`,
        dueDate: order.paymentPlan.milestones[order.paymentPlan.milestones.length - 1].dueDate,
        targetAmount: 0,
        cumulativeTarget: 0,
        status: 'PENDING',
        warningCount: 0,
        description: 'Rate Adjustment'
      });
    }

    const perMilestone = this.round(remainingBalance / pendingMilestones.length);
    let runningSum = totalPaid;

    const newPending = pendingMilestones.map((m, idx) => {
      const amount = (idx === pendingMilestones.length - 1) 
        ? (remainingBalance - (perMilestone * (pendingMilestones.length - 1))) 
        : perMilestone;
      
      runningSum += amount;
      return { ...m, targetAmount: this.round(amount), cumulativeTarget: this.round(runningSum), status: 'PENDING' as const };
    });

    return {
      ...order,
      items: updatedItems,
      totalAmount: newCartTotal,
      netPayable: newNetPayable,
      goldRateAtBooking: currentRate24K,
      status: OrderStatus.ACTIVE,
      paymentPlan: {
        ...order.paymentPlan,
        milestones: [...paidMilestones, ...newPending].sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
        protectionStatus: ProtectionStatus.ACTIVE,
        protectionRateBooked: currentRate24K
      }
    };
  }
};