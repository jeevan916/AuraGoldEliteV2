
import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, Phone, Mail, Search, ChevronRight, 
  BrainCircuit, ShieldAlert, Sparkles, MessageCircle, Clock, Zap, 
  CreditCard, TrendingUp, AlertTriangle, CheckCircle2, History, MessageSquare,
  ArrowRight, Activity, Plus, X, ArrowLeft, Calendar, MapPin, LayoutGrid, List, ReceiptIndianRupee
} from 'lucide-react';
import { Customer, Order, WhatsAppLogEntry, CreditworthinessReport } from '../types';
import { geminiService } from '../services/geminiService';

interface CustomerListProps {
  customers: Customer[];
  orders: Order[];
  onViewOrder: (id: string) => void;
  onMessageSent: (log: WhatsAppLogEntry) => void;
  onAddCustomer?: (customer: Customer) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ customers, orders, onViewOrder, onMessageSent, onAddCustomer }) => {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', contact: '', email: '', secondary: '' });

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.contact.includes(search)
  );

  const handleCreateCustomer = () => {
      if (!newCustomer.name || !newCustomer.contact) return alert("Name and Contact are required.");
      if (onAddCustomer) {
          const cust: Customer = {
              id: `CUST-${newCustomer.contact}`,
              name: newCustomer.name,
              contact: newCustomer.contact,
              email: newCustomer.email,
              secondaryContact: newCustomer.secondary,
              orderIds: [],
              totalSpent: 0,
              joinDate: new Date().toISOString()
          };
          onAddCustomer(cust);
          setShowAddModal(false);
          setNewCustomer({ name: '', contact: '', email: '', secondary: '' });
      }
  };

  // --- ADD CUSTOMER MODAL (Full Screen Sheet) ---
  if (showAddModal) {
      return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full h-[90vh] sm:h-auto sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl overflow-hidden flex flex-col animate-slideUp">
                <div className="bg-slate-50 p-6 border-b flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-black text-slate-800">New Client</h3>
                    <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-200 rounded-full text-slate-600"><X size={20} /></button>
                </div>
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block ml-1">Full Name</label>
                        <input 
                            className="w-full bg-slate-100 rounded-xl p-4 text-slate-900 font-bold text-lg outline-none focus:ring-2 focus:ring-amber-500"
                            value={newCustomer.name}
                            onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                            placeholder="Ex: Aditi Rao"
                            autoFocus
                        />
                    </div>
                    <div>
                         <label className="text-xs font-bold text-slate-400 uppercase mb-2 block ml-1">Phone Number</label>
                        <input 
                            className="w-full bg-slate-100 rounded-xl p-4 text-slate-900 font-mono font-medium text-lg outline-none focus:ring-2 focus:ring-amber-500"
                            value={newCustomer.contact}
                            onChange={e => setNewCustomer({...newCustomer, contact: e.target.value})}
                            placeholder="9876543210"
                            type="tel"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block ml-1">Email (Optional)</label>
                        <input 
                            className="w-full bg-slate-100 rounded-xl p-4 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-amber-500"
                            value={newCustomer.email}
                            onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                            placeholder="client@email.com"
                            type="email"
                        />
                    </div>
                </div>
                <div className="p-6 border-t shrink-0 safe-pb">
                    <button 
                        onClick={handleCreateCustomer}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
                    >
                        Save Profile
                    </button>
                </div>
            </div>
        </div>
      );
  }

  // --- MAIN LIST ---
  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* Search Bar */}
      <div className="relative shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
              type="text" 
              placeholder="Search clients..." 
              className="w-full pl-11 pr-4 py-3.5 bg-white border-none rounded-2xl shadow-sm text-[17px] focus:ring-2 focus:ring-amber-500 outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
          />
      </div>

      {/* iOS Style List Group */}
      <div className="flex-1 overflow-y-auto bg-white rounded-[24px] shadow-sm">
          {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
                  <User size={48} className="opacity-20"/>
                  <p className="font-bold">No clients found</p>
                  <button onClick={() => setShowAddModal(true)} className="text-amber-600 font-bold text-sm">Add Client</button>
              </div>
          ) : (
             <div className="divide-y divide-slate-100">
                {filtered.map(c => (
                    <div 
                        key={c.id} 
                        onClick={() => {
                            if (c.orderIds.length > 0) onViewOrder(c.orderIds[0]); // Simple Nav for now
                            else alert("No orders for this client yet.");
                        }}
                        className="flex items-center gap-4 p-4 active:bg-slate-50 transition-colors cursor-pointer"
                    >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-black text-slate-500 text-lg">
                            {c.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-[17px] truncate">{c.name}</h3>
                            <p className="text-sm text-slate-500 font-medium truncate">{c.contact}</p>
                        </div>
                        <div className="text-right">
                             <span className="block font-bold text-slate-900 text-sm">₹{c.totalSpent.toLocaleString()}</span>
                             <span className="text-xs text-slate-400 font-medium">{c.orderIds.length} Orders</span>
                        </div>
                        <ChevronRight className="text-slate-300" size={20} />
                    </div>
                ))}
             </div>
          )}
      </div>

      {/* Floating Action Button (Mobile Only fallback if not using tab bar +) */}
      {onAddCustomer && (
          <button 
              onClick={() => setShowAddModal(true)}
              className="fixed bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center lg:hidden z-40 active:scale-90 transition-transform"
          >
              <Plus size={28} />
          </button>
      )}
    </div>
  );
};

export default CustomerList;
