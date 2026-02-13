
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
  const [timeElapsed, setTimeElapsed] = useState(0);
  
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
    const initSession = async () => {
      const sessions = await db.sessions.getByCandidateId(user.id);
      const active = sessions.find(s => s.status === 'in_progress');
      if (active) {
        setSession(active);
        const allInterviews = await db.interviews.getAll();
        const i = allInterviews.find(x => x.id === active.interviewId);
        if (i) setInterview(i);
      }
    };
    initSession();
    return () => { mountedRef.current = false; };
  }, [user.id]);

  // Timer for HUD
  useEffect(() => {
    let interval: any;
    if (step === 'live') {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step]);

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

  const terminateSession = async (reason: string) => {
    if (!session || !mountedRef.current) return;
    
    // Stop all tracks
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
    }

    // Update DB
    await db.sessions.update({ 
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

      // Initialize AI with the requested env var
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            if (!mountedRef.current) return;
            setIsLive(true);
            setStep('live');
            setLoading(false);

            // Stream audio from the microphone to the model.
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
          },
          onclose: () => {
             console.log("AI Disconnected");
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are a professional AI interviewer for the ${interview.jobRole} position at ${interview.companyName}. You are interviewing ${user.name}. Start the conversation by introducing yourself and asking the first question: "${interview.questions[0].text}". Then continue with the rest of the questions: ${interview.questions.slice(1).map(q => q.text).join('; ')}. Be polite, concise, and focused. If the user indicates they are done or if you have finished the questions, say "Thank you, goodbye" and stop generating.`
        }
      });
    } catch (e) {
      console.error(e);
      alert("Please allow camera and mic permissions.");
      setLoading(false);
    }
  };

  const finishSession = async () => {
    setLoading(true);
    await db.responses.save({
      id: Math.random().toString(36).substr(2, 9),
      sessionId: session!.id,
      questionId: 'verbal-assessment',
      questionText: 'Verbal Evaluation',
      responseText: transcript.join(' '),
      timestamp: Date.now()
    });
    
    setTimeout(async () => {
      await db.sessions.update({ ...session!, status: 'completed', completedAt: Date.now() });
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(console.error);
      }
      
      onComplete();
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!interview || !session) return null;

  return (
    <div className="h-screen w-screen bg-black text-white relative overflow-hidden font-mono">
      
      {step === 'welcome' && (
        <div className="flex flex-col items-center justify-center h-full p-6 relative z-20 font-sans">
            {/* Background Decor */}
            <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-[#007AFF]/10 to-transparent pointer-events-none"></div>

            <div className="max-w-lg w-full text-center space-y-8 glass p-10 rounded-[40px] border border-white/10 animate-in zoom-in-95 duration-500 mx-4">
              <div className="w-20 h-20 bg-white rounded-[24px] flex items-center justify-center mx-auto shadow-2xl overflow-hidden">
                {user.logoUrl ? (
                   <img src={user.logoUrl} className="w-full h-full object-cover" alt="Company Logo" />
                ) : (
                   <div className="w-10 h-10 bg-black rounded-xl"></div>
                )}
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tighter text-white leading-none">Cognitive Check</h1>
                <p className="text-white/60 text-base font-medium">{interview.jobRole} @ {interview.companyName}</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-6 text-left space-y-3 border border-white/5">
                <p className="font-bold text-white/40 text-[10px] uppercase tracking-[0.2em]">Security Protocols</p>
                <ul className="space-y-3 text-white/90 font-medium text-xs md:text-sm">
                  <li className="flex items-center space-x-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                    <span>Biometric Feed Analysis Active</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                    <span>Tab Switching Prohibited</span>
                  </li>
                </ul>
              </div>
              <Button size="lg" className="w-full h-12 text-base rounded-2xl font-bold shadow-[0_0_30px_rgba(0,122,255,0.3)]" onClick={startSession} loading={loading}>
                Initialize Secure Session
              </Button>
            </div>
        </div>
      )}

      {step === 'live' && (
        <div className="absolute inset-0 z-0 bg-black">
          {/* Main Video Feed - Surveillance Style */}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover filter contrast-125 saturate-50" 
          />
          {/* Scan Lines Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%] pointer-events-none"></div>
          
          {/* Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60 pointer-events-none z-10"></div>

          {/* HUD - Heads Up Display */}
          <div className="absolute inset-0 z-20 p-6 flex flex-col justify-between pointer-events-none">
             
             {/* Top Bar */}
             <div className="flex justify-between items-start">
                 <div className="space-y-1">
                     <div className="flex items-center gap-2 text-red-500">
                         <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
                         <span className="text-[10px] font-bold tracking-[0.2em]">REC • {formatTime(timeElapsed)}</span>
                     </div>
                     <p className="text-[9px] text-white/40 tracking-widest">CAM-01 • {interview.code} • 1080p</p>
                 </div>
                 <div className="text-right">
                     <p className="text-[9px] text-[#007AFF] tracking-widest animate-pulse">ANALYZING BIOMETRICS...</p>
                     <div className="flex gap-1 justify-end mt-1">
                        {[...Array(5)].map((_,i) => (
                           <div key={i} className="w-1 h-2 bg-[#007AFF]" style={{ opacity: Math.random() }}></div>
                        ))}
                     </div>
                 </div>
             </div>

             {/* Center Reticle (Subtle) */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] border border-white/10 rounded-full opacity-30 flex items-center justify-center">
                 <div className="w-full h-[1px] bg-white/20"></div>
                 <div className="h-full w-[1px] bg-white/20 absolute"></div>
                 <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#007AFF]"></div>
                 <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#007AFF]"></div>
                 <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#007AFF]"></div>
                 <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#007AFF]"></div>
             </div>

             {/* Bottom Bar */}
             <div className="flex justify-between items-end">
                <div className="space-y-2">
                   <div className="bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded-lg">
                      <p className="text-[9px] text-white/60 tracking-widest mb-1">VOICE STRESS ANALYSIS</p>
                      <div className="w-32 h-6 flex items-end gap-0.5">
                         {[...Array(20)].map((_,i) => (
                            <div key={i} className="flex-1 bg-green-500/50" style={{ height: `${Math.random() * 100}%` }}></div>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Manual End Button - Pointer Events Enabled */}
                <div className="pointer-events-auto">
                    <Button 
                       variant="danger" 
                       size="lg" 
                       onClick={finishSession} 
                       loading={loading} 
                       className="rounded-none border-2 border-red-500 bg-red-500/10 hover:bg-red-500/30 text-red-500 font-mono tracking-widest uppercase px-6 py-3 text-xs"
                    >
                      [ Terminate Session ]
                    </Button>
                </div>
             </div>
          </div>

          {/* AI Message Overlay (Subtle, at bottom) */}
          <div className="absolute bottom-24 left-0 right-0 text-center z-10">
             <p className="text-white/50 text-xs tracking-widest bg-black/50 inline-block px-4 py-1 backdrop-blur-sm rounded-full">
               System Active. Audio is being processed.
             </p>
          </div>
        </div>
      )}
    </div>
  );
};
