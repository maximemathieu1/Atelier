import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Unite = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  km_actuel: number | null;
  statut: string;
  client_id?: string | null;
};

type Client = {
  id: string;
  nom: string;
};

type BT = {
  id: string;
  numero?: string | null;
  unite_id: string;
  statut: string;
  km?: number | null;
  date_ouverture?: string | null;
  date_fermeture?: string | null;
  verrouille?: boolean | null;
  annee?: number | null;
  mois?: number | null;
  created_at?: string | null;
  client_id?: string | null;
  client_nom?: string | null;
  total_pieces?: number | null;
  total_main_oeuvre?: number | null;
  total_frais_atelier?: number | null;
  total_general?: number | null;
};

function fmtDate(v: any) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-CA");
}

function money(v: number) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(v || 0);
}

const pill: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,.12)",
  fontSize: 12,
  fontWeight: 900,
};

function isOpenStatut(statut: string | null | undefined) {
  return statut === "ouvert" || statut === "a_faire" || statut === "en_cours";
}

function isClosedStatut(statut: string | null | undefined) {
  return statut === "ferme" || statut === "termine";
}

function isFacturedStatut(statut: string | null | undefined) {
  return statut === "facture";
}

function statutLabel(s: string) {
  if (isOpenStatut(s)) return "Ouvert";
  if (isClosedStatut(s)) return "Fermé";
  if (isFacturedStatut(s)) return "Facturé";
  if (s === "verrouille") return "Verrouillé";
  return s;
}

