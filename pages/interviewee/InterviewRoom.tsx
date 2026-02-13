
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/Shared';
import { db } from '../../services/db';
import { Interview, Profile, InterviewSession } from '../../types';
import Vapi from '@vapi-ai/web';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

export const InterviewRoom: React.FC<{ user: Profile, onComplete: () => void }> = ({ user, onComplete }) => {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [status, setStatus] = useState<'loading' | 'instructions' | 'connecting' | 'live' | 'completed' | 'terminated'>('loading');
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [faceWarning, setFaceWarning] = useState<string | null>(null);
  const [faceCount, setFaceCount] = useState<number>(0);
  
  const vapiRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const requestRef = useRef<number>();
  const noFaceTimerRef = useRef(0);
  const multiFaceTimerRef = useRef(0);
  const isTerminatingRef = useRef(false);

  // Initialize Session
  useEffect(() => {
    mountedRef.current = true;
    const initSession = async () => {
      try {
        const sessions = await db.sessions.getByCandidateId(user.id);
        const active = sessions.find(s => s.status === 'in_progress');
        
        if (!active) {
            console.warn("No active session found.");
            onComplete();
            return;
        }

        setSession(active);

        const allInterviews = await db.interviews.getAll();
        const i = allInterviews.find(x => x.id === active.interviewId);
        
        if (!i) {
            alert("Critical Error: Assessment data missing.");
            onComplete();
            return;
        }

        setInterview(i);
        setStatus('instructions');

        // Setup Vapi
        const publicKey = '08163664-575c-457e-814a-bafae9bc0eda'; 
        const vapi = new Vapi(publicKey); 
        vapiRef.current = vapi;

        // Vapi Event Listeners
        vapi.on('call-start', () => {
            console.log('Call has started');
            if (mountedRef.current) setStatus('live');
        });

        vapi.on('call-end', () => {
            console.log('Call has ended via event');
            handleCallEndGracefully();
        });

        vapi.on('volume-level', (volume: number) => {
            if (mountedRef.current) setVolumeLevel(volume);
        });

        vapi.on('error', (e: any) => {
            console.log('Vapi Error Event:', e);
            const msg = e?.error?.message || e?.message || JSON.stringify(e);
            
            // "Meeting ended due to ejection" is often just the agent hanging up via tool call
            if (msg.includes("ejection") || msg.includes("Meeting has ended") || msg.includes("Room closed")) {
                handleCallEndGracefully();
            } else {
                console.error("Non-fatal Vapi Error:", msg);
            }
        });

      } catch (err) {
          console.error("Init Error:", err);
          alert("Failed to initialize system.");
          onComplete();
      }
    };

    initSession();

    return () => { 
        mountedRef.current = false;
        if (vapiRef.current) vapiRef.current.stop();
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [user.id]);

  const handleCallEndGracefully = () => {
      if (isTerminatingRef.current) return;
      if (!mountedRef.current) return;
      
      // If we are already terminated, don't override with 'completed'
      if (status === 'terminated') return;

      finishSession('completed');
  };

  // --- FACE DETECTION SETUP ---
  useEffect(() => {
      const loadFaceDetector = async () => {
          try {
              const vision = await FilesetResolver.forVisionTasks(
                  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
              );
              faceDetectorRef.current = await FaceDetector.createFromOptions(vision, {
                  baseOptions: {
                      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
                      delegate: "GPU"
                  },
                  runningMode: "VIDEO"
              });
              console.log("Face Detector Loaded");
          } catch (e) {
              console.error("Failed to load Face Detector", e);
          }
      };
      loadFaceDetector();
  }, []);

  // --- FACE DETECTION LOOP ---
  const detectFaces = () => {
      if (!videoRef.current || !faceDetectorRef.current || status !== 'live') return;
      if (videoRef.current.readyState < 2) {
          requestRef.current = requestAnimationFrame(detectFaces);
          return;
      }

      const video = videoRef.current;
      if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          
          try {
              const detections = faceDetectorRef.current.detectForVideo(video, performance.now());
              const count = detections.detections.length;
              setFaceCount(count);

              // SCENARIO 1: NO FACE (Tolerance: 10 seconds)
              if (count === 0) {
                  noFaceTimerRef.current += 100; // rough loop ms
                  multiFaceTimerRef.current = 0;
                  
                  if (noFaceTimerRef.current > 2000) { // 2s warning
                      setFaceWarning("⚠️ No face detected. Please return to frame.");
                  }
                  if (noFaceTimerRef.current > 10000) { // 10s termination
                      terminateSession("No face detected for >10 seconds.");
                      return; 
                  }
              } 
              // SCENARIO 2: MULTIPLE FACES (Tolerance: 5 seconds)
              else if (count > 1) {
                  multiFaceTimerRef.current += 100;
                  noFaceTimerRef.current = 0;
                  
                  setFaceWarning("⚠️ Security Alert: Multiple faces detected.");
                  
                  if (multiFaceTimerRef.current > 5000) { // 5s termination
                       terminateSession("Multiple faces detected in secure environment.");
                       return;
                  }
              } 
              // SCENARIO 3: ONE FACE (Clean)
              else {
                  // Reset timers slowly to avoid flickering
                  noFaceTimerRef.current = Math.max(0, noFaceTimerRef.current - 50);
                  multiFaceTimerRef.current = Math.max(0, multiFaceTimerRef.current - 50);
                  setFaceWarning(null);
              }
          } catch (e) {
              // Ignore transient detection errors
          }
      }
      requestRef.current = requestAnimationFrame(detectFaces);
  };

  // Start loop when live
  useEffect(() => {
      if (status === 'live') {
          requestRef.current = requestAnimationFrame(detectFaces);
      } else {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
  }, [status]);


  // Timer
  useEffect(() => {
    let interval: any;
    if (status === 'live') {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // --- ANTI-CHEAT (SAVE BROWSER) ---
  useEffect(() => {
    if (status !== 'live' && status !== 'connecting') return;

    const handleViolation = () => {
      if (!session) return;
      terminateSession("Browser focus lost or Fullscreen exited.");
    };

    const onVisibilityChange = () => {
      if (document.hidden) handleViolation();
    };

    const onFullScreenChange = () => {
        if (!document.fullscreenElement) {
             handleViolation();
        }
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullScreenChange);

    return () => {
      window.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullScreenChange);
    };
  }, [status, session]);

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
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;
    
    setStatus('terminated');
    
    try {
        if (vapiRef.current) vapiRef.current.stop();
    } catch(e) {}

    if (session) {
        await db.sessions.update({ 
            ...session, 
            status: 'terminated_early', 
            completedAt: Date.now(),
            terminationReason: reason,
            decision: 'failed'
        });
    }

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }

    alert(`⚠️ INTERVIEW TERMINATED\nReason: ${reason}`);
    onComplete();
  };

  const finishSession = async (finalStatus: 'completed') => {
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;
    
    if (status === 'terminated' || !session) return;
    
    // UI Feedback immediately
    setStatus('completed');

    try {
        if (vapiRef.current) vapiRef.current.stop();
    } catch(e) {}

    await db.sessions.update({ 
        ...session, 
        status: finalStatus, 
        completedAt: Date.now() 
    });

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    onComplete();
  };

  const startCall = async () => {
    if (!interview || !session) return;
    
    await enterFullScreen();
    setStatus('connecting');

    // Start Video for Detection
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 },
                facingMode: "user"
            }, 
            audio: false 
        });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    } catch(e) {
        console.warn("Camera init failed", e);
        alert("Camera access is required for security verification.");
        setStatus('instructions');
        return;
    }

    const candidateName = user.name;
    const jobRole = interview.jobRole;
    const companyName = interview.companyName;
    const numberOfQuestions = interview.questions.length;
    const interviewQuestionsList = interview.questions.map((q, i) => `${i+1}. ${q.text}`).join('\n');

    const baseSystemPrompt = `# AI Voice Interview Agent

You are a professional AI interviewer for {{JOB_ROLE}} at {{COMPANY_NAME}}.

## Protocol
1. **Introduction**: Greet {{CANDIDATE_NAME}}. Briefly state you are an AI agent.
2. **Questions**: Ask these {{NUMBER_OF_QUESTIONS}} questions one by one. Do not group them.
{{INTERVIEW_QUESTIONS}}
3. **Pacing**: Wait for the candidate's full response. Ask 1 brief follow-up if the answer is vague.
4. **Completion**: When all questions are done, say "Thank you, that concludes the interview." and IMMEDIATELY call the 'end_call' function.

**CRITICAL**: You MUST use the 'end_call' tool to finish the session properly.
`;

    const injectedSystemPrompt = baseSystemPrompt
        .replace(/{{CANDIDATE_NAME}}/g, candidateName)
        .replace(/{{JOB_ROLE}}/g, jobRole)
        .replace(/{{COMPANY_NAME}}/g, companyName)
        .replace(/{{NUMBER_OF_QUESTIONS}}/g, numberOfQuestions.toString())
        .replace(/{{INTERVIEW_QUESTIONS}}/g, interviewQuestionsList);

    const firstMessage = `Hello ${candidateName}, I am the AI interviewer for ${companyName}. I'm ready when you are.`;
    const endCallMessage = `Thank you ${candidateName}. Goodbye.`;

    const assistantConfig = {
        name: "AI Interviewr FYP",
        voice: {
            model: "eleven_turbo_v2_5",
            voiceId: "uYXf8XasLslADfZ2MB4u",
            provider: "11labs",
            stability: 0.5,
            similarityBoost: 0.9
        },
        model: {
            model: "gpt-4-turbo",
            messages: [{ role: "system", content: injectedSystemPrompt }],
            provider: "openai",
            temperature: 0.7
        },
        firstMessage: firstMessage,
        endCallFunctionEnabled: true,
        endCallMessage: endCallMessage,
        transcriber: {
            model: "nova-3",
            language: "en",
            provider: "deepgram",
            endpointing: 200 // Slightly longer wait to prevent cutting off
        },
        artifactPlan: { videoRecordingEnabled: false } // Disabled to save bandwidth/complexity
    };

    try {
        await vapiRef.current.start(assistantConfig);
    } catch (e) {
        console.error("Vapi Start Failed", e);
        alert("Failed to connect to AI server. Please retry.");
        setStatus('instructions');
    }
  };

  const handleManualEnd = () => {
      // Immediate UI response
      finishSession('completed');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- RENDER ---
  
  if (status === 'loading' || !interview || !session) {
    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-white font-sans">
            <div className="w-10 h-10 border-4 border-white/10 border-t-[#007AFF] rounded-full animate-spin mb-4"></div>
            <p className="text-xs font-bold text-white/50 tracking-widest uppercase">Initializing Secure Environment...</p>
        </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white relative overflow-hidden font-mono selection:bg-transparent">
      
      {/* --- INSTRUCTIONS --- */}
      {status === 'instructions' && (
        <div className="flex flex-col items-center justify-center h-full p-6 relative z-20 font-sans">
            <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-[#007AFF]/10 to-transparent pointer-events-none"></div>
            <div className="max-w-lg w-full text-center space-y-6 glass p-8 rounded-[24px] border border-white/10 animate-in zoom-in-95 duration-500 mx-4 shadow-2xl">
              <h1 className="text-xl font-bold text-white">Security Check</h1>
              <div className="grid gap-2 text-left">
                  <div className="bg-white/5 p-3 rounded-[16px] border border-white/5 flex gap-3 items-center">
                      <div className="w-4 h-4 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px] font-bold">✓</div>
                      <p className="text-xs font-bold text-white">Face Detection Enabled</p>
                  </div>
                  <div className="bg-red-500/10 p-3 rounded-[16px] border border-red-500/20 flex gap-3 items-start">
                      <div className="w-4 h-4 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mt-0.5 text-[10px] font-bold">!</div>
                      <div>
                          <p className="text-xs font-bold text-white mb-0.5">Zero Tolerance Policy</p>
                          <p className="text-[10px] text-white/60 leading-tight">If you exit Fullscreen or multiple faces are detected, the interview will terminate.</p>
                      </div>
                  </div>
              </div>
              <Button size="lg" className="w-full h-11 text-sm rounded-[14px] font-bold" onClick={startCall}>
                Start Interview
              </Button>
            </div>
        </div>
      )}

      {/* --- LIVE INTERVIEW --- */}
      {(status === 'connecting' || status === 'live') && (
        <div className="absolute inset-0 z-0 bg-black flex flex-col">
          
          {/* CONNECTING OVERLAY */}
          {status === 'connecting' && (
              <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
                  <div className="relative">
                     <div className="w-20 h-20 rounded-full border-4 border-[#007AFF]/30 border-t-[#007AFF] animate-spin"></div>
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-[#007AFF] rounded-full animate-pulse"></div>
                     </div>
                  </div>
                  <div className="text-center space-y-2">
                      <h2 className="text-xl font-bold text-white tracking-tight">Connecting to AI Agent</h2>
                      <p className="text-xs text-white/50">Verifying secure environment...</p>
                  </div>
              </div>
          )}

          {/* WARNING OVERLAY */}
          {faceWarning && (
              <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 backdrop-blur-md text-white px-8 py-4 rounded-full shadow-[0_0_50px_rgba(220,38,38,0.5)] border border-red-400 animate-pulse flex items-center gap-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  <span className="font-bold text-sm tracking-wide">{faceWarning}</span>
              </div>
          )}

          {/* MAIN VISUAL AREA */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
             
             {/* PIP Video Feed (Visible for user assurance) */}
             <div className="absolute top-6 right-6 w-48 h-36 bg-black rounded-[16px] border border-white/20 overflow-hidden shadow-2xl z-30">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover transform scale-x-[-1]"
                />
                <div className="absolute bottom-2 left-2 flex gap-1.5">
                    <div className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] font-bold flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${faceCount === 1 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                        {faceCount} FACE(S)
                    </div>
                </div>
             </div>
             
             {/* Audio Visualizer */}
             <div className="relative z-10 flex flex-col items-center">
                 <div className={`w-40 h-40 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-[0_0_100px_rgba(0,122,255,0.1)] transition-all duration-100`} style={{ transform: `scale(${1 + Math.min(volumeLevel, 0.5)})` }}>
                     <div className="flex gap-1.5 items-center h-12">
                         {[...Array(7)].map((_, i) => (
                             <div key={i} className="w-2 bg-[#007AFF] rounded-full transition-all duration-75 shadow-[0_0_15px_#007AFF]" style={{ height: Math.max(12, volumeLevel * 80 * (Math.random() + 0.5)) + 'px' }}></div>
                         ))}
                     </div>
                 </div>
                 <p className="mt-8 text-white/30 text-xs font-medium tracking-[0.2em] uppercase">AI Agent Listening</p>
             </div>

             {/* Background Grid */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none"></div>
          </div>
          
          {/* HUD Footer */}
          <div className="absolute bottom-0 w-full z-20 p-8 flex flex-col items-center bg-gradient-to-t from-black via-black/80 to-transparent">
             
             {/* Status Badge */}
             <div className="flex items-center gap-2 mb-8 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                 <div className={`w-2 h-2 bg-red-500 rounded-full ${status === 'live' ? 'animate-pulse' : ''}`}></div>
                 <span className="text-xs font-bold tracking-[0.2em] text-white/80">
                    {status === 'connecting' ? 'INITIALIZING' : `REC • ${formatTime(timeElapsed)}`}
                 </span>
             </div>

             <Button 
                onClick={handleManualEnd}
                className="w-full max-w-sm h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-transform active:scale-95 flex items-center justify-center gap-3"
             >
                <div className="w-4 h-4 bg-white rounded-[2px]"></div>
                END INTERVIEW
             </Button>
          </div>
        </div>
      )}
    </div>
  );
};
