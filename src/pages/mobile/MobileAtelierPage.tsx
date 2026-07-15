import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function MobileAtelierPage() {
  const nav = useNavigate();

  const [bts, setBts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("bons_travail")
        .select(`
          id,
          numero,
          statut,
          date_ouverture,
          client_nom,
          km,
          unite_id,
          unite:unites!bons_travail_unite_id_fkey(
            no_unite,
            marque,
            modele,
            plaque
          )
        `)
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

  const filteredBts = bts.filter((bt) => {
    const needle = search.trim().toLocaleLowerCase("fr-CA");
    if (!needle) return true;

    const haystack = [
      bt.numero,
      bt.client_nom,
      bt.unite?.no_unite,
      bt.unite?.marque,
      bt.unite?.modele,
      bt.unite?.plaque,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("fr-CA");

    return haystack.includes(needle);
  });

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

      <div style={styles.searchCard}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher BT, unité, client ou plaque"
          style={styles.searchInput}
        />
      </div>

      {loading ? (
        <div style={styles.empty}>Chargement…</div>
      ) : bts.length === 0 ? (
        <div style={styles.empty}>Aucun BT ouvert.</div>
      ) : filteredBts.length === 0 ? (
        <div style={styles.empty}>Aucun résultat.</div>
      ) : (
        <div style={styles.list}>
          {filteredBts.map((bt) => {
            const uniteNo =
              bt.unite?.no_unite ||
              bt.unite_id ||
              "—";

            return (
              <button
                key={bt.id}
                type="button"
                onClick={() => nav(`/mobile/bt/${bt.id}`)}
                style={styles.card}
              >
                <div style={styles.cardTop}>
  <div>
    <div style={styles.btNumber}>
      {bt.numero || "—"}
    </div>

    <div style={styles.unit}>
      🚍 Unité {uniteNo}
    </div>
  </div>
</div>

<div style={styles.meta}>
  {bt.unite?.marque || ""} {bt.unite?.modele || ""}
</div>

<div style={styles.meta}>
  Client : {bt.client_nom || "—"}
</div>

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
            );
          })}
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
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  kicker: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 900,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 950,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
  },
  searchCard: {
    marginBottom: 12,
  },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    borderRadius: 14,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 16,
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
    textAlign: "left",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
  },
  btNumber: {
    fontSize: 18,
    fontWeight: 950,
  },
  unit: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: 900,
  },
  badge: {
    padding: "5px 9px",
    borderRadius: 999,
    background: "#e0f2fe",
    fontSize: 11,
    fontWeight: 900,
  },
  meta: {
    marginTop: 7,
    fontSize: 13,
    color: "#64748b",
  },
  footer: {
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
  },
  empty: {
    padding: 14,
    background: "#fff",
    borderRadius: 12,
  },
};