import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function MobileAtelierPage() {
  const nav = useNavigate();

  const [unite, setUnite] = useState("");
  const [km, setKm] = useState("");
  const [loading, setLoading] = useState(false);

  async function openBt() {
    if (!unite) return alert("Entrer une unité");

    setLoading(true);

    try {
      const { data: uniteRow } = await supabase
        .from("unites")
        .select("*")
        .eq("no_unite", unite)
        .maybeSingle();

      if (!uniteRow) throw new Error("Unité introuvable");

      // chercher BT ouvert
      const { data: bt } = await supabase
        .from("bons_travail")
        .select("id")
        .eq("unite_id", uniteRow.id)
        .in("statut", ["a_faire", "en_cours", "ouvert"])
        .limit(1)
        .maybeSingle();

      let btId = bt?.id;

      if (!btId) {
        const { data: newBt } = await supabase
          .from("bons_travail")
          .insert({
            unite_id: uniteRow.id,
            statut: "en_cours",
          })
          .select("id")
          .single();

        btId = newBt?.id;
      }

      if (km) {
        await supabase.rpc("enregistrer_km_bt", {
          p_bt_id: btId,
          p_unite_id: uniteRow.id,
          p_km: Number(km),
        });
      }

      nav(`/mobile/bt/${btId}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Punch rapide</h2>

      <input
        placeholder="Unité"
        value={unite}
        onChange={(e) => setUnite(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <input
        placeholder="KM"
        value={km}
        onChange={(e) => setKm(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <button onClick={openBt} disabled={loading}>
        Ouvrir BT
      </button>
    </div>
  );
}