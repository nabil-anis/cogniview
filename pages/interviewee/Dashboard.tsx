
import React, { useState, useEffect } from 'react';
import { Card, Button } from '../../components/Shared';
import { db } from '../../services/db';
import { Profile, InterviewSession } from '../../types';

export const IntervieweeDashboard: React.FC<{ user: Profile, onNavigate: (page: string) => void }> = ({ user, onNavigate }) => {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);

  useEffect(() => {
    setSessions(db.sessions.getByCandidateId(user.id));
  }, [user.id]);

  return (
    <div className="min-h-screen bg-black text-white px-6 md:px-12 pb-12 pt-40 animate-in fade-in duration-700">
       <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#007AFF]/10 to-transparent pointer-events-none"></div>

      <div className="max-w-4xl mx-auto space-y-12 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-[#007AFF]">Candidate Portal</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">Assessment History</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {sessions.length === 0 ? (
            <div className="py-24 text-center border border-dashed border-white/10 rounded-[3rem] bg-white/[0.02]">
               <div className="text-4xl mb-4 opacity-20">📂</div>
               <p className="text-white/30 font-bold uppercase tracking-widest text-xs">No history found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map(s => (
                <div key={s.id} className="glass p-6 rounded-[2rem] border border-white/5 flex flex-col md:flex-row items-center justify-between hover:bg-white/[0.08] transition-all gap-6">
                  <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold border ${s.decision === 'passed' ? 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
                      {s.companyName.charAt(0)}
                    </div>
                    <div>
                       <h3 className="text-xl font-bold text-white">{s.interviewTitle}</h3>
                       <p className="text-sm text-white/50">{s.companyName}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full md:w-auto gap-8">
                     <div className="text-right">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Date</p>
                        <p className="text-sm font-bold text-white">{new Date(s.startedAt).toLocaleDateString()}</p>
                     </div>
                     <div className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                        s.decision === 'passed' ? 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/20' : 
                        s.decision === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                        'bg-white/5 text-white/40 border-white/10'
                     }`}>
                        {s.decision}
                     </div>
                  </div>
                </div>
              ))}
            </div>
          ) }
        </div>
      </div>
    </div>
  );
};
