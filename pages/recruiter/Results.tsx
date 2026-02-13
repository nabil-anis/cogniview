
import React, { useState, useEffect } from 'react';
import { Button, Card } from '../../components/Shared';
import { db } from '../../services/db';
import { aiService } from '../../services/gemini';
import { Interview, InterviewSession, EvaluationResult, SessionDecision } from '../../types';

export const Results: React.FC<{ interviewId: string, onBack: () => void }> = ({ interviewId, onBack }) => {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
        const allInterviews = await db.interviews.getAll();
        const i = allInterviews.find(x => x.id === interviewId);
        if (i) {
          setInterview(i);
          const allSessions = await db.sessions.getAll();
          setSessions(allSessions.filter(s => s.interviewId === interviewId));
        }
    };
    fetchData();
  }, [interviewId]);

  const updateDecision = async (decision: SessionDecision) => {
    if (!selectedSession) return;
    const updated = { ...selectedSession, decision };
    await db.sessions.update(updated);
    setSelectedSession(updated);
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
    
    // Show toast notification "Email sent"
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const runEvaluation = async (session: InterviewSession) => {
    if (session.status === 'terminated_early') {
      setSelectedSession(session);
      setEvaluation(null);
      return;
    }

    setLoading(true);
    setSelectedSession(session);
    setEvaluation(null); // Reset prev evaluation while loading
    
    try {
      const existing = await db.evaluations.getBySession(session.id);
      if (existing) {
        setEvaluation(existing);
        setLoading(false);
        return;
      }

      const responses = await db.responses.getBySession(session.id);
      const result = await aiService.evaluateCandidate(
        interview!.jobRole,
        interview!.parameters,
        responses.map(r => ({ q: r.questionText, a: r.responseText }))
      );

      const ev: EvaluationResult = {
        id: Math.random().toString(36).substr(2, 9),
        responseId: responses[0]?.id || 'none',
        ...result
      };
      await db.evaluations.save(ev);
      setEvaluation(ev);
    } catch (e) {
      console.error(e);
      alert("Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!interview) return null;

  // --- CANDIDATE POOL VIEW (List) ---
  if (!selectedSession) {
    return (
      <div className="min-h-screen bg-black text-white px-4 md:px-8 lg:px-12 pb-12 pt-40 animate-in fade-in duration-700">
         <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#007AFF]/10 to-transparent pointer-events-none"></div>
         
        <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
            <div className="space-y-2">
              <p className="text-[10px] md:text-[11px] font-bold text-[#007AFF] uppercase tracking-[0.4em]">Analytics Terminal</p>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tighter text-white">{interview.title || interview.jobRole}</h1>
            </div>
            <Button variant="ghost" onClick={onBack} className="rounded-2xl px-6 md:px-8 h-12 font-bold border border-white/10 hover:bg-white/10 w-full md:w-auto text-white">Exit</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-8 md:p-10 rounded-[2.5rem] border border-white/10 text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-[#007AFF]/10 blur-[50px] rounded-full"></div>
               <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-4">Entries</p>
               <p className="text-6xl md:text-7xl font-black text-white">{sessions.length}</p>
            </div>
            <div className="glass p-8 md:p-10 rounded-[2.5rem] border border-white/10 text-center bg-[#007AFF] text-white shadow-[0_10px_40px_rgba(0,122,255,0.3)]">
               <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-4">Shortlisted</p>
               <p className="text-6xl md:text-7xl font-black">{sessions.filter(s => s.decision === 'passed').length}</p>
            </div>
            <div className="glass p-8 md:p-10 rounded-[2.5rem] border border-white/10 text-center">
               <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-4">Rejected</p>
               <p className="text-6xl md:text-7xl font-black text-white/50">{sessions.filter(s => s.decision === 'failed').length}</p>
            </div>
          </div>

          <div className="glass rounded-[3rem] border border-white/10 overflow-hidden">
            <div className="p-8 md:p-10 border-b border-white/10">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">Candidate Pool</h2>
            </div>
            <div className="divide-y divide-white/5">
              {sessions.length === 0 ? (
                <div className="p-16 md:p-24 text-center text-white/20 font-bold uppercase tracking-widest text-xs">Waiting for data transmission...</div>
              ) : (
                sessions.map(s => (
                  <div key={s.id} className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-white/5 transition-all cursor-pointer group gap-6" onClick={() => runEvaluation(s)}>
                    <div className="flex items-center space-x-6 md:space-x-8">
                      <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-xl md:text-2xl font-bold shadow-lg flex-shrink-0 ${s.status === 'terminated_early' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20'}`}>
                        {s.candidateName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xl md:text-2xl text-white tracking-tight leading-none mb-1 truncate">{s.candidateName}</p>
                        <p className="text-xs md:text-sm font-medium text-white/40 truncate">{s.candidateEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center w-full md:w-auto justify-between md:justify-end md:space-x-12 pl-20 md:pl-0">
                      <div className="text-left md:text-right flex flex-col items-start md:items-end gap-2">
                        <span className={`px-4 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${
                          s.decision === 'passed' ? 'bg-[#007AFF]/20 text-[#007AFF]' : 
                          s.decision === 'failed' ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white/40'
                        }`}>
                          {s.decision}
                        </span>
                        <p className="text-[9px] md:text-[10px] font-bold text-white/20 uppercase tracking-widest">{new Date(s.startedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-all">
                         <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
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
  }

  // --- LOADING STATE ---
  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-8">
       <div className="w-16 h-16 border-4 border-[#007AFF]/30 border-t-[#007AFF] rounded-full animate-spin"></div>
       <h2 className="text-xl font-bold text-white tracking-widest uppercase animate-pulse">Generating Insights...</h2>
    </div>
  );

  // --- DETAILS VIEW (Bento Grid) ---
  return (
    <div className="min-h-screen bg-black text-white px-4 md:px-8 lg:px-12 pb-12 pt-40 animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Navigation & Actions */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center space-x-6">
            <button onClick={() => setSelectedSession(null)} className="p-4 glass rounded-2xl border border-white/10 hover:bg-white/10 transition-all group">
              <svg className="w-6 h-6 text-white group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <h1 className="text-4xl font-bold tracking-tighter text-white leading-none">{selectedSession.candidateName}</h1>
              <p className="text-xs font-bold text-[#007AFF] uppercase tracking-[0.3em] mt-2">Comprehensive Analysis</p>
            </div>
          </div>
        </div>

        {selectedSession.status === 'terminated_early' ? (
           <div className="bg-red-500/10 p-16 rounded-[3rem] text-center space-y-8 border border-red-500/20 mt-12">
             <div className="text-6xl mb-4">🚫</div>
             <h2 className="text-4xl font-bold text-red-500 tracking-tight uppercase">Flagged</h2>
             <p className="text-xl font-medium text-white/80 max-w-2xl mx-auto">"{selectedSession.terminationReason}"</p>
           </div>
        ) : evaluation ? (
          <>
          /* XIAOMI BENTO GRID LAYOUT */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 mt-8">
            
            {/* Block 1: Overall Fit Score (Large Square) */}
            <div className="col-span-1 md:col-span-1 row-span-1 md:row-span-2 bg-[#1C1C1E] rounded-[2.5rem] p-8 flex flex-col items-center justify-between border border-white/5 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-40 h-40 bg-[#007AFF]/20 blur-[60px] rounded-full group-hover:bg-[#007AFF]/30 transition-colors duration-500"></div>
               <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 relative z-10 w-full text-center">Fit Score</p>
               <div className="relative z-10 flex flex-col items-center">
                  <span className="text-8xl font-black tracking-tighter text-white">{Math.round(evaluation.overallScore)}</span>
                  <div className="w-12 h-1 bg-[#007AFF] rounded-full mt-4"></div>
               </div>
               <p className="text-center text-white/50 text-xs font-medium max-w-[150px] relative z-10">Calculated based on {interview.parameters.length} weighted parameters.</p>
            </div>

            {/* Block 2: Recommendation (Wide Rectangle) */}
            <div className="col-span-1 md:col-span-2 bg-[#2C2C2E] rounded-[2.5rem] p-8 flex flex-col justify-center border border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#007AFF]/10 to-transparent pointer-events-none"></div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#007AFF] mb-2">AI Recommendation</p>
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{evaluation.analysis.recommendation}</h2>
            </div>

             {/* Block 3: Confidence (Square) */}
             <div className="col-span-1 md:col-span-1 bg-[#1C1C1E] rounded-[2.5rem] p-8 flex flex-col items-center justify-center border border-white/5 text-center">
                <div className="w-16 h-16 rounded-full border-4 border-[#007AFF] flex items-center justify-center mb-4">
                   <span className="text-sm font-bold text-white">{Math.round(evaluation.analysis.confidence * 100)}%</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Confidence</p>
            </div>

            {/* Block 4: Key Strength (Square) */}
             <div className="col-span-1 md:col-span-1 bg-[#1C1C1E] rounded-[2.5rem] p-8 flex flex-col justify-between border border-white/5">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center text-green-500 mb-4">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                </div>
                <div>
                   <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Top Strength</p>
                   <p className="text-lg font-bold text-white leading-tight">{evaluation.analysis.strengths[0]?.title || "N/A"}</p>
                </div>
            </div>

            {/* Block 5: Summary (Large/Tall Rectangle) */}
            <div className="col-span-1 md:col-span-2 row-span-1 md:row-span-2 bg-[#1C1C1E] rounded-[2.5rem] p-10 border border-white/5 flex flex-col">
               <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-6">Executive Summary</p>
               <p className="text-lg md:text-xl text-white/80 leading-relaxed font-medium">"{evaluation.analysis.summary}"</p>
               
               <div className="mt-auto pt-8">
                  <div className="h-px w-full bg-white/10 mb-6"></div>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                     {Object.entries(evaluation.parameterScores).map(([key, score]) => (
                        <div key={key} className="flex-shrink-0 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                           <span className="text-[10px] font-bold text-white/40 block mb-1 uppercase tracking-wider">{key}</span>
                           <span className="text-lg font-bold text-white">{score}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* Block 6: Weakness (Square) */}
            <div className="col-span-1 md:col-span-1 bg-[#1C1C1E] rounded-[2.5rem] p-8 flex flex-col justify-between border border-white/5">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-500 mb-4">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <div>
                   <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Area of Focus</p>
                   <p className="text-lg font-bold text-white leading-tight">{evaluation.analysis.weaknesses[0]?.title || "None"}</p>
                </div>
            </div>

          </div>

          {/* Action Buttons (Inline) */}
          <div className="flex justify-center items-center gap-6 mt-16 mb-8">
             <Button 
                onClick={() => updateDecision('failed')} 
                variant="ghost" 
                className={`w-40 rounded-full h-14 text-xs font-bold uppercase tracking-widest transition-all ${
                   selectedSession.decision === 'failed' ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-[#1C1C1E] border border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                }`}
             >
                Reject
             </Button>
             <Button 
                onClick={() => updateDecision('passed')} 
                variant="ghost" 
                className={`w-40 rounded-full h-14 text-xs font-bold uppercase tracking-widest transition-all ${
                   selectedSession.decision === 'passed' ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'bg-[#1C1C1E] border border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                }`}
             >
                Approve
             </Button>
          </div>
          </>
        ) : null}

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed bottom-10 right-10 bg-white text-black px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-300 z-50 flex items-center gap-3">
             <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
             </div>
             <div>
                <p className="text-sm font-bold">Email Sent</p>
                <p className="text-xs text-black/60">Candidate has been notified.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
