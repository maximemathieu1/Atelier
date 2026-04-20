import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DictationStatus =
  | "idle"
  | "requesting-mic"
  | "connecting"
  | "listening"
  | "stopping"
  | "error";

type UseLiveDictationOptions = {
  language?: string;
  onPartialText?: (text: string) => void;
  onFinalText?: (text: string) => void;
  onError?: (message: string) => void;
};

/**
 * Version légère côté page:
 * - ouvre le micro
 * - enregistre par petits chunks
 * - envoie chaque chunk au backend
 * - récupère un texte partiel / final
 *
 * IMPORTANT:
 * Le backend /api/voice/transcribe-stream est à implémenter.
 * Il doit accepter un FormData avec:
 *   - audio: Blob
 *   - language: string
 *   - finalize: "0" | "1"
 *
 * Réponse JSON attendue:
 * {
 *   text?: string;
 *   isFinal?: boolean;
 * }
 */
export function useLiveDictation(options: UseLiveDictationOptions = {}) {
  const {
    language = "fr",
    onPartialText,
    onFinalText,
    onError,
  } = options;

  const [status, setStatus] = useState<DictationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
  const [isSupported, setIsSupported] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const isStoppingRef = useRef(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";
    setIsSupported(ok);
  }, []);

  const cleanupMedia = useCallback(() => {
    try {
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    recorderRef.current = null;
    streamRef.current = null;
  }, []);

  const pushChunk = useCallback(
    async (blob: Blob, finalize: boolean) => {
      const form = new FormData();
      form.append("audio", blob, "chunk.webm");
      form.append("language", language);
      form.append("finalize", finalize ? "1" : "0");
      form.append("sessionId", sessionIdRef.current);

      const res = await fetch("/api/voice/transcribe-stream", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error(`Transcription impossible (${res.status})`);
      }

      const json = (await res.json()) as {
        text?: string;
        isFinal?: boolean;
      };

      const text = (json.text ?? "").trim();
      if (!text) return;

      if (json.isFinal || finalize) {
        setLiveText("");
        onFinalText?.(text);
      } else {
        setLiveText(text);
        onPartialText?.(text);
      }
    },
    [language, onFinalText, onPartialText]
  );

  const start = useCallback(async () => {
    if (!isSupported) {
      const msg = "Dictée vocale non supportée sur cet appareil.";
      setError(msg);
      setStatus("error");
      onError?.(msg);
      return;
    }

    if (status === "listening" || status === "connecting" || status === "requesting-mic") {
      return;
    }

    setError(null);
    setLiveText("");
    setStatus("requesting-mic");
    isStoppingRef.current = false;
    sessionIdRef.current = crypto.randomUUID();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = async (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) return;

        try {
          if (!isStoppingRef.current) {
            await pushChunk(event.data, false);
          }
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Erreur de transcription.";
          setError(msg);
          setStatus("error");
          onError?.(msg);
        }
      };

      recorder.onerror = () => {
        const msg = "Erreur d'enregistrement audio.";
        setError(msg);
        setStatus("error");
        onError?.(msg);
      };

      recorder.onstop = async () => {
        setStatus("stopping");

        try {
          // Petit blob vide final interdit; on force un mini blob si besoin côté backend.
          // Ici on laisse surtout le backend finaliser la session avec finalize=1.
          const emptyBlob = new Blob([], { type: mimeType });
          await pushChunk(emptyBlob, true);
          setStatus("idle");
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Erreur à l'arrêt de la dictée.";
          setError(msg);
          setStatus("error");
          onError?.(msg);
        } finally {
          cleanupMedia();
        }
      };

      setStatus("connecting");
      recorder.start(1200); // envoie un chunk environ toutes les 1.2 sec
      setStatus("listening");
    } catch (e) {
      cleanupMedia();
      const msg =
        e instanceof Error
          ? e.message
          : "Impossible d'accéder au microphone.";
      setError(msg);
      setStatus("error");
      onError?.(msg);
    }
  }, [cleanupMedia, isSupported, onError, pushChunk, status]);

  const stop = useCallback(async () => {
    if (status !== "listening" && status !== "connecting") return;

    isStoppingRef.current = true;

    try {
      recorderRef.current?.stop();
    } catch {
      cleanupMedia();
      setStatus("idle");
    }
  }, [cleanupMedia, status]);

  const clear = useCallback(() => {
    setLiveText("");
    setError(null);
    if (status === "error") setStatus("idle");
  }, [status]);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  return useMemo(
    () => ({
      isSupported,
      status,
      error,
      liveText,
      isListening: status === "listening",
      isBusy:
        status === "requesting-mic" ||
        status === "connecting" ||
        status === "stopping",
      start,
      stop,
      clear,
    }),
    [clear, error, isSupported, liveText, start, status, stop]
  );
}