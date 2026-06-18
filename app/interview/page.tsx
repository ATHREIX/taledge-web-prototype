"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Play, Square, AlertTriangle, Code, LayoutDashboard, Loader2, X } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useGeminiLive } from "@/hooks/useGeminiLive";
import { useProctoring } from "@/hooks/useProctoring";
import { Button, Badge, Eyebrow } from "@/components/ui";
import { Logo } from "@/components/logo";
import { itemVariants } from "@/lib/motion";

export default function InterviewSession() {
  const { isConnected, connect, disconnect, startMicrophone, messages } = useGeminiLive();
  const { isCheating, violations } = useProctoring();

  // Guard fetched/derived collections so the UI never crashes on undefined.
  const safeMessages = messages ?? [];
  const safeViolations = violations ?? [];

  const [isMicOn, setIsMicOn] = useState(false);
  const [code, setCode] = useState("// Write your solution here...\n");
  const [isConnecting, setIsConnecting] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const toggleSession = async () => {
    if (isConnected) {
      disconnect();
      setIsMicOn(false);
      setMicError(null);
    } else {
      setIsConnecting(true);
      try {
        await connect();
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const toggleMic = async () => {
    if (!isMicOn) {
      setMicError(null);
      try {
        await startMicrophone();
        setIsMicOn(true);
      } catch (err) {
        // Surface getUserMedia / permission / device failures in the UI.
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Microphone access was denied. Enable mic permissions in your browser and try again."
            : err instanceof DOMException && err.name === "NotFoundError"
            ? "No microphone was found. Connect a mic and try again."
            : "Could not start the microphone. Check your device and permissions.";
        setMicError(message);
        setIsMicOn(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink-900 font-sans overflow-y-auto lg:overflow-hidden flex flex-col">
      {/* Top Navbar */}
      <nav className="h-16 border-b border-ink-200/70 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md z-10">
        <Logo />

        <div className="flex items-center space-x-4">
          {isCheating && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Badge tone="danger" className="px-3 py-1.5 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Integrity Violation ({safeViolations.length}/3)</span>
              </Badge>
            </motion.div>
          )}

          <Button
            type="button"
            onClick={toggleSession}
            variant={isConnected ? "danger" : "primary"}
            size="sm"
            className="rounded-full"
            disabled={isConnecting}
            aria-label={isConnected ? "End interview session" : "Start interview session"}
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : isConnected ? (
              <Square className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{isConnecting ? "Connecting…" : isConnected ? "End Session" : "Start Interview"}</span>
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* Left Panel: AI Visualization & Transcript */}
        <div className="w-full lg:w-1/3 min-h-[60vh] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-ink-200/70 flex flex-col bg-white/60 backdrop-blur-sm relative">

          {/* 3D Audio Visualizer Area (single decorative halo on this page) */}
          <div className="h-64 border-b border-ink-200/70 flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-ink-50 to-white">
            {/* Glowing Orb */}
            <motion.div
              aria-hidden="true"
              animate={
                isConnected
                  ? {
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5],
                      boxShadow: [
                        "0 0 20px 0px rgba(99, 102, 241, 0.3)",
                        "0 0 60px 10px rgba(99, 102, 241, 0.6)",
                        "0 0 20px 0px rgba(99, 102, 241, 0.3)"
                      ]
                    }
                  : { scale: 1, opacity: 0.2 }
              }
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-32 h-32 rounded-full bg-gradient-to-br from-brand-600 to-accent-500 blur-[2px] z-10"
            />

            <div className="absolute bottom-4 flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-ink-300'}`} aria-hidden="true"></div>
              <Eyebrow>{isConnected ? 'System Active' : 'System Standby'}</Eyebrow>
            </div>
          </div>

          {/* Mic / device error surface */}
          {micError && (
            <div
              role="alert"
              className="mx-4 mt-4 flex items-start gap-3 rounded-xl2 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span className="flex-1 leading-relaxed">{micError}</span>
              <button
                type="button"
                onClick={() => setMicError(null)}
                aria-label="Dismiss microphone error"
                className="shrink-0 rounded-md p-0.5 text-rose-600 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Transcript Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-ink-200">
            {safeMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-ink-500">
                <LayoutDashboard className="w-12 h-12 text-ink-300" aria-hidden="true" />
                <p className="text-sm max-w-[200px]">Click &apos;Start Interview&apos; to initialize the AI engine.</p>
              </div>
            ) : (
              safeMessages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] rounded-xl2 px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'ai'
                      ? 'bg-brand-50 border border-brand-100 text-brand-800'
                      : 'bg-white border border-ink-200/70 text-ink-700'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Mic Controls */}
          <div className="h-20 border-t border-ink-200/70 flex items-center justify-center bg-white/70 backdrop-blur-lg">
            <button
              type="button"
              onClick={toggleMic}
              disabled={!isConnected}
              aria-label={
                !isConnected
                  ? "Microphone unavailable until the session starts"
                  : isMicOn
                  ? "Microphone is on"
                  : "Turn on microphone"
              }
              aria-pressed={isMicOn}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                !isConnected ? 'opacity-50 cursor-not-allowed bg-ink-100 text-ink-500' :
                isMicOn
                  ? 'bg-brand-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]'
                  : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
              }`}
            >
              {isMicOn ? <Mic className="w-5 h-5" aria-hidden="true" /> : <MicOff className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Right Panel: Code Editor (intentionally dark) */}
        <div className="w-full lg:flex-1 min-h-[60vh] lg:min-h-0 flex flex-col bg-[#1e1e1e]">
          <div className="h-10 border-b border-white/5 flex items-center px-4 bg-[#252526]">
            <Code className="w-4 h-4 text-slate-400 mr-2" aria-hidden="true" />
            <span className="text-xs font-mono text-slate-400">solution.ts</span>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'Fira Code', monospace",
                padding: { top: 20 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
