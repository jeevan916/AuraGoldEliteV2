
import { useState, useEffect } from 'react';
import { Order, OrderStatus, ProductionStatus } from '../types';
import { errorService } from '../services/errorService';
import { storageService } from '../services/storageService';

export function useOrders() {
  const [orders, setOrdersState] = useState<Order[]>(storageService.getOrders());

  useEffect(() => {
    // Subscribe to storage changes (e.g. from server sync)
    const unsubscribe = storageService.subscribe(() => {
        setOrdersState([...storageService.getOrders()]);
    });
    return unsubscribe;
  }, []);

  const setOrders = (newOrders: Order[]) => {
      setOrdersState(newOrders);
      storageService.setOrders(newOrders);
  };

  const addOrder = (newOrder: Order) => {
    const updated = [newOrder, ...orders];
    setOrders(updated);
    errorService.logActivity('ORDER_CREATED', `Order ${newOrder.id} for ${newOrder.customerName}`);
    // Force immediate sync to backend for robust "order generation"
    storageService.pushToServer();
  };

  const updateOrder = (updatedOrder: Order) => {
    const updated = orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    setOrders(updated);
    // Force immediate sync
    storageService.pushToServer();
  };

  const recordPayment = (orderId: string, amount: number, method: string, date: string, note: string) => {
    const updated = orders.map(o => {
      if (o.id !== orderId) return o;
      const newPayment = { id: `PAY-${Date.now()}`, date: date || new Date().toISOString(), amount, method, note };
      const totalPaid = o.payments.reduce((acc, p) => acc + p.amount, 0) + amount;
      
      let runningSum = 0;
      const updatedMilestones = o.paymentPlan.milestones.map(m => {
        runningSum += m.targetAmount;
        return { 
          ...m, 
          status: totalPaid >= runningSum ? 'PAID' as const : (totalPaid > (runningSum - m.targetAmount) ? 'PARTIAL' as const : 'PENDING' as const) 
        };
      });

      const allPaid = totalPaid >= o.totalAmount - 0.01;
      return { 
        ...o, 
        payments: [...o.payments, newPayment], 
        paymentPlan: { ...o.paymentPlan, milestones: updatedMilestones },
        status: allPaid ? OrderStatus.COMPLETED : (updatedMilestones.some(m => m.status !== 'PAID' && new Date(m.dueDate) < new Date()) ? OrderStatus.OVERDUE : OrderStatus.ACTIVE)
      };
    });
    setOrders(updated);
    // Force immediate sync
    storageService.pushToServer();
  };

  const updateItemStatus = (orderId: string, itemId: string, status: ProductionStatus) => {
    const updated = orders.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        items: o.items.map(item => item.id === itemId ? { ...item, productionStatus: status } : item)
      };
    });
    setOrders(updated);
    // Force immediate sync
    storageService.pushToServer();
  };

  return { orders, setOrders, addOrder, updateOrder, recordPayment, updateItemStatus };
}
