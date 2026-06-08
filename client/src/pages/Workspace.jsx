import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Mail, ShieldAlert, Key } from 'lucide-react';

const initialMembers = [
  { name: 'Dharmik', email: 'dharmik@taraflow.ai', role: 'Owner', avatar: 'D' },
  { name: 'Tara Developer', email: 'dev@taraflow.ai', role: 'Admin', avatar: 'TD' },
  { name: 'SaaS Marketer', email: 'marketing@taraflow.ai', role: 'Member', avatar: 'SM' },
];

const Workspace = () => {
  const [members, setMembers] = useState(initialMembers);
  const [emailInput, setEmailInput] = useState('');

  const handleInvite = (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    const newMember = {
      name: emailInput.split('@')[0],
      email: emailInput,
      role: 'Member',
      avatar: emailInput.substring(0, 2).toUpperCase(),
    };
    setMembers([...members, newMember]);
    setEmailInput('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 py-4"
    >
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent flex items-center space-x-3">
          <Users className="h-8 w-8 text-indigo-400" />
          <span>Workspace Members</span>
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Manage team members, roles, permissions, and invite new administrators to collaborate.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Invite Form Panel - 1 Column */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 h-fit space-y-6">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-base">Invite Collaborator</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Send workspace invitation link.</p>
          </div>

          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white rounded-xl shadow transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Send Invite</span>
            </button>
          </form>
        </div>

        {/* Member List Table - 2 Columns */}
        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-zinc-900 dark:text-white text-base">Active Members ({members.length})</h3>
            <span className="text-xs text-indigo-400 font-bold bg-indigo-500/5 px-2.5 py-1 rounded-full border border-indigo-500/10">
              Multi-tenant Enabled
            </span>
          </div>

          <div className="divide-y divide-zinc-850">
            {members.map((member, idx) => (
              <div key={idx} className="py-4 flex justify-between items-center hover:bg-zinc-900/10 rounded-xl px-2 transition-all">
                <div className="flex items-center space-x-3.5">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center font-bold text-white text-sm">
                    {member.avatar}
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-900 dark:text-white text-sm sm:text-base">{member.name}</h4>
                    <p className="text-xs text-zinc-500 mt-0.5">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Role Badge */}
                  <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                    member.role === 'Owner' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                    member.role === 'Admin' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                    'bg-zinc-950 text-zinc-400 border-zinc-850'
                  }`}>
                    {member.role === 'Owner' && <Key className="mr-1 h-3.5 w-3.5 text-indigo-400" />}
                    {member.role === 'Admin' && <ShieldAlert className="mr-1 h-3.5 w-3.5 text-violet-400" />}
                    {member.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Workspace;
