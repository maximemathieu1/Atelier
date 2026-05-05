import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function MobileAtelierPage() {
  const nav = useNavigate();

  const [bts, setBts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("bons_travail")
        .select(
          "id,numero,statut,date_ouverture,client_nom,km,unite:unites(no_unite,marque,modele,plaque)"
        )
        .in("statut", ["a_faire", "en_cours", "ouvert"])
        .order("date_ouverture", { ascending: false });

      if (error) throw error;

      setBts(data || []);
    } catch (e: any) {
      alert(e?.message || "Erreur de chargement des BT ouverts.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Atelier mobile</div>
          <h1 style={styles.title}>BT ouverts</h1>
        </div>

        <button type="button" onClick={() => void load()} style={styles.refreshBtn}>
          ↻
        </button>
      </div>

      {loading ? (
        <div style={styles.empty}>Chargement…</div>
      ) : bts.length === 0 ? (
        <div style={styles.empty}>Aucun BT ouvert.</div>
      ) : (
        <div style={styles.list}>
          {bts.map((bt) => (
            <button
              key={bt.id}
              type="button"
              onClick={() => nav(`/mobile/bt/${bt.id}`)}
              style={styles.card}
            >
              <div style={styles.cardTop}>
                <div>
                  <div style={styles.btNumber}>BT {bt.numero || "—"}</div>
                  <div style={styles.unit}>Unité {bt.unite?.no_unite || "—"}</div>
                </div>

                <div style={styles.badge}>{bt.statut || "ouvert"}</div>
              </div>

              <div style={styles.meta}>
                {bt.unite?.marque || ""} {bt.unite?.modele || ""}
              </div>

              <div style={styles.meta}>Client : {bt.client_nom || "—"}</div>

              <div style={styles.footer}>
                <span>
                  Ouvert :{" "}
                  {bt.date_ouverture
                    ? new Date(bt.date_ouverture).toLocaleDateString("fr-CA")
                    : "—"}
                </span>

                <span>KM : {bt.km ?? "—"}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 14,
    background: "#f3f4f6",
    boxSizing: "border-box",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  kicker: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#64748b",
    fontWeight: 900,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 950,
    color: "#111827",
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 20,
    fontWeight: 900,
  },
  list: {
    display: "grid",
    gap: 10,
  },
  card: {
    width: "100%",
    padding: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    boxShadow: "0 6px 16px rgba(15,23,42,.05)",
    textAlign: "left",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  btNumber: {
    fontSize: 18,
    fontWeight: 950,
    color: "#111827",
  },
  unit: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: 850,
    color: "#334155",
  },
  badge: {
    flexShrink: 0,
    padding: "5px 9px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#075985",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  meta: {
    marginTop: 7,
    fontSize: 13,
    color: "#64748b",
  },
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#475569",
    fontSize: 12,
    fontWeight: 750,
  },
  empty: {
    padding: 14,
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    color: "#64748b",
  },
};