import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DictationStatus = "idle" | "listening" | "error";

type UseSpeechDictationOptions = {
  lang?: string;
  onInterimText?: (text: string) => void;
  onFinalText?: (text: string) => void;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: null | (() => void);
  onerror: null | ((event: { error?: string }) => void);
  onend: null | (() => void);
  onresult: null | ((event: any) => void);
  start: () => void;
  stop: () => void;
};

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function useSpeechDictation(options: UseSpeechDictationOptions = {}) {
  const { lang = "fr-CA", onInterimText, onFinalText } = options;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const w = window as WindowWithSpeech;
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
  }, []);

  const start = useCallback(() => {
    if (!isSupported) {
      setError("Dictée vocale non supportée sur cet appareil.");
      setStatus("error");
      return;
    }

    setError(null);

    const w = window as WindowWithSpeech;
    const RecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setError("Dictée vocale non supportée sur cet appareil.");
      setStatus("error");
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }

      const recognition = new RecognitionCtor();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => {
        setStatus("listening");
      };

      recognition.onerror = (event) => {
        const err = event?.error || "Erreur de dictée vocale.";
        setError(err);
        setStatus("error");
      };

      recognition.onend = () => {
        setStatus((prev) => (prev === "error" ? "error" : "idle"));
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0]?.transcript ?? "";
          if (event.results[i].isFinal) final += transcript;
          else interim += transcript;
        }

        if (interim.trim()) onInterimText?.(interim.trim());
        else onInterimText?.("");

        if (final.trim()) onFinalText?.(final.trim());
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      setError(e?.message || "Impossible de démarrer la dictée.");
      setStatus("error");
    }
  }, [isSupported, lang, onFinalText, onInterimText]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  return {
    isSupported,
    isListening: status === "listening",
    status,
    error,
    start,
    stop,
    clearError: () => {
      setError(null);
      if (status === "error") setStatus("idle");
    },
  };
}