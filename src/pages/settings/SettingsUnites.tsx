// src/pages/settings/SettingsUnites.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Categorie = "type_unite" | "motorisation" | "freins" | "suspension";

type OptionRow = {
  id: string;
  categorie: Categorie;
  libelle: string;
  ordre: number;
  actif: boolean;
  created_at: string;
};

const CAT_LABEL: Record<Categorie, string> = {
  type_unite: "Type",
  motorisation: "Motorisation",
  freins: "Freins",
  suspension: "Suspension",
};

export default function SettingsUnites() {
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState<Categorie>("type_unite");

  const [rows, setRows] = useState<OptionRow[]>([]);
  const [libelle, setLibelle] = useState("");

  const filtered = useMemo(() => rows.filter((r) => r.categorie === cat), [rows, cat]);

  async function load() {
    const { data, error } = await supabase
      .from("unite_options")
      .select("id,categorie,libelle,ordre,actif,created_at")
      .order("categorie", { ascending: true })
      .order("ordre", { ascending: true })
      .order("libelle", { ascending: true });

    if (error) return alert(error.message);
    setRows((data as any) ?? []);
  }

  async function add() {
    const name = libelle.trim();
    if (!name || busy) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("unite_options").insert({
        categorie: cat,
        libelle: name,
        ordre: 0,
        actif: true,
      });
      if (error) throw error;

      setLibelle("");
      await load(); // ✅ refresh immédiat
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActif(r: OptionRow) {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("unite_options").update({ actif: !r.actif }).eq("id", r.id);
      if (error) throw error;
      await load(); // ✅ refresh immédiat
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function rename(r: OptionRow) {
    if (busy) return;
    const next = prompt("Nouveau libellé :", r.libelle);
    if (next === null) return;
    const v = next.trim();
    if (!v) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("unite_options").update({ libelle: v }).eq("id", r.id);
      if (error) throw error;
      await load(); // ✅ refresh immédiat
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: OptionRow) {
    if (busy) return;
    if (!confirm(`Supprimer "${r.libelle}" ?`)) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("unite_options").delete().eq("id", r.id);
      if (error) throw error;
      await load(); // ✅ refresh immédiat
    } catch (e: any) {
      alert(
        (e?.message ?? String(e)) +
          "\n\nNote: si cette option est utilisée par une unité, la suppression peut être bloquée. Dans ce cas, désactive-la plutôt."
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Paramètres — Unités</div>
          <div className="card-subtitle">Gère les listes déroulantes (Type, Motorisation, Freins, Suspension)</div>
        </div>

        <button className="ghost" onClick={load} disabled={busy} type="button">
          Rafraîchir
        </button>
      </div>

      <div className="tabs" style={{ marginTop: 8 }}>
        {(["type_unite", "motorisation", "freins", "suspension"] as Categorie[]).map((c) => (
          <button key={c} className={"tab" + (cat === c ? " active" : "")} onClick={() => setCat(c)} type="button">
            {CAT_LABEL[c]}
          </button>
        ))}
      </div>

      <div className="toolbar" style={{ marginTop: 10 }}>
        <input
          className="input"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder={`Ajouter un item (${CAT_LABEL[cat]})`}
        />
        <button className="btn-primary" onClick={add} disabled={busy} type="button">
          Ajouter
        </button>
      </div>

      <div className="table-wrap">
        <table className="list">
          <thead>
            <tr>
              <th>Libellé</th>
              <th>Actif</th>
              <th>Ordre</th>
              <th>Créé</th>
              <th style={{ width: 260, textAlign: "right" }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr className="row" key={r.id}>
                <td style={{ fontWeight: 900 }}>{r.libelle}</td>
                <td>{r.actif ? "Oui" : "Non"}</td>
                <td className="mono">{r.ordre}</td>
                <td className="muted">{new Date(r.created_at).toLocaleDateString("fr-CA")}</td>
                <td style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                  <button className="ghost" style={{ borderStyle: "solid" }} onClick={() => toggleActif(r)} disabled={busy} type="button">
                    {r.actif ? "Désactiver" : "Activer"}
                  </button>
                  <button className="ghost" style={{ borderStyle: "solid" }} onClick={() => rename(r)} disabled={busy} type="button">
                    Renommer
                  </button>
                  <button className="ghost" style={{ borderStyle: "solid" }} onClick={() => remove(r)} disabled={busy} type="button">
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun item pour {CAT_LABEL[cat]}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="hint">
        Astuce : si une option est déjà utilisée par une unité, préfère <b>Désactiver</b> plutôt que supprimer.
      </div>
    </div>
  );
}