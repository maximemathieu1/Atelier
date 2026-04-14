// src/pages/Parametres.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Categorie = "type_unite" | "motorisation" | "freins" | "suspension";

type OptionRow = {
  id: string;
  categorie: Categorie;
  libelle: string;
  ordre: number;
  actif: boolean;
  created_at?: string;
};

const CATS: { key: Categorie; label: string }[] = [
  { key: "type_unite", label: "Types d’unité" },
  { key: "motorisation", label: "Motorisation" },
  { key: "freins", label: "Freins" },
  { key: "suspension", label: "Suspension" },
];

function normInt(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export default function Parametres() {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<OptionRow[]>([]);
  const [filterCat, setFilterCat] = useState<Categorie | "all">("all");

  // Form ajout
  const [newCat, setNewCat] = useState<Categorie>("type_unite");
  const [newLibelle, setNewLibelle] = useState("");
  const [newOrdre, setNewOrdre] = useState<number>(0);
  const [newActif, setNewActif] = useState(true);

  const grouped = useMemo(() => {
    const map = new Map<Categorie, OptionRow[]>();
    for (const c of CATS) map.set(c.key, []);
    for (const r of rows) map.get(r.categorie)?.push(r);

    for (const c of CATS) {
      const arr = map.get(c.key) ?? [];
      arr.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.libelle.localeCompare(b.libelle));
    }
    return map;
  }, [rows]);

  async function load() {
    const { data, error } = await supabase
      .from("unite_options")
      .select("id,categorie,libelle,ordre,actif,created_at")
      .order("categorie", { ascending: true })
      .order("ordre", { ascending: true })
      .order("libelle", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }
    setRows((data as any) ?? []);
  }

  async function add() {
    const lib = newLibelle.trim();
    if (!lib || busy) return;

    setBusy(true);
    try {
      const payload = {
        categorie: newCat,
        libelle: lib,
        ordre: normInt(newOrdre, 0),
        actif: Boolean(newActif),
      };

      const { error } = await supabase.from("unite_options").insert(payload);
      if (error) throw error;

      setNewLibelle("");
      setNewOrdre(0);
      setNewActif(true);
      await load();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveRow(r: OptionRow) {
    if (busy) return;
    setBusy(true);
    try {
      const payload = {
        categorie: r.categorie,
        libelle: (r.libelle ?? "").trim(),
        ordre: normInt(r.ordre, 0),
        actif: Boolean(r.actif),
      };

      if (!payload.libelle) throw new Error("Libellé requis.");

      const { error } = await supabase.from("unite_options").update(payload).eq("id", r.id);
      if (error) throw error;

      await load();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    if (!confirm("Supprimer cet élément ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("unite_options").delete().eq("id", id);
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
      <div className="page-header">
        <div className="page-title">
          <h1 style={{ margin: 0 }}>Paramètres</h1>
          <div className="muted">Gestion des listes déroulantes (Unités) + base pour les futurs réglages.</div>
        </div>

        <div className="page-actions">
          <button className="btn" onClick={load} disabled={busy} type="button">
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Bloc ajout */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Ajouter un élément</div>
            <div className="card-subtitle">Ex: “Autobus 12 rangées”, “Diesel”, “Air”, etc.</div>
          </div>
        </div>

        <div className="inline-form" style={{ marginTop: 8 }}>
          <div className="field">
            <div className="label">Catégorie</div>
            <select className="input" value={newCat} onChange={(e) => setNewCat(e.target.value as Categorie)}>
              {CATS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <div className="label">Libellé</div>
            <input className="input" value={newLibelle} onChange={(e) => setNewLibelle(e.target.value)} placeholder="Ex: Diesel" />
          </div>

          <div className="field" style={{ maxWidth: 180 }}>
            <div className="label">Ordre</div>
            <input
              className="input"
              value={String(newOrdre)}
              onChange={(e) => setNewOrdre(normInt(e.target.value, 0))}
              inputMode="numeric"
              placeholder="0"
            />
          </div>

          <label className="checkline" style={{ marginTop: 22 }}>
            <input type="checkbox" checked={newActif} onChange={(e) => setNewActif(e.target.checked)} />
            <span>Actif</span>
          </label>

          <button className="btn-primary" onClick={add} disabled={busy} type="button" style={{ alignSelf: "end" }}>
            Ajouter
          </button>
        </div>
      </div>

      {/* Filtre */}
      <div className="toolbar">
        <div className="filters">
          <button className={"filter-btn" + (filterCat === "all" ? " active" : "")} onClick={() => setFilterCat("all")} type="button">
            Tout
          </button>
          {CATS.map((c) => (
            <button
              key={c.key}
              className={"filter-btn" + (filterCat === c.key ? " active" : "")}
              onClick={() => setFilterCat(c.key)}
              type="button"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listes */}
      {CATS.filter((c) => filterCat === "all" || c.key === filterCat).map((c) => {
        const list = grouped.get(c.key) ?? [];
        return (
          <div className="card" key={c.key} style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">{c.label}</div>
                <div className="card-subtitle">Ordre + activation. (Les unités verront seulement les éléments actifs.)</div>
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="list">
                <thead>
                  <tr>
                    <th style={{ width: 220 }}>Libellé</th>
                    <th style={{ width: 110 }}>Ordre</th>
                    <th style={{ width: 90 }}>Actif</th>
                    <th style={{ width: 220 }} />
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr className="row" key={r.id}>
                      <td>
                        <input
                          className="input"
                          value={r.libelle ?? ""}
                          onChange={(e) =>
                            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, libelle: e.target.value } : x)))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={String(r.ordre ?? 0)}
                          inputMode="numeric"
                          onChange={(e) =>
                            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ordre: normInt(e.target.value, 0) } : x)))
                          }
                        />
                      </td>
                      <td>
                        <label className="checkline">
                          <input
                            type="checkbox"
                            checked={Boolean(r.actif)}
                            onChange={(e) =>
                              setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, actif: e.target.checked } : x)))
                            }
                          />
                          <span />
                        </label>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn" onClick={() => saveRow(r)} disabled={busy} type="button">
                          Enregistrer
                        </button>
                        <button className="btn btn-danger" onClick={() => remove(r.id)} disabled={busy} type="button" style={{ marginLeft: 8 }}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}

                  {list.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        Aucun élément.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="hint">Astuce: mets Ordre = 10, 20, 30… pour insérer facilement plus tard.</div>
          </div>
        );
      })}
    </div>
  );
}