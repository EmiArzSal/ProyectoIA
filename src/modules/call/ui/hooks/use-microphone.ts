"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// One microphone stream for the whole interview: acquired once in the
// pre-check (inside a click, so the permission prompt and the AudioContext
// are allowed), reused by every answer, released on finish or unmount.

export type MicError = "unsupported" | "denied" | "not-found" | "busy" | "unknown";
export type MicStatus = "idle" | "requesting" | "ready" | "error" | "lost";

export const MIC_ERROR_MESSAGES: Record<MicError, { title: string; hint: string }> = {
  unsupported: {
    title: "Tu navegador no permite usar el micrófono aquí",
    hint: "Abre la página con HTTPS en Chrome, Edge, Firefox o Safari actualizados.",
  },
  denied: {
    title: "El permiso del micrófono está bloqueado",
    hint: "Haz clic en el candado junto a la dirección de la página, permite el micrófono y vuelve a intentarlo.",
  },
  "not-found": {
    title: "No encontramos ningún micrófono",
    hint: "Conecta un micrófono o audífonos con micrófono y vuelve a intentarlo.",
  },
  busy: {
    title: "Otra aplicación está usando tu micrófono",
    hint: "Cierra Zoom, Meet, Discord u otra app que lo esté usando y vuelve a intentarlo.",
  },
  unknown: {
    title: "No se pudo acceder al micrófono",
    hint: "Revisa que esté conectado y que el navegador tenga permiso, y vuelve a intentarlo.",
  },
};

// Same base types /api/session/transcribe accepts. Safari only records mp4.
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const DEVICE_KEY = "agora.micDeviceId";

const readSavedDevice = () => {
  try { return localStorage.getItem(DEVICE_KEY); } catch { return null; }
};
const saveDevice = (id: string | null) => {
  try {
    if (id) localStorage.setItem(DEVICE_KEY, id);
    else localStorage.removeItem(DEVICE_KEY);
  } catch { /* private mode: not remembered, still works */ }
};

const toMicError = (err: unknown): MicError => {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "not-found";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "unknown";
};

const isSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined";

export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

const isLive = (stream: MediaStream | null) =>
  !!stream && stream.getAudioTracks().some((t) => t.readyState === "live");

export function useMicrophone({ monitorLevel }: { monitorLevel: boolean }) {
  const [status, setStatus]     = useState<MicStatus>("idle");
  const [error, setError]       = useState<MicError | null>(null);
  const [devices, setDevices]   = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [level, setLevel]       = useState(0); // 0–1, only while monitoring

  const streamRef   = useRef<MediaStream | null>(null);
  const deviceRef   = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const releasedRef = useRef(false);

  const stopTracks = (keep?: MediaStream) => {
    const old = streamRef.current;
    if (old && old !== keep) old.getTracks().forEach((t) => { t.onended = null; t.stop(); });
    streamRef.current = null;
  };

  // Created inside the user's click (before any await): browsers with strict
  // autoplay rules keep a context created later suspended, and the meter
  // would stay at zero.
  const ensureAudioContext = () => {
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.resume().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtxRef.current = new Ctx();
    void audioCtxRef.current.resume().catch(() => {});
  };

  const refreshDevices = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "audioinput" && d.deviceId));
    } catch { /* the list is optional */ }
  };

  /** Opens (or re-opens) the microphone. Returns null and sets `error` on failure. */
  const acquire = useCallback(async (requestedId?: string | null): Promise<MediaStream | null> => {
    if (!isSupported()) {
      setError("unsupported");
      setStatus("error");
      return null;
    }
    releasedRef.current = false;
    ensureAudioContext();
    setStatus("requesting");

    const wanted = requestedId !== undefined ? requestedId : (deviceRef.current ?? readSavedDevice());
    const open = (id: string | null) =>
      navigator.mediaDevices.getUserMedia({
        audio: {
          ...(id ? { deviceId: { exact: id } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

    let stream: MediaStream;
    try {
      try {
        stream = await open(wanted);
      } catch (err) {
        // A remembered microphone that is no longer connected: use the default.
        const name = err instanceof DOMException ? err.name : "";
        if (!wanted || (name !== "OverconstrainedError" && name !== "NotFoundError")) throw err;
        saveDevice(null);
        stream = await open(null);
      }
    } catch (err) {
      setError(toMicError(err));
      setStatus("error");
      return null;
    }

    // Released while the prompt was open (the user left the page).
    if (releasedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }

    stopTracks(stream);
    streamRef.current = stream;
    const track = stream.getAudioTracks()[0];
    const actualId = requestedId || track?.getSettings().deviceId || wanted || null;
    deviceRef.current = actualId;
    setDeviceId(actualId);
    if (requestedId) saveDevice(requestedId);

    // Unplugged headset, revoked permission, OS took the device...
    if (track) {
      track.onended = () => {
        if (streamRef.current === stream) setStatus("lost");
      };
    }

    setError(null);
    setStatus("ready");
    void refreshDevices(); // labels are only visible after permission
    return stream;
  }, []);

  /** The live stream, re-opening the microphone if it was lost. */
  const getStream = useCallback(async (): Promise<MediaStream | null> => {
    if (isLive(streamRef.current)) return streamRef.current;
    return acquire();
  }, [acquire]);

  const selectDevice = useCallback((id: string) => acquire(id), [acquire]);

  /** Stops the microphone (the browser's recording indicator turns off). */
  const release = useCallback(() => {
    releasedRef.current = true;
    stopTracks();
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
    setStatus("idle");
  }, []);

  // Show a blocked permission before the user clicks, where the browser tells us.
  useEffect(() => {
    if (!isSupported()) {
      setError("unsupported");
      setStatus("error");
      return;
    }
    let perm: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((p) => {
        perm = p;
        if (p.state === "denied") { setError("denied"); setStatus("error"); }
        p.onchange = () => {
          if (p.state === "denied") { setError("denied"); setStatus("error"); }
          else if (!streamRef.current) { setError(null); setStatus("idle"); }
        };
      })
      .catch(() => { /* Permissions API without "microphone" (older Firefox/Safari) */ });
    return () => { if (perm) perm.onchange = null; };
  }, []);

  // Live input level for the pre-check meter.
  useEffect(() => {
    const stream = streamRef.current;
    if (!monitorLevel || status !== "ready" || !stream) return;

    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === "closed") return;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);

    let raf = 0;
    let lastUpdate = 0;
    const tick = (t: number) => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += v * v;
      const rms = Math.sqrt(sum / data.length);
      // Speech is roughly 0.02–0.2 RMS; scale so normal speech fills the bar.
      if (t - lastUpdate > 80) {
        setLevel(Math.min(1, rms * 8));
        lastUpdate = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      setLevel(0);
    };
  }, [monitorLevel, status, deviceId]);

  // Never leave the microphone open after leaving the page.
  useEffect(() => () => {
    releasedRef.current = true;
    stopTracks();
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  return { status, error, devices, deviceId, level, acquire, getStream, selectDevice, release };
}

export type Microphone = ReturnType<typeof useMicrophone>;
