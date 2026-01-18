
import React from 'react';
import { 
  User, Phone, Mail, Calendar, TrendingUp, ShoppingBag, 
  ChevronRight, Plus, ArrowLeft, CreditCard 
} from 'lucide-react';
import { Customer, Order } from '../types';
import { Card, Badge, Button } from './shared/BaseUI';

interface CustomerProfileProps {
  customer: Customer;
  orders: Order[];
  onBack: () => void;
  onViewOrder: (orderId: string) => void;
  onNewOrder: (customer: Customer) => void;
}

const CustomerProfile: React.FC<CustomerProfileProps> = ({ 
  customer, orders, onBack, onViewOrder, onNewOrder 
}) => {
  // Filter orders for this customer based on ID or loose contact matching
  const customerOrders = orders.filter(o => 
    customer.orderIds.includes(o.id) || 
    o.customerContact.includes(customer.contact.slice(-10))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalDue = customerOrders.reduce((acc, o) => {
    const paid = o.payments.reduce((p, c) => p + c.amount, 0);
    return acc + (o.totalAmount - paid);
  }, 0);

  const lastActive = customerOrders.length > 0 
    ? new Date(customerOrders[0].createdAt).toLocaleDateString() 
    : 'New Customer';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn">
      
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col justify-between">
           <div>
              <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 transition-colors mb-4 font-bold text-xs">
                  <ArrowLeft size={16} /> Back to Directory
              </button>
              <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-slate-200">
                      {customer.name.charAt(0)}
                  </div>
                  <div>
                      <h1 className="text-2xl font-black text-slate-800">{customer.name}</h1>
                      <div className="flex items-center gap-3 text-sm text-slate-500 font-medium mt-1">
                          <span className="flex items-center gap-1"><Phone size={12}/> {customer.contact}</span>
                          {customer.email && <span className="flex items-center gap-1"><Mail size={12}/> {customer.email}</span>}
                      </div>
                  </div>
              </div>
           </div>
           <div className="mt-6 pt-6 border-t border-slate-100 flex gap-4">
               <Button onClick={() => onNewOrder(customer)} size="sm" className="bg-emerald-600">
                   <Plus size={14} /> New Order
               </Button>
           </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4">
            <Card className="p-5 flex flex-col justify-center bg-amber-50 border-amber-100">
                <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest mb-1">Lifetime Value</p>
                <p className="text-3xl font-black text-slate-800">₹{customer.totalSpent.toLocaleString()}</p>
            </Card>
            <Card className="p-5 flex flex-col justify-center bg-blue-50 border-blue-100">
                <p className="text-[10px] font-black uppercase text-blue-700 tracking-widest mb-1">Total Orders</p>
                <p className="text-3xl font-black text-slate-800">{customerOrders.length}</p>
            </Card>
            <Card className="p-5 flex flex-col justify-center bg-white">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Outstanding</p>
                <p className={`text-xl font-black ${totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₹{totalDue.toLocaleString()}
                </p>
            </Card>
            <Card className="p-5 flex flex-col justify-center bg-white">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Last Active</p>
                <p className="text-sm font-bold text-slate-700">{lastActive}</p>
            </Card>
        </div>
      </div>

      {/* Order History */}
      <div>
          <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <ShoppingBag className="text-amber-500" /> Order History
          </h3>
          
          <div className="space-y-4">
              {customerOrders.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-3xl border border-dashed text-slate-400">
                      <p>No orders found for this customer.</p>
                  </div>
              ) : (
                  customerOrders.map(order => {
                      const paid = order.payments.reduce((a,c) => a+c.amount, 0);
                      const balance = order.totalAmount - paid;
                      
                      return (
                          <div 
                            key={order.id} 
                            onClick={() => onViewOrder(order.id)}
                            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all cursor-pointer group"
                          >
                              <div className="flex justify-between items-start">
                                  <div className="flex gap-4">
                                      <div className="p-3 bg-slate-50 rounded-xl h-fit">
                                          <ShoppingBag size={20} className="text-slate-400"/>
                                      </div>
                                      <div>
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className="font-black text-slate-800 text-sm">{order.id}</span>
                                              <Badge label={order.status} variant={order.status === 'COMPLETED' ? 'success' : 'warning'} />
                                          </div>
                                          <p className="text-xs text-slate-500">
                                              {new Date(order.createdAt).toLocaleDateString()} • {order.items.length} Items
                                          </p>
                                          <div className="flex gap-1 mt-2">
                                              {order.items.map((i, idx) => (
                                                  <span key={idx} className="text-[10px] bg-slate-50 px-2 py-1 rounded text-slate-600 border">
                                                      {i.category}
                                                  </span>
                                              ))}
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="text-right">
                                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total</p>
                                      <p className="font-bold text-slate-800 mb-2">₹{order.totalAmount.toLocaleString()}</p>
                                      {balance > 0 ? (
                                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded">
                                              Due: ₹{balance.toLocaleString()}
                                          </span>
                                      ) : (
                                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                              Fully Paid
                                          </span>
                                      )}
                                  </div>
                              </div>
                          </div>
                      );
                  })
              )}
          </div>
      </div>

    </div>
  );
};

export default CustomerProfile;
