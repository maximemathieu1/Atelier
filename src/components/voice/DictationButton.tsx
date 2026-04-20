import React from "react";

type Props = {
  isSupported: boolean;
  isListening: boolean;
  isBusy?: boolean;
  disabled?: boolean;
  onStart: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
};

export default function DictationButton({
  isSupported,
  isListening,
  isBusy = false,
  disabled = false,
  onStart,
  onStop,
}: Props) {
  const baseStyle: React.CSSProperties = {
    minWidth: 56,
    height: 44,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: disabled || !isSupported ? "not-allowed" : "pointer",
    fontSize: 18,
    fontWeight: 700,
    padding: "0 14px",
  };

  const liveStyle: React.CSSProperties = isListening
    ? {
        border: "1px solid #dc2626",
        color: "#dc2626",
      }
    : {};

  return (
    <button
      type="button"
      disabled={disabled || !isSupported || isBusy}
      onClick={isListening ? onStop : onStart}
      title={
        !isSupported
          ? "Dictée non supportée"
          : isListening
          ? "Arrêter la dictée"
          : "Démarrer la dictée"
      }
      style={{ ...baseStyle, ...liveStyle }}
    >
      {isListening ? "⏹" : "🎤"}
    </button>
  );
}