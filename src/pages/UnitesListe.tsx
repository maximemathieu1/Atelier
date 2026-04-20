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

type SortKey = "no_unite" | "marque" | "modele" | "niv" | "km_actuel";
type SortDir = "asc" | "desc";

export default function UnitesListe() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Unite[]>([]);
  const [search, setSearch] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("no_unite");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function getSortValue(row: Unite, key: SortKey) {
    switch (key) {
      case "no_unite":
        return row.no_unite ?? "";
      case "marque":
        return row.marque ?? "";
      case "modele":
        return row.modele ?? "";
      case "niv":
        return row.niv ?? "";
      case "km_actuel":
        return row.km_actuel ?? 0;
      default:
        return "";
    }
  }

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

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];

    copy.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }

      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "fr", { numeric: true, sensitivity: "base" })
        : String(bv).localeCompare(String(av), "fr", { numeric: true, sensitivity: "base" });
    });

    return copy;
  }, [filteredRows, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const fromRow = sortedRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, sortedRows.length);

  function renderSortArrow(key: SortKey) {
    if (sortKey !== key) return <span style={{ opacity: 0.35 }}>↕</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

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

        <div style={{ marginTop: 12, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--line, #d0d7de)",
              background: "var(--card, #fff)",
              outline: "none",
            }}
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort("no_unite")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    No unité {renderSortArrow("no_unite")}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("marque")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Marque {renderSortArrow("marque")}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("modele")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Modèle {renderSortArrow("modele")}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("niv")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    VIN {renderSortArrow("niv")}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("km_actuel")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    KM {renderSortArrow("km_actuel")}
                  </span>
                </th>
                <th style={{ width: 160 }} />
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((u) => (
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

              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: "12px 8px" }}>
                    {rows.length === 0 ? "Aucune unité." : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
  style={{
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px solid rgba(0,0,0,.08)",
  }}
>
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <span className="muted">
      Affichage {fromRow} à {toRow} sur {sortedRows.length}
    </span>
  </div>

  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    <button
      type="button"
      className="ghost"
      style={{
        opacity: page <= 1 ? 0.5 : 1,
        cursor: page <= 1 ? "not-allowed" : "pointer",
      }}
      disabled={page <= 1}
      onClick={() => setPage(1)}
    >
      « Première
    </button>

    <button
      type="button"
      className="ghost"
      style={{
        opacity: page <= 1 ? 0.5 : 1,
        cursor: page <= 1 ? "not-allowed" : "pointer",
      }}
      disabled={page <= 1}
      onClick={() => setPage((p) => Math.max(1, p - 1))}
    >
      ‹ Précédente
    </button>

    <button
      type="button"
      className="ghost"
      style={{
        fontWeight: 900,
        border: "1px solid #2563eb",
        background: "#2563eb",
        color: "#fff",
      }}
    >
      Page {page} / {totalPages}
    </button>

    <button
      type="button"
      className="ghost"
      style={{
        opacity: page >= totalPages ? 0.5 : 1,
        cursor: page >= totalPages ? "not-allowed" : "pointer",
      }}
      disabled={page >= totalPages}
      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
    >
      Suivante ›
    </button>

    <button
      type="button"
      className="ghost"
      style={{
        opacity: page >= totalPages ? 0.5 : 1,
        cursor: page >= totalPages ? "not-allowed" : "pointer",
      }}
      disabled={page >= totalPages}
      onClick={() => setPage(totalPages)}
    >
      Dernière »
    </button>
  </div>
</div>

        <div className="hint">Clique une unité pour ouvrir sa fiche + notes mécaniques.</div>
      </div>
    </div>
  );
}