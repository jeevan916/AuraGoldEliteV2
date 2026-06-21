import { Order } from '../types';

export function applyLateFees(order: Order): boolean {
    let orderChanged = false;
    let addedLateFees = 0;
    
    if (!order.lateFeePeriodsApplied) order.lateFeePeriodsApplied = {};
    if (typeof order.lateFeeAmount !== 'number') order.lateFeeAmount = 0;
    if (typeof order.lateFeeWaived !== 'number') order.lateFeeWaived = 0;
    
    order.paymentPlan.milestones.forEach(m => {
        if (m.status !== 'PAID') {
            // Check if this milestone is pure late fee (we added these in previous versions)
            if (m.id.startsWith('LATEFEE')) return;
            
            const dueTime = new Date(m.dueDate).getTime();
            const now = Date.now();
            if (now > dueTime) {
                const daysLate = Math.floor((now - dueTime) / 86400000);
                const periods = Math.floor(daysLate / 30);
                const previouslyApplied = order.lateFeePeriodsApplied![m.id] || 0;
                
                if (periods > previouslyApplied) {
                    const newPeriods = periods - previouslyApplied;
                    // Simple interest:
                    // If targetAmount already includes some late fee, we subtract the accumulated late fees
                    // to compute simple interest on the base principal only.
                    let principal = m.targetAmount;
                    if (m.description && m.description.includes('+ Late Fee')) {
                        principal = Math.max(0, m.targetAmount - order.lateFeeAmount); 
                    }

                    const fee = Math.round(principal * 0.015 * newPeriods);
                    if (fee > 0) {
                        addedLateFees += fee;
                        order.lateFeePeriodsApplied![m.id] = periods;
                        orderChanged = true;
                    }
                }
            }
        }
    });

    if (addedLateFees > 0) {
        order.lateFeeAmount += addedLateFees;
        order.totalAmount += addedLateFees; 
        
        const pendingMilestones = order.paymentPlan.milestones.filter(m => m.status !== 'PAID');
        if (pendingMilestones.length > 0) {
            const last = pendingMilestones[pendingMilestones.length - 1];
            last.targetAmount += addedLateFees;
            last.cumulativeTarget += addedLateFees;
            if (last.description) {
                if (!last.description.includes('Late Fee')) last.description += ' + Late Fee';
            } else {
                last.description = 'Installment + Late Fee';
            }
        } else {
            order.paymentPlan.milestones.push({
                id: `LATEFEE-${Date.now()}`,
                status: 'PENDING',
                dueDate: new Date().toISOString().split('T')[0],
                targetAmount: addedLateFees,
                cumulativeTarget: order.totalAmount,
                warningCount: 0,
                description: 'Overdue Charges (Late Fee)'
            } as any);
        }
    }
    
    return orderChanged;
}
