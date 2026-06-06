"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Play, Square, AlertTriangle, Code, LayoutDashboard } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useGeminiLive } from "@/hooks/useGeminiLive";
import { useProctoring } from "@/hooks/useProctoring";

export default function InterviewSession() {
  const { isConnected, connect, disconnect, startMicrophone, messages } = useGeminiLive();
  const { isCheating, violations } = useProctoring();
  
  const [isMicOn, setIsMicOn] = useState(false);
  const [code, setCode] = useState("// Write your solution here...\n");

  const toggleSession = async () => {
    if (isConnected) {
      disconnect();
      setIsMicOn(false);
    } else {
      await connect();
    }
  };

  const toggleMic = () => {
    if (!isMicOn) {
      startMicrophone();
      setIsMicOn(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans overflow-hidden flex flex-col">
      {/* Top Navbar */}
      <nav className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-black/20 backdrop-blur-md z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
            <span className="font-bold text-sm">T</span>
          </div>
          <span className="font-semibold text-lg tracking-tight">Taledge Intelligence</span>
        </div>
        
        <div className="flex items-center space-x-4">
          {isCheating && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-2 text-red-400 bg-red-400/10 px-3 py-1.5 rounded-full text-sm font-medium border border-red-400/20"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Integrity Violation ({violations.length}/3)</span>
            </motion.div>
          )}
          
          <button 
            onClick={toggleSession}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center space-x-2 ${
              isConnected 
                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" 
                : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
            }`}
          >
            {isConnected ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isConnected ? "End Session" : "Start Interview"}</span>
          </button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: AI Visualization & Transcript */}
        <div className="w-1/3 border-r border-white/10 flex flex-col bg-black/40 relative">
          
          {/* 3D Audio Visualizer Area */}
          <div className="h-64 border-b border-white/10 flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-slate-900 to-black">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
            
            {/* Glowing Orb */}
            <motion.div
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
              className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 via-blue-500 to-purple-500 blur-[2px] z-10"
            />
            
            <div className="absolute bottom-4 flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`}></div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">
                {isConnected ? 'System Active' : 'System Standby'}
              </span>
            </div>
          </div>

          {/* Transcript Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-slate-500">
                <LayoutDashboard className="w-12 h-12 opacity-20" />
                <p className="text-sm max-w-[200px]">Click 'Start Interview' to initialize the AI engine.</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'ai' 
                      ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-100' 
                      : 'bg-white/5 border border-white/10 text-slate-300'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Mic Controls */}
          <div className="h-20 border-t border-white/10 flex items-center justify-center bg-black/60 backdrop-blur-lg">
            <button
              onClick={toggleMic}
              disabled={!isConnected}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                !isConnected ? 'opacity-50 cursor-not-allowed bg-slate-800' :
                isMicOn 
                  ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Right Panel: Code Editor */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          <div className="h-10 border-b border-white/5 flex items-center px-4 bg-[#252526]">
            <Code className="w-4 h-4 text-slate-400 mr-2" />
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
