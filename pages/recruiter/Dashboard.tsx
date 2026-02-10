
import React, { useState, useEffect } from 'react';
import { Button, Card } from '../../components/Shared';
import { db } from '../../services/db';
import { Interview, Profile } from '../../types';

export const RecruiterDashboard: React.FC<{ user: Profile, onNavigate: (page: string) => void }> = ({ user, onNavigate }) => {
  const [interviews, setInterviews] = useState<Interview[]>([]);

  useEffect(() => {
    setInterviews(db.interviews.getAll().filter(i => i.recruiterId === user.id));
  }, [user.id]);

  return (
    <div className="min-h-screen bg-black text-white px-4 md:px-8 lg:px-12 pb-12 pt-40 animate-in fade-in duration-700">
       {/* Background Glow */}
       <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#007AFF]/10 to-transparent pointer-events-none"></div>
       
      <div className="max-w-7xl mx-auto space-y-12 md:space-y-16 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-8 gap-6">
          <div className="space-y-2">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.4em] text-[#007AFF]">Command Center</p>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-white">Recruitment</h1>
          </div>
          <Button onClick={() => onNavigate('create-interview')} size="lg" className="rounded-2xl h-12 md:h-14 px-6 md:px-8 shadow-[0_0_30px_rgba(0,122,255,0.3)] w-full md:w-auto text-sm md:text-base">
            + New Assessment
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Main Stats Card */}
          <div className="col-span-1 md:col-span-2 glass p-8 md:p-10 rounded-[2.5rem] border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#007AFF]/20 blur-[100px] rounded-full group-hover:bg-[#007AFF]/30 transition-all duration-700"></div>
            <div className="relative z-10">
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Total Assessments Active</p>
              <p className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-none">{interviews.length}</p>
              <div className="mt-8 flex gap-4">
                 <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/60">
                   Real-time Sync Active
                 </div>
              </div>
            </div>
          </div>
          
          {/* Info Card */}
          <div className="glass p-8 md:p-10 rounded-[2.5rem] border border-white/10 flex flex-col justify-between gap-6">
            <div className="w-12 h-12 rounded-2xl bg-[#007AFF] flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white leading-tight mb-2">AI-Driven Insights</p>
              <p className="text-xs md:text-sm text-white/50 leading-relaxed">
                Automated screening is active. Candidate responses are being analyzed for semantic depth and behavioral cues.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">Active Pipelines</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {interviews.length === 0 ? (
              <div className="py-24 md:py-32 text-center border border-dashed border-white/10 rounded-[3rem] bg-white/[0.02]">
                <p className="text-white/20 font-bold uppercase tracking-widest text-xs">No active pipelines found</p>
              </div>
            ) : (
              interviews.map(i => (
                <div 
                  key={i.id} 
                  onClick={() => onNavigate(`results-${i.id}`)}
                  className="glass p-6 md:p-8 rounded-[2rem] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer group hover:bg-white/10 transition-all duration-300 gap-6"
                >
                  <div className="flex items-center space-x-6">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-[#007AFF]/20 to-transparent border border-[#007AFF]/20 flex items-center justify-center text-xl md:text-2xl font-bold text-[#007AFF] group-hover:scale-110 transition-transform flex-shrink-0">
                      {i.jobRole.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white group-hover:text-[#007AFF] transition-colors">{i.title || i.jobRole}</h3>
                      <p className="text-[10px] md:text-xs font-mono text-white/40 uppercase tracking-widest mt-1">{i.jobRole}</p>
                    </div>
                  </div>
                  <div className="flex items-center w-full sm:w-auto justify-between sm:justify-end sm:space-x-12">
                     <div className="text-left sm:text-right">
                       <p className="text-[9px] md:text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Access Code</p>
                       <p className="font-mono text-base md:text-lg font-bold text-[#007AFF] tracking-wider">{i.code}</p>
                     </div>
                     <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
                       <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
