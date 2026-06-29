import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Plus, Edit2, Trash2, Key, Users, RefreshCw, Loader2 } from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { SectionHeader, Card, Button } from './shared/BaseUI';

interface StaffManagerProps {
    currentUser: AuthUser;
}

interface StaffUser {
    id: number;
    username: string;
    role: UserRole;
    created_at: string;
}

export const StaffManager: React.FC<StaffManagerProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<StaffUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Modal states
    const [showNewUserModal, setShowNewUserModal] = useState(false);
    const [editRoleUser, setEditRoleUser] = useState<StaffUser | null>(null);
    const [editPasswordUser, setEditPasswordUser] = useState<StaffUser | null>(null);
    
    // Form states
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('SALES');
    
    const [updatedRole, setUpdatedRole] = useState<UserRole>('SALES');
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
                setError(data.error || 'Failed to load users');
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
                body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole })
            });
            const data = await res.json();
            if (data.success) {
                setShowNewUserModal(false);
                setNewUsername('');
                setNewPassword('');
                fetchUsers();
            } else {
                alert(data.error || 'Failed to create user');
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleUpdateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editRoleUser) return;
        try {
            const res = await fetch(`/api/auth/users/${editRoleUser.id}/role`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentUser.token}`
                },
                body: JSON.stringify({ role: updatedRole })
            });
            const data = await res.json();
            if (data.success) {
                setEditRoleUser(null);
                fetchUsers();
            } else {
                alert(data.error);
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editPasswordUser) return;
        try {
            const res = await fetch(`/api/auth/users/${editPasswordUser.id}/password`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentUser.token}`
                },
                body: JSON.stringify({ password: updatedPassword })
            });
            const data = await res.json();
            if (data.success) {
                setEditPasswordUser(null);
                setUpdatedPassword('');
                alert('Password updated successfully');
            } else {
                alert(data.error);
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

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 pb-32">
            <SectionHeader 
                title="Staff Management" 
                subtitle="Login access and role allocation" 
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
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                            <tr>
                                <th className="p-4 font-black uppercase text-[10px] tracking-widest">Username</th>
                                <th className="p-4 font-black uppercase text-[10px] tracking-widest">Role</th>
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
                                        {u.id.toString() === currentUser.id.toString() && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full ml-2">YOU</span>}
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${
                                            u.role === 'ADMIN' ? 'bg-rose-100 text-rose-700' :
                                            u.role === 'MANAGER' ? 'bg-amber-100 text-amber-700' :
                                            u.role === 'KARIGAR' ? 'bg-stone-100 text-stone-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>{u.role}</span>
                                    </td>
                                    <td className="p-4 text-slate-500 font-mono text-xs">
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button onClick={() => { setEditRoleUser(u); setUpdatedRole(u.role); }} className="p-2 text-slate-400 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded-lg transition-colors" title="Change Role"><Edit2 size={16} /></button>
                                        <button onClick={() => setEditPasswordUser(u)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors" title="Reset Password"><Key size={16} /></button>
                                        {u.id.toString() !== currentUser.id.toString() && (
                                            <button onClick={() => handleDelete(u.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors" title="Delete User"><Trash2 size={16} /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* New User Modal */}
            {showNewUserModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-black text-slate-800 mb-4">Create Staff Account</h3>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Username</label>
                                <input required type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Temporary Password</label>
                                <input required type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Role</label>
                                <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500">
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

            {/* Edit Role Modal */}
            {editRoleUser && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-xl font-black text-slate-800 mb-4">Change Role</h3>
                        <p className="text-sm text-slate-500 mb-4">Update access level for <span className="font-bold text-slate-800">{editRoleUser.username}</span></p>
                        <form onSubmit={handleUpdateRole} className="space-y-4">
                            <div>
                                <select value={updatedRole} onChange={e => setUpdatedRole(e.target.value as UserRole)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500">
                                    <option value="SALES">Sales Agent</option>
                                    <option value="MANAGER">Store Manager</option>
                                    <option value="KARIGAR">Karigar</option>
                                    <option value="ADMIN">Administrator</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="ghost" onClick={() => setEditRoleUser(null)} className="flex-1">Cancel</Button>
                                <Button type="submit" variant="primary" className="flex-1">Save Role</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {editPasswordUser && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-xl font-black text-slate-800 mb-4">Reset Password</h3>
                        <p className="text-sm text-slate-500 mb-4">Set a new password for <span className="font-bold text-slate-800">{editPasswordUser.username}</span></p>
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div>
                                <input required type="text" placeholder="New Password" value={updatedPassword} onChange={e => setUpdatedPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-amber-500" />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="ghost" onClick={() => { setEditPasswordUser(null); setUpdatedPassword(''); }} className="flex-1">Cancel</Button>
                                <Button type="submit" variant="primary" className="flex-1">Update Password</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};
