
import { useState, useEffect } from 'react';
import { Order, OrderStatus, ProductionStatus } from '../types';
import { errorService } from '../services/errorService';
import { storageService } from '../services/storageService';
import { whatsappService } from '../services/whatsappService';

export function useOrders() {
  const [orders, setOrdersState] = useState<Order[]>(storageService.getOrders());

  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
        setOrdersState([...storageService.getOrders()]);
    });
    return unsubscribe;
  }, []);

  const setOrders = (newOrders: Order[]) => {
      setOrdersState(newOrders);
      storageService.setOrders(newOrders);
  };

  const addOrder = async (newOrder: Order) => {
    const updated = [newOrder, ...orders];
    setOrders(updated);
    errorService.logActivity('ORDER_CREATED', `Order ${newOrder.id} for ${newOrder.customerName}`);
    
    // Trigger Interactive Confirmation Template
    try {
        await whatsappService.sendTemplateMessage(
            newOrder.customerContact,
            'auragold_order_receipt',
            'en_US',
            [newOrder.customerName, newOrder.id, `₹${newOrder.totalAmount.toLocaleString()}`],
            newOrder.customerName,
            newOrder.shareToken // URL Suffix for button
        );
    } catch (e) {
        console.warn("Auto-WhatsApp failed on booking creation", e);
    }
  };

  const updateOrder = (updatedOrder: Order) => {
    const updated = orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    setOrders(updated);
  };

  const recordPayment = (orderId: string, amount: number, method: string, date: string, note: string) => {
    // Logic moved to clusters/PaymentWidget for gateway compatibility
    // Kept as shim for legacy hooks if any
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
  };

  return { orders, setOrders, addOrder, updateOrder, recordPayment, updateItemStatus };
}
