"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, Camera, AlertTriangle, ShieldAlert, FileText, Loader2, Eye, Smartphone, Users, MonitorOff, Clipboard, Brain } from "lucide-react";
import Editor from "@monaco-editor/react";

type CandidateProfile = {
  fullName: string;
  targetRole: string;
  resumeSkills: string[];
};

type ProctoringStatus = {
  faceVisible: boolean;
  personCount: number;
  phoneDetected: boolean;
  cameraCovered: boolean;
  tabFocused: boolean;
};

export default function InterviewPage({ params }: { params: Promise<{ id: string; mode: string }> }) {
  const { id, mode } = use(params);
  const router = useRouter();
  const isTech = mode === "technical";

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [interimDraft, setInterimDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  
  const [warnings, setWarnings] = useState(0);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const webcamEnabledRef = useRef(false);
  const [isCodingMode, setIsCodingMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [preloadedSession, setPreloadedSession] = useState<any>(null);
  const [aiVolume, setAiVolume] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [proctoringStatus, setProctoringStatus] = useState<ProctoringStatus>({
    faceVisible: false, personCount: 0, phoneDetected: false, cameraCovered: false, tabFocused: true,
  });
  const [violationLog, setViolationLog] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const proctoringRef = useRef({ blocked: false, isWarningVisible: false });
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef("");
  const modelRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [proctoringReady, setProctoringReady] = useState(false);

  // Initialize page, camera, and start interview
  useEffect(() => {
    let localProfile = null;
    try {
      const stored = localStorage.getItem("taledge:workspace-profile");
      if (stored) {
         localProfile = JSON.parse(stored);
         setProfile(localProfile);
      }
    } catch {}

    // Preload first question
    fetch("/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
         studentId: id, 
         role: localProfile?.targetRole || "Candidate", 
         mode, 
         stage: 1,
         resumeSummary: localProfile?.resumeSkills?.join(", ")
      }),
    }).then(r => r.json()).then(data => {
      if (data.ok) setPreloadedSession(data);
    });

    const timer = setInterval(() => setElapsed(e => e + 1), 1000);

    // Auto-enable camera
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        mediaStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setWebcamEnabled(true);
        webcamEnabledRef.current = true;
      })
      .catch((err) => console.error("Camera error:", err));

    // Load Proctoring Vision AI
    const loadTF = async () => {
      const script1 = document.createElement("script");
      script1.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs";
      script1.async = true;
      document.body.appendChild(script1);
      
      script1.onload = () => {
        const script2 = document.createElement("script");
        script2.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd";
        script2.async = true;
        document.body.appendChild(script2);
        
        script2.onload = () => {
          (window as any).cocoSsd.load().then((model: any) => {
            modelRef.current = model;
            setProctoringReady(true);
          });
        };
      };
    };
    loadTF();

    // Setup speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 3;

      recognition.onstart = () => setRecording(true);
      recognition.onresult = (event: any) => {
        let finalStr = "";
        let interimStr = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            let bestAlt = event.results[i][0];
            for (let a = 1; a < event.results[i].length; a++) {
              if (event.results[i][a].confidence > bestAlt.confidence) {
                bestAlt = event.results[i][a];
              }
            }
            finalStr += bestAlt.transcript + " ";
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }
        
        if (finalStr) {
          draftRef.current += finalStr;
          setDraft(draftRef.current);
        }
        
        // Zero-latency DOM update
        if (textAreaRef.current) {
          textAreaRef.current.value = draftRef.current + interimStr;
        } else {
          setInterimDraft(interimStr);
        }
        
        // Auto-send silence detection (8 seconds)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const btn = document.getElementById("send-btn");
          if (btn && !btn.hasAttribute("disabled")) {
            btn.click();
          }
        }, 8000);
      };
      recognition.onend = () => {
        setRecording(false);
        if (recognitionRef.current?.shouldListen) {
           try { recognitionRef.current.start(); } catch(e) {}
        }
      };
      recognitionRef.current = recognition;
    }

    // ==== PROCTORING ENGINE ====

    const issueWarning = (reason: string) => {
      // Only issue warnings after the interview has actually started
      if (!hasStartedRef.current) return;
      if (proctoringRef.current.blocked || proctoringRef.current.isWarningVisible) return;
      proctoringRef.current.isWarningVisible = true;
      
      setViolationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${reason}`]);
      
      setWarnings(prev => {
        const newWarnings = prev + 1;
        if (newWarnings >= 3) {
          proctoringRef.current.blocked = true;
          setBlocked(true);
        } else {
          setWarningMessage(`PROCTORING WARNING (${newWarnings}/3): ${reason}`);
        }
        return newWarnings;
      });
    };

    // 1. Tab switching detection (ONLY visibilitychange — blur is too aggressive and causes false positives)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setProctoringStatus(prev => ({ ...prev, tabFocused: false }));
        issueWarning("You switched away from the interview tab.");
      } else {
        setProctoringStatus(prev => ({ ...prev, tabFocused: true }));
      }
    };

    // 2. Keyboard shortcut blocking
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Alt+Tab, Ctrl+Tab, Ctrl+W, Ctrl+N, Ctrl+Shift+I (devtools), F12
      if (
        (e.altKey && e.key === "Tab") ||
        (e.ctrlKey && e.key === "Tab") ||
        (e.ctrlKey && e.key === "w") ||
        (e.ctrlKey && e.key === "n") ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.shiftKey && e.key === "J") ||
        (e.ctrlKey && e.key === "u") ||
        e.key === "F12" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 3. Disable drag events 
    const handleDragStart = (e: DragEvent) => e.preventDefault();

    // 4. Detect window resize (potential devtools)
    let lastWidth = window.outerWidth;
    const handleResize = () => {
      const widthDiff = Math.abs(window.outerWidth - window.innerWidth);
      if (widthDiff > 200 && lastWidth === window.outerWidth) {
        // DevTools likely opened
        setViolationLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] DevTools size anomaly detected`]);
      }
      lastWidth = window.outerWidth;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("dragstart", handleDragStart);
    window.addEventListener("resize", handleResize);

    // 5. Advanced AI Vision Tracking + Canvas brightness detection
    let missingFrames = 0;
    let darkFrames = 0;

    const checkVisionAI = async () => {
      if (!videoRef.current || !webcamEnabledRef.current || proctoringRef.current.blocked || proctoringRef.current.isWarningVisible) return;

      // Canvas-based brightness check (catches tape over camera, finger over lens, etc.)
      try {
        const video = videoRef.current;
        let canvas = canvasRef.current;
        if (!canvas) {
          canvas = document.createElement("canvas");
          canvasRef.current = canvas;
        }
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx && video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, 64, 48);
          const imageData = ctx.getImageData(0, 0, 64, 48);
          const pixels = imageData.data;
          let totalBrightness = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            totalBrightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          }
          const avgBrightness = totalBrightness / (pixels.length / 4);
          
          if (avgBrightness < 15) {
            darkFrames++;
            setProctoringStatus(prev => ({ ...prev, cameraCovered: true }));
            if (darkFrames >= 3) {
              issueWarning("Camera appears to be covered or blocked! The image is completely dark.");
              darkFrames = 0;
            }
          } else {
            darkFrames = 0;
            setProctoringStatus(prev => ({ ...prev, cameraCovered: false }));
          }
        }
      } catch {}

      // COCO-SSD object detection
      if (modelRef.current) {
        try {
          const predictions = await modelRef.current.detect(videoRef.current);
          
          let personCount = 0;
          let phoneDetected = false;
          
          predictions.forEach((p: any) => {
            if (p.class === "person" && p.score > 0.30) personCount++;
            if ((p.class === "cell phone" || p.class === "laptop" || p.class === "book") && p.score > 0.30) phoneDetected = true;
          });

          setProctoringStatus(prev => ({
            ...prev,
            personCount,
            faceVisible: personCount >= 1,
            phoneDetected,
          }));
          
          if (phoneDetected) {
             issueWarning("Unauthorized device detected! The AI detected a phone, laptop, or reference material in your frame.");
          } else if (personCount > 1) {
             issueWarning("Intrusion detected! The AI detected " + personCount + " people in your camera frame. Only 1 person is allowed.");
          } else if (personCount === 0) {
             missingFrames++;
             if (missingFrames >= 2) {
                issueWarning("You are not visible to the AI! Your face must be clearly visible at all times.");
                missingFrames = 0;
             }
          } else {
             missingFrames = 0;
          }
        } catch (e) {}
      }
    };
    const visionInterval = setInterval(checkVisionAI, 1200);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("dragstart", handleDragStart);
      window.removeEventListener("resize", handleResize);
      clearInterval(visionInterval);
      clearInterval(timer);
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // CRITICAL: When blocked, immediately kill all audio and speech recognition
  useEffect(() => {
    if (blocked) {
      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.shouldListen = false;
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      // Stop any playing audio
      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch(e) {}
        audioSourceRef.current = null;
      }
      // Close audio context
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      // Clear silence timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setAiSpeaking(false);
      setAiVolume(0);
      setRecording(false);
      setIsProcessing(false);
    }
  }, [blocked]);

  // Sync messages to localStorage for the Fit Score generator
  useEffect(() => {
    if (messages.length > 0) {
      const formattedForScoring = messages.map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text
      }));
      localStorage.setItem(`taledge:interview:${id}:${mode}`, JSON.stringify(formattedForScoring));
    }
  }, [messages, id, mode]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const stripMarkdown = (text: string) => text.replace(/\*/g, "");

  const playAudioAndListen = async (base64Data: string) => {
    if (!base64Data) {
      startListening();
      return;
    }
    
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const binaryString = atob(base64Data);
      const byteLength = binaryString.length;
      const validLength = byteLength % 2 === 0 ? byteLength : byteLength - 1;
      const bytes = new Uint8Array(validLength);
      for (let i = 0; i < validLength; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      
      const audioBuffer = audioCtxRef.current.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }

      const source = audioCtxRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      source.connect(analyser);
      analyser.connect(audioCtxRef.current.destination);
      
      setAiSpeaking(true);
      
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        setAiVolume(average);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      source.onended = () => {
        setAiSpeaking(false);
        setAiVolume(0);
        audioSourceRef.current = null;
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        startListening();
      };
      
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      
      audioSourceRef.current = source;
      source.start();
    } catch (e) {
      console.error("Audio playback error:", e);
      startListening();
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isCodingMode) {
      recognitionRef.current.shouldListen = true;
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  async function startInterview() {
    setIsProcessing(true);
    if (preloadedSession) {
      setSessionId(preloadedSession.sessionId);
      setMessages([{ role: "ai", text: stripMarkdown(preloadedSession.firstQuestion) }]);
      setIsProcessing(false);
      playAudioAndListen(preloadedSession.audioBase64);
      return;
    }

    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: id,
          role: profile?.targetRole || "Candidate",
          mode,
          stage: 1,
          resumeSummary: profile?.resumeSkills?.join(", ")
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSessionId(data.sessionId);
        setMessages([{ role: "ai", text: stripMarkdown(data.firstQuestion) }]);
        setIsProcessing(false);
        playAudioAndListen(data.audioBase64);
      }
    } catch (e) {
      setIsProcessing(false);
    }
  }

  const handleStartInterview = async () => {
    setHasStarted(true);
    hasStartedRef.current = true;
    
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {}

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    
    const osc = audioCtxRef.current.createOscillator();
    const gain = audioCtxRef.current.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(audioCtxRef.current.destination);
    osc.start(0);
    osc.stop(audioCtxRef.current.currentTime + 0.1);

    startInterview();
  };

  const closeWarning = async () => {
    setWarningMessage("");
    proctoringRef.current.isWarningVisible = false;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch(e) {}
  };

  async function handleSendText() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const currentText = textAreaRef.current ? textAreaRef.current.value.trim() : (draft + interimDraft).trim();
    if (!currentText || !sessionId || isProcessing) return;
    
    if (recognitionRef.current) {
      recognitionRef.current.shouldListen = false;
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    setMessages(prev => [...prev, { role: "user", text: currentText }]);
    setDraft("");
    draftRef.current = "";
    setInterimDraft("");
    if (textAreaRef.current) textAreaRef.current.value = "";
    setIsProcessing(true);

    try {
      const res = await fetch("/api/interview/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          text: currentText,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.isDone) {
          setDone(true);
          setMessages(prev => [...prev, { role: "ai", text: "Thank you for completing this assessment. Your responses have been recorded and analyzed. Click below to view your detailed results." }]);
          setIsProcessing(false);
          return;
        }
        setMessages(prev => [...prev, { role: "ai", text: stripMarkdown(data.nextQuestion) }]);
        setIsProcessing(false);
        playAudioAndListen(data.audioBase64);
      }
    } catch (e) {
      setIsProcessing(false);
    }
  }

  function toggleMic() {
    if (!recognitionRef.current) return;
    if (recording) {
      recognitionRef.current.shouldListen = false;
      recognitionRef.current.stop();
    } else {
      startListening();
    }
  }

  const m = Math.floor(elapsed / 60);
  const s = String(elapsed % 60).padStart(2, "0");

  // Proctoring status indicator helper
  const StatusDot = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse'}`} />
      <span className={`text-[9px] font-bold uppercase tracking-wider ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col font-sans relative z-0 select-none"
      onCopy={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
      onPaste={e => e.preventDefault()}
      onContextMenu={e => e.preventDefault()}
      onSelectCapture={e => {}}
    >
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/8 blur-[150px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/8 blur-[150px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-cyan-600/5 blur-[120px] animate-pulse" style={{ animationDuration: '15s' }} />
      </div>

      {/* ===== PRE-START RULES OVERLAY ===== */}
      {!hasStarted && !blocked && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-3xl flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#12121a] p-8 rounded-3xl shadow-2xl border border-white/10 max-w-lg w-full">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Proctored Assessment</h2>
            <p className="text-slate-400 mb-6 text-sm">This is a strictly monitored AI interview. Read the rules carefully.</p>
            
            <div className="bg-white/5 rounded-2xl p-5 mb-6 border border-white/10 space-y-3">
              {[
                { icon: <MonitorOff className="w-4 h-4" />, title: "No Window Switching", desc: "Leaving, minimizing, or unfocusing will trigger a warning." },
                { icon: <Users className="w-4 h-4" />, title: "No Other People", desc: "AI will detect anyone else in your camera frame." },
                { icon: <Smartphone className="w-4 h-4" />, title: "No Devices", desc: "Phones, tablets, laptops, or reference books will be flagged." },
                { icon: <Camera className="w-4 h-4" />, title: "Camera Always On", desc: "Covering or blocking the camera will issue a warning." },
                { icon: <Clipboard className="w-4 h-4" />, title: "No Copy/Paste", desc: "Clipboard, right-click, drag, and keyboard shortcuts are blocked." },
                { icon: <Eye className="w-4 h-4" />, title: "Face Must Be Visible", desc: "Your face must remain clearly visible at all times." },
              ].map((rule, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 text-indigo-400">{rule.icon}</div>
                  <div><span className="text-sm font-semibold text-white">{rule.title}: </span><span className="text-sm text-slate-400">{rule.desc}</span></div>
                </div>
              ))}
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6">
              <p className="text-red-400 text-xs font-bold text-center">⚠ 3 violations = automatic termination. No exceptions.</p>
            </div>

            <button onClick={handleStartInterview} disabled={!proctoringReady} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 text-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3">
              {proctoringReady ? "I Accept All Rules — Start Interview" : <><Loader2 className="w-5 h-5 animate-spin" /> Initializing AI Proctoring Engine...</>}
            </button>
          </motion.div>
        </div>
      )}

      {/* ===== BLOCKED OVERLAY ===== */}
      {blocked && (
        <div className="fixed inset-0 z-[200] bg-red-950/95 backdrop-blur-3xl flex items-center justify-center p-4 text-center">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-[#12121a] p-10 rounded-3xl shadow-2xl max-w-lg w-full border border-red-500/30">
            <div className="w-20 h-20 bg-red-500/20 rounded-full mx-auto flex items-center justify-center mb-6">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4">Assessment Terminated</h2>
            <p className="text-slate-400 mb-4 text-lg">Your assessment has been permanently blocked due to {warnings} proctoring violations.</p>
            <div className="bg-white/5 rounded-xl p-4 mb-8 text-left max-h-32 overflow-y-auto">
              {violationLog.map((v, i) => (
                <p key={i} className="text-xs text-red-400 font-mono mb-1">{v}</p>
              ))}
            </div>
            <button onClick={() => router.push(`/student/${id}`)} className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">
              Return to Dashboard
            </button>
          </motion.div>
        </div>
      )}

      {/* ===== WARNING OVERLAY ===== */}
      <AnimatePresence>
        {warningMessage && !blocked && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-amber-950/90 backdrop-blur-3xl flex items-center justify-center p-4 text-center">
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#12121a] p-10 rounded-3xl shadow-2xl max-w-lg w-full border border-amber-500/30">
              <div className="w-20 h-20 bg-amber-500/20 rounded-full mx-auto flex items-center justify-center mb-6">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
              </div>
              <h2 className="text-2xl font-black text-white mb-4">{warningMessage.split(':')[0]}</h2>
              <p className="text-slate-300 mb-4 text-lg font-medium">{warningMessage.split(':').slice(1).join(':')}</p>
              <p className="text-slate-500 mb-8 text-sm">Return to fullscreen immediately. {3 - warnings} warning(s) remaining before termination.</p>
              <button onClick={closeWarning} className="px-8 py-4 w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-xl hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/20">
                I Understand — Return to Interview
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MAIN INTERVIEW LAYOUT ===== */}
      <div className="flex-1 flex flex-col w-full z-10 relative">
        {/* Header */}
        <header className="bg-[#12121a]/80 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white text-sm leading-tight">TalEdge AI</h1>
                <p className="text-[10px] font-medium text-slate-500">{isTech ? "Technical" : "Behavioural"} Assessment</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-[10px] font-bold shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                PROCTORED · {warnings}/3
              </div>
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${!isProcessing && sessionId ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${!isProcessing && sessionId ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {!isProcessing && sessionId ? "Live" : "Connecting..."}
              </div>
              <div className="flex items-center gap-1 px-3 py-1.5 bg-white/5 text-slate-400 rounded-full text-[10px] font-bold font-mono border border-white/5">
                {m}:{s}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Camera + Proctoring Panel + Profile */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Camera Feed */}
            <div className="bg-[#12121a]/80 backdrop-blur-2xl rounded-2xl p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-white/5 relative group">
              <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
                <div className="px-2.5 py-1 bg-black/70 backdrop-blur-xl rounded-lg text-[9px] font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <span className={`w-1.5 h-1.5 rounded-full ${webcamEnabled ? 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`} />
                  <Camera className="w-2.5 h-2.5" />
                  {webcamEnabled ? "LIVE" : "OFF"}
                </div>
                <div className="px-2.5 py-1 bg-indigo-900/80 backdrop-blur-xl rounded-lg text-[9px] font-bold text-indigo-200 flex items-center gap-1.5 uppercase tracking-wider border border-indigo-500/30">
                  {proctoringReady ? (
                    <><Eye className="w-2.5 h-2.5 text-emerald-400" /> AI Vision</>
                  ) : (
                    <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Loading...</>
                  )}
                </div>
              </div>
              {/* Person count indicator */}
              {hasStarted && proctoringStatus.personCount > 0 && (
                <div className="absolute top-3 right-3 z-20">
                  <div className={`px-2.5 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1.5 uppercase tracking-wider ${proctoringStatus.personCount === 1 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'}`}>
                    <Users className="w-2.5 h-2.5" />
                    {proctoringStatus.personCount} {proctoringStatus.personCount === 1 ? 'Person' : 'People'}
                  </div>
                </div>
              )}
              <div className="relative rounded-xl overflow-hidden">
                <div className={`absolute inset-0 border-2 rounded-xl z-10 pointer-events-none transition-colors duration-500 ${webcamEnabled && !proctoringStatus.cameraCovered ? 'border-emerald-500/20' : 'border-red-500/30'}`} />
                <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] object-cover bg-black rounded-xl" />
              </div>
            </div>

            {/* Live Proctoring Panel */}
            {hasStarted && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#12121a]/80 backdrop-blur-2xl rounded-2xl p-4 border border-white/5">
                <h3 className="text-[10px] font-bold text-slate-500 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldAlert className="w-3 h-3 text-indigo-400" /> Live Security Checks
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <StatusDot ok={proctoringStatus.faceVisible} label="Face visible" />
                  <StatusDot ok={!proctoringStatus.phoneDetected} label="No devices" />
                  <StatusDot ok={proctoringStatus.personCount <= 1} label="No intrusion" />
                  <StatusDot ok={!proctoringStatus.cameraCovered} label="Cam clear" />
                  <StatusDot ok={proctoringStatus.tabFocused} label="Tab focused" />
                  <StatusDot ok={warnings === 0} label={`${warnings}/3 warns`} />
                </div>
              </motion.div>
            )}

            {/* Candidate Profile */}
            <div className="bg-[#12121a]/80 backdrop-blur-2xl rounded-2xl p-5 border border-white/5">
              <h3 className="text-[10px] font-bold text-slate-500 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-3 h-3 text-indigo-400" /> Candidate Profile
              </h3>
              {profile && (
                <div className="space-y-3">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Name</div>
                    <div className="text-sm font-medium text-white">{profile.fullName}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Role</div>
                    <div className="text-sm font-medium text-white">{profile.targetRole}</div>
                  </div>
                  {profile.resumeSkills && profile.resumeSkills.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Skills</div>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.resumeSkills.slice(0, 6).map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded-md text-[10px] font-semibold border border-indigo-500/20">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Chat Interface */}
          <div className="lg:col-span-8 flex flex-col bg-[#12121a]/60 backdrop-blur-3xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-white/5 overflow-hidden relative">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-transparent">
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-br-sm shadow-lg shadow-indigo-500/10"
                        : "bg-white/5 backdrop-blur-md text-slate-200 border border-white/10 rounded-bl-sm"
                    }`}>
                      {msg.role === "ai" && (
                        <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 mb-1.5 flex items-center gap-1">
                          <Brain className="w-3 h-3" /> AI Interviewer
                        </div>
                      )}
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isProcessing && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-white/5 backdrop-blur-md text-slate-300 border border-white/10 rounded-2xl px-5 py-3.5 rounded-bl-sm flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm font-medium text-slate-400">Thinking...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={chatBottomRef} />
            </div>

            {/* AI Visualizer Orb */}
            <div className="absolute top-5 right-5 pointer-events-none">
              <div className="relative w-14 h-14 md:w-16 md:h-16 flex items-center justify-center">
                 <div 
                   className={`absolute inset-0 rounded-full blur-xl transition-all duration-75 ${aiSpeaking ? 'bg-purple-500/50' : !isProcessing && sessionId && !recording ? 'bg-emerald-500/30 animate-pulse' : isProcessing ? 'bg-indigo-500/30' : 'bg-transparent'}`} 
                   style={{ transform: aiSpeaking ? `scale(${1 + aiVolume / 80})` : 'scale(1)' }}
                 />
                 <div 
                   className={`relative w-8 h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-75 ${aiSpeaking ? 'bg-gradient-to-tr from-fuchsia-500 to-indigo-500 border-fuchsia-400 shadow-[0_0_30px_rgba(217,70,239,0.6)]' : !isProcessing && sessionId && !recording ? 'bg-gradient-to-tr from-emerald-500 to-teal-300 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]' : isProcessing ? 'bg-gradient-to-tr from-indigo-500 to-purple-400 border-indigo-400' : 'bg-slate-800 border-slate-600'}`}
                   style={{ transform: aiSpeaking ? `scale(${1 + aiVolume / 120})` : '' }}
                 >
                   <div className="w-1/2 h-1/2 rounded-full bg-white/30 blur-[1px]" />
                 </div>
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-5 bg-[#12121a]/80 backdrop-blur-xl border-t border-white/5 z-10">
              {done ? (
                <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20 text-center">
                  <h3 className="text-lg font-bold text-emerald-400 mb-2">Interview Completed</h3>
                  <p className="text-slate-400 text-sm mb-4">Your responses have been analyzed. View your detailed Fit Score report.</p>
                  <button onClick={() => router.push(`/student/${id}/fit-score`)} className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/20">
                    View Results & Report
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1 mb-1">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      {recording && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                      {recording ? "Listening..." : "Auto-Mic Ready"}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setIsCodingMode(false)} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${!isCodingMode ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>Voice / Text</button>
                      {isTech && <button onClick={() => setIsCodingMode(true)} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${isCodingMode ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}><FileText className="w-3 h-3 inline mr-1" />Code</button>}
                    </div>
                  </div>
                  
                  <div className="flex gap-3 items-end">
                    {!isCodingMode && (
                      <button
                        onClick={toggleMic}
                        className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                          recording ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5"
                        }`}
                      >
                        {recording ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
                      </button>
                    )}
                    
                    <div className="flex-1">
                      {isCodingMode ? (
                        <div className="h-48 border border-indigo-500/20 rounded-xl overflow-hidden focus-within:ring-2 ring-indigo-500/20">
                          <Editor
                            height="100%"
                            defaultLanguage="javascript"
                            theme="vs-dark"
                            value={draft + interimDraft}
                            onChange={(val) => {
                               setDraft(val || "");
                               setInterimDraft("");
                            }}
                            options={{ minimap: { enabled: false }, fontSize: 13, padding: { top: 12 } }}
                          />
                        </div>
                      ) : (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-2 flex focus-within:border-indigo-500/30 transition-colors">
                          <textarea
                            ref={textAreaRef}
                            defaultValue={draft}
                            onChange={(e) => {
                               draftRef.current = e.target.value;
                               setDraft(e.target.value);
                            }}
                            placeholder="Speak naturally or type your response..."
                            className="flex-1 bg-transparent px-2 py-2 resize-none text-sm focus:outline-none text-white placeholder-slate-600"
                            rows={2}
                          />
                        </div>
                      )}
                      <div className="flex justify-end mt-2">
                        <button id="send-btn" onClick={handleSendText} disabled={isProcessing} className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:from-indigo-500 hover:to-purple-500 shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2">
                          <Send className="w-3.5 h-3.5" /> Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
