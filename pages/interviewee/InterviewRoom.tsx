
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/Shared';
import { db } from '../../services/db';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Interview, Profile, InterviewSession } from '../../types';

// Audio Encoding/Decoding Helpers
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const InterviewRoom: React.FC<{ user: Profile, onComplete: () => void }> = ({ user, onComplete }) => {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'welcome' | 'live' | 'ending'>('welcome');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mountedRef = useRef(true);

  // Anti-Cheat & Session Init Logic
  useEffect(() => {
    mountedRef.current = true;
    const sessions = db.sessions.getByCandidateId(user.id);
    const active = sessions.find(s => s.status === 'in_progress');
    if (active) {
      setSession(active);
      const i = db.interviews.getAll().find(x => x.id === active.interviewId);
      if (i) setInterview(i);
    }
    return () => { mountedRef.current = false; };
  }, [user.id]);

  // Anti-Cheat Event Listeners
  useEffect(() => {
    if (step !== 'live') return;

    const handleViolation = () => {
      if (!session) return;
      terminateSession("Candidate switched tabs or exited full-screen mode.");
    };

    const onVisibilityChange = () => {
      if (document.hidden) handleViolation();
    };

    const onBlur = () => {
      handleViolation();
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [step, session]);

  const enterFullScreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen denied", e);
    }
  };

  const terminateSession = (reason: string) => {
    if (!session || !mountedRef.current) return;
    
    // Stop all tracks
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
    }

    // Update DB
    db.sessions.update({ 
        ...session, 
        status: 'terminated_early', 
        completedAt: Date.now(),
        terminationReason: reason,
        decision: 'failed'
    });

    alert(`⚠️ Security Violation Detected: ${reason}\n\nThe interview has been terminated and reported to the recruiter.`);
    onComplete();
  };

  const startSession = async () => {
    if (!interview) return;
    setLoading(true);
    await enterFullScreen();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" } 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      outputNodeRef.current = outputCtx.createGain();
      outputNodeRef.current.connect(outputCtx.destination);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            if (!mountedRef.current) return;
            setIsLive(true);
            setStep('live');
            setLoading(false);

            // Start sending audio from mic to model
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (!mountedRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!mountedRef.current) return;
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputNodeRef.current!);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (message.serverContent?.outputTranscription) {
              setTranscript(prev => [...prev, message.serverContent!.outputTranscription!.text]);
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are a professional AI interviewer for the ${interview.jobRole} position at ${interview.companyName}. You are interviewing ${user.name}. Start the conversation by introducing yourself and asking the first question: "${interview.questions[0].text}". Then continue with the rest of the questions: ${interview.questions.slice(1).map(q => q.text).join('; ')}. Be polite, concise, and focused.`
        }
      });
    } catch (e) {
      alert("Please allow camera and mic permissions.");
      setLoading(false);
    }
  };

  const finishSession = () => {
    setLoading(true);
    db.responses.save({
      id: Math.random().toString(36).substr(2, 9),
      sessionId: session!.id,
      questionId: 'verbal-assessment',
      questionText: 'Verbal Evaluation',
      responseText: transcript.join(' '),
      timestamp: Date.now()
    });
    
    setTimeout(() => {
      db.sessions.update({ ...session!, status: 'completed', completedAt: Date.now() });
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(console.error);
      }
      
      onComplete();
    }, 1500);
  };

  if (!interview || !session) return null;

  return (
    <div className="h-screen w-screen bg-black text-white relative overflow-hidden">
      
      {step === 'welcome' && (
        <div className="flex flex-col items-center justify-center h-full p-6 relative z-20">
            {/* Background Decor */}
            <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-[#007AFF]/10 to-transparent pointer-events-none"></div>

            <div className="max-w-xl w-full text-center space-y-12 glass p-8 md:p-16 rounded-[3rem] border border-white/10 animate-in zoom-in-95 duration-500 mx-4">
              <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl">
                <div className="w-12 h-12 bg-black rounded-xl"></div>
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-none">Cognitive Check</h1>
                <p className="text-white/60 text-lg font-medium">{interview.jobRole} @ {interview.companyName}</p>
              </div>
              <div className="bg-white/5 rounded-3xl p-6 md:p-8 text-left space-y-4 border border-white/5">
                <p className="font-bold text-white/40 text-xs uppercase tracking-[0.2em]">Security Protocols</p>
                <ul className="space-y-4 text-white/90 font-medium text-sm md:text-base">
                  <li className="flex items-center space-x-4">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span>Full Screen Required</span>
                  </li>
                  <li className="flex items-center space-x-4">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span>Tab Switching Prohibited</span>
                  </li>
                </ul>
              </div>
              <Button size="lg" className="w-full h-16 text-lg rounded-2xl font-bold shadow-[0_0_40px_rgba(0,122,255,0.3)]" onClick={startSession} loading={loading}>
                Initialize Secure Session
              </Button>
            </div>
        </div>
      )}

      {step === 'live' && (
        <div className="absolute inset-0 z-0 bg-black">
          {/* Immersive Camera Background */}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none"></div>

          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10">
             <div className="glass px-6 py-3 rounded-full border border-white/10 flex items-center gap-3">
                 <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                 <span className="text-xs font-bold uppercase tracking-widest text-white">Live • {interview.jobRole}</span>
             </div>
             <Button variant="danger" size="sm" onClick={finishSession} loading={loading} className="rounded-full px-6 shadow-lg border border-red-500/50">
               End Session
             </Button>
          </div>

          {/* AI Overlay Panel */}
          <div className="absolute bottom-8 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-3xl glass p-8 md:p-10 rounded-[2.5rem] border border-white/20 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-10 duration-700 flex flex-col md:flex-row items-center gap-8 md:gap-12">
               {/* AI Avatar */}
               <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-[#007AFF] to-cyan-400 shadow-[0_0_50px_rgba(0,122,255,0.4)] flex items-center justify-center relative flex-shrink-0">
                  <div className="absolute inset-0 bg-white/30 blur-2xl rounded-full animate-pulse"></div>
                  <div className="flex items-center space-x-1 h-8 relative z-10">
                     {[...Array(4)].map((_, i) => (
                       <div key={i} className="w-1.5 bg-white rounded-full animate-[bounce_1s_infinite]" style={{ height: `${40 + Math.random() * 60}%`, animationDelay: `${i * 0.15}s` }}></div>
                     ))}
                  </div>
               </div>
               
               {/* Context */}
               <div className="text-center md:text-left space-y-2">
                 <p className="text-[10px] font-bold text-[#007AFF] uppercase tracking-[0.2em]">Interviewer</p>
                 <p className="text-xl md:text-2xl font-bold text-white leading-tight">"I'm listening. Please detail your experience..."</p>
               </div>
          </div>
        </div>
      )}

      {/* Footer Branding (Overlay) */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-30 pointer-events-none z-20 hidden md:block">
        <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-white">Cogniview Secure Browser v2.5</span>
      </div>
    </div>
  );
};
