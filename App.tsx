
import React, { useState, useEffect } from 'react';
import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { RecruiterDashboard } from './pages/recruiter/Dashboard';
import { CreateInterview } from './pages/recruiter/CreateInterview';
import { InterviewRoom } from './pages/interviewee/InterviewRoom';
import { IntervieweeDashboard } from './pages/interviewee/Dashboard';
import { Results } from './pages/recruiter/Results';
import { db } from './services/db';
import { Profile } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('landing');
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  useEffect(() => {
    const user = db.auth.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      navigateUser(user);
    }
  }, []);

  const navigateUser = (user: Profile) => {
    if (user.role === 'recruiter') {
      setCurrentPage('dashboard');
    } else {
      const sessions = db.sessions.getByCandidateId(user.id);
      const active = sessions.find(s => s.status === 'in_progress');
      if (active) setCurrentPage('interview-room');
      else setCurrentPage('candidate-dashboard');
    }
  };

  const handleAuth = () => {
    const user = db.auth.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      navigateUser(user);
    }
  };

  const logout = () => {
    db.auth.logout();
    setCurrentUser(null);
    setCurrentPage('landing');
  };

  const renderPage = () => {
    if (!currentUser) {
      if (currentPage === 'login') return <Auth onAuth={handleAuth} onBack={() => setCurrentPage('landing')} />;
      return <Landing onNavigate={setCurrentPage} />;
    }

    // Role-based rendering
    if (currentUser.role === 'recruiter') {
      if (currentPage === 'create-interview') return <CreateInterview user={currentUser} onBack={() => setCurrentPage('dashboard')} />;
      if (currentPage.startsWith('results-')) {
        return <Results interviewId={currentPage.split('-')[1]} onBack={() => setCurrentPage('dashboard')} />;
      }
      return <RecruiterDashboard user={currentUser} onNavigate={setCurrentPage} />;
    }

    if (currentUser.role === 'interviewee') {
      if (currentPage === 'interview-room') return <InterviewRoom user={currentUser} onComplete={() => setCurrentPage('candidate-dashboard')} />;
      return <IntervieweeDashboard user={currentUser} onNavigate={setCurrentPage} />;
    }

    return <div className="p-20 text-center text-white">Unauthorized Access</div>;
  };

  return (
    <div className="min-h-screen bg-black flex flex-col selection:bg-[#007AFF] selection:text-white overflow-x-hidden font-sans">
      {/* Floating Navigation Bar */}
      {currentUser && currentPage !== 'interview-room' && (
        <div className="fixed top-6 left-0 w-full z-50 flex justify-center pointer-events-none px-4">
          <nav className="glass pointer-events-auto flex items-center justify-between px-6 py-3 rounded-full border border-white/10 shadow-2xl backdrop-blur-xl bg-black/60 max-w-2xl w-full transition-all duration-300 hover:border-white/20">
            <div 
              className="flex items-center space-x-3 cursor-pointer group" 
              onClick={() => navigateUser(currentUser)}
            >
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center transition-transform group-hover:scale-95">
                <div className="w-4 h-4 bg-black rounded-sm"></div>
              </div>
              <span className="text-sm font-bold tracking-tight text-white hidden sm:block">Cogniview</span>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">User</p>
                <p className="font-semibold text-white text-xs truncate max-w-[100px]">{currentUser.name}</p>
              </div>
              <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
              <button 
                onClick={logout} 
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-red-500/10 hover:text-red-500 text-white/60 font-bold text-[10px] uppercase tracking-widest transition-all border border-transparent hover:border-red-500/20"
              >
                Log Out
              </button>
            </div>
          </nav>
        </div>
      )}
      
      {/* Main Content Area */}
      <main className="flex-1 w-full relative">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
