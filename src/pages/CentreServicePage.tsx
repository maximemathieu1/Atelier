import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Fabricant = "Lion" | "Girardin" | "Thomas";
type Payeur = "client" | "fabricant" | "partage";

type CentreServiceRow = {
  id: string;
  bt_id: string;
  fabricant: Fabricant;
  numero_case: string | null;
  numero_reclamation: string | null;
  statut: string;
  payeur: Payeur;
  preautorisation: string | null;
  date_ouverture: string | null;
  date_fermeture: string | null;
  commentaires: string | null;
  updated_at: string | null;
  bons_travail?: {
    id: string;
    numero: string | null;
    unite_id: string;
    client_nom: string | null;
    statut: string;
    unites?: {
      no_unite: string | null;
      marque: string | null;
      modele: string | null;
      annee: number | null;
      niv: string | null;
    } | null;
  } | null;
};

const FABRICANTS: Array<"tous" | Fabricant> = [
  "tous",
  "Lion",
  "Girardin",
  "Thomas",
];

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

function payeurLabel(value: Payeur) {
  if (value === "client") return "Client";
  if (value === "fabricant") return "Fabricant";
  return "Partagé";
}

export default function CentreServicePage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<CentreServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [fabricant, setFabricant] = useState<"tous" | Fabricant>("tous");
  const [statut, setStatut] = useState("ouverts");

  async function loadRows() {
    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("bt_garanties")
        .select(
          `
            id,
            bt_id,
            fabricant,
            numero_case,
            numero_reclamation,
            statut,
            payeur,
            preautorisation,
            date_ouverture,
            date_fermeture,
            commentaires,
            updated_at,
            bons_travail (
              id,
              numero,
              unite_id,
              client_nom,
              statut,
             unites!bons_travail_unite_id_fkey (
  no_unite,
  marque,
  modele,
  annee,
  niv
)
            )
          `,
        )
        .order("updated_at", { ascending: false });

      if (queryError) throw queryError;
      setRows((data || []) as unknown as CentreServiceRow[]);
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement du centre de service.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();

    return rows.filter((row) => {
      if (fabricant !== "tous" && row.fabricant !== fabricant) return false;
      if (statut === "ouverts" && row.statut === "ferme") return false;
      if (statut === "fermes" && row.statut !== "ferme") return false;

      if (!term) return true;

      const bt = row.bons_travail;
      const unite = bt?.unites;
      const haystack = [
        row.numero_case,
        row.numero_reclamation,
        row.fabricant,
        row.statut,
        row.preautorisation,
        bt?.numero,
        bt?.client_nom,
        unite?.no_unite,
        unite?.niv,
        unite?.niv ? unite.niv.slice(-8) : "",
        unite?.marque,
        unite?.modele,
        unite?.annee,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [rows, q, fabricant, statut]);

  const styles: Record<string, CSSProperties> = {
    page: {
      width: "100%",
      minHeight: "100%",
      padding: 20,
      background: "#f5f7fb",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 16,
    },
    h1: {
      margin: 0,
      color: "#0f172a",
      fontSize: 30,
      fontWeight: 950,
    },
    subtitle: { marginTop: 4, color: "#64748b", fontWeight: 600 },
    btn: {
      height: 42,
      padding: "0 16px",
      borderRadius: 12,
      border: "1px solid #d6dbe7",
      background: "#fff",
      color: "#0f172a",
      fontWeight: 800,
      cursor: "pointer",
    },
    toolbar: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      padding: 14,
      marginBottom: 14,
      border: "1px solid #e2e8f0",
      borderRadius: 18,
      background: "#fff",
      boxShadow: "0 10px 24px rgba(15,23,42,.04)",
    },
    input: {
      flex: 1,
      minWidth: 280,
      height: 44,
      padding: "0 14px",
      borderRadius: 14,
      border: "1px solid #d6dbe7",
      background: "#fff",
      fontSize: 14,
      outline: "none",
    },
    select: {
      minWidth: 175,
      height: 44,
      padding: "0 12px",
      borderRadius: 14,
      border: "1px solid #d6dbe7",
      background: "#fff",
      fontSize: 14,
      outline: "none",
    },
    tableShell: {
      overflow: "hidden",
      border: "1px solid #e2e8f0",
      borderRadius: 18,
      background: "#fff",
      boxShadow: "0 10px 24px rgba(15,23,42,.04)",
    },
    tableWrap: { width: "100%", overflowX: "auto" },
    table: { width: "100%", minWidth: 1120, borderCollapse: "collapse" },
    th: {
      padding: "15px 14px",
      background: "#f8fafc",
      borderBottom: "1px solid #e2e8f0",
      color: "#0f172a",
      fontSize: 13,
      fontWeight: 900,
      textAlign: "left",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "15px 14px",
      borderBottom: "1px solid #eef2f7",
      color: "#0f172a",
      fontSize: 14,
      whiteSpace: "nowrap",
    },
    muted: { color: "#64748b", fontSize: 12, marginTop: 3 },
    empty: { padding: 30, textAlign: "center", color: "#64748b", fontWeight: 700 },
    error: {
      padding: 12,
      marginBottom: 12,
      border: "1px solid #fecdd3",
      borderRadius: 14,
      background: "#fff1f2",
      color: "#9f1239",
      fontWeight: 700,
    },
    pill: {
      display: "inline-flex",
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid #d6dbe7",
      background: "#f8fafc",
      fontSize: 12,
      fontWeight: 800,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Centre de service</h1>
          <div style={styles.subtitle}>
            Suivi des bons de travail Lion, Girardin et Thomas
          </div>
        </div>

        <button type="button" style={styles.btn} onClick={() => void loadRows()}>
          Actualiser
        </button>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.toolbar}>
        <input
          style={styles.input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Recherche case, réclamation, BT, unité, NIV, client..."
        />

        <select
          style={styles.select}
          value={fabricant}
          onChange={(e) => setFabricant(e.target.value as "tous" | Fabricant)}
        >
          {FABRICANTS.map((item) => (
            <option key={item} value={item}>
              {item === "tous" ? "Tous les fabricants" : item}
            </option>
          ))}
        </select>

        <select
          style={styles.select}
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
        >
          <option value="ouverts">Dossiers ouverts</option>
          <option value="fermes">Dossiers fermés</option>
          <option value="tous">Tous les statuts</option>
        </select>
      </div>

      <div style={styles.tableShell}>
        {loading ? (
          <div style={styles.empty}>Chargement…</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Case</th>
                  <th style={styles.th}>BT</th>
                  <th style={styles.th}>Unité</th>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Fabricant</th>
                  <th style={styles.th}>Réclamation</th>
                  <th style={styles.th}>Statut</th>
                  <th style={styles.th}>Payeur</th>
                  <th style={styles.th}>Ouvert le</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={styles.empty}>
                      Aucun bon de travail dans le centre de service.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => {
                    const bt = row.bons_travail;
                    const unite = bt?.unites;
                    const rowBg = index % 2 === 0 ? "#fff" : "#f8fafc";

                    return (
                      <tr
                        key={row.id}
                        style={{ background: rowBg, cursor: "pointer" }}
                        onDoubleClick={() => nav(`/bt/${row.bt_id}?centreService=1`)}
                        onClick={() => nav(`/bt/${row.bt_id}?centreService=1`)}
                      >
                        <td style={styles.td}>{row.numero_case || "—"}</td>
                        <td style={{ ...styles.td, fontWeight: 800 }}>
                          {bt?.numero || "—"}
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 900 }}>{unite?.no_unite || "—"}</div>
                          <div style={styles.muted}>
                            {[unite?.marque, unite?.modele, unite?.annee]
                              .filter(Boolean)
                              .join(" ")}
                          </div>
                        </td>
                        <td style={styles.td}>{bt?.client_nom || "—"}</td>
                        <td style={styles.td}>{row.fabricant}</td>
                        <td style={styles.td}>{row.numero_reclamation || "—"}</td>
                        <td style={styles.td}>
                          <span style={styles.pill}>{row.statut}</span>
                        </td>
                        <td style={styles.td}>{payeurLabel(row.payeur)}</td>
                        <td style={styles.td}>{fmtDate(row.date_ouverture)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
