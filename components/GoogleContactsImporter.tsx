import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Users, Check, X, Loader2 } from 'lucide-react';
import firebaseConfig from '../firebase-applet-config.json';
import { Customer } from '../types';

let app: any;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  // If already initialized
}
const auth = app ? getAuth(app) : null;

interface GoogleContactsImporterProps {
  onImport: (customers: Customer[]) => void;
  onClose: () => void;
}

export const GoogleContactsImporter: React.FC<GoogleContactsImporterProps> = ({ onImport, onClose }) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchContacts = async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to get access token');
      }

      const res = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses&pageSize=1000', {
        headers: { Authorization: `Bearer ${credential.accessToken}` },
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      const validContacts = (data.connections || []).filter((c: any) => 
        c.names?.[0]?.displayName && c.phoneNumbers?.[0]?.value
      );
      
      setContacts(validContacts);
      setSelected(new Set(validContacts.map((c: any) => c.resourceName)));
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setError(null); // User just closed the popup, don't show an error
      } else {
        setError(err.message || 'Failed to fetch contacts');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    const toImport = contacts.filter(c => selected.has(c.resourceName)).map(c => {
      const phone = c.phoneNumbers[0].value.replace(/\D/g, '');
      return {
        id: `CUST-${phone.slice(-10) || Date.now()}`,
        name: c.names[0].displayName,
        contact: phone.length > 10 ? phone.slice(-10) : phone,
        email: c.emailAddresses?.[0]?.value || '',
        secondaryContact: '',
        orderIds: [],
        totalSpent: 0,
        joinDate: new Date().toISOString()
      };
    });
    
    onImport(toImport);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 bg-slate-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Google Contacts</h3>
              <p className="text-sm text-slate-500">Import your clients</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-200 rounded-full text-slate-600 hover:bg-slate-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-4 mb-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {contacts.length === 0 && !loading && (
            <div className="text-center py-10 space-y-4">
              <p className="text-slate-500">Connect to Google to see your contacts.</p>
              <button 
                onClick={fetchContacts}
                className="mx-auto flex items-center gap-3 bg-white border border-slate-200 shadow-sm px-6 py-3 rounded-full font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Connect Google Contacts
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-slate-500 font-medium">Fetching contacts...</p>
            </div>
          )}

          {contacts.length > 0 && !loading && (
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-4 px-2">
                <span className="font-bold text-slate-700">{selected.size} selected</span>
                <button 
                  onClick={() => setSelected(selected.size === contacts.length ? new Set() : new Set(contacts.map(c => c.resourceName)))}
                  className="text-sm font-bold text-blue-600"
                >
                  {selected.size === contacts.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="space-y-1">
                {contacts.map((c, i) => (
                  <div 
                    key={i} 
                    onClick={() => toggleSelect(c.resourceName)}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${selected.has(c.resourceName) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                      {selected.has(c.resourceName) && <Check size={16} strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{c.names?.[0]?.displayName}</p>
                      <p className="text-sm text-slate-500 truncate">{c.phoneNumbers?.[0]?.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {contacts.length > 0 && (
          <div className="p-4 border-t bg-white">
            <button 
              onClick={handleImport}
              disabled={selected.size === 0}
              className="w-full bg-blue-600 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
            >
              Import {selected.size} Contacts
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
