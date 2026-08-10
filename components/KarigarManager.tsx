
import React, { useState, useMemo } from 'react';
import { 
  Hammer, Search, Calendar, User, Clock, 
  ChevronRight, Save, Camera, AlertCircle, CheckCircle2, 
  ArrowRight, MessageSquare, Scale, ClipboardList, Filter,
  Download, Image as ImageIcon
} from 'lucide-react';
import { Order, JewelryDetail, ProductionStatus, OrderStatus, GlobalSettings } from '../types';
import { whatsappService } from '../services/whatsappService';
import { compressImage, uploadOrderImage } from '../services/imageOptimizer';
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
      const names = new Set<string>(settings.karigars || []);
      productionQueue.forEach(q => q.item.karigarName && names.add(q.item.karigarName));
      return Array.from(names).sort();
  }, [productionQueue, settings.karigars]);

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
          customizationDetails: q.item.customizationDetails || '',
          netWeight: q.item.netWeight,
          makingChargesPerGram: q.item.makingChargesPerGram || 0,
          otherCharges: q.item.otherCharges || 0,
          productionStatus: q.item.productionStatus
      });
  };

  const handleSave = async (order: Order, itemId: string, originalItem: JewelryDetail) => {
      const weightChanged = editFields.netWeight !== undefined && editFields.netWeight !== originalItem.netWeight;
      const makingChargesChanged = editFields.makingChargesPerGram !== undefined && editFields.makingChargesPerGram !== originalItem.makingChargesPerGram;
      const otherChargesChanged = editFields.otherCharges !== undefined && editFields.otherCharges !== (originalItem.otherCharges || 0);
      const statusChanged = editFields.productionStatus !== undefined && editFields.productionStatus !== originalItem.productionStatus;

      if (weightChanged || makingChargesChanged || otherChargesChanged) {
          const w = editFields.netWeight ?? originalItem.netWeight;
          const makingCharges = editFields.makingChargesPerGram ?? originalItem.makingChargesPerGram;
          const otherChg = editFields.otherCharges ?? (originalItem.otherCharges || 0);

          const oldTotal = order.totalAmount;
          const effectiveRate = originalItem.netWeight > 0 ? (originalItem.baseMetalValue / originalItem.netWeight) : order.goldRateAtBooking;

          const metalValue = w * effectiveRate;
          const wastageValue = metalValue * (originalItem.wastagePercentage / 100);
          const laborValue = makingCharges * w;
          const subTotal = metalValue + wastageValue + laborValue + originalItem.stoneCharges + otherChg;
          const tax = subTotal * (settings.defaultTaxRate / 100);
          const newFinalAmount = subTotal + tax;

          const updatedItems = order.items.map(i => i.id === itemId ? {
              ...i,
              ...editFields,
              netWeight: w,
              makingChargesPerGram: makingCharges,
              otherCharges: otherChg,
              baseMetalValue: metalValue,
              wastageValue,
              totalLaborValue: laborValue,
              taxAmount: tax,
              finalAmount: newFinalAmount
          } : i);

          const netLateFee = Math.max(0, (order.lateFeeAmount || 0) - (order.lateFeeWaived || 0));
          const newTotal = Math.max(0, updatedItems.reduce((s, i) => s + i.finalAmount, 0) - (order.discountAmount || 0) + netLateFee);
          const valueChange = newTotal - oldTotal;

          const newMilestones = JSON.parse(JSON.stringify(order.paymentPlan.milestones));
          const last = newMilestones[newMilestones.length - 1];
          if (last.status !== 'PAID') {
              last.targetAmount += valueChange;
              last.cumulativeTarget += valueChange;
          } else {
              newMilestones.push({
                  id: `ADJ-WT-${Date.now()}`,
                  dueDate: new Date().toISOString().split('T')[0],
                  targetAmount: valueChange,
                  cumulativeTarget: newTotal,
                  status: 'PENDING',
                  warningCount: 0,
                  description: 'Order Adjustment'
              } as any);
          }

          const originalMilestones = order.paymentPlan.originalMilestones || JSON.parse(JSON.stringify(order.paymentPlan.milestones));

          const updatedOrder = { 
              ...order, 
              items: updatedItems, 
              totalAmount: newTotal, 
              paymentPlan: { 
                  ...order.paymentPlan, 
                  milestones: newMilestones,
                  originalMilestones 
              } 
          };

          onOrderUpdate(updatedOrder);
      } else {
          onUpdateItem(order.id, itemId, editFields);
      }

      setEditingItemId(null);

      // Trigger WA Notifications
      try {
          if (weightChanged) {
              await whatsappService.sendTemplateMessage(
                  order.customerContact,
                  'auragold_weight_update',
                  'en_US',
                  [order.customerName, originalItem.category, editFields.netWeight!.toString(), originalItem.netWeight.toString(), "Adjusted in Ledger"],
                  order.customerName
              );
          } else if (statusChanged) {
               await whatsappService.sendTemplateMessage(
                  order.customerContact,
                  'auragold_production_update',
                  'en_US',
                  [order.customerName, originalItem.category, order.id, editFields.productionStatus!.replace('_', ' '), order.shareToken],
                  order.customerName
              );
          }
      } catch (e) {
          console.warn("WhatsApp Notification failed on Desk Update", e);
      }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, orderId: string, item: JewelryDetail, type: 'ordered' | 'ready' = 'ready') => {
      if (e.target.files && e.target.files.length > 0) {
          setIsUploading(true);
          try {
              const uploadedList: string[] = [];
              for (let i = 0; i < e.target.files.length; i++) {
                  const serverUrl = await uploadOrderImage(e.target.files[i], type);
                  uploadedList.push(serverUrl);
              }
              
              if (type === 'ordered') {
                  const updatedPhotos = [...(item.photoUrls || []), ...uploadedList];
                  onUpdateItem(orderId, item.id, { photoUrls: updatedPhotos });
              } else {
                  const updatedPhotos = [...(item.readyPhotoUrls || []), ...uploadedList];
                  onUpdateItem(orderId, item.id, { readyPhotoUrls: updatedPhotos });
              }
              
              if (type === 'ready' && confirm("Ready photo updated. Send 'Finished Product Showcase' to customer via WhatsApp?")) {
                  const ord = orders.find(o => o.id === orderId)!;
                  await whatsappService.sendTemplateMessage(
                      ord.customerContact,
                      'auragold_finished_item_showcase',
                      'en_US',
                      [ord.customerName, orderId],
                      ord.customerName,
                      ord.shareToken
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
                                  <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="font-black text-slate-800 text-lg leading-tight">{item.category} • {item.netWeight}g</h4>
                                          {item.isReadyProduct ? (
                                              <span className="text-blue-600 font-extrabold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">Ready</span>
                                          ) : (
                                              <span className="text-amber-600 font-extrabold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">To Make</span>
                                          )}
                                      </div>
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
                                      <span className="text-xs font-black">{item.promisedDate ? new Date(item.promisedDate).toLocaleDateString('en-IN') : 'Not Set'}</span>
                                  </div>
                              </div>
                          </div>

                          {/* Grid of Ordered and Ready Product Photos */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100/80 mb-4 text-xs">
                              {/* Ordered reference pictures */}
                              <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                      <ImageIcon size={10} className="text-slate-500" /> Ordered Reference Images
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                      {/* Capture / Upload Button */}
                                      <div className="relative shrink-0 w-12 h-12 bg-white hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 transition-colors cursor-pointer shadow-sm">
                                          <Camera size={14} />
                                          <span className="text-[7px] font-bold mt-0.5 uppercase">Upload</span>
                                          <input 
                                              type="file" 
                                              accept="image/*" 
                                              multiple 
                                              className="absolute inset-0 opacity-0 cursor-pointer" 
                                              onChange={(e) => handlePhotoUpload(e, order.id, item, 'ordered')} 
                                          />
                                      </div>
                                      {/* Render Images */}
                                      {(!item.photoUrls || item.photoUrls.length === 0) ? (
                                          <span className="text-[9px] text-slate-400 italic font-medium ml-1">No reference pictures</span>
                                      ) : (
                                          item.photoUrls.map((url, imgIdx) => (
                                              <div key={imgIdx} className="relative w-12 h-12 group bg-white rounded-xl overflow-hidden border border-slate-200 shrink-0 shadow-sm">
                                                  <img src={url} className="w-full h-full object-cover" />
                                                  <button 
                                                      onClick={() => {
                                                          const link = document.createElement('a');
                                                          link.href = url;
                                                          link.download = `ordered-product-${item.id}-${imgIdx}.jpg`;
                                                          document.body.appendChild(link);
                                                          link.click();
                                                          document.body.removeChild(link);
                                                      }}
                                                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/60"
                                                      title="Download Image"
                                                  >
                                                      <Download size={12} />
                                                  </button>
                                              </div>
                                          ))
                                      )}
                                  </div>
                              </div>

                              {/* Ready product showcase pictures */}
                              <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                      <CheckCircle2 size={10} className="text-emerald-500" /> Ready Product Images (Showcase)
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                      {/* Capture / Upload Button */}
                                      <div className="relative shrink-0 w-12 h-12 bg-white hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 transition-colors cursor-pointer shadow-sm">
                                          <Camera size={14} />
                                          <span className="text-[7px] font-bold mt-0.5 uppercase">Upload</span>
                                          <input 
                                              type="file" 
                                              accept="image/*" 
                                              multiple 
                                              className="absolute inset-0 opacity-0 cursor-pointer" 
                                              onChange={(e) => handlePhotoUpload(e, order.id, item, 'ready')} 
                                          />
                                      </div>
                                      {/* Render Images */}
                                      {(!item.readyPhotoUrls || item.readyPhotoUrls.length === 0) ? (
                                          <span className="text-[9px] text-slate-400 italic font-medium ml-1">No final images yet</span>
                                      ) : (
                                          item.readyPhotoUrls.map((url, imgIdx) => (
                                              <div key={imgIdx} className="relative w-12 h-12 group bg-white rounded-xl overflow-hidden border border-slate-200 shrink-0 shadow-sm">
                                                  <img src={url} className="w-full h-full object-cover" />
                                                  <button 
                                                      onClick={() => {
                                                          const link = document.createElement('a');
                                                          link.href = url;
                                                          link.download = `ready-product-${item.id}-${imgIdx}.jpg`;
                                                          document.body.appendChild(link);
                                                          link.click();
                                                          document.body.removeChild(link);
                                                      }}
                                                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/60"
                                                      title="Download Image"
                                                  >
                                                      <Download size={12} />
                                                  </button>
                                              </div>
                                          ))
                                      )}
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
                                              list="karigar-list"
                                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm font-bold focus:border-amber-400 outline-none"
                                              value={editFields.karigarName}
                                              onChange={e => setEditFields({...editFields, karigarName: e.target.value})}
                                              placeholder="Artisan Name"
                                          />
                                          <datalist id="karigar-list">
                                              {karigars.map(k => <option key={k} value={k} />)}
                                          </datalist>
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

                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Making Charges (₹/g)</label>
                                          <input 
                                              type="number"
                                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm font-black focus:border-emerald-500 outline-none"
                                              value={editFields.makingChargesPerGram}
                                              onChange={e => setEditFields({...editFields, makingChargesPerGram: parseFloat(e.target.value) || 0})}
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Other Charges (₹)</label>
                                          <input 
                                              type="number"
                                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm font-black focus:border-emerald-500 outline-none"
                                              value={editFields.otherCharges}
                                              onChange={e => setEditFields({...editFields, otherCharges: parseFloat(e.target.value) || 0})}
                                          />
                                      </div>
                                  </div>

                                  <div className="space-y-1">
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Notes (Public)</label>
                                      <textarea 
                                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm font-medium focus:border-emerald-400 outline-none h-16 resize-none"
                                          value={editFields.customizationDetails}
                                          onChange={e => setEditFields({...editFields, customizationDetails: e.target.value})}
                                          placeholder="Notes visible to customer..."
                                      />
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
                                          className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors"
                                      >
                                          Cancel
                                      </button>
                                      <button 
                                          onClick={() => handleSave(order, item.id, item)}
                                          className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-emerald-700 shadow-lg flex items-center justify-center gap-2 transition-all"
                                      >
                                          <Save size={14} /> Save Updates
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              );
          })}
          
          {filteredQueue.length === 0 && (
              <div className="col-span-1 xl:col-span-2 py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                  <Hammer size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-bold uppercase tracking-widest text-sm">No Active Production Items</p>
                  <p className="text-xs mt-2">All items are delivered or queue is empty.</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default KarigarManager;
