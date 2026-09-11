import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type DictationStatus =
  | "idle"
  | "requesting-mic"
  | "listening"
  | "transcribing"
  | "error";

type UseLiveDictationOptions = {
  language?: string;
  onPartialText?: (text: string) => void;
  onFinalText?: (text: string) => void;
  onError?: (message: string) => void;
};

/**
 * Dictée haute précision :
 * - enregistre toute la dictée localement
 * - n'envoie RIEN pendant que l'utilisateur parle
 * - au Stop, construit un seul fichier WEBM/Opus
 * - envoie le fichier complet à la Supabase Edge Function voice-transcribe
 * - retourne uniquement la transcription finale
 *
 * Le moteur de transcription est Groq whisper-large-v3 côté backend.
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
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("audio/webm");

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";

    setIsSupported(ok);
  }, []);

  const cleanupMedia = useCallback(() => {
    try {
      recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    } catch {}

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    } catch {}

    recorderRef.current = null;
    streamRef.current = null;
  }, []);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      setStatus("error");
      onError?.(message);
    },
    [onError],
  );

  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      if (!audioBlob.size) {
        throw new Error("Aucun audio n'a été enregistré.");
      }

      setStatus("transcribing");
      setLiveText("");
      onPartialText?.("");

      const form = new FormData();
      form.append("audio", audioBlob, "dictation.webm");
      form.append("language", language);

      const { data, error: invokeError } = await supabase.functions.invoke(
        "voice-transcribe",
        {
          body: form,
        },
      );

      if (invokeError) {
        throw new Error(invokeError.message || "Transcription impossible.");
      }

      const text = String(data?.text ?? "").trim();

      if (!text) {
        throw new Error("Aucun texte n'a été reconnu dans la dictée.");
      }

      onFinalText?.(text);
      setStatus("idle");
    },
    [language, onFinalText, onPartialText],
  );

  const start = useCallback(async () => {
    if (!isSupported) {
      fail("Dictée vocale non supportée sur cet appareil.");
      return;
    }

    if (
      status === "requesting-mic" ||
      status === "listening" ||
      status === "transcribing"
    ) {
      return;
    }

    setError(null);
    setLiveText("");
    onPartialText?.("");
    chunksRef.current = [];
    setStatus("requesting-mic");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });

      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      });

      recorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        cleanupMedia();
        fail("Erreur d'enregistrement audio.");
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current,
        });

        chunksRef.current = [];
        cleanupMedia();

        try {
          await transcribeAudio(audioBlob);
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "Erreur de transcription.";
          fail(message);
        }
      };

      // Important : aucun timeslice.
      // Le navigateur garde toute la dictée jusqu'à recorder.stop().
      recorder.start();
      setStatus("listening");
    } catch (e) {
      cleanupMedia();
      const message =
        e instanceof Error
          ? e.message
          : "Impossible d'accéder au microphone.";
      fail(message);
    }
  }, [cleanupMedia, fail, isSupported, onPartialText, status, transcribeAudio]);

  const stop = useCallback(() => {
    if (status !== "listening") return;

    const recorder = recorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      cleanupMedia();
      setStatus("idle");
      return;
    }

    try {
      recorder.stop();
    } catch {
      cleanupMedia();
      fail("Impossible d'arrêter l'enregistrement audio.");
    }
  }, [cleanupMedia, fail, status]);

  const clear = useCallback(() => {
    setLiveText("");
    setError(null);
    onPartialText?.("");

    if (status === "error") {
      setStatus("idle");
    }
  }, [onPartialText, status]);

  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      } catch {}

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
      isBusy: status === "requesting-mic" || status === "transcribing",
      start,
      stop,
      clear,
    }),
    [clear, error, isSupported, liveText, start, status, stop],
  );
}
