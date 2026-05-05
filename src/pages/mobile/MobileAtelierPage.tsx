import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function MobileAtelierPage() {
  const nav = useNavigate();
  const [bts, setBts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const { data } = await supabase
      .from("bons_travail")
      .select("id, numero, statut, date_ouverture, unite:unites(no_unite)")
      .in("statut", ["a_faire", "en_cours", "ouvert"])
      .order("date_ouverture", { ascending: false });

    setBts(data || []);
    setLoading(false);
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>BT ouverts</h2>

      {loading ? (
        <div>Chargement…</div>
      ) : bts.length === 0 ? (
        <div>Aucun BT ouvert</div>
      ) : (
        bts.map((bt) => (
          <div
            key={bt.id}
            onClick={() => nav(`/mobile/bt/${bt.id}`)}
            style={{
              padding: 14,
              border: "1px solid #ddd",
              borderRadius: 12,
              marginBottom: 10,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 900 }}>
              BT {bt.numero || ""}
            </div>

            <div style={{ opacity: 0.7 }}>
              Unité: {bt.unite?.no_unite || "-"}
            </div>

            <div style={{ fontSize: 12, marginTop: 4 }}>
              {new Date(bt.date_ouverture).toLocaleString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}