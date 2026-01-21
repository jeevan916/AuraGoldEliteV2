
import React, { useState } from 'react';
import { Plus, Trash2, LayoutGrid } from 'lucide-react';
import { CatalogItem } from '../../types';
import { storageService } from '../../services/storageService';

interface CatalogTabProps {
    catalog: CatalogItem[];
    setCatalog: (items: CatalogItem[]) => void;
}

const CatalogTab: React.FC<CatalogTabProps> = ({ catalog, setCatalog }) => {
    const [newItem, setNewItem] = useState<Partial<CatalogItem>>({
        category: 'Ring', metalColor: 'Yellow Gold', purity: '22K'
    });

    const handleAddCatalogItem = () => {
        if (!newItem.name || !newItem.makingChargesPerGram) return alert("Name and Charges are required");
        const item: CatalogItem = {
            id: `cat-${Date.now()}`,
            category: newItem.category || 'Ring',
            name: newItem.name,
            metalColor: newItem.metalColor || 'Yellow Gold',
            purity: (newItem.purity || '22K') as any,
            wastagePercentage: newItem.wastagePercentage || 0,
            makingChargesPerGram: newItem.makingChargesPerGram,
            stoneCharges: newItem.stoneCharges || 0
        };
        const updated = [...catalog, item];
        setCatalog(updated);
        storageService.setCatalog(updated);
        setNewItem({ category: 'Ring', metalColor: 'Yellow Gold', purity: '22K', name: '', wastagePercentage: 0, makingChargesPerGram: 0 });
    };

    const handleDeleteCatalogItem = (id: string) => {
        const updated = catalog.filter(c => c.id !== id);
        setCatalog(updated);
        storageService.setCatalog(updated);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            <div className="lg:col-span-1 bg-white p-6 rounded-[2.5rem] border border-amber-100 shadow-sm h-fit">
                <h3 className="font-black text-slate-800 text-lg mb-6 flex items-center gap-2">
                    <Plus size={20} className="text-amber-500" /> Add Product
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                          value={newItem.category}
                          onChange={e => setNewItem({...newItem, category: e.target.value})}
                        >
                            {['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Chain', 'Pendant', 'Set', 'Silverware'].map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400">Product Name</label>
                        <input 
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                           placeholder="Ex: Temple Haram"
                           value={newItem.name || ''}
                           onChange={e => setNewItem({...newItem, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400">Purity</label>
                          <select 
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                              value={newItem.purity}
                              onChange={e => setNewItem({...newItem, purity: e.target.value as any})}
                          >
                              <option>22K</option><option>24K</option><option>18K</option><option>999</option><option>925</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400">Wastage %</label>
                          <input 
                              type="number"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                              value={newItem.wastagePercentage || ''}
                              onChange={e => setNewItem({...newItem, wastagePercentage: parseFloat(e.target.value)})}
                              placeholder="12"
                          />
                        </div>
                    </div>
                    <div>
                          <label className="text-[10px] font-black uppercase text-slate-400">Making (₹/g)</label>
                          <input 
                              type="number"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                              value={newItem.makingChargesPerGram || ''}
                              onChange={e => setNewItem({...newItem, makingChargesPerGram: parseFloat(e.target.value)})}
                              placeholder="450"
                          />
                    </div>
                    <button 
                      onClick={handleAddCatalogItem}
                      className="w-full bg-amber-500 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg mt-2"
                    >
                        Add to Catalog
                    </button>
                </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100">
                    <h3 className="font-bold text-slate-700">Inventory Catalog ({catalog.length} Items)</h3>
                    <span className="text-xs text-slate-400">Saved to Cloud Database</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {catalog.map(item => (
                        <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative group hover:border-amber-200 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-slate-800">{item.name}</h4>
                                    <p className="text-xs text-slate-500">{item.category} • {item.purity}</p>
                                </div>
                                <button onClick={() => handleDeleteCatalogItem(item.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                            </div>
                            <div className="flex gap-2 text-[10px] font-black uppercase text-slate-400 mt-2">
                                <span className="bg-slate-50 px-2 py-1 rounded border">VA: {item.wastagePercentage}%</span>
                                <span className="bg-slate-50 px-2 py-1 rounded border">MC: ₹{item.makingChargesPerGram}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CatalogTab;
