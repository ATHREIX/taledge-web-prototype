"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, Camera, AlertTriangle, ShieldAlert, FileText, Loader2, Eye, Smartphone, Users, MonitorOff, Clipboard, Brain, Check, X, ArrowRight } from "lucide-react";
import Editor from "@monaco-editor/react";

type CandidateProfile = {
  fullName: string;
  email?: string;
  institution?: string;
  yearCohort?: string;
  aspiration?: string;
  targetRole: string;
  resumeSummary?: string;
  resumeSkills?: string[];
  resumeProjects?: { title: string; stack?: string[]; impact?: string }[];
};

function isSamePerson(box1: [number, number, number, number], box2: [number, number, number, number]): boolean {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;
  
  const x_left = Math.max(x1, x2);
  const y_top = Math.max(y1, y2);
  const x_right = Math.min(x1 + w1, x2 + w2);
  const y_bottom = Math.min(y1 + h1, y2 + h2);
  
  if (x_right < x_left || y_bottom < y_top) {
    return false;
  }
  
  const intersectionArea = (x_right - x_left) * (y_bottom - y_top);
  const area1 = w1 * h1;
  const area2 = w2 * h2;
  const unionArea = area1 + area2 - intersectionArea;
  const iou = unionArea > 0 ? intersectionArea / unionArea : 0;
  
  // 1. If IoU is very high, it's definitely the same person detection
  if (iou > 0.7) {
    return true;
  }
  
  // 2. If one box is nested inside another (high intersection over smaller box)
  // AND their horizontal centers are closely aligned (e.g. upper-body box vs full-body box of the same person),
  // they represent the same person.
  const minArea = Math.min(area1, area2);
  const overlapSmaller = intersectionArea / minArea;
  if (overlapSmaller > 0.75) {
    const cx1 = x1 + w1 / 2;
    const cx2 = x2 + w2 / 2;
    const centerDistX = Math.abs(cx1 - cx2);
    // If horizontal centers are within 25% of the smaller box's width
    if (centerDistX < Math.min(w1, w2) * 0.25) {
      return true;
    }
  }
  
  return false;
}

