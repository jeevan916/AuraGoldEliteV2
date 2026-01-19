
import { Order, JewelryDetail, GlobalSettings, Milestone, OrderStatus, ProtectionStatus } from '../types';

/**
 * Handles all financial calculations for the AuraGold system.
 * Professional approach uses integer rounding to avoid floating point drift.
 */
export const financialService = {
    
    /**
     * Calculates the quote for a single jewelry item based on current settings and market rates.
     */
    calculateItemQuote(item: Partial<JewelryDetail>, settings: GlobalSettings, marketRate: number): Partial<JewelryDetail> {
        const rate = item.purity === '24K' ? settings.currentGoldRate24K : 
                     item.purity === '18K' ? settings.currentGoldRate18K : marketRate;
        
        const metalValue = Math.round((item.netWeight || 0) * rate);
        const wastageValue = Math.round(metalValue * ((item.wastagePercentage || 0) / 100));
        const laborValue = Math.round((item.makingChargesPerGram || 0) * (item.netWeight || 0));
        const subTotal = metalValue + wastageValue + laborValue + (item.stoneCharges || 0);
        const tax = Math.round(subTotal * (settings.defaultTaxRate / 100));
        
        return {
            ...item,
            baseMetalValue: metalValue,
            wastageValue,
            totalLaborValue: laborValue,
            taxAmount: tax,
            finalAmount: subTotal + tax
        };
    },

    /**
     * Repopulates an order based on new market rates. Used when rate protection lapses.
     */
    repopulateOrderAtMarket(order: Order, settings: GlobalSettings): Order {
        const currentRate = settings.currentGoldRate22K;
        
        // 1. Recalculate Items
        const updatedItems = order.items.map(item => {
            const quote = this.calculateItemQuote(item, settings, currentRate);
            return { ...item, ...quote } as JewelryDetail;
        });

        const newTotal = updatedItems.reduce((s, i) => s + i.finalAmount, 0);
        const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
        const remainingBalance = newTotal - totalPaid;

        // 2. Adjust Milestones
        const paidMilestones = order.paymentPlan.milestones.filter(m => m.status === 'PAID');
        const pendingMilestones = order.paymentPlan.milestones.filter(m => m.status !== 'PAID');

        // Distribute remaining balance equally among pending milestones
        const count = pendingMilestones.length || 1;
        const newPerMilestone = Math.round(remainingBalance / count);
        let runningSum = totalPaid;

        const newPendingMilestones = pendingMilestones.map((m, idx) => {
            const amount = (idx === count - 1) 
                ? (remainingBalance - (newPerMilestone * (count - 1))) 
                : newPerMilestone;
            
            runningSum += amount;
            return {
                ...m,
                targetAmount: amount,
                cumulativeTarget: runningSum,
                status: 'PENDING' as const,
                warningCount: 0 
            };
        });

        return {
            ...order,
            items: updatedItems,
            totalAmount: newTotal,
            goldRateAtBooking: currentRate,
            status: OrderStatus.ACTIVE,
            paymentPlan: {
                ...order.paymentPlan,
                milestones: [...paidMilestones, ...newPendingMilestones].sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
                protectionStatus: ProtectionStatus.ACTIVE,
                protectionRateBooked: currentRate
            }
        };
    }
};
