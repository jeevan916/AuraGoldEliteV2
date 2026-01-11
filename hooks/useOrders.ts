
import { useState, useEffect } from 'react';
import { Order, OrderStatus, ProductionStatus } from '../types';
import { errorService } from '../services/errorService';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aura_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setOrders(parsed);
        } else {
          console.warn("Invalid order data format in storage. Resetting.");
          setOrders([]);
        }
      }
    } catch (e) {
      console.error("Failed to parse orders from local storage. Resetting corrupted data.", e);
      // Fallback: Clear corrupted data to allow app to start
      localStorage.removeItem('aura_orders');
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    // Only save if we have orders or if we explicitly want to save empty state
    // This prevents overwriting valid data with empty array on initial mount before load
    if (orders) { 
        localStorage.setItem('aura_orders', JSON.stringify(orders));
    }
  }, [orders]);

  const addOrder = (newOrder: Order) => {
    setOrders(prev => [newOrder, ...prev]);
    errorService.logActivity('ORDER_CREATED', `Order ${newOrder.id} for ${newOrder.customerName}`);
  };

  const updateOrder = (updatedOrder: Order) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  const recordPayment = (orderId: string, amount: number, method: string, date: string, note: string) => {
    setOrders(prev => prev.map(o => {
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
    }));
  };

  const updateItemStatus = (orderId: string, itemId: string, status: ProductionStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        items: o.items.map(item => item.id === itemId ? { ...item, productionStatus: status } : item)
      };
    }));
  };

  return { orders, setOrders, addOrder, updateOrder, recordPayment, updateItemStatus };
}
