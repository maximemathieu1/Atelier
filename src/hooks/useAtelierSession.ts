import { useCallback, useEffect, useMemo, useState } from "react";

export type AtelierSession = {
  mecanoId: string;
  mecanoNom: string;
};

const STORAGE_KEY = "atelier_active_mecano";

function readStoredSession(): AtelierSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.mecanoId || !parsed?.mecanoNom) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useAtelierSession() {
  const [session, setSession] = useState<AtelierSession | null>(null);

  useEffect(() => {
    setSession(readStoredSession());
  }, []);

  const setMecano = useCallback((next: AtelierSession) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    window.dispatchEvent(new CustomEvent("atelier-session-changed"));
  }, []);

  const clearMecano = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    window.dispatchEvent(new CustomEvent("atelier-session-changed"));
  }, []);

  useEffect(() => {
    const sync = () => setSession(readStoredSession());
    window.addEventListener("storage", sync);
    window.addEventListener("atelier-session-changed", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("atelier-session-changed", sync as EventListener);
    };
  }, []);

  return useMemo(
    () => ({
      session,
      mecanoId: session?.mecanoId ?? null,
      mecanoNom: session?.mecanoNom ?? null,
      isLoggedMecano: !!session,
      setMecano,
      clearMecano,
    }),
    [session, setMecano, clearMecano]
  );
}