type ProctoringStatus = {
  faceVisible: boolean;
  personCount: number;
  phoneDetected: boolean;
  cameraCovered: boolean;
  tabFocused: boolean;
  noiseDetected: boolean;
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [setupStep, setSetupStep] = useState<"rules" | "verify" | "interview">("rules");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{status: "idle" | "verifying" | "success" | "error", message?: string}>({status: "idle"});
  const [hasStarted, setHasStarted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [preloadedSession, setPreloadedSession] = useState<any>(null);
  const [aiVolume, setAiVolume] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [proctoringStatus, setProctoringStatus] = useState<ProctoringStatus>({
    faceVisible: false, personCount: 0, phoneDetected: false, cameraCovered: false, tabFocused: true, noiseDetected: false,
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
  const doneRef = useRef(false);
  useEffect(() => {
    doneRef.current = done;
    if (done) {
      if (recognitionRef.current) {
        recognitionRef.current.shouldListen = false;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setRecording(false);
    }
  }, [done]);

  // Initialize page, camera, and start interview
  useEffect(() => {
    let localProfile = null;
    try {
      let stored = localStorage.getItem("taledge:workspace-profile");
      if (!stored) {
        stored = localStorage.getItem("taledge:demo-profile");
      }
      if (stored) {
         localProfile = JSON.parse(stored);
         setProfile(localProfile);
      }
    } catch {}

    const resumeContext = localProfile ? [
      localProfile.resumeSummary,
      localProfile.resumeSkills && localProfile.resumeSkills.length > 0 ? `Skills: ${localProfile.resumeSkills.join(", ")}` : "",
      localProfile.resumeProjects && localProfile.resumeProjects.length > 0 ? `Projects: ${localProfile.resumeProjects.map((p: any) => `${p.title} (${p.stack?.join(", ") || ""}): ${p.impact || ""}`).join("; ")}` : "",
      localProfile.aspiration ? `Goal/Target Placement: ${localProfile.aspiration}` : ""
    ].filter(Boolean).join("\n") : "";

    // Preload first question
    fetch("/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
         studentId: id, 
         candidateName: localProfile?.fullName || "Candidate",
         role: localProfile?.targetRole || "Candidate", 
         mode, 
         stage: mode === "technical" ? 1 : 2,
         resumeSummary: resumeContext
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

    // Request audio stream for noise monitoring
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        audioStream = stream;
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          noiseContext = new AudioContextClass();
          audioAnalyzer = noiseContext.createAnalyser();
          audioAnalyzer.fftSize = 256;
          audioSource = noiseContext.createMediaStreamSource(stream);
          audioSource.connect(audioAnalyzer);
        } catch (e) {
          console.error("Audio analyzer setup error:", e);
        }
      })
      .catch((err) => console.warn("Mic access denied or unavailable for noise check:", err));

    // Load Proctoring Vision AI
    const loadTF = async () => {
      const fallbackTimeout = setTimeout(() => {
        if (!modelRef.current) {
          console.warn("TFJS/COCO-SSD model loading timed out. Enabling interview without AI vision proctoring.");
          setProctoringReady(true);
        }
      }, 6000);

      try {
        const script1 = document.createElement("script");
        script1.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js";
        script1.async = true;
        document.body.appendChild(script1);
        
        script1.onload = () => {
          const script2 = document.createElement("script");
          script2.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js";
          script2.async = true;
          document.body.appendChild(script2);
          
          script2.onload = () => {
            try {
              (window as any).cocoSsd.load().then((model: any) => {
                modelRef.current = model;
                clearTimeout(fallbackTimeout);
                setProctoringReady(true);
              }).catch((e: any) => {
                console.error("CocoSSD load failed, using fallback:", e);
                setProctoringReady(true);
              });
            } catch (err) {
              console.error("CocoSSD init failed, using fallback:", err);
              setProctoringReady(true);
            }
          };

          script2.onerror = () => {
            console.error("CocoSSD script load failed");
            setProctoringReady(true);
          };
        };

        script1.onerror = () => {
          console.error("TFJS script load failed");
          setProctoringReady(true);
        };
      } catch (err) {
        console.error("TFJS initialization threw an error:", err);
        setProctoringReady(true);
      }
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
        
        // Auto-send silence detection (4 seconds)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const btn = document.getElementById("send-btn");
          if (btn && !btn.hasAttribute("disabled")) {
            btn.click();
          }
        }, 4000);
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
    let intrusionFrames = 0;
    let phoneFrames = 0;

    // Background noise detection context and nodes
    let audioStream: MediaStream | null = null;
    let audioAnalyzer: AnalyserNode | null = null;
    let audioSource: MediaStreamAudioSourceNode | null = null;
    let noiseContext: AudioContext | null = null;

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
          
          // Lower person detection threshold to 0.35 to successfully capture long-distance humans in frame,
          // but filter out overlapping bounding boxes to prevent hands-on-head/shoulders from registering as multiple people.
          const personPredictions = predictions.filter((p: any) => p.class === "person" && p.score > 0.35);
          
          const uniquePersons: any[] = [];
          personPredictions.forEach((p: any) => {
            const isOverlapping = uniquePersons.some((u: any) => {
              return isSamePerson(
                p.bbox as [number, number, number, number], 
                u.bbox as [number, number, number, number]
              );
            });
            if (!isOverlapping) {
              uniquePersons.push(p);
            }
          });

          const personCount = uniquePersons.length;
          
          // Lower device detection threshold to 0.35 to capture cell phones/laptops/books reliably
          const phoneDetected = predictions.some((p: any) => 
            (p.class === "cell phone" || p.class === "laptop" || p.class === "book") && p.score > 0.35
          );

          // Audio level check for background noise
          let noiseDetected = false;
          if (audioAnalyzer && noiseContext) {
            if (noiseContext.state === 'suspended') {
              try { noiseContext.resume(); } catch(e) {}
            }
            if (noiseContext.state === 'running') {
              const dataArray = new Uint8Array(audioAnalyzer.frequencyBinCount);
              audioAnalyzer.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avgVolume = sum / dataArray.length;
              noiseDetected = avgVolume > 35; // continuous average volume threshold
            }
          }

          setProctoringStatus(prev => ({
            ...prev,
            personCount,
            faceVisible: personCount >= 1,
            phoneDetected,
            noiseDetected,
          }));
          
          // Debounce phone detection: trigger warning only if detected in 2 consecutive frames (1.6s)
          if (phoneDetected) {
            phoneFrames++;
            if (phoneFrames >= 2) {
              issueWarning("Unauthorized device detected! The AI detected a phone, laptop, or reference material in your frame.");
              phoneFrames = 0;
            }
          } else {
            phoneFrames = 0;
          }

          // Debounce multiple people detection: trigger warning only if detected in 2 consecutive frames (1.6s)
          if (personCount > 1) {
            intrusionFrames++;
            if (intrusionFrames >= 2) {
              issueWarning(`Intrusion detected! The AI detected ${personCount} people in your camera frame. Only 1 person is allowed.`);
              intrusionFrames = 0;
            }
          } else {
            intrusionFrames = 0;
          }

          // Debounce missing face detection: trigger warning only if detected in 3 consecutive frames (2.4s)
          if (personCount === 0) {
            missingFrames++;
            if (missingFrames >= 3) {
              issueWarning("You are not visible to the AI! Your face must be clearly visible at all times.");
              missingFrames = 0;
            }
          } else {
            missingFrames = 0;
          }
        } catch (e) {}
      }
    };
    const visionInterval = setInterval(checkVisionAI, 800);

     return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("dragstart", handleDragStart);
      window.removeEventListener("resize", handleResize);
      clearInterval(visionInterval);
      clearInterval(timer);
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      audioStream?.getTracks().forEach(t => t.stop());
      if (noiseContext) {
        try { noiseContext.close(); } catch(e) {}
      }
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
      localStorage.setItem(`taledge:interview:${id}:${mode}:updatedAt`, Date.now().toString());
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
    if (doneRef.current) return;
    if (recognitionRef.current && !isCodingMode) {
      recognitionRef.current.shouldListen = true;
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  async function startInterview() {
    setIsProcessing(true);
    try {
      localStorage.removeItem(`taledge:fit-score:${id}`);
    } catch (e) {}
    if (preloadedSession) {
      setSessionId(preloadedSession.sessionId);
      setMessages([{ role: "ai", text: stripMarkdown(preloadedSession.firstQuestion) }]);
      setIsProcessing(false);
      playAudioAndListen(preloadedSession.audioBase64);
      return;
    }

    const resumeContext = profile ? [
      profile.resumeSummary,
      profile.resumeSkills && profile.resumeSkills.length > 0 ? `Skills: ${profile.resumeSkills.join(", ")}` : "",
      profile.resumeProjects && profile.resumeProjects.length > 0 ? `Projects: ${profile.resumeProjects.map((p: any) => `${p.title} (${p.stack?.join(", ") || ""}): ${p.impact || ""}`).join("; ")}` : "",
      profile.aspiration ? `Goal/Target Placement: ${profile.aspiration}` : ""
    ].filter(Boolean).join("\n") : "";

    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: id,
          candidateName: profile?.fullName || "Candidate",
          role: profile?.targetRole || "Candidate",
          mode,
          stage: mode === "technical" ? 1 : 2,
          resumeSummary: resumeContext
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

  const handleGoToVerify = () => {
    setSetupStep("verify");
  };

  const handleCaptureAndVerify = async () => {
    setVerificationResult({ status: "verifying" });
    
    // Verify Identity using Gemini Vision
    try {
      if (videoRef.current && webcamEnabledRef.current) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = videoRef.current.videoWidth || 640;
        tempCanvas.height = videoRef.current.videoHeight || 480;
        const ctx = tempCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0);
          const base64Image = tempCanvas.toDataURL("image/jpeg", 0.8);
          setCapturedImage(base64Image);
          
          const vRes = await fetch("/api/interview/verify-face", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64Image })
          });
          const vData = await vRes.json();
          if (!vData.ok || !vData.verified) {
            setVerificationResult({
              status: "error", 
              message: "Failed: " + (vData.reason || "No clear face detected.")
            });
          } else {
            setVerificationResult({ status: "success" });
          }
        }
      }
    } catch (e) {
      console.error("Face verification error:", e);
      setVerificationResult({ status: "error", message: "An unexpected error occurred during verification." });
    }
  };

  const handleStartInterview = async () => {
    setSetupStep("interview");
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
          try {
            localStorage.removeItem(`taledge:fit-score:${id}`);
          } catch (e) {}
          setDone(true);
          const finalMsg = data.nextQuestion 
            ? stripMarkdown(data.nextQuestion) 
            : "Thank you for completing this assessment. Your responses have been recorded and analyzed. Click below to view your detailed results.";
          setMessages(prev => [...prev, { role: "ai", text: finalMsg }]);
          setIsProcessing(false);
          if (data.audioBase64) {
            playAudioAndListen(data.audioBase64);
          }
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
      <span className={`text-[9px] font-bold uppercase tracking-wider ${ok ? 'text-emerald-700' : 'text-rose-600'}`}>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative z-0 select-none"
      onCopy={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
      onPaste={e => e.preventDefault()}
      onContextMenu={e => e.preventDefault()}
      onSelectCapture={e => {}}
    >
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-400/20 blur-[130px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-emerald-400/20 blur-[130px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[30%] right-[20%] w-[35%] h-[35%] rounded-full bg-blue-400/20 blur-[120px] animate-pulse" style={{ animationDuration: '15s' }} />
      </div>

      {/* ===== PRE-START RULES OVERLAY ===== */}
      {!hasStarted && setupStep === "rules" && !blocked && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xl overflow-y-auto flex justify-center p-4 md:p-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="my-auto bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-3xl shadow-2xl border border-white/80 max-w-2xl w-full">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Proctored Assessment</h2>
            <p className="text-slate-600 mb-4 text-xs font-semibold">This is a strictly monitored AI interview. Read the rules carefully.</p>
            
            <div className="bg-slate-100/50 rounded-2xl p-4 mb-4 border border-slate-200/50 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              {[
                { icon: <MonitorOff className="w-4 h-4" />, title: "No Window Switching", desc: "Leaving or unfocusing triggers a warning." },
                { icon: <Users className="w-4 h-4" />, title: "No Other People", desc: "Only 1 person allowed in frame." },
                { icon: <Smartphone className="w-4 h-4" />, title: "No Devices", desc: "Phones or books are prohibited." },
                { icon: <Camera className="w-4 h-4" />, title: "Camera Always On", desc: "Covering camera triggers warnings." },
                { icon: <Clipboard className="w-4 h-4" />, title: "No Copy/Paste", desc: "Keyboard shortcuts are blocked." },
                { icon: <Eye className="w-4 h-4" />, title: "Face Visible", desc: "Your face must remain visible." },
                { icon: <Mic className="w-4 h-4" />, title: "Quiet Environment", desc: "Keep background noise low." },
              ].map((rule, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 text-indigo-600 shrink-0">{rule.icon}</div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block leading-tight">{rule.title}</span>
                    <span className="text-[10px] text-slate-500 leading-snug block">{rule.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 mb-4">
              <p className="text-red-600 text-[10px] font-bold text-center">⚠ 3 violations = automatic termination. No exceptions.</p>
            </div>

            <button onClick={handleGoToVerify} disabled={!proctoringReady} className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 text-sm transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2">
              {proctoringReady ? "Continue to Face ID Setup" : <><Loader2 className="w-4 h-4 animate-spin" /> Initializing AI Proctoring Engine...</>}
            </button>
          </motion.div>
        </div>
      )}

      {/* ===== FACE ID VERIFICATION OVERLAY ===== */}
      {!hasStarted && setupStep === "verify" && !blocked && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xl overflow-y-auto flex items-center justify-center p-4 md:p-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-3xl shadow-2xl border border-white/80 max-w-lg w-full flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Face ID Verification</h2>
            <p className="text-slate-600 mb-6 text-sm text-center font-medium">Please look directly into your camera to verify your identity. Only one person is allowed.</p>
            
            {capturedImage ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-6 shadow-inner ring-4 ring-slate-100">
                <img src={capturedImage} alt="Captured Face ID" className="w-full h-full object-cover" />
                {verificationResult.status === "verifying" && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                    <Loader2 className="w-8 h-8 animate-spin mb-3" />
                    <span className="font-bold text-sm tracking-wide">Analyzing Image...</span>
                  </div>
                )}
                {verificationResult.status === "success" && (
                  <div className="absolute inset-0 bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="bg-emerald-500 text-white p-3 rounded-full shadow-2xl scale-[1.2] animate-bounce">
                      <Check className="w-8 h-8" />
                    </div>
                  </div>
                )}
                {verificationResult.status === "error" && (
                  <div className="absolute inset-0 bg-red-500/20 border-4 border-red-500 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="bg-red-500 text-white p-3 rounded-full shadow-2xl scale-[1.2]">
                      <X className="w-8 h-8" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-6 relative shadow-inner ring-4 ring-slate-100 flex flex-col items-center justify-center text-slate-400">
                <Camera className="w-10 h-10 mb-2 opacity-50" />
                <span className="text-xs font-semibold uppercase tracking-wider">Live feed active in background</span>
              </div>
            )}

            {verificationResult.status === "error" && (
              <div className="w-full bg-red-50 border border-red-200 rounded-xl p-3 mb-6 text-center">
                <p className="text-red-600 text-sm font-bold">{verificationResult.message}</p>
                <button onClick={() => { setCapturedImage(null); setVerificationResult({status: "idle"}); }} className="mt-2 text-red-700 underline text-xs font-semibold">Take Another Picture</button>
              </div>
            )}

            {verificationResult.status === "success" ? (
              <button onClick={handleStartInterview} className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-sm">
                Identity Verified — Start Interview <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleCaptureAndVerify} disabled={verificationResult.status === "verifying"} className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 text-sm">
                {verificationResult.status === "verifying" ? "Verifying..." : "📸 Capture Image"}
              </button>
            )}
          </motion.div>
        </div>
      )}

      {/* ===== BLOCKED OVERLAY ===== */}
      {blocked && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 text-center">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-white/80 backdrop-blur-2xl p-10 rounded-3xl shadow-2xl max-w-lg w-full border border-red-200">
            <div className="w-20 h-20 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-6">
              <ShieldAlert className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-4">Assessment Terminated</h2>
            <p className="text-slate-600 mb-4 text-lg">Your assessment has been permanently blocked due to {warnings} proctoring violations.</p>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-8 text-left max-h-32 overflow-y-auto">
              {violationLog.map((v, i) => (
                <p key={i} className="text-xs text-red-600 font-mono mb-1">{v}</p>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 text-center">
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white/85 backdrop-blur-2xl p-10 rounded-3xl shadow-2xl max-w-lg w-full border border-amber-200">
              <div className="w-20 h-20 bg-amber-100 rounded-full mx-auto flex items-center justify-center mb-6">
                <AlertTriangle className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-4">{warningMessage.split(':')[0]}</h2>
              <p className="text-slate-700 mb-4 text-lg font-medium">{warningMessage.split(':').slice(1).join(':')}</p>
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
        <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-sm leading-tight">TalEdge AI</h1>
                <p className="text-[10px] font-medium text-slate-500">{isTech ? "Technical" : "Behavioural"} Assessment</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-full text-[10px] font-bold shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                PROCTORED · {warnings}/3
              </div>
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${!isProcessing && sessionId ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-amber-200 bg-amber-50 text-amber-600'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${!isProcessing && sessionId ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {!isProcessing && sessionId ? "Live" : "Connecting..."}
              </div>
              <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold font-mono border border-slate-200/60 shadow-sm">
                {m}:{s}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full p-3 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Camera + Proctoring Panel + Profile */}
          <div className="lg:col-span-4 flex flex-col md:grid md:grid-cols-2 lg:flex lg:flex-col gap-4">
            {/* Camera Feed */}
            <div className="bg-white/50 backdrop-blur-2xl rounded-2xl p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/60 relative group">
              <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
                <div className="px-2.5 py-1 bg-black/70 backdrop-blur-xl rounded-lg text-[9px] font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <span className={`w-1.5 h-1.5 rounded-full ${webcamEnabled ? 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`} />
                  <Camera className="w-2.5 h-2.5" />
                  {webcamEnabled ? "LIVE" : "OFF"}
                </div>
                <div className="px-2.5 py-1 bg-indigo-50/80 backdrop-blur-xl rounded-lg text-[9px] font-bold text-indigo-700 flex items-center gap-1.5 uppercase tracking-wider border border-indigo-200/50">
                  {proctoringReady ? (
                    <><Eye className="w-2.5 h-2.5 text-emerald-600" /> AI Vision</>
                  ) : (
                    <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Loading...</>
                  )}
                </div>
              </div>
              {/* Person count indicator */}
              {hasStarted && proctoringStatus.personCount > 0 && (
                <div className="absolute top-3 right-3 z-20">
                  <div className={`px-2.5 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1.5 uppercase tracking-wider ${proctoringStatus.personCount === 1 ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30' : 'bg-red-500/20 text-red-600 border border-red-500/30 animate-pulse'}`}>
                    <Users className="w-2.5 h-2.5" />
                    {proctoringStatus.personCount} {proctoringStatus.personCount === 1 ? 'Person' : 'People'}
                  </div>
                </div>
              )}
              <div className="relative rounded-xl overflow-hidden">
                <div className={`absolute inset-0 border-2 rounded-xl z-10 pointer-events-none transition-colors duration-500 ${webcamEnabled && !proctoringStatus.cameraCovered ? 'border-emerald-500/20' : 'border-red-500/30'}`} />
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-32 md:h-48 lg:h-auto lg:aspect-[4/3] object-cover bg-black rounded-xl" />
              </div>
            </div>

            {/* Live Proctoring Panel */}
            {hasStarted && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/50 backdrop-blur-2xl rounded-2xl p-4 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <h3 className="text-[10px] font-bold text-slate-400 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldAlert className="w-3 h-3 text-indigo-500" /> Live Security Checks
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <StatusDot ok={proctoringStatus.faceVisible} label="Face visible" />
                  <StatusDot ok={!proctoringStatus.phoneDetected} label="No devices" />
                  <StatusDot ok={proctoringStatus.personCount <= 1} label="No intrusion" />
                  <StatusDot ok={!proctoringStatus.cameraCovered} label="Cam clear" />
                  <StatusDot ok={proctoringStatus.tabFocused} label="Tab focused" />
                  <StatusDot ok={!proctoringStatus.noiseDetected} label="Quiet Env" />
                  <StatusDot ok={warnings === 0} label={`${warnings}/3 warns`} />
                </div>
              </motion.div>
            )}

            {/* Candidate Profile */}
            <div className="bg-white/50 backdrop-blur-2xl rounded-2xl p-5 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <h3 className="text-[10px] font-bold text-slate-400 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-3 h-3 text-indigo-500" /> Candidate Profile
              </h3>
              {profile && (
                <div className="space-y-3">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Name</div>
                    <div className="text-sm font-semibold text-slate-800">{profile.fullName}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Role</div>
                    <div className="text-sm font-semibold text-slate-800">{profile.targetRole}</div>
                  </div>
                  {profile.resumeSkills && profile.resumeSkills.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Skills</div>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.resumeSkills.slice(0, 6).map((skill, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-semibold border border-indigo-100">
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
          <div className="lg:col-span-8 flex flex-col h-[550px] md:h-[600px] lg:h-[calc(100vh-10rem)] bg-white/40 backdrop-blur-3xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/60 overflow-hidden relative">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-transparent">
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-sm border border-indigo-400/30 shadow-md"
                        : "bg-white/80 backdrop-blur-md text-slate-800 border border-slate-200/80 rounded-bl-sm shadow-sm"
                    }`}>
                      {msg.role === "ai" && (
                        <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 mb-1.5 flex items-center gap-1">
                          <Brain className="w-3 h-3" /> AI Interviewer
                        </div>
                      )}
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isProcessing && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-white/80 backdrop-blur-md text-slate-500 border border-slate-200/80 rounded-2xl px-5 py-3.5 rounded-bl-sm flex items-center gap-3 shadow-sm">
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
                   className={`absolute inset-0 rounded-full blur-xl transition-all duration-75 ${aiSpeaking ? 'bg-purple-500/20' : !isProcessing && sessionId && !recording ? 'bg-emerald-500/10 animate-pulse' : isProcessing ? 'bg-indigo-500/10' : 'bg-transparent'}`} 
                   style={{ transform: aiSpeaking ? `scale(${1 + aiVolume / 80})` : 'scale(1)' }}
                 />
                 <div 
                   className={`relative w-8 h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-75 ${aiSpeaking ? 'bg-gradient-to-tr from-fuchsia-500 to-indigo-500 border-fuchsia-400 shadow-[0_0_30px_rgba(217,70,239,0.4)]' : !isProcessing && sessionId && !recording ? 'bg-gradient-to-tr from-emerald-500 to-teal-300 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]' : isProcessing ? 'bg-gradient-to-tr from-indigo-500 to-purple-400 border-indigo-400' : 'bg-slate-100 border-slate-300'}`}
                   style={{ transform: aiSpeaking ? `scale(${1 + aiVolume / 120})` : '' }}
                 >
                   <div className="w-1/2 h-1/2 rounded-full bg-white/30 blur-[1px]" />
                 </div>
              </div>
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-5 bg-white/70 backdrop-blur-xl border-t border-slate-200/60 z-10">
              {done ? (
                <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 text-center">
                  <h3 className="text-lg font-bold text-emerald-800 mb-2">Interview Completed</h3>
                  <p className="text-slate-600 text-sm mb-4">Your responses have been analyzed. View your detailed Fit Score report.</p>
                  <button onClick={() => router.push(`/student/${id}/fit-score`)} className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/20">
                    View Results & Report
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1 mb-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      {recording && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                      {recording ? "Listening... (Auto-submitting after 4s of silence)" : "Auto-Mic Ready"}
                    </div>
                    <div className="text-[9px] font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100/50 animate-pulse">
                      ⚠ Keep background noise low & sit in a quiet place
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setIsCodingMode(false)} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${!isCodingMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200/60'}`}>Voice / Text</button>
                      {isTech && <button onClick={() => setIsCodingMode(true)} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${isCodingMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200/60'}`}><FileText className="w-3 h-3 inline mr-1" />Code</button>}
                    </div>
                  </div>
                  
                  <div className="flex gap-3 items-end">
                    {!isCodingMode && (
                      <button
                        onClick={toggleMic}
                        className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                          recording ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30" : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                        }`}
                      >
                        {recording ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
                      </button>
                    )}
                    
                    <div className="flex-1">
                      {isCodingMode ? (
                        <div className="h-48 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 ring-indigo-500/20">
                          <Editor
                            height="100%"
                            defaultLanguage="javascript"
                            theme="vs"
                            value={draft + interimDraft}
                            onChange={(val) => {
                               setDraft(val || "");
                               setInterimDraft("");
                            }}
                            options={{ minimap: { enabled: false }, fontSize: 13, padding: { top: 12 } }}
                          />
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-xl p-2 flex focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
                          <textarea
                            ref={textAreaRef}
                            defaultValue={draft}
                            onChange={(e) => {
                               draftRef.current = e.target.value;
                               setDraft(e.target.value);
                            }}
                            placeholder="Speak naturally or type your response..."
                            className="flex-1 bg-transparent px-2 py-2 resize-none text-sm focus:outline-none text-slate-800 placeholder-slate-400"
                            rows={2}
                          />
                        </div>
                      )}
                      <div className="flex justify-end mt-2 gap-2">
                        <button
                          onClick={() => {
                            setDraft("");
                            setInterimDraft("");
                            draftRef.current = "";
                            if (textAreaRef.current) textAreaRef.current.value = "";
                            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                            startListening();
                          }}
                          disabled={isProcessing}
                          className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-all text-sm flex items-center gap-1.5"
                        >
                          Clear & Re-answer
                        </button>
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
