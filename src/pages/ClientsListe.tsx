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
    const [{ data: clients, error: clientsError }, { data: unites, error: unitesError }] =
      await Promise.all([
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
        ? String(av).localeCompare(String(bv), "fr", {
            numeric: true,
            sensitivity: "base",
          })
        : String(bv).localeCompare(String(av), "fr", {
            numeric: true,
            sensitivity: "base",
          });
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

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ opacity: 0.35 }}>▼</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function renderSortableHeader(label: string, key: SortKey, alignRight = false) {
    return (
      <th style={alignRight ? styles.thRight : styles.th}>
        <button type="button" style={styles.sortBtn} onClick={() => handleSort(key)}>
          <span>{label}</span>
          <SortArrow col={key} />
        </button>
      </th>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.titleBlock}>
          <h1 style={styles.h1}>Clients</h1>
        </div>

        <div style={styles.topActions}>
          <button type="button" style={styles.primaryBtn} onClick={addClient} disabled={busy}>
            + Nouveau client
          </button>
        </div>
      </div>

      <div style={styles.toolbarCard}>
        <input
          style={styles.searchInput}
          placeholder="Recherche client, courriel, téléphone, nb unités..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          style={styles.select}
          value={String(pageSize)}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          <option value="10">10 / page</option>
          <option value="25">25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>

        <div style={styles.toolbarRight}>
          <div style={styles.resultsText}>
            {sortedRows.length} résultat{sortedRows.length > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div style={styles.tableShell}>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.theadRow}>
                {renderSortableHeader("Client", "nom")}
                {renderSortableHeader("Téléphone", "telephone")}
                {renderSortableHeader("Courriel", "courriel")}
                {renderSortableHeader("Unités", "nb_unites", true)}
              </tr>
            </thead>

            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div style={styles.emptyWrap}>
                      {rows.length === 0 ? "Aucun client." : "Aucun résultat."}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((c, index) => {
                  const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";

                  return (
                    <tr
                      key={c.id}
                      style={{ background: rowBg, cursor: "pointer" }}
                      onDoubleClick={() => nav(`/clients/${c.id}`)}
                    >
                      <td style={{ ...styles.td, background: rowBg }}>
  <div style={styles.clientName}>{c.nom}</div>
</td>

                      <td style={{ ...styles.td, background: rowBg }}>
                        <div style={styles.cellPrimary}>{c.telephone || "—"}</div>
                      </td>

                      <td style={{ ...styles.td, background: rowBg }}>
                        <div style={styles.cellPrimary}>{c.courriel || "—"}</div>
                      </td>

                      <td style={{ ...styles.tdRight, background: rowBg }}>
                        <div style={styles.cellPrimary}>{c.nb_unites}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.pagerWrap}>
          <div style={styles.pagerLeft}>
            <span style={styles.resultsText}>
              Affichage {fromRow} à {toRow} sur {sortedRows.length}
            </span>
          </div>

          <div style={styles.pagerRight}>
            <button
              type="button"
              style={page <= 1 ? styles.ghostBtnDisabled : styles.ghostBtn}
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              « Première
            </button>

            <button
              type="button"
              style={page <= 1 ? styles.ghostBtnDisabled : styles.ghostBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ‹ Précédente
            </button>

            <button type="button" style={styles.primaryBtn}>
              Page {page} / {totalPages}
            </button>

            <button
              type="button"
              style={page >= totalPages ? styles.ghostBtnDisabled : styles.ghostBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Suivante ›
            </button>

            <button
              type="button"
              style={page >= totalPages ? styles.ghostBtnDisabled : styles.ghostBtn}
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              Dernière »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  page: {
    width: "100%",
    padding: 20,
    background: "#f5f7fb",
    minHeight: "100%",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },

  titleBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  h1: {
    margin: 0,
    fontSize: 30,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryBtn: {
    height: 40,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 1px 0 rgba(255,255,255,.22) inset",
  },

  ghostBtn: {
    height: 40,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #d6dbe7",
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },

  ghostBtnDisabled: {
    height: 40,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: 800,
    cursor: "not-allowed",
  },

  toolbarCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    boxShadow: "0 10px 24px rgba(15,23,42,.04)",
  },

  searchInput: {
    height: 44,
    borderRadius: 14,
    border: "1px solid #d6dbe7",
    background: "#fff",
    padding: "0 14px",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    minWidth: 280,
    flex: 1,
  },

  select: {
    height: 44,
    borderRadius: 14,
    border: "1px solid #d6dbe7",
    background: "#fff",
    padding: "0 12px",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    minWidth: 160,
  },

  toolbarRight: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  resultsText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  tableShell: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(15,23,42,.04)",
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: 900,
    borderCollapse: "separate",
    borderSpacing: 0,
    tableLayout: "fixed",
  },

  theadRow: {
    background: "#f8fafc",
  },

  th: {
    padding: "16px 14px",
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    textAlign: "left",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
    background: "#f8fafc",
  },

  thRight: {
    padding: "16px 14px",
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    textAlign: "right",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
    background: "#f8fafc",
  },

  td: {
    padding: "16px 14px",
    fontSize: 14,
    color: "#0f172a",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    fontWeight: 400,
  },

  tdRight: {
    padding: "16px 14px",
    fontSize: 14,
    color: "#0f172a",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    fontWeight: 400,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },

  sortBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    padding: 0,
    margin: 0,
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
    fontWeight: 900,
  },

  clientName: {
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  cellPrimary: {
    fontWeight: 400,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  cellMuted: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontWeight: 400,
  },

  pagerWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: 16,
    background: "#fff",
  },

  pagerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  pagerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  emptyWrap: {
    padding: 28,
    textAlign: "center",
    color: "#64748b",
    fontWeight: 700,
  },
};