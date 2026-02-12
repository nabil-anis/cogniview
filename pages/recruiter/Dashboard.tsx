
import React, { useState, useEffect, useRef } from 'react';
import { Button, Card } from '../../components/Shared';
import { db } from '../../services/db';
import { Interview, Profile } from '../../types';

export const RecruiterDashboard: React.FC<{ user: Profile, onNavigate: (page: string) => void }> = ({ user, onNavigate }) => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [localUser, setLocalUser] = useState(user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchInterviews = async () => {
      const all = await db.interviews.getAll();
      setInterviews(all.filter(i => i.recruiterId === user.id));
    };
    fetchInterviews();
  }, [user.id]);

  const handleCopyCode = (e: React.MouseEvent, code: string, id: string) => {
    e.stopPropagation(); // Prevent navigation to details
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to Base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const updatedProfile = { ...localUser, logoUrl: base64 };
      
      // Optimistic update
      setLocalUser(updatedProfile);
      
      // Persist
      try {
        await db.auth.login(updatedProfile); // Updates localStorage and DB
      } catch (err) {
        console.error("Failed to save logo", err);
        alert("Failed to upload logo.");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 p-6 md:p-8 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Action Area */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4">
          <div className="flex items-center gap-6">
            {/* Logo Upload Area */}
            <div 
              className="relative group w-20 h-20 rounded-2xl bg-[#1C1C1E] border border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-white/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              {localUser.logoUrl ? (
                <img src={localUser.logoUrl} alt="Company Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-white/20 group-hover:text-white/40">+</span>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[8px] font-bold uppercase tracking-widest text-white">Upload</span>
              </div>
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleLogoUpload}
              />
            </div>

            <div>
              <h1 className="text-4xl font-medium text-white tracking-tight">Recruitment</h1>
              <p className="text-base text-gray-500 mt-2">Manage your active pipelines.</p>
            </div>
          </div>
          <Button onClick={() => onNavigate('create-interview')} variant="primary" size="lg" className="shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            + New Assessment
          </Button>
        </div>

        {/* Bento Grid Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
          {/* Active Jobs - Large Square */}
          <div className="md:col-span-2 bg-[#1C1C1E] border border-white/5 rounded-[32px] p-8 md:p-10 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-80 h-80 bg-[#007AFF]/10 blur-[100px] rounded-full group-hover:bg-[#007AFF]/20 transition-all duration-700"></div>
             
             <div className="relative z-10 flex flex-col justify-between h-full min-h-[220px]">
                <div className="flex justify-between items-start">
                   <div className="w-14 h-14 bg-white/10 rounded-[20px] flex items-center justify-center text-white backdrop-blur-md border border-white/5">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                   </div>
                   <span className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] border border-white/10 px-3 py-1 rounded-full">Live</span>
                </div>
                
                <div className="mt-8">
                  <h3 className="text-7xl font-medium text-white tracking-tighter mb-2">{interviews.length}</h3>
                  <p className="text-lg text-white/60 font-medium">Active Assessments</p>
                  <p className="text-sm text-white/30 mt-1">Currently accepting responses</p>
                </div>
             </div>
          </div>
          
          {/* Candidates - Tall Rect */}
          <div className="bg-[#2C2C2E] border border-white/5 rounded-[32px] p-8 flex flex-col justify-between h-full min-h-[220px] relative overflow-hidden group">
             <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/5 blur-[50px] rounded-full pointer-events-none"></div>
             <div className="relative z-10 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
             </div>
             <div className="relative z-10">
                <h3 className="text-5xl font-medium text-white tracking-tight mb-2">0</h3>
                <p className="text-sm text-white/50 font-medium">Candidates Processed</p>
             </div>
          </div>

          {/* System Status - Tall Rect */}
          <div className="bg-[#1C1C1E] border border-white/5 rounded-[32px] p-8 flex flex-col justify-between h-full min-h-[220px]">
             <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             </div>
             <div>
                <h3 className="text-3xl font-medium text-white tracking-tight mb-2">Stable</h3>
                <p className="text-sm text-white/50 font-medium">System Status</p>
                <p className="text-xs text-white/30 mt-1">v2.5.0 Latest</p>
             </div>
          </div>
        </div>

        {/* Assessments List */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-medium text-white">Your Assessments</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {interviews.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-[#222] rounded-[32px] bg-[#111]/50">
                <p className="text-base text-gray-500 mb-4">No assessments found</p>
                <Button onClick={() => onNavigate('create-interview')} variant="secondary" size="sm">Create New</Button>
              </div>
            ) : (
              interviews.map(i => (
                <div 
                  key={i.id} 
                  onClick={() => onNavigate(`results-${i.id}`)}
                  className="group bg-[#1C1C1E] border border-white/[0.06] p-6 rounded-[28px] flex items-center justify-between cursor-pointer hover:bg-[#2C2C2E] transition-all duration-300"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[20px] bg-[#2C2C2E] group-hover:bg-[#3C3C3E] border border-white/5 flex items-center justify-center text-xl font-bold text-white transition-colors">
                      {i.jobRole.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">{i.title || i.jobRole}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                         <span>{i.companyName}</span>
                         <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                         <span>{new Date(i.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-8">
                     <div 
                        className="text-right hidden sm:block cursor-pointer group/copy relative z-10"
                        onClick={(e) => handleCopyCode(e, i.code, i.id)}
                        title="Click to copy code"
                     >
                       <p className={`text-[10px] uppercase tracking-wider mb-1 transition-colors ${copiedId === i.id ? 'text-green-500 font-bold' : 'text-gray-500'}`}>
                         {copiedId === i.id ? 'Copied!' : 'Access Code'}
                       </p>
                       <div className="flex items-center justify-end gap-2">
                         <p className="font-mono text-base font-medium text-[#007AFF] group-hover/copy:text-white transition-colors">{i.code}</p>
                         <div className={`w-5 h-5 flex items-center justify-center rounded-full bg-white/10 transition-all duration-300 ${copiedId === i.id ? 'bg-green-500/20 text-green-500 scale-100' : 'opacity-0 group-hover/copy:opacity-100 -translate-x-2 group-hover/copy:translate-x-0'}`}>
                           {copiedId === i.id ? (
                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                           ) : (
                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                           )}
                         </div>
                       </div>
                     </div>
                     <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white group-hover:bg-white/10 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
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
