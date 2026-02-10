
import React, { useState } from 'react';
import { Button, Input, Card } from '../components/Shared';
import { db } from '../services/db';

interface AuthProps {
  onAuth: () => void;
  onBack: () => void;
  initialRole?: 'recruiter' | 'interviewee';
}

export const Auth: React.FC<AuthProps> = ({ onAuth, onBack, initialRole = 'recruiter' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [candidateCode, setCandidateCode] = useState('');
  const [role, setRole] = useState<'recruiter' | 'interviewee'>(initialRole);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (role === 'recruiter' && !isLogin && !companyName.trim()) {
      alert("Company Name is required for Recruiter registration.");
      return;
    }

    let profile = db.profiles.getByEmail(email);
    
    if (!profile) {
      profile = {
        id: Math.random().toString(36).substr(2, 9),
        email,
        name: name || email.split('@')[0],
        role: role,
        companyName: role === 'recruiter' ? companyName : undefined,
      };
      db.profiles.save(profile);
    } else {
      profile.role = role;
      if (role === 'recruiter' && !profile.companyName && companyName) {
        profile.companyName = companyName;
      }
      db.profiles.save(profile);
    }
    
    if (role === 'interviewee' && candidateCode) {
      const interview = db.interviews.getByCode(candidateCode);
      if (interview) {
        const existingSessions = db.sessions.getByCandidateId(profile.id);
        const alreadyActive = existingSessions.find(s => s.interviewId === interview.id && s.status === 'in_progress');
        
        if (!alreadyActive) {
          const session = {
            id: Math.random().toString(36).substr(2, 9),
            interviewId: interview.id,
            interviewTitle: interview.title || interview.jobRole,
            companyName: interview.companyName,
            candidateId: profile.id,
            candidateName: profile.name,
            candidateEmail: profile.email,
            status: 'in_progress' as const,
            decision: 'pending' as const,
            startedAt: Date.now()
          };
          db.sessions.save(session);
        }
      } else {
        alert('Assessment code invalid.');
        return;
      }
    }

    db.auth.login(profile);
    onAuth();
  };

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#007AFF]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-[340px] space-y-8 animate-in fade-in duration-500 relative z-10">
        <div className="text-center space-y-6">
          <div onClick={onBack} className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto cursor-pointer active:scale-90 transition-all">
            <div className="w-6 h-6 bg-black rounded-md"></div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Sign In</h2>
          
          <div className="inline-flex bg-[#1C1C1E] p-1 rounded-xl border border-white/5">
            <button 
              type="button"
              onClick={() => setRole('recruiter')}
              className={`px-7 py-2 rounded-lg text-[10px] font-bold transition-all duration-300 uppercase tracking-widest ${role === 'recruiter' ? 'bg-white text-black shadow-lg' : 'text-white/30 hover:text-white/60'}`}
            >
              Recruiter
            </button>
            <button 
              type="button"
              onClick={() => setRole('interviewee')}
              className={`px-7 py-2 rounded-lg text-[10px] font-bold transition-all duration-300 uppercase tracking-widest ${role === 'interviewee' ? 'bg-white text-black shadow-lg' : 'text-white/30 hover:text-white/60'}`}
            >
              Candidate
            </button>
          </div>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {!isLogin && (
            <Input 
              label="Full Name" 
              placeholder="Your Name" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
            />
          )}
          {role === 'recruiter' && !isLogin && (
            <Input 
              label="Company" 
              placeholder="e.g. Apple Inc." 
              value={companyName} 
              onChange={e => setCompanyName(e.target.value)} 
              required 
            />
          )}
          <Input 
            label="Email" 
            type="email" 
            placeholder="name@domain.com" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
          />
          <Input 
            label="Password" 
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          
          {role === 'interviewee' && (
            <Input 
              label="Assessment Access Code" 
              placeholder="Enter Code" 
              value={candidateCode} 
              onChange={e => setCandidateCode(e.target.value.toUpperCase())} 
              required={isLogin} 
            />
          )}

          <div className="pt-2">
            <Button type="submit" className="w-full h-12 rounded-xl" size="md">
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </div>
          
          <button 
            type="button" 
            onClick={() => setIsLogin(!isLogin)} 
            className="w-full text-center text-[10px] font-bold text-white/20 hover:text-white transition-colors uppercase tracking-[0.2em] py-2"
          >
            {isLogin ? 'Switch to Registration' : 'Return to Login'}
          </button>
        </form>
      </div>
    </div>
  );
};
