
import React, { useState, useMemo } from 'react';
import { 
  Hammer, Search, Calendar, User, Clock, 
  ChevronRight, Save, Camera, AlertCircle, CheckCircle2, 
  ArrowRight, MessageSquare, Scale, ClipboardList, Filter
} from 'lucide-react';
import { Order, JewelryDetail, ProductionStatus, OrderStatus, GlobalSettings } from '../types';
import { whatsappService } from '../services/whatsappService';
import { compressImage } from '../services/imageOptimizer';
import { Card, Badge, Button } from './shared/BaseUI';

interface KarigarManagerProps {
  orders: Order[];
  onUpdateItem: (orderId: string, itemId: string, updates: Partial<JewelryDetail>) => void;
  onOrderUpdate: (order: Order) => void;
  settings: GlobalSettings;
}

const KarigarManager: React.FC<KarigarManagerProps> = ({ orders, onUpdateItem, onOrderUpdate, settings }) => {
  const [search, setSearch] = useState('');
  const [karigarFilter, setKarigarFilter] = useState('ALL');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  // Local edit states
  const [editFields, setEditFields] = useState<Partial<JewelryDetail>>({});
  const [isUploading, setIsUploading] = useState(false);

  // Flatten active work orders (Exclude Delivered/Cancelled)
  const productionQueue = useMemo(() => {
    const items: { order: Order; item: JewelryDetail }[] = [];
    orders.forEach(order => {
        if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED) {
            order.items.forEach(item => {
                if (item.productionStatus !== ProductionStatus.DELIVERED) {
                    items.push({ order, item });
                }
            });
        }
    });
    return items;
  }, [orders]);

  const karigars = useMemo(() => {
      const names = new Set<string>();
      productionQueue.forEach(q => q.item.karigarName && names.add(q.item.karigarName));
      return Array.from(names).sort();
  }, [productionQueue]);

  const filteredQueue = useMemo(() => {
    return productionQueue.filter(q => {
      const matchesSearch = q.order.customerName.toLowerCase().includes(search.toLowerCase()) || 
                           q.order.id.toLowerCase().includes(search.toLowerCase()) ||
                           q.item.karigarName?.toLowerCase().includes(search.toLowerCase());
      
      const matchesKarigar = karigarFilter === 'ALL' || q.item.karigarName === karigarFilter;
      
      return matchesSearch && matchesKarigar;
    }).sort((a,b) => {
        // Sort by Promised Date (Ascending)
        if (!a.item.promisedDate) return 1;
        if (!b.item.promisedDate) return -1;
        return new Date(a.item.promisedDate).getTime() - new Date(b.item.promisedDate).getTime();
    });
  }, [productionQueue, search, karigarFilter]);

  const handleStartEdit = (q: { order: Order; item: JewelryDetail }) => {
      setEditingItemId(q.item.id);
      setEditFields({
          karigarName: q.item.karigarName || '',
          promisedDate: q.item.promisedDate || '',
          backendNotes: q.item.backendNotes || '',
          netWeight: q.item.netWeight,
          productionStatus: q.item.productionStatus
      });
  };

  const handleSave = async (orderId: string, itemId: string, originalItem: JewelryDetail, customerContact: string, customerName: string, shareToken: string) => {
      // Logic for notifying customer if critical fields changed
      const weightChanged = editFields.netWeight !== undefined && editFields.netWeight !== originalItem.netWeight;
      const statusChanged = editFields.productionStatus !== undefined && editFields.productionStatus !== originalItem.productionStatus;

      onUpdateItem(orderId, itemId, editFields);
      setEditingItemId(null);

      // Trigger WA Notifications
      try {
          if (weightChanged) {
              await whatsappService.sendTemplateMessage(
                  customerContact,
                  'auragold_weight_update',
                  'en_US',
                  [customerName, originalItem.category, editFields.netWeight!.toString(), originalItem.netWeight.toString(), "Adjusted in Ledger"],
                  customerName
              );
          } else if (statusChanged) {
               await whatsappService.sendTemplateMessage(
                  customerContact,
                  'auragold_production_update',
                  'en_US',
                  [customerName, originalItem.category, orderId, editFields.productionStatus!.replace('_', ' '), shareToken],
                  customerName
              );
          }
      } catch (e) {
          console.warn("WhatsApp Notification failed on Desk Update", e);
      }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, orderId: string, item: JewelryDetail) => {
      if (e.target.files && e.target.files[0]) {
          setIsUploading(true);
          try {
              const compressed = await compressImage(e.target.files[0]);
              const updatedPhotos = [compressed, ...item.photoUrls];
              onUpdateItem(orderId, item.id, { photoUrls: updatedPhotos });
              
              if (confirm("Item photo updated. Send 'Finished Product Showcase' to customer?")) {
                  await whatsappService.sendTemplateMessage(
                      orders.find(o => o.id === orderId)!.customerContact,
                      'auragold_finished_item_showcase',
                      'en_US',
                      [orders.find(o => o.id === orderId)!.customerName, orderId],
                      orders.find(o => o.id === orderId)!.customerName,
                      orders.find(o => o.id === orderId)!.shareToken
                  );
              }
          } catch (e) {
              alert("Photo processing failed.");
          } finally {
              setIsUploading(false);
          }
      }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-32">
      {/* Header Panel */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
            <h2 className="text-3xl font-black flex items-center gap-3">
                <Hammer className="text-amber-500" /> Karigar & Production Desk
            </h2>
            <p className="text-slate-400 text-sm mt-2 max-w-xl">
                Manage your artisans, workshop timelines, and internal quality notes. 
                Keep customers updated automatically as work progresses.
            </p>
            <div className="flex gap-4 mt-8">
                <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/10">
                    <p className="text-[10px] font-black uppercase text-amber-500 mb-1">Items in Forge</p>
                    <p className="text-2xl font-black">{productionQueue.length}</p>
                </div>
                <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/10">
                    <p className="text-[10px] font-black uppercase text-emerald-500 mb-1">Overdue (Artisan)</p>
                    <p className="text-2xl font-black">
                        {productionQueue.filter(q => q.item.promisedDate && new Date(q.item.promisedDate) < new Date()).length}
                    </p>
                </div>
            </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border shadow-sm">
          <div className="relative flex-1">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input 
                type="text" 
                placeholder="Find item, customer or karigar..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
             />
          </div>
          <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-slate-50 px-4 rounded-2xl">
                  <Filter size={14} className="text-slate-400" />
                  <select 
                    className="bg-transparent text-xs font-black uppercase py-3 outline-none"
                    value={karigarFilter}
                    onChange={e => setKarigarFilter(e.target.value)}
                  >
                      <option value="ALL">All Artisans</option>
                      {karigars.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
              </div>
          </div>
      </div>

      {/* Production Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredQueue.map(({ order, item }) => {
              const isEditing = editingItemId === item.id;
              const isOverdue = item.promisedDate && new Date(item.promisedDate) < new Date();

              return (
                  <div key={item.id} className={`bg-white rounded-[2.5rem] border-2 shadow-sm transition-all overflow-hidden ${isEditing ? 'border-amber-400 scale-[1.01] shadow-xl' : 'border-slate-50 hover:border-slate-100'}`}>
                      <div className="p-6">
                          <div className="flex justify-between items-start mb-6">
                              <div className="flex gap-4">
                                  <div className="w-16 h-16 bg-slate-100 rounded-2xl relative group overflow-hidden">
                                      <img src={item.photoUrls[0]} className="w-full h-full object-cover" />
                                      <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                          <Camera size={20} className="text-white" />
                                          <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, order.id, item)} />
                                      </label>
                                  </div>
                                  <div>
                                      <h4 className="font-black text-slate-800 text-lg leading-tight">{item.category} • {item.netWeight}g</h4>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                          {order.id} | {order.customerName}
                                      </p>
                                      <div className="flex gap-2 mt-2">
                                          <Badge label={item.productionStatus} variant={item.productionStatus === 'READY' ? 'success' : 'info'} />
                                          {item.karigarName && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-slate-200 flex items-center gap-1"><User size={10}/> {item.karigarName}</span>}
                                      </div>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Artisan Due</p>
                                  <div className={`flex items-center gap-1.5 justify-end ${isOverdue ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>
                                      <Calendar size={14} />
                                      <span className="text-xs font-black">{item.promisedDate ? new Date(item.promisedDate).toLocaleDateString('en-GB', {day:'numeric', month:'short'}) : 'Not Set'}</span>
                                  </div>
                              </div>
                          </div>

                          {!isEditing ? (
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 h-full">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><ClipboardList size={10}/> Backend Notes</p>
                                      <p className="text-xs text-slate-600 italic leading-relaxed">
                                          {item.backendNotes || "No workshop instructions logged."}
                                      </p>
                                  </div>
                                  <div className="flex flex-col gap-2 justify-center">
                                      <button 
                                          onClick={() => handleStartEdit({ order, item })}
                                          className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2"
                                      >
                                          Manage Item <ChevronRight size={14} />
                                      </button>
                                  </div>
                              </div>
                          ) : (
                              <div className="space-y-4 animate-slideUp">
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Karigar</label>
                                          <input 
                                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm font-bold focus:border-amber-400 outline-none"
                                              value={editFields.karigarName}
                                              onChange={e => setEditFields({...editFields, karigarName: e.target.value})}
                                              placeholder="Artisan Name"
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Karigar Due Date</label>
                                          <input 
                                              type="date"
                                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm font-bold focus:border-amber-400 outline-none"
                                              value={editFields.promisedDate}
                                              onChange={e => setEditFields({...editFields, promisedDate: e.target.value})}
                                          />
                                      </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Actual Net Weight (g)</label>
                                          <div className="relative">
                                              <Scale className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                              <input 
                                                  type="number"
                                                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 pl-9 text-sm font-black focus:border-emerald-500 outline-none"
                                                  value={editFields.netWeight}
                                                  onChange={e => setEditFields({...editFields, netWeight: parseFloat(e.target.value) || 0})}
                                              />
                                          </div>
                                      </div>
                                      <div className="space-y-1">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Production Stage</label>
                                          <select 
                                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm font-black focus:border-blue-500 outline-none"
                                              value={editFields.productionStatus}
                                              onChange={e => setEditFields({...editFields, productionStatus: e.target.value as ProductionStatus})}
                                          >
                                              {Object.values(ProductionStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                          </select>
                                      </div>
                                  </div>

                                  <div className="space-y-1">
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Workshop Backend Notes (Internal)</label>
                                      <textarea 
                                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm font-medium focus:border-amber-400 outline-none h-20 resize-none"
                                          value={editFields.backendNotes}
                                          onChange={e => setEditFields({...editFields, backendNotes: e.target.value})}
                                          placeholder="Enter private instructions for Karigar..."
                                      />
                                  </div>

                                  <div className="flex gap-3 pt-2">
                                      <button 
                                          onClick={() => setEditingItemId(null)}
                                          className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200"
                                      >
                                          Discard
                                      </button>
                                      <button 
                                          onClick={() => handleSave(order.id, item.id, item, order.customerContact, order.customerName, order.shareToken)}
                                          className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                                      >
                                          <Save size={14} /> Commit Changes
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                      
                      {/* Sub-strip for Order Journey */}
                      <div className="bg-slate-50 px-6 py-3 border-t flex justify-between items-center">
                          <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Journey:</span>
                              <span className="text-[10px] font-bold text-slate-600">{item.productionStatus}</span>
                          </div>
                          {item.productionStatus === ProductionStatus.READY && (
                              <div className="text-emerald-600 flex items-center gap-1 text-[9px] font-black uppercase">
                                  <CheckCircle2 size={12} /> Ready for Handover
                              </div>
                          )}
                      </div>
                  </div>
              );
          })}

          {filteredQueue.length === 0 && (
              <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-400 opacity-30">
                  <Hammer size={64} className="mb-4" />
                  <p className="font-black uppercase tracking-widest">No active production items</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default KarigarManager;
