/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  CheckCircle2, 
  Trophy, 
  CircleDollarSign, 
  Settings2, 
  Calendar, 
  LogOut, 
  Plus, 
  Trash2, 
  Clock,
  AlertCircle,
  TrendingUp,
  History,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  format, 
  addDays, 
  isThursday, 
  nextThursday, 
  differenceInDays, 
  startOfToday,
  parseISO
} from 'date-fns';

import { auth } from './lib/firebase';
import { 
  memberService, 
  attendanceService, 
  fineService, 
  adminService,
  getSessionState 
} from './lib/firestoreService';
import { Member, AttendanceRecord, FineRecord, Group, Role, AttendanceStatus } from './types';

// Tab Definitions
type Tab = 'dashboard' | 'attendance' | 'results' | 'finance' | 'admin';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const [members, setMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [fines, setFines] = useState<FineRecord[]>([]);

  // Auth & Initial Data Loading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const adminCheck = await adminService.isAdmin(user.email || '');
        setIsAdmin(adminCheck);
        refreshData();
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [m, f] = await Promise.all([
        memberService.getAll(),
        fineService.getAll()
      ]);
      setMembers(m);
      setFines(f);
      
      // Default to today's attendance
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const a = await attendanceService.getByDate(todayStr);
      setAttendance(a);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMembers([]);
      setFines([]);
      setAttendance([]);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-neutral-50 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md w-full p-8 bg-white rounded-3xl shadow-xl border border-neutral-100"
        >
          <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
            <Trophy size={40} />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Speech Mastery Pro</h1>
          <p className="text-neutral-500 mb-8">Manage student groups, track attendance, and monitor performance with ease.</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-3 transition-colors shadow-lg shadow-blue-200"
          >
            <img src="https://www.gstatic.com/firebase/birdseed/images/google-g.svg" alt="Google" className="w-5 h-5 bg-white rounded-full" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex font-sans overflow-hidden h-screen">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-56 bg-brand-sidebar flex-col py-6 shrink-0 border-r border-brand-border">
        <div className="px-6 pb-6 text-xl font-black text-white tracking-tight italic">
          SPEECH<span className="text-brand-blue">+</span>
        </div>
        
        <nav className="flex-1 space-y-1">
          <SidebarNavButton active={activeTab === 'dashboard'} icon={<Calendar className="w-4 h-4" />} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
          <SidebarNavButton active={activeTab === 'attendance'} icon={<CheckCircle2 className="w-4 h-4" />} label="Attendance" onClick={() => setActiveTab('attendance')} />
          <SidebarNavButton active={activeTab === 'results'} icon={<Trophy className="w-4 h-4" />} label="Results" onClick={() => setActiveTab('results')} />
          <SidebarNavButton active={activeTab === 'finance'} icon={<CircleDollarSign className="w-4 h-4" />} label="Finance" onClick={() => setActiveTab('finance')} />
          {isAdmin && <SidebarNavButton active={activeTab === 'admin'} icon={<Settings2 className="w-4 h-4" />} label="Admin Settings" onClick={() => setActiveTab('admin')} />}
        </nav>

        <div className="mt-auto px-6 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-xs">
              {user.displayName?.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{user.displayName}</p>
              <p className="text-[10px] text-brand-text-muted font-bold truncate uppercase">{isAdmin ? 'Admin' : 'Student'}</p>
            </div>
            <button onClick={handleLogout} className="text-brand-text-muted hover:text-white transition-colors">
              <LogOut size={16} />
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
             <p className="text-[9px] font-black text-brand-text-muted uppercase tracking-widest">Cycle Start: MAY 14, 2026</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-brand-border px-6 py-4 flex items-center justify-between">
          <div className="lg:hidden flex items-center gap-2">
            <Trophy className="text-brand-blue" size={24} />
            <h1 className="font-black text-lg">SPEECH+</h1>
          </div>
          
          <div className="hidden lg:block">
            <h1 className="text-xl font-bold text-brand-text-main">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management
            </h1>
            <p className="text-xs text-brand-text-muted font-medium mt-0.5">
              {format(new Date(), 'EEEE, MMMM dd, yyyy')} — Week {getSessionState().weekIndex + 1} of Cycle
            </p>
          </div>

          <div className="flex items-center gap-3">
             <button 
              onClick={refreshData}
              className="p-2 text-brand-text-muted hover:bg-brand-bg rounded-lg transition-all"
              title="Refresh Data"
             >
               <History size={18} />
             </button>
             <button className="bg-brand-blue hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition-all active:scale-95">
               Submit Final Scores
             </button>
          </div>
        </header>

        {/* Global Status Bar */}
        <div className="bg-white border-b border-brand-border px-6 py-3 hidden sm:flex items-center gap-12">
          <StatusItem label="Speaking Group" value={`Group ${getSessionState().groupSpeaking}`} valueColor="text-brand-blue" />
          <StatusItem label="System Status" value="Online & Syncing" valueColor="text-brand-green" />
          <StatusItem label="Total Members" value={`${members.length} Enlisted`} />
          <StatusItem label="Next Rest Day" value={`In ${3 - (getSessionState().weekIndex % 4)} Weeks`} valueColor="text-brand-text-muted" />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-24 lg:pb-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Dashboard members={members} onRefresh={refreshData} />
              </motion.div>
            )}
            {activeTab === 'attendance' && (
              <motion.div key="attendance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Attendance members={members} attendance={attendance} isAdmin={isAdmin} onRefresh={refreshData} />
              </motion.div>
            )}
            {activeTab === 'results' && (
              <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Results members={members} />
              </motion.div>
            )}
            {activeTab === 'finance' && (
              <motion.div key="finance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Finance members={members} fines={fines} isAdmin={isAdmin} onRefresh={refreshData} />
              </motion.div>
            )}
            {activeTab === 'admin' && (
              <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <AdminPanel members={members} isAdmin={isAdmin} onRefresh={refreshData} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-brand-border px-4 py-2 flex items-center justify-around z-50">
        <MobileNavButton active={activeTab === 'dashboard'} icon={<Calendar size={20} />} label="Home" onClick={() => setActiveTab('dashboard')} />
        <MobileNavButton active={activeTab === 'attendance'} icon={<CheckCircle2 size={20} />} label="Log" onClick={() => setActiveTab('attendance')} />
        <MobileNavButton active={activeTab === 'results'} icon={<Trophy size={20} />} label="Standings" onClick={() => setActiveTab('results')} />
        <MobileNavButton active={activeTab === 'finance'} icon={<CircleDollarSign size={20} />} label="Finance" onClick={() => setActiveTab('finance')} />
        {isAdmin && <MobileNavButton active={activeTab === 'admin'} icon={<Settings2 size={20} />} label="Admin" onClick={() => setActiveTab('admin')} />}
      </nav>
    </div>
  );
}

function SidebarNavButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-6 py-3 text-[13px] font-bold transition-all relative group ${
        active ? 'bg-white/5 text-white' : 'text-brand-text-muted hover:text-white hover:bg-white/5'
      }`}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-blue" />}
      <span className={active ? 'text-brand-blue' : 'opacity-60 group-hover:opacity-100 transition-opacity'}>{icon}</span>
      {label}
    </button>
  );
}

function MobileNavButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 gap-1 rounded-lg transition-all ${
        active ? 'text-brand-blue' : 'text-brand-text-muted'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function StatusItem({ label, value, valueColor = 'text-brand-text-main' }: { label: string, value: string, valueColor?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-bold ${valueColor}`}>{value}</span>
    </div>
  );
}

function Dashboard({ members }: { members: Member[], onRefresh: () => Promise<void> }) {
  const today = new Date();
  const session = getSessionState(today);
  const nextSession = nextThursday(today);
  const daysUntil = differenceInDays(nextSession, today);

  const topThree = [...members].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 space-y-6">
        <section className="bg-brand-blue rounded-xl p-8 text-white relative overflow-hidden shadow-lg">
           <Calendar className="absolute -bottom-12 -right-8 w-64 h-64 opacity-10 rotate-12" />
           <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-sm">
                  {session.isRestDay ? 'Refresh Cycle' : 'Active Speaking'}
                </span>
              </div>
              <h2 className="text-4xl font-black mb-4 leading-tight">
                {session.isRestDay ? 'Monthly Rest Cycle' : `Group ${session.groupSpeaking} Speakers Today`}
              </h2>
              <div className="flex flex-wrap gap-4 mt-8">
                <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 border border-white/5 min-w-[120px]">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Session Date</p>
                  <p className="text-lg font-bold">{format(today, 'MMM dd, yyyy')}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 border border-white/5 min-w-[120px]">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Days Left</p>
                  <p className="text-lg font-bold">{daysUntil} to next</p>
                </div>
              </div>
           </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard title="Total Students" value={members.length} color="text-brand-blue" />
          <StatCard title="Speakers" value={members.filter(m => m.group === session.groupSpeaking).length} color={session.groupSpeaking === 'none' ? 'text-brand-text-muted' : 'text-brand-green'} />
          <StatCard title="Cycle Progress" value={`${session.weekIndex + 1}/4`} color="text-brand-text-main" />
        </div>
      </div>

      <div className="lg:col-span-4 space-y-6">
        <section className="bg-white border border-brand-border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between bg-neutral-50/50">
            <h3 className="text-sm font-bold tracking-tight">Current Leaders</h3>
            <Trophy size={16} className="text-amber-500" />
          </div>
          <div className="divide-y divide-brand-border">
            {topThree.map((m, idx) => (
              <div key={m.id} className="px-5 py-4 flex items-center justify-between group hover:bg-brand-bg transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-brand-text-muted italic">{String(idx + 1).padStart(2, '0')}</span>
                  <p className="text-sm font-bold">{m.name}</p>
                </div>
                <span className="text-sm font-black text-brand-green">{m.totalScore}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-brand-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-brand-green">
                <CircleDollarSign size={24} />
             </div>
             <div>
                <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Total Fines Collected</p>
                <p className="text-2xl font-black text-brand-text-main">
                  {members.reduce((a, b) => a + b.totalFinePaid, 0)} <span className="text-xs font-bold opacity-40">TK</span>
                </p>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string, value: string | number, color: string }) {
  return (
    <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
      <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest mb-1">{title}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function Attendance({ members, attendance, isAdmin, onRefresh }: { members: Member[], attendance: AttendanceRecord[], isAdmin: boolean, onRefresh: () => Promise<void> }) {
  const [selectedGroup, setSelectedGroup] = useState<Group>('A');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [marking, setMarking] = useState<string | null>(null);

  const today = new Date();
  const dateStr = format(today, 'yyyy-MM-dd');
  const session = getSessionState(today);
  const isThursdayOnly = isThursday(today);

  const groupMembers = useMemo(() => members.filter(m => m.group === selectedGroup), [members, selectedGroup]);

  const handleMark = async (member: Member, status: AttendanceStatus) => {
    if (!isAdmin) return;
    setMarking(member.id);
    
    let role: Role = 'none';
    let marks = 0;

    if (status === 'present') {
      if (session.isRestDay) {
        role = 'none';
        marks = 3;
      } else if (member.group === session.groupSpeaking) {
        role = 'speaker';
        marks = scores[member.id] || 0;
      } else {
        role = 'listener';
        marks = 3;
      }
    }

    await attendanceService.markAttendance(member, dateStr, status, role, marks);
    setMarking(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-brand-border rounded-xl shadow-md flex flex-col h-[70vh]">
        <div className="px-6 py-4 border-b border-brand-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-50/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-blue/10 rounded-lg text-brand-blue">
               <Users size={18} />
             </div>
             <div>
               <h3 className="text-sm font-bold tracking-tight">Speaker & Listener Log</h3>
               <p className="text-[10px] font-bold text-brand-text-muted uppercase">Selected Date: {dateStr}</p>
             </div>
          </div>

          <div className="flex bg-brand-border/30 p-1 rounded-lg">
            {(['A', 'B', 'C'] as Group[]).map(g => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  selectedGroup === g ? 'bg-white text-brand-blue shadow-sm' : 'text-brand-text-muted hover:text-brand-text-main'
                }`}
              >
                Group {g}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-neutral-50 z-10 shadow-sm">
              <tr>
                <th className="text-left px-6 py-3 text-[11px] font-black text-brand-text-muted uppercase tracking-widest border-b border-brand-border">Name</th>
                <th className="text-left px-4 py-3 text-[11px] font-black text-brand-text-muted uppercase tracking-widest border-b border-brand-border">Role</th>
                <th className="text-left px-4 py-3 text-[11px] font-black text-brand-text-muted uppercase tracking-widest border-b border-brand-border">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-black text-brand-text-muted uppercase tracking-widest border-b border-brand-border">Score (0-10)</th>
                <th className="text-right px-6 py-3 text-[11px] font-black text-brand-text-muted uppercase tracking-widest border-b border-brand-border">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-sm">
              {groupMembers.map(member => {
                const record = attendance.find(a => a.memberId === member.id);
                const isSpeaker = !session.isRestDay && member.group === session.groupSpeaking;
                const isPresent = record?.status === 'present';
                
                return (
                  <tr key={member.id} className="hover:bg-brand-bg/50 transition-colors">
                    <td className="px-6 py-4 font-bold">{member.name}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                        isSpeaker ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-500'
                      }`}>
                        {isSpeaker ? 'Speaker' : 'Listener'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {record ? (
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                          isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isPresent ? 'Present' : 'Absent'}
                        </span>
                      ) : <span className="text-xs text-brand-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      {isAdmin && isThursdayOnly ? (
                        <div className="flex items-center gap-2">
                           {isSpeaker ? (
                             <input 
                               type="number"
                               min="0"
                               max="10"
                               value={scores[member.id] ?? (record?.marks || '')}
                               onChange={(e) => setScores({ ...scores, [member.id]: parseInt(e.target.value) || 0 })}
                               disabled={marking === member.id}
                               className="w-16 h-8 border border-brand-border rounded text-center font-mono focus:ring-1 focus:ring-brand-blue outline-none"
                             />
                           ) : (
                             <span className="text-xs text-brand-text-muted font-bold font-mono">{isPresent ? '+3' : '—'}</span>
                           )}
                        </div>
                      ) : (
                        <span className="font-mono font-bold">{record?.marks || '—'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                       {isAdmin && isThursdayOnly && (
                         <button
                           onClick={() => handleMark(member, isPresent ? 'absent' : 'present')}
                           disabled={marking === member.id}
                           className={`h-8 px-4 rounded font-bold text-[10px] uppercase transition-all ${
                             isPresent ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                           }`}
                         >
                           {marking === member.id ? '...' : (isPresent ? 'Absent' : 'Present')}
                         </button>
                       )}
                    </td>
                  </tr>
                );
              })}
              {groupMembers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-brand-text-muted italic font-medium">No members in this group yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Results({ members }: { members: Member[] }) {
  const sortedMembers = useMemo(() => [...members].sort((a, b) => b.totalScore - a.totalScore), [members]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="bg-white border border-brand-border rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-6 border-b border-brand-border bg-neutral-900 text-white flex items-center justify-between">
           <div>
              <h3 className="text-lg font-black tracking-tight">Global Standings</h3>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">Hall of Fame</p>
           </div>
           <Trophy size={32} className="text-amber-400 opacity-80" />
        </div>
        
        <div className="divide-y divide-brand-border">
          {sortedMembers.map((member, index) => (
            <div key={member.id} className="flex items-center px-8 py-5 hover:bg-brand-bg transition-colors">
              <div className="w-12 text-sm font-black text-brand-text-muted">
                {String(index + 1).padStart(2, '0')}.
              </div>
              <div className="flex-1 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white ${
                  index === 0 ? 'bg-amber-400' : index === 1 ? 'bg-neutral-300' : index === 2 ? 'bg-orange-300' : 'bg-brand-sidebar'
                }`}>
                  {member.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold">{member.name}</p>
                  <p className="text-[10px] font-black text-brand-text-muted uppercase tracking-wider">Group {member.group}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-brand-green">{member.totalScore}</span>
                <p className="text-[9px] font-black text-brand-text-muted uppercase tracking-widest">Points</p>
              </div>
            </div>
          ))}
          {sortedMembers.length === 0 && (
            <div className="p-20 text-center text-brand-text-muted">Leaderboard is currently empty.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Finance({ members, fines, isAdmin, onRefresh }: { members: Member[], fines: FineRecord[], isAdmin: boolean, onRefresh: () => Promise<void> }) {
  const [showAddFine, setShowAddFine] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);

  const totalCollected = useMemo(() => members.reduce((sum, m) => sum + m.totalFinePaid, 0), [members]);
  const totalDues = useMemo(() => members.reduce((sum, m) => sum + m.totalFineDue, 0), [members]);

  const handleDeduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const member = members.find(m => m.id === selectedMemberId);
    if (!member || !amount) return;
    
    setWorking(true);
    await fineService.deductFine(member, parseFloat(amount), reason);
    setWorking(false);
    setShowAddFine(false);
    onRefresh();
  };

  const handlePay = async (fine: FineRecord) => {
    setWorking(true);
    await fineService.payFine(fine);
    setWorking(false);
    onRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black">Finance (Joripana)</h2>
          <p className="text-xs text-brand-text-muted font-bold uppercase tracking-widest">Financial Discipline Records</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowAddFine(true)}
            className="bg-brand-red hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm shadow-lg shadow-red-100 transition-all active:scale-95 flex items-center gap-2"
          >
            <AlertCircle size={16} />
            Deduct Fine
          </button>
        )}
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-brand-green uppercase tracking-widest mb-1">Collected Amount</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-brand-green">{totalCollected}</span>
            <span className="text-xs font-bold text-brand-green/60 uppercase">TK</span>
          </div>
        </div>

        <div className="bg-brand-red/10 border border-brand-red/20 rounded-xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-brand-red uppercase tracking-widest mb-1">Total Outstanding Dues</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-brand-red">{totalDues}</span>
            <span className="text-xs font-bold text-brand-red/60 uppercase">TK</span>
          </div>
        </div>
      </div>

      <div className="lg:col-span-8">
        <section className="bg-white border border-brand-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-brand-border bg-neutral-50/50">
            <h3 className="text-xs font-black uppercase tracking-widest text-brand-text-muted">Recent Transaction Log</h3>
          </div>
          <div className="divide-y divide-brand-border max-h-[500px] overflow-auto">
            {fines.map(fine => (
              <div key={fine.id} className="px-6 py-4 flex items-center justify-between group hover:bg-brand-bg transition-colors">
                <div className="flex flex-col gap-0.5">
                   <div className="flex items-center gap-2">
                     <p className="text-sm font-bold">{fine.memberName}</p>
                     <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                       fine.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                     }`}>
                       {fine.status}
                     </span>
                   </div>
                   <p className="text-[11px] text-brand-text-muted font-medium italic truncate max-w-[200px]">{fine.reason || 'Record entry'}</p>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                     <p className={`text-base font-black ${fine.status === 'paid' ? 'text-brand-text-main' : 'text-brand-red'}`}>
                       {fine.amount} TK
                     </p>
                     <p className="text-[9px] font-bold text-brand-text-muted uppercase">{format(fine.date, 'MMM dd, HH:mm')}</p>
                   </div>
                   {isAdmin && fine.status === 'due' && (
                     <button 
                      onClick={() => handlePay(fine)}
                      disabled={working}
                      className="p-2 bg-brand-blue text-white rounded hover:bg-blue-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
                     >
                       <CheckCircle2 size={16} />
                     </button>
                   )}
                </div>
              </div>
            ))}
            {fines.length === 0 && (
              <div className="p-20 text-center text-brand-text-muted text-sm italic font-medium">No deductions recorded yet. Clean slate!</div>
            )}
          </div>
        </section>
      </div>

      {showAddFine && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-sidebar/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-brand-red p-6 text-white">
               <h3 className="text-xl font-black flex items-center gap-2">
                  <AlertCircle size={24} />
                  New Fine (Deduction)
               </h3>
               <p className="text-red-100 text-xs mt-1 font-medium italic">Impacts total student marks immediately.</p>
            </div>
            <form onSubmit={handleDeduct} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Select Member</label>
                <select 
                  required
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full bg-brand-bg border border-brand-border rounded px-3 py-2 text-sm font-bold focus:ring-1 focus:ring-brand-red outline-none"
                >
                  <option value="">Choose Student...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name} (Grp {m.group})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Amount (TK/Points)</label>
                <input 
                  required
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-brand-bg border border-brand-border rounded px-3 py-2 text-sm font-mono font-bold focus:ring-1 focus:ring-brand-red outline-none"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Brief Reason</label>
                <input 
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-brand-bg border border-brand-border rounded px-3 py-2 text-sm font-medium focus:ring-1 focus:ring-brand-red outline-none"
                  placeholder="Reason for fine..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddFine(false)} className="flex-1 py-2 text-sm font-bold text-brand-text-muted hover:bg-brand-bg rounded">Cancel</button>
                <button 
                  type="submit" 
                  disabled={working}
                  className="flex-1 py-2 bg-brand-red text-white text-sm font-black rounded shadow-lg shadow-red-100 disabled:opacity-50"
                >
                  Execute
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function AdminPanel({ members, isAdmin, onRefresh }: { members: Member[], isAdmin: boolean, onRefresh: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState<Group>('A');
  const [working, setWorking] = useState(false);

  if (!isAdmin) return <div className="p-20 text-center font-black text-brand-red italic bg-brand-red/10 rounded-xl">🔒 ACCESS RESTRICTED TO ADMINISTRATORS ONLY</div>;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setWorking(true);
    await memberService.add(name, group);
    setName('');
    setWorking(false);
    onRefresh();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Permanently remove this student? All history will be lost.")) return;
    setWorking(true);
    await memberService.remove(id);
    setWorking(false);
    onRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <div className="space-y-6">
        <h3 className="text-xl font-black">Registry Management</h3>
        <section className="bg-white border border-brand-border rounded-xl shadow-md overflow-hidden">
          <div className="bg-brand-blue p-6 text-white">
             <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Add New Participation</p>
             <h4 className="text-lg font-bold">Enlist Member</h4>
          </div>
          <form onSubmit={handleAdd} className="p-8 space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Student Full Name</label>
              <input 
                required
                type="text"
                placeholder="Ex. Adnan Chowdhury"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-3 font-bold focus:ring-1 focus:ring-brand-blue outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest">Assign Group</label>
              <div className="flex bg-neutral-100 p-1 rounded-lg">
                {(['A', 'B', 'C'] as Group[]).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGroup(g)}
                    className={`flex-1 py-2 rounded font-black text-xs transition-all ${
                      group === g ? 'bg-white text-brand-blue shadow-sm' : 'text-brand-text-muted hover:text-brand-text-main'
                    }`}
                  >
                    Group {g}
                  </button>
                ))}
              </div>
            </div>
            <button 
              disabled={working}
              className="w-full py-4 bg-brand-sidebar text-white font-black text-sm rounded-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Confirm Enlistment
            </button>
          </form>
        </section>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-black">Active Registry <span className="text-brand-text-muted">/ {members.length}</span></h3>
        <section className="bg-white border border-brand-border rounded-xl shadow-sm flex flex-col max-h-[600px]">
          <div className="divide-y divide-brand-border overflow-y-auto">
            {members.map(member => (
              <div key={member.id} className="flex items-center px-6 py-4 group hover:bg-brand-bg transition-colors">
                <div className="flex-1 flex items-center gap-4">
                  <div className="w-8 h-8 rounded bg-neutral-100 flex items-center justify-center font-black text-brand-text-muted text-xs">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{member.name}</p>
                    <span className="text-[9px] font-black text-brand-blue uppercase">Group {member.group}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleRemove(member.id)}
                  className="p-2 text-brand-text-muted hover:text-brand-red transition-colors opacity-40 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {members.length === 0 && <div className="p-20 text-center text-brand-text-muted text-sm italic">Registry is currently empty.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
