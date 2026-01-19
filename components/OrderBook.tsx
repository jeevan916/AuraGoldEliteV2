
import React, { useState, useMemo } from 'react';
import { 
  Search, Package, CheckCircle2, Archive, Clock, ChevronRight, 
  BookOpen, CheckCheck, Plus, AlertCircle 
} from 'lucide-react';
import { Order, OrderStatus, ProductionStatus } from '../types';
import { MainView } from '../App';

interface OrderBookProps {
  orders: Order[];
  onViewOrder: (id: string) => void;
  onUpdateOrder?: (order: Order) => void;
  onNavigate: (view: MainView) => void;
}

type BookTab = 'ACTIVE' | 'READY' | 'ARCHIVE';

const OrderBook: React.FC<OrderBookProps> = ({ orders, onViewOrder, onUpdateOrder, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<BookTab>('ACTIVE');
  const [search, setSearch] = useState('');

  const safeOrders = orders || [];

  const filteredOrders = useMemo(() => {
    let subset = [];
    switch(activeTab) {
        case 'ACTIVE':
            subset = safeOrders.filter(o => (o.status === OrderStatus.ACTIVE || o.status === OrderStatus.OVERDUE));
            break;
        case 'READY':
            subset = safeOrders.filter(o => o.status === OrderStatus.COMPLETED);
            break;
        case 'ARCHIVE':
            subset = safeOrders.filter(o => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.CANCELLED);
            break;
    }
    if (!search) return subset;
    return subset.filter(o => 
        o.customerName.toLowerCase().includes(search.toLowerCase()) ||
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.customerContact.includes(search)
    );
  }, [safeOrders, activeTab, search]);

  const handleQuickDeliver = (e: React.MouseEvent, order: Order) => {
      e.stopPropagation();
      if (!onUpdateOrder) return;
      if (confirm(`Mark order for ${order.customerName} as DELIVERED?`)) {
          const updated: Order = {
              ...order,
              status: OrderStatus.DELIVERED,
              items: order.items.map(i => ({...i, productionStatus: ProductionStatus.DELIVERED}))
          };
          onUpdateOrder(updated);
      }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch(status) {
        case OrderStatus.ACTIVE: return 'bg-blue-50 text-blue-700 border-blue-100';
        case OrderStatus.OVERDUE: return 'bg-rose-50 text-rose-700 border-rose-100';
        case OrderStatus.COMPLETED: return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        case OrderStatus.DELIVERED: return 'bg-slate-100 text-slate-600 border-slate-200';
        case OrderStatus.CANCELLED: return 'bg-gray-100 text-gray-500 border-gray-200';
        default: return 'bg-slate-50 text-slate-600';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
           <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
             <BookOpen className="text-amber-600" /> Order Book
           </h2>
           <p className="text-sm text-slate-500 font-medium">Master registry of all bookings.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
            <div className="flex bg-white p-1 rounded-2xl shadow-sm border flex-1 md:flex-none overflow-x-auto">
              <TabButton active={activeTab === 'ACTIVE'} onClick={() => setActiveTab('ACTIVE')} icon={Clock} label="Active" />
              <TabButton active={activeTab === 'READY'} onClick={() => setActiveTab('READY')} icon={CheckCircle2} label="Ready" />
              <TabButton active={activeTab === 'ARCHIVE'} onClick={() => setActiveTab('ARCHIVE')} icon={Archive} label="Archive" />
            </div>
            <button 
                onClick={() => onNavigate('ORDER_NEW')}
                className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
                <Plus size={16} /> <span className="hidden sm:inline">New</span>
            </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-6 border-b bg-slate-50/50 flex flex-col md:flex-row gap-4 shrink-0">
          <div className="relative flex-1">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input 
              type="text" 
              placeholder="Search registry..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-medium text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
             />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredOrders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-20">
               <Package size={48} className="opacity-20" />
               <p className="font-bold text-sm uppercase tracking-widest">No orders found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
               {filteredOrders.map(order => {
                  const paid = order.payments.reduce((a,c) => a + c.amount, 0);
                  const balance = order.totalAmount - paid;
                  const progress = order.totalAmount > 0 ? Math.min(100, Math.round((paid / order.totalAmount) * 100)) : 0;

                  return (
                    <div key={order.id} onClick={() => onViewOrder(order.id)} className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group relative">
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${order.status === OrderStatus.OVERDUE ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {order.customerName.charAt(0)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-slate-800">{order.customerName}</h3>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>{order.status}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">#{order.id} • {order.items.length} Items</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Due</p>
                                    <p className={`font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{balance.toLocaleString()}</p>
                                </div>
                                {activeTab === 'READY' && onUpdateOrder ? (
                                    <button onClick={(e) => handleQuickDeliver(e, order)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-md z-10"><CheckCheck size={14} /> Deliver</button>
                                ) : <ChevronRight className="text-slate-300 group-hover:text-amber-500 transition-colors" />}
                            </div>
                        </div>
                    </div>
                  );
               })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
    <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
  </button>
);

export default OrderBook;
