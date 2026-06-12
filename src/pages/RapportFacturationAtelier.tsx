import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../lib/supabaseClient";

type BtRow = {
  id: string;
  numero: string | null;
  statut: string | null;
  unite_id: string | null;
  client_nom: string | null;
  date_fermeture: string | null;
  date_ouverture: string | null;
  total_pieces: number | null;
  total_main_oeuvre: number | null;
  total_frais_atelier: number | null;
  total_general: number | null;
};

type UniteRow = {
  id: string;
  no_unite: string | null;
};

type ParametresEntrepriseRow = {
  tps_rate: number | string | null;
  tvq_rate: number | string | null;
};

function money(v: number) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(v || 0);
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

function toRate(v: number | string | null | undefined, fallback: number) {
  const n = Number(String(v ?? fallback).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function hideIframeSidebar(iframe: HTMLIFrameElement | null) {
  if (!iframe) return;

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const styleId = "bt-modal-hide-sidebar-style";
    if (doc.getElementById(styleId)) return;

    const style = doc.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      .sidebar,
      .drawer-backdrop,
      .mobile-topbar {
        display: none !important;
      }

      .app-shell {
        display: block !important;
      }

      .content,
      main.content {
        margin-left: 0 !important;
        width: 100% !important;
        max-width: none !important;
        padding-left: 0 !important;
      }

      body {
        overflow: auto !important;
      }
    `;

    doc.head.appendChild(style);
  } catch (e) {
    console.warn("Impossible de masquer le menu dans le iframe BT", e);
  }
}

export default function RapportFacturationAtelier() {
  const now = new Date();

  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  const [compagnieFilter, setCompagnieFilter] = useState("toutes");

  const [tpsRate, setTpsRate] = useState(0.05);
  const [tvqRate, setTvqRate] = useState(0.09975);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<BtRow[]>([]);
  const [unitesById, setUnitesById] = useState<Record<string, UniteRow>>({});
  const [btModalId, setBtModalId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const { data: paramData, error: paramError } = await supabase
        .from("parametres_entreprise")
        .select("tps_rate,tvq_rate")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paramError) throw paramError;

      if (paramData) {
        const p = paramData as ParametresEntrepriseRow;
        setTpsRate(toRate(p.tps_rate, 0.05));
        setTvqRate(toRate(p.tvq_rate, 0.09975));
      }

      const start = `${annee}-${String(mois).padStart(2, "0")}-01T04:00:00.000Z`;
      const end = new Date(Date.UTC(annee, mois, 1, 4, 0, 0, 0)).toISOString();

      const { data: btData, error: btError } = await supabase
        .from("bons_travail")
        .select(`
          id,
          numero,
          statut,
          unite_id,
          client_nom,
          date_ouverture,
          date_fermeture,
          total_pieces,
          total_main_oeuvre,
          total_frais_atelier,
          total_general
        `)
        .eq("statut", "facture")
        .gte("date_fermeture", start)
        .lt("date_fermeture", end)
        .order("date_fermeture", { ascending: true });

      if (btError) throw btError;

      const btRows = (btData || []) as BtRow[];
      setRows(btRows);

      const uniteIds = Array.from(
        new Set(btRows.map((r) => r.unite_id).filter(Boolean) as string[]),
      );

      if (uniteIds.length > 0) {
        const { data: uniteData, error: uniteError } = await supabase
          .from("unites")
          .select("id,no_unite")
          .in("id", uniteIds);

        if (uniteError) throw uniteError;

        const map: Record<string, UniteRow> = {};
        for (const u of (uniteData || []) as UniteRow[]) {
          map[u.id] = u;
        }
        setUnitesById(map);
      } else {
        setUnitesById({});
      }
    } catch (e: any) {
      setErr(e?.message || "Erreur chargement rapport");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [mois, annee]);

  const compagnies = useMemo(() => {
    return Array.from(
      new Set(rows.map((r) => r.client_nom?.trim() || "Sans compagnie")),
    ).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (compagnieFilter === "toutes") return rows;

    return rows.filter(
      (r) => (r.client_nom?.trim() || "Sans compagnie") === compagnieFilter,
    );
  }, [rows, compagnieFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, BtRow[]>();

    for (const row of filteredRows) {
      const compagnie = row.client_nom?.trim() || "Sans compagnie";
      if (!map.has(compagnie)) map.set(compagnie, []);
      map.get(compagnie)!.push(row);
    }

    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "fr", { sensitivity: "base" }),
    );
  }, [filteredRows]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        const piecesAtelier =
          Number(row.total_pieces || 0) +
          Number(row.total_frais_atelier || 0);
        const mainOeuvre = Number(row.total_main_oeuvre || 0);
        const total = Number(row.total_general || piecesAtelier + mainOeuvre);

        acc.piecesAtelier += piecesAtelier;
        acc.mainOeuvre += mainOeuvre;
        acc.total += total;

        return acc;
      },
      { piecesAtelier: 0, mainOeuvre: 0, total: 0 },
    );
  }, [filteredRows]);

  const totalTaxesIncluses = totals.total * (1 + tpsRate + tvqRate);

  const styles: Record<string, CSSProperties> = {
    page: { padding: 20, background: "#f5f7fb", minHeight: "100%" },
    top: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      margin: 0,
      fontSize: 30,
      fontWeight: 950,
      color: "#0f172a",
    },
    subtitle: { color: "#64748b", fontWeight: 600, marginTop: 4 },
    filters: { display: "flex", gap: 10, flexWrap: "wrap" },
    select: {
      height: 42,
      borderRadius: 12,
      border: "1px solid #d6dbe7",
      background: "#fff",
      padding: "0 12px",
      fontWeight: 800,
    },
    card: {
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 18,
      boxShadow: "0 10px 24px rgba(15,23,42,.04)",
      overflow: "hidden",
      marginBottom: 16,
    },
    groupTitle: {
      padding: "14px 16px",
      background: "#f8fafc",
      borderBottom: "1px solid #e2e8f0",
      fontWeight: 950,
      fontSize: 18,
    },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      textAlign: "left",
      padding: "12px 14px",
      fontSize: 13,
      fontWeight: 900,
      borderBottom: "1px solid #e2e8f0",
      whiteSpace: "nowrap",
    },
    thAmount: {
      textAlign: "right",
      padding: "12px 14px",
      fontSize: 13,
      fontWeight: 900,
      borderBottom: "1px solid #e2e8f0",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "12px 14px",
      borderBottom: "1px solid #eef2f7",
      whiteSpace: "nowrap",
    },
    tdAmount: {
      padding: "12px 14px",
      borderBottom: "1px solid #eef2f7",
      textAlign: "right",
      whiteSpace: "nowrap",
      fontVariantNumeric: "tabular-nums",
    },
    rowClickable: {
      cursor: "pointer",
    },
    subtotal: { background: "#f8fafc", fontWeight: 950 },
    error: {
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      color: "#9f1239",
      padding: 12,
      borderRadius: 14,
      marginBottom: 12,
      fontWeight: 800,
    },
    totalCard: {
      background: "#0f172a",
      color: "#fff",
      borderRadius: 18,
      padding: 18,
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
      gap: 14,
    },
    totalLabel: {
      color: "rgba(255,255,255,.72)",
      fontSize: 13,
      fontWeight: 800,
      marginBottom: 6,
    },
    totalValue: { fontSize: 22, fontWeight: 950 },
    btModalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.62)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 10,
    },
    btModalCard: {
      width: "80vw",
      height: "90vh",
      background: "#fff",
      borderRadius: 18,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 28px 80px rgba(0,0,0,.30)",
    },
    btModalHeader: {
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      borderBottom: "1px solid #e2e8f0",
      fontWeight: 900,
      flex: "0 0 auto",
    },
    btModalBody: {
      flex: "1 1 auto",
      minHeight: 0,
    },
    btCloseBtn: {
      border: "1px solid #e2e8f0",
      background: "#fff",
      color: "#0f172a",
      width: 38,
      height: 38,
      borderRadius: 12,
      cursor: "pointer",
      fontSize: 20,
      fontWeight: 950,
      lineHeight: 1,
    },
  };

  const monthOptions = [
    [1, "Janvier"],
    [2, "Février"],
    [3, "Mars"],
    [4, "Avril"],
    [5, "Mai"],
    [6, "Juin"],
    [7, "Juillet"],
    [8, "Août"],
    [9, "Septembre"],
    [10, "Octobre"],
    [11, "Novembre"],
    [12, "Décembre"],
  ];

  return (
    <div style={styles.page}>
      <div style={styles.top}>
        <div>
          <h1 style={styles.title}>Rapport facturation atelier</h1>
          <div style={styles.subtitle}>
            Rapport interne par compagnie — pièces + frais atelier, main-d’œuvre
          </div>
        </div>

        <div style={styles.filters}>
          <select
            style={styles.select}
            value={mois}
            onChange={(e) => setMois(Number(e.target.value))}
          >
            {monthOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            style={styles.select}
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 4 + i).map(
              (y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ),
            )}
          </select>

          <select
            style={styles.select}
            value={compagnieFilter}
            onChange={(e) => setCompagnieFilter(e.target.value)}
          >
            <option value="toutes">Toutes les compagnies</option>
            {compagnies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err ? <div style={styles.error}>Erreur : {err}</div> : null}

      {loading ? (
        <div style={styles.card}>
          <div style={{ padding: 20, fontWeight: 800 }}>Chargement…</div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div style={styles.card}>
          <div style={{ padding: 20, color: "#64748b", fontWeight: 800 }}>
            Aucun BT facturé pour cette période.
          </div>
        </div>
      ) : (
        <>
          {grouped.map(([compagnie, items]) => {
            const sub = items.reduce(
              (acc, row) => {
                const piecesAtelier =
                  Number(row.total_pieces || 0) +
                  Number(row.total_frais_atelier || 0);
                const mainOeuvre = Number(row.total_main_oeuvre || 0);
                const total = Number(row.total_general || piecesAtelier + mainOeuvre);

                acc.piecesAtelier += piecesAtelier;
                acc.mainOeuvre += mainOeuvre;
                acc.total += total;

                return acc;
              },
              { piecesAtelier: 0, mainOeuvre: 0, total: 0 },
            );

            return (
              <div key={compagnie} style={styles.card}>
                <div style={styles.groupTitle}>{compagnie}</div>

                <div style={{ overflowX: "auto" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date fermeture</th>
                        <th style={styles.th}>BT / Facture</th>
                        <th style={styles.th}>Unité</th>
                        <th style={styles.thAmount}>Pièces + frais atelier</th>
                        <th style={styles.thAmount}>Main-d’œuvre</th>
                        <th style={styles.thAmount}>Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((row) => {
                        const piecesAtelier =
                          Number(row.total_pieces || 0) +
                          Number(row.total_frais_atelier || 0);
                        const mainOeuvre = Number(row.total_main_oeuvre || 0);
                        const total = Number(
                          row.total_general || piecesAtelier + mainOeuvre,
                        );
                        const uniteNo = row.unite_id
                          ? unitesById[row.unite_id]?.no_unite
                          : null;

                        return (
                          <tr
                            key={row.id}
                            style={styles.rowClickable}
                            title="Double-cliquer pour ouvrir le BT"
                            onDoubleClick={() => setBtModalId(row.id)}
                          >
                            <td style={styles.td}>{fmtDate(row.date_fermeture)}</td>
                            <td style={styles.td}>{row.numero || "—"}</td>
                            <td style={styles.td}>{uniteNo || "—"}</td>
                            <td style={styles.tdAmount}>{money(piecesAtelier)}</td>
                            <td style={styles.tdAmount}>{money(mainOeuvre)}</td>
                            <td style={styles.tdAmount}>{money(total)}</td>
                          </tr>
                        );
                      })}

                      <tr style={styles.subtotal}>
                        <td style={styles.td} colSpan={3}>
                          Sous-total {compagnie}
                        </td>
                        <td style={styles.tdAmount}>{money(sub.piecesAtelier)}</td>
                        <td style={styles.tdAmount}>{money(sub.mainOeuvre)}</td>
                        <td style={styles.tdAmount}>{money(sub.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <div style={styles.totalCard}>
            <div>
              <div style={styles.totalLabel}>Total pièces + frais atelier</div>
              <div style={styles.totalValue}>{money(totals.piecesAtelier)}</div>
            </div>

            <div>
              <div style={styles.totalLabel}>Total main-d’œuvre</div>
              <div style={styles.totalValue}>{money(totals.mainOeuvre)}</div>
            </div>

            <div>
              <div style={styles.totalLabel}>Total global</div>
              <div style={styles.totalValue}>{money(totals.total)}</div>
            </div>

            <div>
              <div style={styles.totalLabel}>Total taxes incluses</div>
              <div style={styles.totalValue}>{money(totalTaxesIncluses)}</div>
            </div>
          </div>
        </>
      )}

      {btModalId && (
        <div style={styles.btModalOverlay} onClick={() => setBtModalId(null)}>
          <div style={styles.btModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.btModalHeader}>
              <span>Bon de travail</span>

              <button
                type="button"
                style={styles.btCloseBtn}
                onClick={() => setBtModalId(null)}
                title="Fermer"
              >
                ×
              </button>
            </div>

            <div style={styles.btModalBody}>
              <iframe
                src={`/bt/${btModalId}`}
                title="Bon de travail"
                onLoad={(e) => hideIframeSidebar(e.currentTarget)}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  display: "block",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}