export default function BTListe() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [bts, setBts] = useState<BT[]>([]);
  const [unites, setUnites] = useState<Unite[]>([]);
  const [unitesById, setUnitesById] = useState<Record<string, Unite>>({});
  const [clientsById, setClientsById] = useState<Record<string, Client>>({});

  const [q, setQ] = useState("");
  const [statut, setStatut] = useState<
    "tous" | "ouvert" | "ferme" | "facture" | "verrouille"
  >("ouvert");

  const [newUniteId, setNewUniteId] = useState<string>("");
  const [newUniteText, setNewUniteText] = useState<string>("");

  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setErr(null);

    try {
      const [
        { data: uData, error: eU },
        { data: btData, error: eB },
        { data: cData, error: eC },
      ] = await Promise.all([
        supabase
          .from("unites")
          .select("id,no_unite,marque,modele,annee,km_actuel,statut,client_id")
          .order("no_unite", { ascending: true }),
        supabase.from("bons_travail").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("clients").select("id,nom"),
      ]);

      if (eU) throw eU;
      if (eB) throw eB;
      if (eC) throw eC;

      const u = (uData || []) as Unite[];
      const btRows = (btData || []) as BT[];
      const clients = (cData || []) as Client[];

      setUnites(u);
      setBts(btRows);

      const unitMap: Record<string, Unite> = {};
      for (const row of u) unitMap[row.id] = row;
      setUnitesById(unitMap);

      const clientMap: Record<string, Client> = {};
      for (const row of clients) clientMap[row.id] = row;
      setClientsById(clientMap);

      if (!newUniteId && u.length) {
        setNewUniteId(u[0].id);
        setNewUniteText(u[0].no_unite || "");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resolveClientName(bt: BT) {
    if (bt.client_nom?.trim()) return bt.client_nom.trim();
    if (bt.client_id && clientsById[bt.client_id]?.nom) return clientsById[bt.client_id].nom;

    const u = unitesById[bt.unite_id];
    if (u?.client_id && clientsById[u.client_id]?.nom) return clientsById[u.client_id].nom;

    return "—";
  }

  function resolvePiecesAtelier(bt: BT) {
    const pieces = Number(bt.total_pieces || 0);
    const atelier = Number(bt.total_frais_atelier || 0);
    return pieces + atelier;
  }

  function resolveMainOeuvre(bt: BT) {
    return Number(bt.total_main_oeuvre || 0);
  }

  function resolveGrandTotal(bt: BT) {
    const totalGeneral = Number(bt.total_general || 0);
    if (totalGeneral > 0) return totalGeneral;
    return resolvePiecesAtelier(bt) + resolveMainOeuvre(bt);
  }

  function matchesStatutFilter(btStatut: string) {
    if (statut === "tous") return true;
    if (statut === "ouvert") return isOpenStatut(btStatut);
    if (statut === "ferme") return isClosedStatut(btStatut);
    if (statut === "facture") return isFacturedStatut(btStatut);
    if (statut === "verrouille") return btStatut === "verrouille";
    return true;
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return bts.filter((bt) => {
      if (!matchesStatutFilter(bt.statut)) return false;
      if (!term) return true;

      const u = unitesById[bt.unite_id];
      const client = resolveClientName(bt);
      const totalPiecesAtelier = resolvePiecesAtelier(bt);
      const totalMo = resolveMainOeuvre(bt);
      const grandTotal = resolveGrandTotal(bt);

      const s = [
        bt.numero || "",
        statutLabel(bt.statut || ""),
        bt.statut || "",
        u?.no_unite || "",
        client,
        String(totalPiecesAtelier),
        String(totalMo),
        String(grandTotal),
        u ? [u.marque, u.modele, u.annee].filter(Boolean).join(" ") : "",
      ]
        .join(" ")
        .toLowerCase();

      return s.includes(term);
    });
  }, [bts, q, statut, unitesById, clientsById]);

  function syncUnitFromText(value: string) {
    setNewUniteText(value);

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      setNewUniteId("");
      return;
    }

    const exact =
      unites.find((u) => String(u.no_unite || "").trim().toLowerCase() === normalized) ||
      unites.find(
        (u) =>
          `${u.no_unite} — ${[u.marque, u.modele, u.annee].filter(Boolean).join(" ")}`
            .trim()
            .toLowerCase() === normalized
      );

    if (exact) {
      setNewUniteId(exact.id);
      return;
    }

    const startsWith = unites.find((u) =>
      String(u.no_unite || "").trim().toLowerCase().startsWith(normalized)
    );

    if (startsWith) {
      setNewUniteId(startsWith.id);
      return;
    }

    setNewUniteId("");
  }

  async function createBT() {
    setCreateErr(null);

    if (!newUniteId) {
      setCreateErr("Aucune unité valide sélectionnée.");
      return;
    }

    setCreating(true);
    try {
      const now = new Date();
      const annee = now.getFullYear();
      const mois = now.getMonth() + 1;

      const { data: existing, error: existingErr } = await supabase
        .from("bons_travail")
        .select("id,statut,date_fermeture")
        .eq("unite_id", newUniteId)
        .eq("annee", annee)
        .eq("mois", mois)
        .or("statut.eq.ouvert,statut.eq.a_faire,statut.eq.en_cours")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingErr) throw existingErr;

      if (existing?.id) {
        nav(`/bt/${existing.id}`);
        return;
      }

      const unite = unites.find((u) => u.id === newUniteId);

      const { data, error } = await supabase
        .from("bons_travail")
        .insert({
          unite_id: newUniteId,
          statut: "ouvert",
          verrouille: false,
          titre: unite ? `Entretien ${unite.no_unite}` : "Bon de travail",
          annee,
          mois,
          date_ouverture: new Date().toISOString(),
          date_fermeture: null,
          total_pieces: 0,
          total_main_oeuvre: 0,
          total_frais_atelier: 0,
          total_general: 0,
        })
        .select("id")
        .single();

      if (error) throw error;

      nav(`/bt/${data.id}`);
    } catch (e: any) {
      setCreateErr(e?.message ?? "Erreur création / ouverture BT");
    } finally {
      setCreating(false);
    }
  }

  const styles: Record<string, React.CSSProperties> = {
    page: { padding: 20, width: "100%" },
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      marginBottom: 12,
    },
    row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    h1: { margin: 0, fontSize: 22, fontWeight: 950 },
    muted: { color: "rgba(0,0,0,.6)" },
    btnPrimary: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 950,
      cursor: "pointer",
      opacity: creating ? 0.75 : 1,
    },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
    },
    select: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
    },
    tableWrap: {
      width: "100%",
      overflowX: "auto",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      minWidth: 980,
      tableLayout: "fixed" as const,
    },
    th: {
      textAlign: "left" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      whiteSpace: "nowrap" as const,
    },
    thAmount: {
      textAlign: "right" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      whiteSpace: "nowrap" as const,
      width: 125,
    },
    thClient: {
      textAlign: "left" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      whiteSpace: "nowrap" as const,
      width: 90,
    },
    thStatus: {
      textAlign: "left" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      whiteSpace: "nowrap" as const,
      width: 90,
    },
    td: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top" as const,
      whiteSpace: "nowrap" as const,
    },
    tdAmount: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top" as const,
      textAlign: "right" as const,
      whiteSpace: "nowrap" as const,
    },
    tdClient: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top" as const,
      whiteSpace: "nowrap" as const,
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    link: { color: "#2563eb", cursor: "pointer", textDecoration: "underline" },
    errBox: {
      background: "rgba(220,38,38,.07)",
      border: "1px solid rgba(220,38,38,.2)",
      padding: 10,
      borderRadius: 12,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.row}>
        <div>
          <div style={styles.h1}>Bons de travail</div>
          <div style={styles.muted}>Liste + création rapide</div>
        </div>
      </div>

      {err && (
        <div style={{ ...styles.card, ...styles.errBox }}>
          <b>Erreur:</b> {err}
        </div>
      )}

      <div style={styles.card}>
        <div style={{ fontWeight: 950 }}>Nouveau BT</div>

        <div style={{ ...styles.row, marginTop: 10 }}>
          <input
            list="bt-unites-list"
            style={{ ...styles.input, minWidth: 320 }}
            placeholder="Entrer l’unité"
            value={newUniteText}
            onChange={(e) => syncUnitFromText(e.target.value)}
          />

          <datalist id="bt-unites-list">
            {unites.map((u) => (
              <option key={u.id} value={u.no_unite}>
                {[u.marque, u.modele, u.annee].filter(Boolean).join(" ")}
              </option>
            ))}
          </datalist>

          <button style={styles.btnPrimary} onClick={createBT} disabled={creating || !newUniteId}>
            {creating ? "Ouverture…" : "Créer et ouvrir"}
          </button>

          {createErr && (
            <div style={{ ...styles.errBox, marginTop: 8, width: "100%" }}>
              {createErr}
            </div>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="Recherche (BT, unité, client, statut…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select style={styles.select} value={statut} onChange={(e) => setStatut(e.target.value as any)}>
            <option value="tous">Tous les statuts</option>
            <option value="ouvert">Ouvert</option>
            <option value="ferme">Fermé</option>
            <option value="facture">Facturé</option>
            <option value="verrouille">Verrouillé</option>
          </select>

          <div style={{ marginLeft: "auto" }}>
            <span style={styles.muted}>{filtered.length}</span>
            <span style={styles.muted}> résultat(s)</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 10 }}>Chargement…</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>BT</th>
                  <th style={styles.th}>Unité</th>
                  <th style={styles.thClient}>Client</th>
                  <th style={styles.th}>KM</th>
                  <th style={styles.th}>Ouverture</th>
                  <th style={styles.thAmount}>Total pièces + atelier</th>
                  <th style={styles.thAmount}>Total main-d’œuvre</th>
                  <th style={styles.thAmount}>Grand total</th>
                  <th style={styles.thStatus}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={9}>
                      <span style={styles.muted}>Aucun bon de travail.</span>
                    </td>
                  </tr>
                ) : (
                  filtered.map((bt) => {
                    const u = unitesById[bt.unite_id];
                    const kmVal = (bt as any).km ?? (bt as any).kilometrage ?? null;
                    const opened = (bt as any).date_ouverture ?? (bt as any).created_at ?? null;
                    const client = resolveClientName(bt);
                    const totalPiecesAtelier = resolvePiecesAtelier(bt);
                    const totalMainOeuvre = resolveMainOeuvre(bt);
                    const grandTotal = resolveGrandTotal(bt);

                    return (
                      <tr key={bt.id}>
                        <td style={styles.td}>
                          <span style={styles.link} onClick={() => nav(`/bt/${bt.id}`)}>
                            {bt.numero || (bt as any).no_bt || "(BT)"}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <div style={{ fontWeight: 900 }}>{u?.no_unite ?? "—"}</div>
                          <div style={styles.muted}>
                            {u ? [u.marque, u.modele, u.annee].filter(Boolean).join(" ") : ""}
                          </div>
                        </td>

                        <td style={styles.tdClient} title={client}>
                          {client}
                        </td>

                        <td style={styles.td}>{kmVal ?? "—"}</td>

                        <td style={styles.td}>{fmtDate(opened)}</td>

                        <td style={styles.tdAmount}>{money(totalPiecesAtelier)}</td>

                        <td style={styles.tdAmount}>{money(totalMainOeuvre)}</td>

                        <td style={styles.tdAmount}>
                          <strong>{money(grandTotal)}</strong>
                        </td>

                        <td style={styles.td}>
                          <span style={pill}>{statutLabel(bt.statut)}</span>
                          {Boolean(bt.verrouille) && (
                            <span style={{ ...pill, marginLeft: 8 }}>Verrouillé</span>
                          )}
                        </td>
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