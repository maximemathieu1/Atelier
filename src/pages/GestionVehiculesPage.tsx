import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../lib/supabaseClient";

type PeriodeKey = "1" | "3" | "5" | "all";

type UniteRow = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  plaque: string | null;
  niv: string | null;
  km_actuel: number | null;
  statut: string | null;
  client_id: string | null;
  clients?: { nom: string | null } | null;
};

type BtRow = {
  id: string;
  numero: string | null;
  unite_id: string;
  statut: string | null;
  date_ouverture: string | null;
  date_fermeture: string | null;
  km: number | null;
  total_pieces: number | null;
  total_main_oeuvre: number | null;
  total_frais_atelier: number | null;
  total_general: number | null;
  total_final: number | null;
};

type SuiviEvent = {
  id: string;
  created_at: string | null;
  unite_id: string;
  bt_id: string | null;
  inventaire_item_id: string | null;
  suivi_type: string | null;
  localisation: string | null;
  action: string | null;
  date_evenement: string | null;
  km: number | null;
  actif: boolean | null;
  remplace_evenement_id: string | null;
  piece_sku: string | null;
  piece_nom: string | null;
  categorie_piece_id: string | null;
  sous_categorie_piece_id: string | null;
};

const periodeOptions: Array<{ value: PeriodeKey; label: string }> = [
  { value: "1", label: "1 an" },
  { value: "3", label: "3 ans" },
  { value: "5", label: "5 ans" },
  { value: "all", label: "Tout" },
];

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));
}

function fmtNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(Number(value));
}

