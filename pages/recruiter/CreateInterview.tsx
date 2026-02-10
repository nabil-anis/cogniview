
import React, { useState } from 'react';
import { Button, Input, Card } from '../../components/Shared';
import { db } from '../../services/db';
import { aiService } from '../../services/gemini';
import { Question, EvaluationParameter, Profile } from '../../types';

export const CreateInterview: React.FC<{ user: Profile, onBack: () => void }> = ({ user, onBack }) => {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [companyName, setCompanyName] = useState(user.companyName || '');
  const [parameters, setParameters] = useState<EvaluationParameter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  
  // Custom Matrix State
  const [matrixMode, setMatrixMode] = useState<'auto' | 'custom'>('auto');
  const [customParam, setCustomParam] = useState({ name: '', description: '', weight: '' });

  const handleGenerateParams = async () => {
    if (!jobRole.trim()) return;
    setLoadingAI(true);
    const suggested = await aiService.generateParameters(jobRole);
    setParameters(suggested);
    setLoadingAI(false);
  };

  const handleAddCustomParam = () => {
    if (!customParam.name || !customParam.weight) return;
    const newParam: EvaluationParameter = {
      id: Math.random().toString(36).substr(2, 9),
      name: customParam.name,
      description: customParam.description || 'Custom criterion',
      weight: parseInt(customParam.weight) || 0
    };
    setParameters([...parameters, newParam]);
    setCustomParam({ name: '', description: '', weight: '' });
  };

  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return;
    const q: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: newQuestion,
      variants: [newQuestion]
    };
    setQuestions([...questions, q]);
    setNewQuestion('');
  };

  const updateParam = (id: string, field: keyof EvaluationParameter, value: any) => {
    setParameters(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeParam = (id: string) => {
    setParameters(prev => prev.filter(p => p.id !== id));
  };

  const handleSave = () => {
    if (!jobRole || !companyName) {
      alert("Please fill in the job details.");
      return;
    }
    if (questions.length === 0) {
      alert("Please add at least one interview question.");
      return;
    }
    const totalWeight = parameters.reduce((sum, p) => sum + Number(p.weight), 0);
    if (parameters.length > 0 && Math.abs(totalWeight - 100) > 1) {
        alert(`Total weight must equal 100. Current total: ${totalWeight}`);
        return;
    }

    const interview = {
      id: Math.random().toString(36).substr(2, 9),
      recruiterId: user.id,
      companyName,
      jobRole,
      code: Math.random().toString(36).substr(2, 6).toUpperCase(),
      title: title.trim() || jobRole,
      questions,
      parameters,
      status: 'active' as const,
      createdAt: Date.now()
    };
    db.interviews.save(interview);
    alert(`Assessment Created. Access Code: ${interview.code}`);
    onBack();
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 md:px-12 pb-12 pt-40">
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#007AFF]/10 to-transparent pointer-events-none"></div>

      <div className="max-w-3xl mx-auto space-y-12 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-[#007AFF] uppercase tracking-[0.4em]">Configuration</p>
            <h1 className="text-4xl font-bold tracking-tighter text-white">New Assessment</h1>
          </div>
          <button onClick={onBack} className="text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Discard</button>
        </div>

        {step === 1 ? (
          <div className="glass p-10 rounded-[2.5rem] border border-white/10 space-y-10">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Role Definitions</h2>
              <p className="text-sm text-white/40">Set the parameters for the AI interviewer.</p>
            </div>
            
            <div className="space-y-8">
              <Input 
                label="Target Role" 
                placeholder="e.g. Senior Backend Engineer" 
                value={jobRole} 
                onChange={e => setJobRole(e.target.value)} 
                className="text-lg font-bold"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  label="Organization" 
                  placeholder="Company Name" 
                  value={companyName} 
                  onChange={e => setCompanyName(e.target.value)} 
                />
                <Input 
                  label="Internal Reference (Optional)" 
                  placeholder="e.g. Q3 Hiring Batch" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                />
              </div>
            </div>

            <div className="pt-4">
              <Button size="lg" className="w-full h-14 rounded-2xl font-bold shadow-lg" onClick={() => setStep(2)} disabled={!jobRole || !companyName}>
                Initialize Protocol &rarr;
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 pb-32">
            {/* Questions Section */}
            <div className="glass p-10 rounded-[2.5rem] border border-white/10 space-y-8">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Verbal Questions</h2>
                <p className="text-sm text-white/40">These prompts will guide the AI's conversation.</p>
              </div>

              <div className="flex gap-4">
                <input 
                  className="flex-1 px-6 py-4 rounded-2xl bg-white/[0.03] border border-white/10 outline-none focus:border-[#007AFF] transition-all text-sm font-medium text-white placeholder-white/20" 
                  placeholder="Type a strategic question..." 
                  value={newQuestion} 
                  onChange={e => setNewQuestion(e.target.value)} 
                  onKeyPress={e => e.key === 'Enter' && handleAddQuestion()} 
                />
                <Button onClick={handleAddQuestion} size="md" variant="secondary" className="rounded-2xl px-8 bg-white/10 border-white/10 hover:bg-white/20">Add</Button>
              </div>

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between group">
                    <div className="flex items-center space-x-6">
                      <span className="text-[10px] font-bold text-[#007AFF] bg-[#007AFF]/10 px-2 py-1 rounded uppercase">Q{idx + 1}</span>
                      <p className="text-sm font-medium text-white/80">{q.text}</p>
                    </div>
                    <button onClick={() => setQuestions(questions.filter(x => x.id !== q.id))} className="text-white/10 group-hover:text-red-500/50 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Parameters Section */}
            <div className="glass p-10 rounded-[2.5rem] border border-white/10 space-y-6">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-white tracking-tight">Evaluation Matrix</h2>
                    <p className="text-sm text-white/40">Define success metrics for the AI analysis.</p>
                  </div>
                  
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                     <button 
                        onClick={() => setMatrixMode('auto')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matrixMode === 'auto' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                     >
                        Auto-Generate
                     </button>
                     <button 
                        onClick={() => setMatrixMode('custom')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${matrixMode === 'custom' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                     >
                        Custom
                     </button>
                  </div>
               </div>

               {matrixMode === 'auto' && parameters.length === 0 && (
                   <div className="py-8 text-center">
                       <Button 
                         onClick={handleGenerateParams} 
                         loading={loadingAI} 
                         variant="primary" 
                         size="md" 
                         className="rounded-xl shadow-lg shadow-blue-500/20"
                       >
                         ✨ Generate Criteria with AI
                       </Button>
                   </div>
               )}

               {matrixMode === 'custom' && (
                  <div className="grid grid-cols-12 gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="col-span-12 md:col-span-5">
                          <input 
                             placeholder="Criterion Name (e.g. Technical Depth)" 
                             className="w-full bg-transparent border-b border-white/10 py-2 text-sm text-white focus:border-[#007AFF] outline-none placeholder-white/20"
                             value={customParam.name}
                             onChange={e => setCustomParam({...customParam, name: e.target.value})}
                          />
                      </div>
                      <div className="col-span-12 md:col-span-4">
                          <input 
                             placeholder="Description" 
                             className="w-full bg-transparent border-b border-white/10 py-2 text-sm text-white focus:border-[#007AFF] outline-none placeholder-white/20"
                             value={customParam.description}
                             onChange={e => setCustomParam({...customParam, description: e.target.value})}
                          />
                      </div>
                      <div className="col-span-8 md:col-span-2">
                           <input 
                             type="number"
                             placeholder="Weight %" 
                             className="w-full bg-transparent border-b border-white/10 py-2 text-sm text-white focus:border-[#007AFF] outline-none placeholder-white/20 text-center"
                             value={customParam.weight}
                             onChange={e => setCustomParam({...customParam, weight: e.target.value})}
                          />
                      </div>
                      <div className="col-span-4 md:col-span-1 flex justify-end">
                          <button onClick={handleAddCustomParam} className="w-8 h-8 rounded-lg bg-[#007AFF] flex items-center justify-center text-white hover:bg-[#0055BB]">
                             +
                          </button>
                      </div>
                  </div>
               )}

               {parameters.length > 0 && (
                 <div className="space-y-4 pt-4">
                   {parameters.map(p => (
                     <div key={p.id} className="p-5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between group">
                       <div className="space-y-1">
                         <p className="text-sm font-bold text-white">{p.name}</p>
                         <p className="text-[10px] text-white/40 max-w-[300px]">{p.description}</p>
                       </div>
                       <div className="flex items-center gap-4">
                           <div className="flex items-center space-x-3 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                              <input 
                                type="number" 
                                className="w-10 bg-transparent text-right text-xs font-bold text-[#007AFF] outline-none" 
                                value={p.weight} 
                                onChange={e => updateParam(p.id, 'weight', e.target.value)}
                              />
                              <span className="text-[10px] font-bold text-white/20">%</span>
                           </div>
                           <button onClick={() => removeParam(p.id)} className="text-white/20 hover:text-red-500 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                           </button>
                       </div>
                     </div>
                   ))}
                   <div className="flex justify-end pt-2">
                      <p className={`text-xs font-bold ${parameters.reduce((s, p) => s + Number(p.weight), 0) === 100 ? 'text-green-500' : 'text-red-500'}`}>
                         Total Weight: {parameters.reduce((s, p) => s + Number(p.weight), 0)}%
                      </p>
                   </div>
                 </div>
               )}
            </div>

            <div className="flex justify-between items-center pt-8">
              <button onClick={() => setStep(1)} className="text-xs font-bold text-white/30 hover:text-white transition-colors uppercase tracking-widest">Back</button>
              <Button size="lg" onClick={handleSave} className="h-16 px-12 rounded-2xl shadow-[0_0_40px_rgba(0,122,255,0.4)] text-lg font-bold">Launch Assessment</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
