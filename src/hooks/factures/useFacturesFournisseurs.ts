import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export function useFacturesFournisseurs() {
  const [factures, setFactures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("factures_fournisseurs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setFactures(data || []);
    setLoading(false);
  }

  async function autoriser(facture: any) {
    const { data: user } = await supabase.auth.getUser();

    await supabase
      .from("factures_fournisseurs")
      .update({
        statut: "autorisee_paiement",
        autorise_par: user.user?.id,
        autorise_email: user.user?.email,
        autorise_le: new Date().toISOString(),
      })
      .eq("id", facture.id);

    await load();
  }

  async function setStatut(facture: any, statut: string) {
    await supabase
      .from("factures_fournisseurs")
      .update({ statut })
      .eq("id", facture.id);

    await load();
  }

  async function saveNote(facture: any, note: string) {
    await supabase
      .from("factures_fournisseurs")
      .update({ note })
      .eq("id", facture.id);

    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return {
    factures,
    loading,
    reload: load,
    autoriser,
    setStatut,
    saveNote,
  };
}