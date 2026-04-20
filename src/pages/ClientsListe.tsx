import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Client = {
  id: string;
  nom: string;
  courriel: string | null;
  telephone: string | null;
};

type ClientRow = Client & {
  nb_unites: number;
};

type SortKey = "nom" | "courriel" | "telephone" | "nb_unites";
type SortDir = "asc" | "desc";

export default function ClientsListe() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("nom");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  async function load() {
    const [{ data: clients, error: clientsError }, { data: unites, error: unitesError }] = await Promise.all([
      supabase.from("clients").select("id, nom, courriel, telephone").order("nom"),
      supabase.from("unites").select("client_id").not("client_id", "is", null),
    ]);

    if (clientsError) {
      alert(clientsError.message);
      return;
    }

    if (unitesError) {
      alert(unitesError.message);
      return;
    }

    const counts = new Map<string, number>();

    for (const u of (unites as Array<{ client_id: string | null }> | null) ?? []) {
      if (!u.client_id) continue;
      counts.set(u.client_id, (counts.get(u.client_id) ?? 0) + 1);
    }

    const merged: ClientRow[] = ((clients as Client[]) ?? []).map((c) => ({
      ...c,
      nb_unites: counts.get(c.id) ?? 0,
    }));

    setRows(merged);
  }

  async function addClient() {
    if (busy) return;

    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({ nom: "Nouveau client" })
        .select("id")
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error("Impossible de créer le client.");

      nav(`/clients/${data.id}?edit=1`);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeClient(id: string) {
    if (busy) return;
    if (!confirm("Supprimer ce client ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
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

  function getSortValue(row: ClientRow, key: SortKey) {
    switch (key) {
      case "nom":
        return row.nom ?? "";
      case "courriel":
        return row.courriel ?? "";
      case "telephone":
        return row.telephone ?? "";
      case "nb_unites":
        return row.nb_unites ?? 0;
      default:
        return "";
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((c) => {
      const haystack = [c.nom, c.courriel ?? "", c.telephone ?? "", String(c.nb_unites)]
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
          <h1>Clients</h1>
          <div className="muted">Gestion des clients atelier</div>
        </div>

        <button className="ghost" onClick={load} disabled={busy} type="button">
          Rafraîchir
        </button>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="toolbar" style={{ justifyContent: "flex-start" }}>
          <button className="btn-primary" onClick={addClient} disabled={busy} type="button">
            Ajouter client
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            marginBottom: 14,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, courriel, téléphone ou nb unités..."
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
                  onClick={() => handleSort("nom")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Nom {renderSortArrow("nom")}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("courriel")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Courriel {renderSortArrow("courriel")}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("telephone")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Téléphone {renderSortArrow("telephone")}
                  </span>
                </th>
                <th
                  onClick={() => handleSort("nb_unites")}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Nb unités {renderSortArrow("nb_unites")}
                  </span>
                </th>
                <th style={{ width: 160 }} />
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((c) => (
                <tr
                  className="row"
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => nav(`/clients/${c.id}`)}
                >
                  <td style={{ fontWeight: 800 }}>{c.nom}</td>
                  <td>{c.courriel ?? ""}</td>
                  <td>{c.telephone ?? ""}</td>
                  <td style={{ fontWeight: 800 }}>{c.nb_unites}</td>
                  <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="ghost"
                      style={{ borderStyle: "solid" }}
                      disabled={busy}
                      onClick={() => removeClient(c.id)}
                      type="button"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}

              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: "12px 8px" }}>
                    {rows.length === 0 ? "Aucun client." : "Aucun résultat."}
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

        <div className="hint">Clique un client pour ouvrir sa fiche.</div>
      </div>
    </div>
  );
}