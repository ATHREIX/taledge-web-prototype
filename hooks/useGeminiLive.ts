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
  /** Pre-interview difficulty anchor ("adaptive" | "easy" | "medium" | "hard"). */
  difficulty?: string;
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
  // Session resumption (Gemini Live caps a single WebSocket at ~10 min and audio
  // sessions at ~15 min). We enable contextWindowCompression to lift the duration
  // cap, and sessionResumption so that when the server resets the connection
  // mid-interview we transparently reconnect with the latest handle and keep the
  // SAME mic/audio — the candidate never notices. Without this a 30-min interview
  // freezes at ~10 min.
  const sessionHandleRef = useRef<string | null>(null);
  const intentionalCloseRef = useRef(false); // true only when disconnect() is called
  const reconnectingRef = useRef(false);
  const connCtxRef = useRef<{ apiKey: string; model: string; voice?: string; systemInstruction?: string; captureMic: boolean } | null>(null);
  // Half-duplex turn-taking: while the interviewer "has the floor" (generating
  // or its audio is still playing) we MUTE the candidate's mic so they can't
  // talk over the AI and the AI's own voice can't leak back in. The mic resumes
  // once the AI's turn fully ends.
  const aiTurnActiveRef = useRef(false);
  // External hard-mute: holds the candidate's mic closed regardless of turn state
  // (used to fully pause the live interviewer during a coding block).
  const forceMuteRef = useRef(false);
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

    // Jitter buffer: the interview page runs heavy per-frame work on the main
    // thread (TF proctoring, identity checks), which can deliver/queue audio
    // chunks late and leave audible gaps ("breaking"). When the scheduled
    // playhead has already drained (a stall or the first chunk of a turn), start
    // the next chunk a cushion ahead of `currentTime` so brief stalls are
    // absorbed; otherwise stack chunks gaplessly back-to-back.
    const JITTER = 0.12;
    const startAt =
      playheadRef.current > ctx.currentTime + 0.005
        ? playheadRef.current
        : ctx.currentTime + JITTER;
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
      // Drop mic frames while hard-muted (coding block), or — half-duplex — while
      // the interviewer is generating / its audio is still playing.
      if (forceMuteRef.current || aiTurnActiveRef.current || isPlaying.current) return;
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

  const connect = useCallback(async (context: LiveContext = {}, opts: { captureMic?: boolean } = {}) => {
    // captureMic=false lets the caller drive the candidate's audio/transcription
    // itself (e.g. forced-English browser SpeechRecognition + text turns) so this
    // hook only handles the AI's audio OUT. Defaults to true for backward compat.
    const captureMic = opts.captureMic !== false;
    setError(null);
    intentionalCloseRef.current = false;
    sessionHandleRef.current = null;
    reconnectingRef.current = false;

    // Guard against a stale/duplicate socket (e.g. React dev double-invoke or a
    // rapid reconnect) so two live sessions can't race the connection state.
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    // 1) Mint the ephemeral token server-side. A failure here is terminal for
    //    Live. Gemini Live is the only interviewer path; on connect failure the
    //    caller surfaces a retryable error (no silent degrade).
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

    connCtxRef.current = { apiKey, model, voice, systemInstruction, captureMic };

    // 2) Open the Live socket and resolve ONLY once the session is actually
    //    ready (`setupComplete`). If the socket errors/closes (e.g. the token is
    //    rejected) or never becomes ready in time, resolve `false`. Gemini Live is
    //    the only interviewer path; on connect failure the caller surfaces a
    //    retryable error (no silent degrade). Once running, the SAME logic is
    //    reused to RECONNECT when
    //    the server resets the ~10-min connection — keyed off the resumption
    //    handle — so the interview continues past the session limit.
    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(readyTimer);
        resolve(ok);
      };

      // Safety net: if Live never confirms the FIRST setup, fall back.
      const readyTimer = setTimeout(() => {
        if (settled) return;
        setError("The live interviewer did not respond in time.");
        try { wsRef.current?.close(); } catch {}
        settle(false);
      }, 10000);

      const openSocket = (isReconnect: boolean) => {
        const c = connCtxRef.current!;
        let ws: WebSocket;
        try {
          const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(c.apiKey)}`;
          ws = new WebSocket(url);
        } catch {
          if (!isReconnect) { setError("Could not connect to the live interviewer."); settle(false); }
          else { reconnectingRef.current = false; }
          return;
        }
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              setup: {
                model: c.model.startsWith("models/") ? c.model : `models/${c.model}`,
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    languageCode: "en-US",
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: c.voice || "Aoede" } },
                  },
                },
                systemInstruction: { parts: [{ text: c.systemInstruction || "You are a professional interviewer." }] },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                // Lift the ~15-min audio session cap via a server-side sliding window.
                contextWindowCompression: { slidingWindow: {} },
                // Resume the SAME session across the ~10-min connection limit. On a
                // reconnect we pass the latest handle so the model keeps full context.
                sessionResumption: sessionHandleRef.current ? { handle: sessionHandleRef.current } : {},
              },
            })
          );
          // Kick off the greeting only on the FIRST connect — a reconnect resumes
          // mid-conversation and must NOT restart the interview.
          if (!isReconnect) {
            ws.send(
              JSON.stringify({
                clientContent: {
                  turns: [
                    {
                      role: "user",
                      parts: [
                        {
                          text: "I'm ready to begin. Greet me warmly by name and open with ONE friendly, human icebreaker about how I'm doing or how my day is going. Do NOT mention my resume, skills, projects, the role, or anything technical yet, and ask nothing technical on this first turn. Then wait for my reply.",
                        },
                      ],
                    },
                  ],
                  turnComplete: true,
                },
              })
            );
          }
        };

        ws.onmessage = async (event) => {
          let payload: any;
          try {
            const raw = event.data instanceof Blob ? await event.data.text() : event.data;
            payload = JSON.parse(raw);
          } catch {
            return;
          }

          // Capture the latest resumption handle so a reconnect restores context.
          if (payload.sessionResumptionUpdate?.newHandle) {
            sessionHandleRef.current = payload.sessionResumptionUpdate.newHandle;
          }

          if (payload.setupComplete) {
            setIsConnected(true);
            reconnectingRef.current = false;
            if (!isReconnect) settle(true);
            if (c.captureMic) {
              startMicrophone().catch(() => setError("Microphone access is required for the live interview."));
            }
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
          // Only surface an error / fall back if the FIRST connect never set up.
          if (!isReconnect && !settled) {
            setError("The live connection had an error.");
            settle(false);
          }
          // Mid-interview errors are handled by onclose (which reconnects).
        };

        ws.onclose = () => {
          if (wsRef.current !== ws) return; // superseded by a newer socket — ignore
          setIsConnected(false);
          // Intentional teardown (disconnect()) → do not reconnect.
          if (intentionalCloseRef.current) { if (!isReconnect) settle(false); return; }
          // A close before the FIRST setupComplete = a failed connect (e.g. rejected
          // token) → surface as failure so the caller can fall back.
          if (!isReconnect && !settled) { settle(false); return; }
          // Otherwise this is the ~10-min connection limit closing us MID-INTERVIEW.
          // Reconnect with the resumption handle to continue the same session.
          if (sessionHandleRef.current && !reconnectingRef.current) {
            reconnectingRef.current = true;
            setTimeout(() => { if (!intentionalCloseRef.current) openSocket(true); }, 400);
          }
        };
      };

      openSocket(false);
    });
  }, [playAudioChunk, startMicrophone]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true; // stop any auto-reconnect on close
    sessionHandleRef.current = null;
    reconnectingRef.current = false;
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
    forceMuteRef.current = false;
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

  /**
   * Send a PRIVATE control/director message to the model as a completed user
   * turn WITHOUT mirroring it into `messages` (so signals like `[WRAP_UP]` or
   * `[DIRECTOR: …]` steer the interviewer but never appear in the transcript).
   * The system prompt tells the model these are system instructions, not the
   * candidate, and must never be read aloud. Returns false if the socket isn't open.
   */
  const sendControl = useCallback((text: string) => {
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
    return true;
  }, []);

  /** Hard-mute / unmute the candidate's mic (used to pause the interviewer during a coding block). */
  const setMicMuted = useCallback((muted: boolean) => {
    forceMuteRef.current = muted;
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
    sendControl,
    setMicMuted,
  };
}
