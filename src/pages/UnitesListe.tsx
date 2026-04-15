import { useEffect, useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");

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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((u) => {
      const haystack = [
        u.no_unite,
        u.marque ?? "",
        u.modele ?? "",
        u.niv ?? "",
        u.km_actuel != null ? String(u.km_actuel) : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, search]);

  function renderVin(niv: string | null) {
    if (!niv) return "";

    const clean = niv.trim();
    const last8 = clean.slice(-8);
    const firstPart = clean.slice(0, -8);

    return (
      <>
        {firstPart}
        <strong>{last8}</strong>
      </>
    );
  }

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

        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une unité, marque, modèle, VIN ou KM..."
            style={{
              width: "100%",
              maxWidth: 420,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--line, #d0d7de)",
              background: "var(--card, #fff)",
              outline: "none",
            }}
          />
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
              {filteredRows.map((u) => (
                <tr
                  className="row"
                  key={u.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => nav(`/unites/${u.id}`)}
                >
                  <td style={{ fontWeight: 900 }}>{u.no_unite}</td>
                  <td>{u.marque ?? ""}</td>
                  <td>{u.modele ?? ""}</td>
                  <td>{renderVin(u.niv)}</td>
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

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: "12px 8px" }}>
                    {rows.length === 0 ? "Aucune unité." : "Aucun résultat."}
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