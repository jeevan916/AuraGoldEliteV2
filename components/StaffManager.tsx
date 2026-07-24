import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Plus, Edit2, Trash2, Key, Users, RefreshCw, Loader2, Phone } from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { SectionHeader, Card, Button } from './shared/BaseUI';

interface StaffManagerProps {
    currentUser: AuthUser;
}

interface StaffUser {
    id: number;
    username: string;
    role: UserRole;
    mobile_number?: string;
    created_at: string;
}

export const StaffManager: React.FC<StaffManagerProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<StaffUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Modal states
    const [showNewUserModal, setShowNewUserModal] = useState(false);
    const [editUser, setEditUser] = useState<StaffUser | null>(null);
    
    // Form states
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('SALES');
    const [newMobileNumber, setNewMobileNumber] = useState('');
    
    const [updatedRole, setUpdatedRole] = useState<UserRole>('SALES');
    const [updatedMobileNumber, setUpdatedMobileNumber] = useState('');
    const [updatedPassword, setUpdatedPassword] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/users', {
                headers: { 'Authorization': `Bearer ${currentUser.token}` }
            });
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
            } else {
                if (data.error === 'Invalid token' || data.error === 'No token provided') {
                    setError('Session expired. Please log out and log back in.');
                } else {
                    setError(data.error || 'Failed to load users');
                }
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentUser.token}`
                },
                body: JSON.stringify({ 
                    username: newUsername, 
                    password: newPassword, 
                    role: newRole,
                    mobile_number: newMobileNumber 
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowNewUserModal(false);
                setNewUsername('');
                setNewPassword('');
                setNewMobileNumber('');
                setNewRole('SALES');
                fetchUsers();
            } else {
                alert(data.error || 'Failed to create user');
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editUser) return;
        try {
            const res = await fetch(`/api/auth/users/${editUser.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentUser.token}`
                },
                body: JSON.stringify({ 
                    role: updatedRole,
                    mobile_number: updatedMobileNumber,
                    password: updatedPassword || undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                setEditUser(null);
                setUpdatedPassword('');
                setUpdatedMobileNumber('');
                fetchUsers();
            } else {
                alert(data.error || 'Failed to update user');
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            const res = await fetch(`/api/auth/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${currentUser.token}` }
            });
            const data = await res.json();
            if (data.success) {
                fetchUsers();
            } else {
                alert(data.error);
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    if (currentUser.role !== 'ADMIN') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <ShieldAlert size={48} className="mb-4" />
                <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
                <p className="text-sm">Only administrators can manage staff access.</p>
            </div>
        );
    }

    if (!currentUser.token) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <ShieldAlert size={48} className="mb-4 text-amber-500" />
                <h2 className="text-xl font-bold text-slate-800">Session Expired</h2>
                <p className="text-sm mt-2 max-w-md">Your login session is outdated and missing a security token. Please log out and log back in to access Staff Management.</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 pb-32">
            <SectionHeader 
                title="Staff Management" 
                subtitle="Login access, role allocation, and contact details" 
                action={
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={fetchUsers}><RefreshCw size={16} /></Button>
                        <Button variant="primary" onClick={() => setShowNewUserModal(true)}><Plus size={16} /> New Staff</Button>
                    </div>
                }
            />

            {error && <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm font-bold">{error}</div>}

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-amber-500" /></div>
            ) : (
                <div className="space-y-4">
                    {/* Mobile Card List (Visible on Mobile) */}
                    <div className="block md:hidden space-y-4">
                        {users.map(u => (
                            <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                            <Users size={14} />
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-800 text-sm flex items-center gap-1">
                                                {u.username}
                                                {u.id.toString() === currentUser.id.toString() && (
                                                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">YOU</span>
                                                )}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono block">
                                                Joined {new Date(u.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                                        u.role === 'ADMIN' ? 'bg-rose-100 text-rose-700' :
                                        u.role === 'MANAGER' ? 'bg-amber-100 text-amber-700' :
                                        u.role === 'KARIGAR' ? 'bg-stone-100 text-stone-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>{u.role}</span>
                                </div>

                                <div className="border-t border-slate-50 pt-2 flex items-center justify-between text-xs">
                                    <div className="text-slate-700 font-bold">
                                        {u.mobile_number ? (
                                            <span className="flex items-center gap-1.5 font-mono">
                                                <Phone size={12} className="text-slate-400" />
                                                {u.mobile_number}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 font-normal italic">No mobile number</span>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-50 pt-2 flex gap-2">
                                    <button 
                                        onClick={() => { 
                                            setEditUser(u); 
                                            setUpdatedRole(u.role); 
                                            setUpdatedMobileNumber(u.mobile_number || ''); 
                                            setUpdatedPassword(''); 
                                        }} 
                                        className="flex-1 py-2 text-slate-600 hover:text-amber-700 bg-slate-50 hover:bg-amber-50 rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 text-xs font-bold border border-slate-100"
                                    >
                                        <Edit2 size={13} /> Edit Staff
                                    </button>
                                    {u.id.toString() !== currentUser.id.toString() && (
                                        <button 
                                            onClick={() => handleDelete(u.id)} 
                                            className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-xl transition-colors border border-slate-100" 
                                            title="Delete User"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table (Visible on Desktop/Tablet) */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                                    <tr>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest">Username</th>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest">Role</th>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest">Mobile Number</th>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest">Created At</th>
                                        <th className="p-4 font-black uppercase text-[10px] tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <Users size={14} />
                                                </div>
                                                {u.username}
                                                {u.id.toString() === currentUser.id.toString() && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full ml-2 font-bold uppercase tracking-wider">YOU</span>}
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${
                                                    u.role === 'ADMIN' ? 'bg-rose-100 text-rose-700' :
                                                    u.role === 'MANAGER' ? 'bg-amber-100 text-amber-700' :
                                                    u.role === 'KARIGAR' ? 'bg-stone-100 text-stone-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>{u.role}</span>
                                            </td>
                                            <td className="p-4 text-slate-700 font-bold">
                                                {u.mobile_number ? (
                                                    <span className="flex items-center gap-1.5 font-mono text-xs">
                                                        <Phone size={12} className="text-slate-400" />
                                                        {u.mobile_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-normal italic text-xs">Not set</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-slate-500 font-mono text-xs">
                                                {new Date(u.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button 
                                                    onClick={() => { 
                                                        setEditUser(u); 
                                                        setUpdatedRole(u.role); 
                                                        setUpdatedMobileNumber(u.mobile_number || ''); 
                                                        setUpdatedPassword(''); 
                                                    }} 
                                                    className="p-2 text-slate-400 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs font-bold" 
                                                    title="Edit Staff Access, Password & Mobile"
                                                >
                                                    <Edit2 size={14} /> Edit Staff
                                                </button>
                                                {u.id.toString() !== currentUser.id.toString() && (
                                                    <button onClick={() => handleDelete(u.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center" title="Delete User"><Trash2 size={14} /></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* New User Modal */}
            {showNewUserModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scaleIn">
                        <h3 className="text-xl font-black text-slate-800 mb-4">Create Staff Account</h3>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Username</label>
                                <input required type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500 transition-all text-sm" placeholder="e.g. rahul_sales" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Temporary Password</label>
                                <input required type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500 transition-all text-sm" placeholder="Min 4 characters" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Mobile Number (Optional)</label>
                                <input type="text" value={newMobileNumber} onChange={e => setNewMobileNumber(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500 transition-all text-sm" placeholder="e.g. +91 9876543210" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Role / Access Level</label>
                                <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500 text-sm">
                                    <option value="SALES">Sales Agent (Basic Access)</option>
                                    <option value="MANAGER">Store Manager (Operations)</option>
                                    <option value="KARIGAR">Karigar (Workshop Only)</option>
                                    <option value="ADMIN">Administrator (Full Access)</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="ghost" onClick={() => setShowNewUserModal(false)} className="flex-1">Cancel</Button>
                                <Button type="submit" variant="primary" className="flex-1">Create Account</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Staff User Modal */}
            {editUser && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scaleIn">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Users size={18} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 leading-none mb-1">Edit Staff Profile</h3>
                                <p className="text-xs text-slate-500 font-bold">Modifying credentials and roles for <span className="text-amber-600 font-black">{editUser.username}</span></p>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Staff Access Level</label>
                                <select value={updatedRole} onChange={e => setUpdatedRole(e.target.value as UserRole)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500 text-sm">
                                    <option value="SALES">Sales Agent (Basic Access)</option>
                                    <option value="MANAGER">Store Manager (Operations)</option>
                                    <option value="KARIGAR">Karigar (Workshop Only)</option>
                                    <option value="ADMIN">Administrator (Full Access)</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Mobile Number</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. +91 9876543210" 
                                    value={updatedMobileNumber} 
                                    onChange={e => setUpdatedMobileNumber(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500 text-sm" 
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Change Password (Optional)</label>
                                <input 
                                    type="text" 
                                    placeholder="Leave blank to keep existing password" 
                                    value={updatedPassword} 
                                    onChange={e => setUpdatedPassword(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500 text-sm" 
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="ghost" onClick={() => setEditUser(null)} className="flex-1">Cancel</Button>
                                <Button type="submit" variant="primary" className="flex-1">Save Profile</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};
