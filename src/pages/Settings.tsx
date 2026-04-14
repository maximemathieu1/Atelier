// src/pages/Settings.tsx
import { useMemo, useState } from "react";
import SettingsUnites from "./settings/SettingsUnites";

type Tab = "unites" | "autres";

export default function Settings() {
  const [tab, setTab] = useState<Tab>("unites");

  const title = useMemo(() => {
    if (tab === "unites") return "Paramètres — Unités";
    return "Paramètres";
  }, [tab]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1 style={{ margin: 0 }}>{title}</h1>
          <div className="muted">Configuration de l’application (on ajoutera d’autres onglets plus tard)</div>
        </div>
      </div>

      <div className="tabs" style={{ marginTop: 8 }}>
        <button className={"tab" + (tab === "unites" ? " active" : "")} onClick={() => setTab("unites")} type="button">
          Unités
        </button>
        <button className={"tab" + (tab === "autres" ? " active" : "")} onClick={() => setTab("autres")} type="button">
          À venir
        </button>
      </div>

      {tab === "unites" && <SettingsUnites />}

      {tab === "autres" && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">À venir</div>
              <div className="card-subtitle">Paramètres pour les futures pages (clients, BT, inventaire…)</div>
            </div>
          </div>

          <div className="hint">On gardera la même logique d’onglets et de pages légères.</div>
        </div>
      )}
    </div>
  );
}