function fmtKm(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${fmtNumber(value)} km`;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

function localisationLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    ignore: "Ignoré",
    avant: "Avant",
    arriere: "Arrière",
    avant_gauche: "Avant gauche",
    avant_droite: "Avant droite",
    arriere_gauche: "Arrière gauche",
    arriere_droite: "Arrière droite",
    tous: "Tous",
  };

  return value ? map[value] || value : "—";
}

function startDateForPeriod(period: PeriodeKey) {
  if (period === "all") return null;
  const years = Number(period);
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
}

export default function GestionVehiculesPage() {
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unites, setUnites] = useState<UniteRow[]>([]);
  const [selectedUniteId, setSelectedUniteId] = useState("");
  const [periode, setPeriode] = useState<PeriodeKey>("3");

  const [bts, setBts] = useState<BtRow[]>([]);
  const [suivis, setSuivis] = useState<SuiviEvent[]>([]);

  const selectedUnite = useMemo(
    () => unites.find((u) => u.id === selectedUniteId) || null,
    [unites, selectedUniteId],
  );

  const activeSuivis = useMemo(
    () => suivis.filter((s) => Boolean(s.actif)),
    [suivis],
  );

  const historiqueSuivis = useMemo(
    () => [...suivis].sort((a, b) => {
      const da = new Date(a.date_evenement || a.created_at || 0).getTime();
      const db = new Date(b.date_evenement || b.created_at || 0).getTime();
      return db - da;
    }),
    [suivis],
  );

  const stats = useMemo(() => {
    const totalEntretien = bts.reduce((sum, bt) => sum + Number(bt.total_general || 0), 0);
    const totalFinal = bts.reduce((sum, bt) => sum + Number(bt.total_final || 0), 0);
    const totalPieces = bts.reduce((sum, bt) => sum + Number(bt.total_pieces || 0), 0);
    const totalMo = bts.reduce((sum, bt) => sum + Number(bt.total_main_oeuvre || 0), 0);
    const totalFraisAtelier = bts.reduce((sum, bt) => sum + Number(bt.total_frais_atelier || 0), 0);

    const kms = bts
      .map((bt) => Number(bt.km || 0))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);

    const kmMin = kms.length ? kms[0] : null;
    const kmMax = kms.length ? kms[kms.length - 1] : selectedUnite?.km_actuel ?? null;
    const kmParcouru = kmMin != null && kmMax != null && kmMax >= kmMin ? kmMax - kmMin : null;
    const coutParKm = kmParcouru && kmParcouru > 0 ? totalEntretien / kmParcouru : null;

    return {
      totalEntretien,
      totalFinal,
      totalPieces,
      totalMo,
      totalFraisAtelier,
      kmParcouru,
      coutParKm,
      nbBt: bts.length,
    };
  }, [bts, selectedUnite]);

  const annualRows = useMemo(() => {
    const map = new Map<string, { year: string; total: number; pieces: number; mo: number; nb: number }>();

    for (const bt of bts) {
      const d = new Date(bt.date_fermeture || bt.date_ouverture || "");
      if (Number.isNaN(d.getTime())) continue;
      const year = String(d.getFullYear());
      const existing = map.get(year) || { year, total: 0, pieces: 0, mo: 0, nb: 0 };
      existing.total += Number(bt.total_general || 0);
      existing.pieces += Number(bt.total_pieces || 0);
      existing.mo += Number(bt.total_main_oeuvre || 0);
      existing.nb += 1;
      map.set(year, existing);
    }

    return Array.from(map.values()).sort((a, b) => Number(b.year) - Number(a.year));
  }, [bts]);

  useEffect(() => {
    void loadUnites();
  }, []);

  useEffect(() => {
    if (!selectedUniteId) {
      setBts([]);
      setSuivis([]);
      return;
    }

    void loadVehicleData(selectedUniteId, periode);
  }, [selectedUniteId, periode]);

  async function loadUnites() {
    setLoadingUnits(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("unites")
        .select("id,no_unite,marque,modele,annee,plaque,niv,km_actuel,statut,client_id,clients(nom)")
        .order("no_unite", { ascending: true });

      if (error) throw error;

      const rows = (data || []) as unknown as UniteRow[];
      setUnites(rows);
      if (!selectedUniteId && rows.length > 0) setSelectedUniteId(rows[0].id);
    } catch (e: any) {
      setError(e?.message || "Erreur chargement véhicules.");
      setUnites([]);
    } finally {
      setLoadingUnits(false);
    }
  }

  async function loadVehicleData(uniteId: string, selectedPeriod: PeriodeKey) {
    setLoadingData(true);
    setError(null);

    try {
      const fromDate = startDateForPeriod(selectedPeriod);

      let btQuery = supabase
        .from("bons_travail")
        .select(
          "id,numero,unite_id,statut,date_ouverture,date_fermeture,km,total_pieces,total_main_oeuvre,total_frais_atelier,total_general,total_final",
        )
        .eq("unite_id", uniteId)
        .order("date_ouverture", { ascending: false });

      if (fromDate) {
        btQuery = btQuery.gte("date_ouverture", fromDate);
      }

      const [btRes, suiviRes] = await Promise.all([
        btQuery,
        supabase
          .from("pieces_suivi_evenements")
          .select("*")
          .eq("unite_id", uniteId)
          .order("date_evenement", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (btRes.error) throw btRes.error;
      if (suiviRes.error) throw suiviRes.error;

      setBts((btRes.data || []) as BtRow[]);
      setSuivis((suiviRes.data || []) as SuiviEvent[]);
    } catch (e: any) {
      setError(e?.message || "Erreur chargement données véhicule.");
      setBts([]);
      setSuivis([]);
    } finally {
      setLoadingData(false);
    }
  }

  const styles: Record<string, CSSProperties> = {
    page: {
      maxWidth: 1180,
      margin: "24px auto",
      padding: "0 14px",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
      marginBottom: 14,
      flexWrap: "wrap",
    },
    h1: { margin: 0, fontSize: 24, fontWeight: 950, color: "#0f172a" },
    muted: { color: "rgba(15,23,42,.62)", fontSize: 13 },
    card: {
      background: "#fff",
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 16,
      padding: 14,
      boxShadow: "0 8px 30px rgba(15,23,42,.05)",
      marginBottom: 12,
    },
    row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    input: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(15,23,42,.14)",
      background: "#fff",
      minWidth: 240,
      fontWeight: 750,
    },
    gridKpi: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: 12,
      marginBottom: 12,
    },
    kpi: {
      background: "#fff",
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 16,
      padding: 14,
      boxShadow: "0 8px 30px rgba(15,23,42,.05)",
      minHeight: 86,
    },
    kpiLabel: { fontSize: 12, fontWeight: 900, color: "rgba(15,23,42,.55)", marginBottom: 8 },
    kpiValue: { fontSize: 22, fontWeight: 950, color: "#0f172a" },
    kpiSub: { fontSize: 12, color: "rgba(15,23,42,.58)", marginTop: 4, fontWeight: 700 },
    twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    sectionTitle: { fontSize: 16, fontWeight: 950, marginBottom: 10, color: "#0f172a" },
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: {
      textAlign: "left" as const,
      fontSize: 12,
      color: "rgba(15,23,42,.55)",
      padding: "8px 6px",
      fontWeight: 900,
      borderBottom: "1px solid rgba(15,23,42,.08)",
    },
    td: {
      padding: "10px 6px",
      borderBottom: "1px solid rgba(15,23,42,.06)",
      verticalAlign: "top" as const,
      fontSize: 13,
    },
    badge: {
      display: "inline-flex",
      padding: "4px 8px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,.10)",
      background: "#f8fafc",
      fontSize: 12,
      fontWeight: 850,
      color: "#334155",
    },
    warn: {
      background: "#fff7ed",
      color: "#92400e",
      border: "1px solid #fed7aa",
      borderRadius: 14,
      padding: 12,
      fontWeight: 800,
      marginBottom: 12,
    },
    empty: {
      padding: 12,
      borderRadius: 12,
      background: "#f8fafc",
      color: "rgba(15,23,42,.62)",
      fontWeight: 750,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Gestion véhicules</h1>
          <div style={styles.muted}>
            Dossier véhicule, coûts d’entretien, coût/km et suivi des pièces importantes.
          </div>
        </div>

        <div style={styles.row}>
          <select
            style={styles.input}
            value={selectedUniteId}
            onChange={(e) => setSelectedUniteId(e.target.value)}
            disabled={loadingUnits}
          >
            {unites.map((u) => (
              <option key={u.id} value={u.id}>
                {u.no_unite} — {[u.marque, u.modele].filter(Boolean).join(" ") || "Véhicule"}
              </option>
            ))}
          </select>

          <select
            style={{ ...styles.input, minWidth: 140 }}
            value={periode}
            onChange={(e) => setPeriode(e.target.value as PeriodeKey)}
          >
            {periodeOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div style={styles.warn}>{error}</div> : null}

      {loadingUnits ? (
        <div style={styles.card}>Chargement des véhicules…</div>
      ) : !selectedUnite ? (
        <div style={styles.card}>Aucun véhicule trouvé.</div>
      ) : (
        <>
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Résumé véhicule</div>
            <div style={{ ...styles.row, justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 950 }}>{selectedUnite.no_unite}</div>
                <div style={styles.muted}>
                  {[selectedUnite.marque, selectedUnite.modele, selectedUnite.annee]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </div>
                <div style={{ ...styles.muted, marginTop: 4 }}>
                  Client : {selectedUnite.clients?.nom || "—"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={styles.badge}>{selectedUnite.statut || "—"}</div>
                <div style={{ ...styles.muted, marginTop: 8 }}>
                  Plaque : {selectedUnite.plaque || "—"} • NIV : {selectedUnite.niv || "—"}
                </div>
                <div style={{ marginTop: 5, fontWeight: 950 }}>KM actuel : {fmtKm(selectedUnite.km_actuel)}</div>
              </div>
            </div>
          </div>

          <div style={styles.gridKpi}>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Coût entretien</div>
              <div style={styles.kpiValue}>{money(stats.totalEntretien)}</div>
              <div style={styles.kpiSub}>{stats.nbBt} BT dans la période</div>
            </div>

            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Coût entretien / km</div>
              <div style={styles.kpiValue}>{stats.coutParKm == null ? "—" : money(stats.coutParKm)}</div>
              <div style={styles.kpiSub}>KM utilisés : {fmtKm(stats.kmParcouru)}</div>
            </div>

            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Pièces</div>
              <div style={styles.kpiValue}>{money(stats.totalPieces)}</div>
              <div style={styles.kpiSub}>Main-d’œuvre : {money(stats.totalMo)}</div>
            </div>

            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Pièces suivies actives</div>
              <div style={styles.kpiValue}>{activeSuivis.length}</div>
              <div style={styles.kpiSub}>Freins, pneus, direction, etc.</div>
            </div>
          </div>

          {loadingData ? (
            <div style={styles.card}>Chargement des données…</div>
          ) : (
            <div style={styles.twoCols}>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>Coût entretien annuel</div>
                {annualRows.length === 0 ? (
                  <div style={styles.empty}>Aucune donnée pour la période.</div>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Année</th>
                        <th style={styles.th}>BT</th>
                        <th style={styles.th}>Pièces</th>
                        <th style={styles.th}>MO</th>
                        <th style={styles.th}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annualRows.map((r) => (
                        <tr key={r.year}>
                          <td style={styles.td}>{r.year}</td>
                          <td style={styles.td}>{r.nb}</td>
                          <td style={styles.td}>{money(r.pieces)}</td>
                          <td style={styles.td}>{money(r.mo)}</td>
                          <td style={{ ...styles.td, fontWeight: 950 }}>{money(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={styles.card}>
                <div style={styles.sectionTitle}>Pièces suivies actives</div>
                {activeSuivis.length === 0 ? (
                  <div style={styles.empty}>Aucune pièce active suivie pour ce véhicule.</div>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Position</th>
                        <th style={styles.th}>Pièce</th>
                        <th style={styles.th}>Installée</th>
                        <th style={styles.th}>KM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSuivis.map((s) => (
                        <tr key={s.id}>
                          <td style={styles.td}>{localisationLabel(s.localisation)}</td>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 900 }}>{s.piece_sku || "—"}</div>
                            <div style={styles.muted}>{s.piece_nom || s.suivi_type || "—"}</div>
                          </td>
                          <td style={styles.td}>{fmtDate(s.date_evenement || s.created_at)}</td>
                          <td style={styles.td}>{fmtKm(s.km)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ ...styles.card, gridColumn: "1 / -1" }}>
                <div style={styles.sectionTitle}>Historique suivi pièces</div>
                {historiqueSuivis.length === 0 ? (
                  <div style={styles.empty}>Aucun historique de pièces suivies.</div>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Action</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Position</th>
                        <th style={styles.th}>Pièce</th>
                        <th style={styles.th}>KM</th>
                        <th style={styles.th}>État</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historiqueSuivis.slice(0, 80).map((s) => (
                        <tr key={s.id}>
                          <td style={styles.td}>{fmtDate(s.date_evenement || s.created_at)}</td>
                          <td style={styles.td}>{s.action || "—"}</td>
                          <td style={styles.td}>{s.suivi_type || "—"}</td>
                          <td style={styles.td}>{localisationLabel(s.localisation)}</td>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 900 }}>{s.piece_sku || "—"}</div>
                            <div style={styles.muted}>{s.piece_nom || "—"}</div>
                          </td>
                          <td style={styles.td}>{fmtKm(s.km)}</td>
                          <td style={styles.td}>
                            <span style={styles.badge}>{s.actif ? "Actif" : "Remplacé/retiré"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
