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
  client_id?: string | null;
};

type Client = {
  id: string;
  nom: string;
};

type SortKey = "no_unite" | "marque" | "modele" | "niv" | "km_actuel" | "client";
type SortDir = "asc" | "desc";

export default function UnitesListe() {
  const nav = useNavigate();

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Unite[]>([]);
  const [clientsById, setClientsById] = useState<Record<string, Client>>({});
  const [search, setSearch] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("no_unite");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  async function load() {
    const [{ data: unitesData, error: unitesError }, { data: clientsData, error: clientsError }] =
      await Promise.all([
        supabase
          .from("unites")
          .select("id, no_unite, marque, modele, niv, km_actuel, client_id")
          .order("no_unite"),
        supabase.from("clients").select("id, nom"),
      ]);

    if (unitesError) {
      alert(unitesError.message);
      return;
    }

    if (clientsError) {
      alert(clientsError.message);
      return;
    }

    const clientsMap: Record<string, Client> = {};
    for (const c of ((clientsData as Client[]) ?? [])) {
      clientsMap[c.id] = c;
    }

    setClientsById(clientsMap);
    setRows((unitesData as Unite[]) ?? []);
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

      nav(`/unites/${data.id}?edit=1`);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resolveClientName(u: Unite) {
    if (!u.client_id) return "—";
    return clientsById[u.client_id]?.nom || "—";
  }

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
      case "client":
        return resolveClientName(row);
      default:
        return "";
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((u) => {
      const client = resolveClientName(u);
      const haystack = [
        u.no_unite,
        u.marque ?? "",
        u.modele ?? "",
        u.niv ?? "",
        u.km_actuel != null ? String(u.km_actuel) : "",
        client,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, search, clientsById]);

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

  function renderSortableHeader(label: string, key: SortKey, alignRight = false, minWidth?: number) {
    return (
      <th style={{ ...(alignRight ? styles.thRight : styles.th), ...(minWidth ? { minWidth } : {}) }}>
        <button type="button" style={styles.sortBtn} onClick={() => handleSort(key)}>
          <span>{label}</span>
          <SortArrow col={key} />
        </button>
      </th>
    );
  }

  function renderVin(niv: string | null) {
    if (!niv) return "—";

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

  function formatKm(value: number | null) {
    if (value == null) return "—";
    return new Intl.NumberFormat("fr-CA").format(value);
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.titleBlock}>
          <h1 style={styles.h1}>Unités</h1>
        </div>

        <div style={styles.topActions}>
          <button type="button" style={styles.primaryBtn} onClick={addUnite} disabled={busy}>
            + Nouvelle unité
          </button>
        </div>
      </div>

      <div style={styles.toolbarCard}>
        <input
          style={styles.searchInput}
          placeholder="Recherche unité, client, marque, modèle, VIN, kilométrage..."
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
                {renderSortableHeader("Unité", "no_unite", false, 160)}
                {renderSortableHeader("Client", "client", false, 220)}
                {renderSortableHeader("Marque", "marque", false, 170)}
                {renderSortableHeader("Modèle", "modele", false, 220)}
                {renderSortableHeader("VIN", "niv", false, 260)}
                {renderSortableHeader("KM", "km_actuel", true, 150)}
              </tr>
            </thead>

            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div style={styles.emptyWrap}>
                      {rows.length === 0 ? "Aucune unité." : "Aucun résultat."}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((u, index) => {
                  const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
                  const client = resolveClientName(u);

                  return (
                    <tr
                      key={u.id}
                      style={{ background: rowBg, cursor: "pointer" }}
                      onDoubleClick={() => nav(`/unites/${u.id}`)}
                    >
                      <td style={{ ...styles.td, background: rowBg }}>
                        <div style={styles.mainValue}>{u.no_unite}</div>
                      </td>

                      <td style={{ ...styles.td, background: rowBg }}>
                        <div style={styles.cellPrimary}>{client}</div>
                      </td>

                      <td style={{ ...styles.td, background: rowBg }}>
                        <div style={styles.cellPrimary}>{u.marque || "—"}</div>
                      </td>

                      <td style={{ ...styles.td, background: rowBg }}>
                        <div style={styles.cellPrimary}>{u.modele || "—"}</div>
                      </td>

                      <td style={{ ...styles.td, background: rowBg }}>
                        <div style={styles.cellPrimary}>{renderVin(u.niv)}</div>
                      </td>

                      <td style={{ ...styles.tdRight, background: rowBg, paddingRight: 24, minWidth: 150 }}>
                        <div style={styles.cellPrimary}>{formatKm(u.km_actuel)}</div>
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
  minWidth: 980,
  borderCollapse: "separate",
  borderSpacing: 0,
  tableLayout: "auto",
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

  mainValue: {
    color: "#0f172a",
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  cellPrimary: {
    fontWeight: 400,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
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