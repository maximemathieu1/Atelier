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

export default function ClientsListe() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");

  async function load() {
    const [{ data: clients, error: clientsError }, { data: unites, error: unitesError }] = await Promise.all([
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

  async function removeClient(id: string) {
    if (busy) return;
    if (!confirm("Supprimer ce client ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((c) => {
      const haystack = [
        c.nom,
        c.courriel ?? "",
        c.telephone ?? "",
        String(c.nb_unites),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>Clients</h1>
          <div className="muted">Gestion des clients atelier</div>
        </div>

        <button className="ghost" onClick={load} disabled={busy} type="button">
          Rafraîchir
        </button>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="toolbar" style={{ justifyContent: "flex-start" }}>
          <button className="btn-primary" onClick={addClient} disabled={busy} type="button">
            Ajouter client
          </button>
        </div>

        {/* 🔍 Barre de recherche */}
        <div style={{ marginTop: 12, marginBottom: 14 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, courriel, téléphone ou nb unités..."
            style={{
              width: "100%",
              maxWidth: 420,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--line, #d0d7de)",
              background: "var(--card, #fff)",
              outline: "none",
            }}
          />
        </div>

        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Courriel</th>
                <th>Téléphone</th>
                <th>Nb unités</th>
                <th style={{ width: 160 }} />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((c) => (
                <tr
                  className="row"
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => nav(`/clients/${c.id}`)}
                >
                  <td style={{ fontWeight: 800 }}>{c.nom}</td>
                  <td>{c.courriel ?? ""}</td>
                  <td>{c.telephone ?? ""}</td>
                  <td style={{ fontWeight: 800 }}>{c.nb_unites}</td>
                  <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="ghost"
                      style={{ borderStyle: "solid" }}
                      disabled={busy}
                      onClick={() => removeClient(c.id)}
                      type="button"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: "12px 8px" }}>
                    {rows.length === 0 ? "Aucun client." : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="hint">Clique un client pour ouvrir sa fiche.</div>
      </div>
    </div>
  );
}