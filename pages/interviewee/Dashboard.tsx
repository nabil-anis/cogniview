
import React, { useState, useEffect } from 'react';
import { Button } from '../../components/Shared';
import { db } from '../../services/db';
import { Profile, InterviewSession, Interview } from '../../types';

export const IntervieweeDashboard: React.FC<{ user: Profile, onNavigate: (page: string) => void }> = ({ user, onNavigate }) => {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [interviews, setInterviews] = useState<Record<string, Interview>>({});
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch sessions
      const sessionData = await db.sessions.getByCandidateId(user.id);
      setSessions(sessionData.sort((a, b) => b.startedAt - a.startedAt));

      // Fetch interviews to get roles
      const allInterviews = await db.interviews.getAll();
      const interviewMap = allInterviews.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {} as Record<string, Interview>);
      setInterviews(interviewMap);
    };
    fetchData();
  }, [user.id]);

  const handleJoin = async () => {
      if (!joinCode) return;
      setLoading(true);
      try {
          const interview = await db.interviews.getByCode(joinCode);
          if (!interview) {
              alert("Invalid Access Code");
              setLoading(false);
              return;
          }

          // Check if already taken or in progress
          const existing = sessions.find(s => s.interviewId === interview.id);
          if (existing && existing.status === 'in_progress') {
             // Resume
             onNavigate('interview-room');
             return;
          }

          if (existing && existing.status === 'completed') {
              alert("You have already completed this assessment.");
              setLoading(false);
              return;
          }

          // Create new session
          const session = {
              id: Math.random().toString(36).substr(2, 9),
              interviewId: interview.id,
              interviewTitle: interview.title || interview.jobRole,
              companyName: interview.companyName,
              candidateId: user.id,
              candidateName: user.name,
              candidateEmail: user.email,
              status: 'in_progress' as const,
              decision: 'pending' as const,
              startedAt: Date.now()
          };
          await db.sessions.save(session);
          onNavigate('interview-room');
      } catch (e) {
          console.error(e);
          alert("Error joining session.");
          setLoading(false);
      }
  };

  const toggleExpand = (id: string) => {
      setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 md:px-12 pb-12 pt-32 animate-in fade-in duration-700">
       <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#007AFF]/10 to-transparent pointer-events-none"></div>

      <div className="max-w-4xl mx-auto space-y-10 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-[#007AFF]">Candidate Portal</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">Your Dashboard</h1>
          </div>
        </div>

        {/* Start New Assessment Input */}
        <div className="glass p-2 rounded-[24px] border border-white/10 flex items-center p-2 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-full h-full bg-white/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            <div className="w-12 h-12 bg-white/10 rounded-[18px] flex items-center justify-center text-white mr-4 flex-shrink-0">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            </div>
            <input 
               value={joinCode}
               onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
               placeholder="Enter Assessment Code to Start..."
               className="bg-transparent border-none text-white text-lg placeholder-white/20 w-full focus:ring-0 outline-none font-medium"
            />
            <Button onClick={handleJoin} loading={loading} className="rounded-xl px-8 h-12">Start</Button>
        </div>

        <div className="space-y-6">
          <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest pl-2">History</h2>
          
          <div className="grid grid-cols-1 gap-4">
            {sessions.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-white/10 rounded-[3rem] bg-white/[0.02]">
                 <div className="text-4xl mb-4 opacity-20">📂</div>
                 <p className="text-white/30 font-bold uppercase tracking-widest text-xs">No interviews yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map(s => {
                  const interview = interviews[s.interviewId];
                  return (
                    <div 
                      key={s.id} 
                      onClick={() => toggleExpand(s.id)}
                      className={`glass rounded-[2rem] border transition-all cursor-pointer overflow-hidden ${expandedId === s.id ? 'bg-white/[0.08] border-white/20 shadow-xl' : 'border-white/5 hover:bg-white/[0.08]'}`}
                    >
                      <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex items-center gap-6 w-full md:w-auto">
                              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold border ${s.decision === 'passed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : s.decision === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/20'}`}>
                              {s.companyName.charAt(0)}
                              </div>
                              <div>
                                  <h3 className="text-xl font-bold text-white">{s.companyName}</h3>
                                  <div className="flex flex-col">
                                      <p className="text-sm font-semibold text-white/80">
                                         {interview?.jobRole || s.interviewTitle}
                                      </p>
                                      {interview?.jobRole && s.interviewTitle !== interview.jobRole && (
                                         <p className="text-xs text-white/40">{s.interviewTitle}</p>
                                      )}
                                  </div>
                              </div>
                          </div>

                          <div className="flex items-center justify-between w-full md:w-auto gap-8">
                              <div className="text-right hidden md:block">
                                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Date</p>
                                  <p className="text-sm font-bold text-white">{new Date(s.startedAt).toLocaleDateString()}</p>
                              </div>
                              <div className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                  s.decision === 'passed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                  s.decision === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                  'bg-white/5 text-white/40 border-white/10'
                              }`}>
                                  {s.decision}
                              </div>
                          </div>
                      </div>
                      
                      {/* Expandable Message Area */}
                      {expandedId === s.id && (
                          <div className="px-6 pb-6 pt-0 animate-in slide-in-from-top-2 duration-300">
                              <div className={`p-4 rounded-xl border ${
                                  s.decision === 'passed' ? 'bg-green-500/10 border-green-500/20' : 
                                  s.decision === 'failed' ? 'bg-red-500/10 border-red-500/20' : 
                                  'bg-white/5 border-white/10'
                              }`}>
                                  {s.decision === 'passed' && (
                                      <div className="flex items-center gap-3 text-green-400">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                          <p className="font-medium text-sm">Congratulations, you passed! The recruitment team will be in touch shortly.</p>
                                      </div>
                                  )}
                                  {s.decision === 'failed' && (
                                      <div className="flex items-center gap-3 text-red-400">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                          <p className="font-medium text-sm">You have failed. Better luck next time.</p>
                                      </div>
                                  )}
                                  {s.decision === 'pending' && (
                                      <div className="flex items-center gap-3 text-white/50">
                                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                          <p className="font-medium text-sm">Evaluation in progress...</p>
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) }
          </div>
        </div>
      </div>
    </div>
  );
};
