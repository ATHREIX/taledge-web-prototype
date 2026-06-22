"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { authedFetch } from "@/lib/api-client";

export type LiveContext = {
  candidateName?: string;
  role?: string;
  mode?: "technical" | "behavioural" | "dnla" | "final";
  track?: "placement" | "exam";
  resumeSummary?: string;
  dnlaSummary?: string;
  priorInterviews?: string;
};

export type LiveMessage = { role: "ai" | "user"; text: string };

/**
 * Gemini Live (realtime native-audio) interviewer client.
 *
 * - Mints an ephemeral token server-side (/api/gemini/live-token), then opens the
 *   BidiGenerateContent WebSocket with it.
 * - Sends a setup with the HD prebuilt voice + interviewer system prompt + input/
 *   output audio transcription, then triggers the AI to speak first.
 * - Streams the AI's native-audio out (24kHz PCM) and the candidate's mic in, and
 *   accumulates BOTH sides' transcriptions into `messages` for scoring.
 */
export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  // Live (in-flight) transcription for the current turn — drives the captions
  // shown while the interviewer is speaking / the candidate is answering.
  const [partialAi, setPartialAi] = useState("");
  const [partialUser, setPartialUser] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  // Half-duplex turn-taking: while the interviewer "has the floor" (generating
  // or its audio is still playing) we MUTE the candidate's mic so they can't
  // talk over the AI and the AI's own voice can't leak back in. The mic resumes
  // once the AI's turn fully ends.
  const aiTurnActiveRef = useRef(false);
  // Per the Live API spec the two audio streams run at DIFFERENT rates:
  //   input (mic → server) = 16kHz, output (server → speaker) = 24kHz.
  // Use a dedicated AudioContext for each so the 24kHz model voice is not
  // resampled through a 16kHz graph (which makes it sound muffled/garbled).
  const audioContextRef = useRef<AudioContext | null>(null); // 16kHz capture
  const outputContextRef = useRef<AudioContext | null>(null); // 24kHz playback
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isPlaying = useRef(false);
  // Playback is SCHEDULED on the output AudioContext clock: each chunk starts
  // where the previous one ends (`playheadRef`). End-of-speech is detected from
  // that scheduled playhead via a timer — NOT from `onended` — so the mic can't
  // get stuck muted if an `onended` event is ever dropped (headless/backgrounded
  // tabs, audio glitches, etc.).
  const playheadRef = useRef(0);
  const speechEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Accumulators for the in-flight turn's streamed transcription text.
  const aiTurnRef = useRef("");
  const userTurnRef = useRef("");

  /** Schedule one 24kHz PCM chunk back-to-back and (re)arm the end-of-speech timer. */
  const playAudioChunk = useCallback((pcm: Int16Array) => {
    if (!outputContextRef.current) {
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = outputContextRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const buffer = ctx.createBuffer(1, pcm.length, 24000); // Gemini Live output is 24kHz
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768.0;

    const startAt = Math.max(ctx.currentTime + 0.03, playheadRef.current);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(startAt);
    playheadRef.current = startAt + buffer.duration;

    isPlaying.current = true;
    setAiSpeaking(true);

    // Re-arm: clear the floor a beat after the last scheduled audio ends. Each
    // new chunk pushes this out, so it only fires once playback truly drains.
    if (speechEndTimerRef.current) clearTimeout(speechEndTimerRef.current);
    const msUntilDone = Math.max(0, (playheadRef.current - ctx.currentTime) * 1000) + 150;
    speechEndTimerRef.current = setTimeout(() => {
      isPlaying.current = false;
      setAiSpeaking(false);
    }, msUntilDone);
  }, []);

  const startMicrophone = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    // Resume the capture context — if it was created outside a user gesture it
    // starts "suspended" and onaudioprocess never fires, so the mic would
    // silently capture nothing.
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume().catch(() => {});
    }
    if (mediaStreamRef.current) return; // already capturing
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    source.connect(processor);
    processor.connect(audioContextRef.current.destination);
    processor.onaudioprocess = (e) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      // Half-duplex: drop mic frames while the interviewer is generating or its
      // audio is still playing, so the candidate is effectively muted until the
      // AI finishes its turn.
      if (aiTurnActiveRef.current || isPlaying.current) return;
      const f32 = e.inputBuffer.getChannelData(0);
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        const s = Math.max(-1, Math.min(1, f32[i]));
        i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const bytes = new Uint8Array(i16.buffer);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      // Official Live API realtime audio shape (16kHz PCM): realtimeInput.audio.
      ws.send(JSON.stringify({ realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: btoa(bin) } } }));
    };
  }, []);

  const connect = useCallback(async (context: LiveContext = {}) => {
    setError(null);

    // Guard against a stale/duplicate socket (e.g. React dev double-invoke or a
    // rapid reconnect) so two live sessions can't race the connection state.
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    // 1) Mint the ephemeral token server-side. A failure here is terminal for
    //    Live; the caller falls back to the REST text interview.
    let apiKey: string, model: string, voice: string | undefined, systemInstruction: string | undefined;
    try {
      const res = await authedFetch("/api/gemini/live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.apiKey) {
        setError("Could not start the live interviewer. Please retry.");
        return false;
      }
      ({ apiKey, model, voice, systemInstruction } = data);
    } catch {
      setError("Could not connect to the live interviewer.");
      return false;
    }

    // 2) Open the Live socket and resolve ONLY once the session is actually
    //    ready (`setupComplete`). If the socket errors/closes (e.g. the token is
    //    rejected) or never becomes ready in time, resolve `false` so the caller
    //    can fall back to the REST text interview instead of stalling on a dead
    //    "connected" session.
    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(readyTimer);
        resolve(ok);
      };

      let ws: WebSocket;
      try {
        // Documented endpoint for API-key auth (v1beta). Key is passed as a
        // query param per the Live API WebSocket spec.
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;
        ws = new WebSocket(url);
      } catch {
        setError("Could not connect to the live interviewer.");
        resolve(false);
        return;
      }
      wsRef.current = ws;

      // Safety net: if Live never confirms setup, tear down and fall back.
      const readyTimer = setTimeout(() => {
        if (settled) return;
        setError("The live interviewer did not respond in time.");
        try { ws.close(); } catch {}
        settle(false);
      }, 10000);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            setup: {
              model: model.startsWith("models/") ? model : `models/${model}`,
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || "Aoede" } } },
              },
              systemInstruction: { parts: [{ text: systemInstruction || "You are a professional interviewer." }] },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          })
        );
        // Nudge the interviewer to greet and ask the first question.
        ws.send(
          JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: "I'm ready. Please begin the interview." }] }],
              turnComplete: true,
            },
          })
        );
      };

      ws.onmessage = async (event) => {
        let payload: any;
        try {
          const raw = event.data instanceof Blob ? await event.data.text() : event.data;
          payload = JSON.parse(raw);
        } catch {
          return;
        }

        if (payload.setupComplete) {
          // The Live session is genuinely ready — only now report success.
          setIsConnected(true);
          settle(true);
          startMicrophone().catch(() => setError("Microphone access is required for the live interview."));
          return;
        }

        const sc = payload.serverContent;
        if (!sc) return;

        // Streamed transcriptions (accumulate per side; commit on turn end).
        // The interviewer's text streams live into `partialAi` so the UI can
        // show captions as it speaks; the candidate's into `partialUser`.
        if (sc.outputTranscription?.text) {
          aiTurnActiveRef.current = true; // interviewer now has the floor → mute mic
          aiTurnRef.current += sc.outputTranscription.text;
          setPartialAi(aiTurnRef.current);
        }
        if (sc.inputTranscription?.text) {
          userTurnRef.current += sc.inputTranscription.text;
          setPartialUser(userTurnRef.current);
        }

        // Native-audio chunks → play.
        const parts = sc.modelTurn?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            const inline = part.inlineData;
            if (inline?.data && typeof inline.mimeType === "string" && inline.mimeType.startsWith("audio/")) {
              aiTurnActiveRef.current = true; // interviewer is speaking → keep mic muted
              const binary = atob(inline.data);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              playAudioChunk(new Int16Array(bytes.buffer));
            }
          }
        }

        if (sc.turnComplete) {
          const userText = userTurnRef.current.trim();
          const aiText = aiTurnRef.current.trim();
          userTurnRef.current = "";
          aiTurnRef.current = "";
          // The interviewer's turn is over. The mic resumes automatically once
          // any queued audio finishes playing (see the onaudioprocess gate).
          aiTurnActiveRef.current = false;
          setPartialAi("");
          setPartialUser("");
          setMessages((prev) => {
            const next = [...prev];
            if (userText) next.push({ role: "user", text: userText });
            if (aiText) next.push({ role: "ai", text: aiText });
            return next;
          });
        }
      };

      ws.onerror = () => {
        setError("The live connection had an error.");
        // If we error before the session is ready, fall back to REST.
        settle(false);
      };
      ws.onclose = () => {
        setIsConnected(false);
        // A close before `setupComplete` (e.g. a rejected token) must surface as
        // a failed connect so the caller falls back instead of hanging.
        settle(false);
      };
    });
  }, [playAudioChunk, startMicrophone]);

  const disconnect = useCallback(() => {
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    try { audioContextRef.current?.close(); } catch {}
    audioContextRef.current = null;
    try { outputContextRef.current?.close(); } catch {}
    outputContextRef.current = null;
    if (speechEndTimerRef.current) { clearTimeout(speechEndTimerRef.current); speechEndTimerRef.current = null; }
    playheadRef.current = 0;
    isPlaying.current = false;
    aiTurnActiveRef.current = false;
    setIsConnected(false);
    setAiSpeaking(false);
    setPartialAi("");
    setPartialUser("");
  }, []);

  /**
   * Send a typed answer over the Live socket as a completed user turn. Lets the
   * candidate type instead of (or alongside) speaking. Mirrors the text into
   * `messages` immediately so it shows in the transcript without waiting on the
   * server echo. Returns false if the socket isn't open or the text is empty.
   */
  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    const trimmed = text.trim();
    if (!ws || ws.readyState !== WebSocket.OPEN || !trimmed) return false;
    ws.send(
      JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text: trimmed }] }],
          turnComplete: true,
        },
      })
    );
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setPartialUser("");
    return true;
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    isConnected,
    aiSpeaking,
    error,
    messages,
    partialAi,
    partialUser,
    connect,
    disconnect,
    startMicrophone,
    sendText,
  };
}
