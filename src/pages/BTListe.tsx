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

  const [sortKey, setSortKey] = useState<
    "numero" | "unite" | "client" | "km" | "date" | "pieces" | "mo" | "total" | "statut"
  >("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
        supabase
          .from("bons_travail")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300),
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

  function handleSort(
    key: "numero" | "unite" | "client" | "km" | "date" | "pieces" | "mo" | "total" | "statut"
  ) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortValue(bt: BT, key: string) {
    const u = unitesById[bt.unite_id];

    switch (key) {
      case "numero":
        return bt.numero || "";
      case "unite":
        return u?.no_unite || "";
      case "client":
        return resolveClientName(bt);
      case "km":
        return Number((bt as any).km ?? (bt as any).kilometrage ?? 0);
      case "date":
        return new Date(bt.date_ouverture || bt.created_at || 0).getTime();
      case "pieces":
        return resolvePiecesAtelier(bt);
      case "mo":
        return resolveMainOeuvre(bt);
      case "total":
        return resolveGrandTotal(bt);
      case "statut":
        return statutLabel(bt.statut || "");
      default:
        return "";
    }
  }

  const filteredSorted = useMemo(() => {
    const term = q.trim().toLowerCase();

    const list = bts.filter((bt) => {
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
        String((bt as any).km ?? (bt as any).kilometrage ?? ""),
        String(totalPiecesAtelier),
        String(totalMo),
        String(grandTotal),
        u ? [u.marque, u.modele, u.annee].filter(Boolean).join(" ") : "",
      ]
        .join(" ")
        .toLowerCase();

      return s.includes(term);
    });

    list.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);

      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }

      return sortDir === "asc"
        ? String(va).localeCompare(String(vb), "fr", { numeric: true, sensitivity: "base" })
        : String(vb).localeCompare(String(va), "fr", { numeric: true, sensitivity: "base" });
    });

    return list;
  }, [bts, q, statut, sortKey, sortDir, unitesById, clientsById]);

  useEffect(() => {
    setPage(1);
  }, [q, statut, sortKey, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page, pageSize]);

  const fromRow = filteredSorted.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, filteredSorted.length);

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

btnSecondaryDisabled: {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,.08)",
  background: "#f3f4f6",
  color: "#9ca3af",
  fontWeight: 800,
  cursor: "not-allowed",
  opacity: 0.8,
},

    btnSecondary: {
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      color: "#111",
      fontWeight: 800,
      cursor: "pointer",
    },
    btnPageActive: {
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
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
      minWidth: 160,
    },
    tableWrap: {
      width: "100%",
      overflowX: "auto",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      minWidth: 1160,
      tableLayout: "fixed" as const,
    },
    th: {
      textAlign: "left" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      whiteSpace: "nowrap" as const,
      userSelect: "none" as const,
    },
    thAmount: {
      textAlign: "right" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      whiteSpace: "nowrap" as const,
      width: 140,
      userSelect: "none" as const,
    },
    thClient: {
      textAlign: "left" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      whiteSpace: "nowrap" as const,
      width: 240,
      userSelect: "none" as const,
    },
    thStatus: {
      textAlign: "left" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      whiteSpace: "nowrap" as const,
      width: 120,
      userSelect: "none" as const,
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
      maxWidth: 240,
    },
    link: { color: "#2563eb", cursor: "pointer", textDecoration: "underline" },
    errBox: {
      background: "rgba(220,38,38,.07)",
      border: "1px solid rgba(220,38,38,.2)",
      padding: 10,
      borderRadius: 12,
    },
    sortBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "transparent",
      border: "none",
      padding: 0,
      margin: 0,
      font: "inherit",
      color: "inherit",
      cursor: "pointer",
      fontWeight: 800,
    },
    pagerWrap: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      marginTop: 14,
      paddingTop: 12,
      borderTop: "1px solid rgba(0,0,0,.08)",
    },
    pagerLeft: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap",
    },
    pagerRight: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap",
    },
  };

  function SortArrow({ col }: { col: typeof sortKey }) {
    if (sortKey !== col) return <span style={{ opacity: 0.35 }}>↕</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function renderSortableHeader(
    label: string,
    key: typeof sortKey,
    style: React.CSSProperties
  ) {
    return (
      <th style={style}>
        <button type="button" style={styles.sortBtn} onClick={() => handleSort(key)}>
          <span>{label}</span>
          <SortArrow col={key} />
        </button>
      </th>
    );
  }

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
        <div style={{ fontWeight: 950 }}>Sélectionner un véhicule</div>

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

          <select
            style={styles.select}
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value="10">10 / page</option>
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>

          <div style={{ marginLeft: "auto" }}>
            <span style={styles.muted}>{filteredSorted.length}</span>
            <span style={styles.muted}> résultat(s)</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 10 }}>Chargement…</div>
        ) : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {renderSortableHeader("BT", "numero", styles.th)}
                    {renderSortableHeader("Unité", "unite", styles.th)}
                    {renderSortableHeader("Client", "client", styles.thClient)}
                    {renderSortableHeader("KM", "km", styles.th)}
                    {renderSortableHeader("Ouverture", "date", styles.th)}
                    {renderSortableHeader("Total pièces + atelier", "pieces", styles.thAmount)}
                    {renderSortableHeader("Total main-d’œuvre", "mo", styles.thAmount)}
                    {renderSortableHeader("Grand total", "total", styles.thAmount)}
                    {renderSortableHeader("Statut", "statut", styles.thStatus)}
                  </tr>
                </thead>

                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={9}>
                        <span style={styles.muted}>Aucun bon de travail.</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((bt) => {
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

            <div style={styles.pagerWrap}>
  <div style={styles.pagerLeft}>
    <span style={styles.muted}>
      Affichage {fromRow} à {toRow} sur {filteredSorted.length}
    </span>
  </div>

  <div style={styles.pagerRight}>
    <button
      type="button"
      style={page <= 1 ? styles.btnSecondaryDisabled : styles.btnSecondary}
      onClick={() => setPage(1)}
      disabled={page <= 1}
    >
      « Première
    </button>

    <button
      type="button"
      style={page <= 1 ? styles.btnSecondaryDisabled : styles.btnSecondary}
      onClick={() => setPage((p) => Math.max(1, p - 1))}
      disabled={page <= 1}
    >
      ‹ Précédente
    </button>

    <button type="button" style={styles.btnPageActive}>
      Page {page} / {totalPages}
    </button>

    <button
      type="button"
      style={page >= totalPages ? styles.btnSecondaryDisabled : styles.btnSecondary}
      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
      disabled={page >= totalPages}
    >
      Suivante ›
    </button>

    <button
      type="button"
      style={page >= totalPages ? styles.btnSecondaryDisabled : styles.btnSecondary}
      onClick={() => setPage(totalPages)}
      disabled={page >= totalPages}
    >
      Dernière »
    </button>
  </div>
</div>
          </>
        )}
      </div>
    </div>
  );
}