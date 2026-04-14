import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Unite = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  niv: string | null;
  km_actuel: number | null;
};

export default function UnitesListe() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Unite[]>([]);

  async function load() {
    const { data, error } = await supabase
      .from("unites")
      .select("id, no_unite, marque, modele, niv, km_actuel")
      .order("no_unite");

    if (error) {
      alert(error.message);
      return;
    }

    setRows((data as Unite[]) ?? []);
  }

  async function addUnite() {
    if (busy) return;

    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("unites")
        .insert({ no_unite: "Nouvelle unité" })
        .select("id")
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error("Impossible de créer l’unité.");

      nav(`/unites/${data.id}`);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeUnite(id: string) {
    if (busy) return;
    if (!confirm("Supprimer cette unité ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("unites").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>Unités</h1>
          <div className="muted">Gestion des unités atelier</div>
        </div>

        <button className="ghost" onClick={load} disabled={busy} type="button">
          Rafraîchir
        </button>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="toolbar" style={{ justifyContent: "flex-start" }}>
          <button className="btn-primary" onClick={addUnite} disabled={busy} type="button">
            Ajouter unité
          </button>
        </div>

        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr>
                <th>No unité</th>
                <th>Marque</th>
                <th>Modèle</th>
                <th>VIN</th>
                <th>KM</th>
                <th style={{ width: 160 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr
                  className="row"
                  key={u.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => nav(`/unites/${u.id}`)}
                >
                  <td style={{ fontWeight: 900 }}>{u.no_unite}</td>
                  <td>{u.marque ?? ""}</td>
                  <td>{u.modele ?? ""}</td>
                  <td>{u.niv ?? ""}</td>
                  <td>{u.km_actuel ?? ""}</td>
                  <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="ghost"
                      style={{ borderStyle: "solid" }}
                      disabled={busy}
                      onClick={() => removeUnite(u.id)}
                      type="button"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: "12px 8px" }}>
                    Aucune unité.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="hint">Clique une unité pour ouvrir sa fiche + notes mécaniques.</div>
      </div>
    </div>
  );
}