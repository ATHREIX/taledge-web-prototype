"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Audio playback queue
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlaying = useRef(false);

  const playNextAudio = async () => {
    if (audioQueue.current.length === 0) {
      isPlaying.current = false;
      return;
    }
    isPlaying.current = true;
    const pcmData = audioQueue.current.shift()!;
    
    if (!audioContextRef.current) return;
    
    // Gemini returns 16kHz PCM audio
    const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000); // Gemini live output is 24kHz
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0; // Convert 16-bit PCM to float [-1, 1]
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => playNextAudio();
    source.start();
  };

  const connect = useCallback(async () => {
    try {
      const response = await fetch("/api/gemini/token");
      const { url } = await response.json();

      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        // Send initial context to the model to set the persona
        const setupMessage = {
          setup: {
            systemInstruction: {
              parts: [{ text: "You are the Taledge AI Interviewer. Start by warmly greeting the candidate. Then ask one technical question or a behavioral question. Be concise. Wait for their response." }]
            }
          }
        };
        wsRef.current?.send(JSON.stringify(setupMessage));
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.serverContent?.modelTurn?.parts) {
          data.serverContent.modelTurn.parts.forEach((part: any) => {
            if (part.text) {
              setMessages((prev) => [...prev, { role: "ai", text: part.text }]);
            }
            if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
              const base64Str = part.inlineData.data;
              const binaryString = atob(base64Str);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytes.buffer);
              audioQueue.current.push(pcm16);
              if (!isPlaying.current) playNextAudio();
            }
          });
        }
      };

      wsRef.current.onclose = () => setIsConnected(false);
    } catch (e) {
      console.error("Connection failed", e);
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close();
    setIsConnected(false);
  }, []);

  const startMicrophone = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    source.connect(processor);
    processor.connect(audioContextRef.current.destination);

    processor.onaudioprocess = (e) => {
      if (!isConnected || !wsRef.current) return;
      
      const float32Data = e.inputBuffer.getChannelData(0);
      const int16Data = new Int16Array(float32Data.length);
      for (let i = 0; i < float32Data.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Data[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Convert Int16Array to base64
      const buffer = new Uint8Array(int16Data.buffer);
      const base64String = btoa(String.fromCharCode.apply(null, Array.from(buffer)));

      const message = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "audio/pcm;rate=16000",
              data: base64String
            }
          ]
        }
      };
      
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      }
    };
  }, [isConnected]);

  return { isConnected, connect, disconnect, startMicrophone, messages };
}
