
import React, { useState } from 'react';
import { Button, Input, Card } from '../components/Shared';
import { db } from '../services/db';
import { Profile } from '../types';

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
  const [loading, setLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (password.length < 5) {
      alert("Security Requirement: Password must be at least 5 characters.");
      return;
    }

    setLoading(true);

    try {
      if (role === 'recruiter' && !isLogin && !companyName.trim()) {
        alert("Company Name is required for Recruiter registration.");
        setLoading(false);
        return;
      }

      let profile = await db.profiles.getByEmail(email);
      
      if (isLogin) {
        // LOGIN FLOW
        if (!profile) {
          alert("Account not found. Please switch to Registration to create an account.");
          setLoading(false);
          return;
        }
      } else {
        // REGISTRATION FLOW
        if (profile) {
          alert("Account already exists with this email. Please Sign In.");
          setLoading(false);
          return;
        }

        // Create new profile
        profile = {
          id: Math.random().toString(36).substr(2, 9),
          email,
          name: name || email.split('@')[0],
          role: role,
          companyName: role === 'recruiter' ? companyName : undefined,
        };
      }
      
      // Handle Candidate Session Linking (Only if code is provided)
      if (role === 'interviewee' && candidateCode) {
        const interview = await db.interviews.getByCode(candidateCode);
        if (interview) {
          const existingSessions = await db.sessions.getByCandidateId(profile.id);
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
            await db.sessions.save(session);
          }
        } else {
          alert('Assessment code invalid.');
          setLoading(false);
          return;
        }
      }

      await db.auth.login(profile);
      onAuth();
    } catch (err) {
      console.error(err);
      alert("Authentication failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#007AFF]/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-[300px] space-y-6 animate-in fade-in duration-500 relative z-10">
        <div className="text-center space-y-5">
          <div onClick={onBack} className="w-10 h-10 bg-white rounded-[14px] flex items-center justify-center mx-auto cursor-pointer active:scale-90 transition-all shadow-lg">
            <div className="w-5 h-5 bg-black rounded-md"></div>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          
          <div className="inline-flex bg-[#1C1C1E] p-0.5 rounded-lg border border-white/5">
            <button 
              type="button"
              onClick={() => setRole('recruiter')}
              className={`px-5 py-1.5 rounded-md text-[9px] font-bold transition-all duration-300 uppercase tracking-widest ${role === 'recruiter' ? 'bg-white text-black shadow-lg' : 'text-white/30 hover:text-white/60'}`}
            >
              Recruiter
            </button>
            <button 
              type="button"
              onClick={() => setRole('interviewee')}
              className={`px-5 py-1.5 rounded-md text-[9px] font-bold transition-all duration-300 uppercase tracking-widest ${role === 'interviewee' ? 'bg-white text-black shadow-lg' : 'text-white/30 hover:text-white/60'}`}
            >
              Candidate
            </button>
          </div>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-3">
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
            placeholder="Min. 5 chars" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          
          {role === 'interviewee' && (
            <div className="pt-1 pb-1">
                 <Input 
                  label="Assessment Access Code" 
                  subLabel="Optional"
                  placeholder="Enter Code" 
                  value={candidateCode} 
                  onChange={e => setCandidateCode(e.target.value.toUpperCase())} 
                  required={false}
                />
                <p className="text-[9px] text-white/30 mt-1.5 px-1">Leave blank to go to your dashboard.</p>
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" className="w-full h-10 rounded-xl text-sm" size="md" loading={loading}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </div>
          
          <button 
            type="button" 
            onClick={() => setIsLogin(!isLogin)} 
            className="w-full text-center text-[9px] font-bold text-white/20 hover:text-white transition-colors uppercase tracking-[0.2em] py-1"
          >
            {isLogin ? 'New here? Create Account' : 'Already have an account? Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
