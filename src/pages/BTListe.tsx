import { useEffect, useMemo, useRef, useState } from "react";
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
  return s || "—";
}

function statutTone(
  s: string | null | undefined
): { bg: string; border: string; color: string } {
  if (isOpenStatut(s)) {
    return { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" };
  }
  if (isClosedStatut(s)) {
    return { bg: "#f3f4f6", border: "#d1d5db", color: "#374151" };
  }
  if (isFacturedStatut(s)) {
    return { bg: "#ecfdf3", border: "#bbf7d0", color: "#15803d" };
  }
  if (s === "verrouille") {
    return { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
  }
  return { bg: "#f8fafc", border: "#e2e8f0", color: "#334155" };
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

  const [sortKey, setSortKey] = useState<
    "numero" | "unite" | "client" | "km" | "date" | "pieces" | "mo" | "total" | "statut"
  >("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newUniteId, setNewUniteId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [unitSearch, setUnitSearch] = useState("");
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  const unitDropdownRef = useRef<HTMLDivElement | null>(null);

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
        setUnitSearch(u[0].no_unite || "");
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

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!unitDropdownRef.current) return;
      if (!unitDropdownRef.current.contains(e.target as Node)) {
        setShowUnitDropdown(false);
      }
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function resolveClientName(bt: BT) {
    if (bt.client_nom?.trim()) return bt.client_nom.trim();
    if (bt.client_id && clientsById[bt.client_id]?.nom) return clientsById[bt.client_id].nom;

    const u = unitesById[bt.unite_id];
    if (u?.client_id && clientsById[u.client_id]?.nom) return clientsById[u.client_id].nom;

    return "—";
  }

  function resolveUnitClientName(u: Unite | null | undefined) {
    if (!u?.client_id) return "—";
    return clientsById[u.client_id]?.nom || "—";
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
      setSortDir(key === "date" ? "desc" : "asc");
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
        ? String(va).localeCompare(String(vb), "fr", {
            numeric: true,
            sensitivity: "base",
          })
        : String(vb).localeCompare(String(va), "fr", {
            numeric: true,
            sensitivity: "base",
          });
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

  const selectedUnite = useMemo(
    () => unites.find((u) => u.id === newUniteId) ?? null,
    [unites, newUniteId]
  );

  const filteredUnits = useMemo(() => {
    const term = unitSearch.trim().toLowerCase();

    const list = [...unites];

    if (!term) {
      return list.slice(0, 80);
    }

    return list
      .filter((u) => {
        const client = resolveUnitClientName(u);
        const haystack = [
          u.no_unite || "",
          u.marque || "",
          u.modele || "",
          u.annee ? String(u.annee) : "",
          client,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      })
      .slice(0, 80);
  }, [unites, unitSearch, clientsById]);

  function openNewModal() {
    setCreateErr(null);

    const first = unites[0];
    if (!newUniteId && first) {
      setNewUniteId(first.id);
      setUnitSearch(first.no_unite || "");
    } else if (selectedUnite) {
      setUnitSearch(selectedUnite.no_unite || "");
    }

    setShowUnitDropdown(false);
    setShowNewModal(true);
  }

  function closeNewModal() {
    if (creating) return;
    setCreateErr(null);
    setShowUnitDropdown(false);
    setShowNewModal(false);
  }

  function selectUnit(u: Unite) {
    setNewUniteId(u.id);
    setUnitSearch(u.no_unite || "");
    setShowUnitDropdown(false);
    setCreateErr(null);
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
        setShowNewModal(false);
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

      setShowNewModal(false);
      nav(`/bt/${data.id}`);
    } catch (e: any) {
      setCreateErr(e?.message ?? "Erreur création / ouverture BT");
    } finally {
      setCreating(false);
    }
  }

  const styles: Record<string, React.CSSProperties> = {
    page: {
      width: "100%",
      padding: 20,
      background: "#f5f7fb",
      minHeight: "100%",
    },

    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 16,
    },

    titleBlock: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },

    h1: {
      margin: 0,
      fontSize: 30,
      fontWeight: 950,
      color: "#0f172a",
      letterSpacing: "-0.02em",
    },

    subtitle: {
      color: "#64748b",
      fontSize: 14,
      fontWeight: 600,
    },

    topActions: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },

    primaryBtn: {
      height: 40,
      padding: "0 18px",
      borderRadius: 14,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontSize: 15,
      fontWeight: 900,
      cursor: "pointer",
      boxShadow: "0 1px 0 rgba(255,255,255,.22) inset",
    },

    primaryBtnDisabled: {
      height: 40,
      padding: "0 18px",
      borderRadius: 14,
      border: "1px solid #bfdbfe",
      background: "#dbeafe",
      color: "#93c5fd",
      fontSize: 15,
      fontWeight: 900,
      cursor: "not-allowed",
    },

    ghostBtn: {
      height: 40,
      padding: "0 16px",
      borderRadius: 14,
      border: "1px solid #d6dbe7",
      background: "#fff",
      color: "#0f172a",
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer",
    },

    ghostBtnDisabled: {
      height: 40,
      padding: "0 16px",
      borderRadius: 14,
      border: "1px solid #e5e7eb",
      background: "#f8fafc",
      color: "#9ca3af",
      fontSize: 14,
      fontWeight: 800,
      cursor: "not-allowed",
    },

    toolbarCard: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 18,
      padding: 14,
      marginBottom: 14,
      boxShadow: "0 10px 24px rgba(15,23,42,.04)",
    },

    searchInput: {
      height: 44,
      borderRadius: 14,
      border: "1px solid #d6dbe7",
      background: "#fff",
      padding: "0 14px",
      fontSize: 14,
      color: "#0f172a",
      outline: "none",
      minWidth: 280,
      flex: 1,
    },

    select: {
      height: 44,
      borderRadius: 14,
      border: "1px solid #d6dbe7",
      background: "#fff",
      padding: "0 12px",
      fontSize: 14,
      color: "#0f172a",
      outline: "none",
      minWidth: 160,
    },

    toolbarRight: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },

    resultsText: {
      color: "#64748b",
      fontSize: 13,
      fontWeight: 700,
      whiteSpace: "nowrap",
    },

    errorBox: {
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      color: "#9f1239",
      padding: 12,
      borderRadius: 14,
      marginBottom: 12,
      fontWeight: 700,
    },

    tableShell: {
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 18,
      overflow: "hidden",
      boxShadow: "0 10px 24px rgba(15,23,42,.04)",
    },

    tableWrap: {
      width: "100%",
      overflowX: "auto",
    },

    table: {
      width: "100%",
      minWidth: 1280,
      borderCollapse: "separate" as const,
      borderSpacing: 0,
      tableLayout: "fixed" as const,
    },

    theadRow: {
      background: "#f8fafc",
    },

    thBase: {
      padding: "16px 14px",
      fontSize: 13,
      fontWeight: 900,
      color: "#0f172a",
      textAlign: "left" as const,
      borderBottom: "1px solid #e2e8f0",
      whiteSpace: "nowrap" as const,
      background: "#f8fafc",
    },

    thAmount: {
      padding: "16px 14px",
      fontSize: 13,
      fontWeight: 900,
      color: "#0f172a",
      textAlign: "right" as const,
      borderBottom: "1px solid #e2e8f0",
      whiteSpace: "nowrap" as const,
      background: "#f8fafc",
    },

    td: {
      padding: "16px 14px",
      fontSize: 14,
      color: "#0f172a",
      borderBottom: "1px solid #eef2f7",
      verticalAlign: "middle" as const,
      whiteSpace: "nowrap" as const,
      fontWeight: 400,
    },

    tdAmount: {
      padding: "16px 14px",
      fontSize: 14,
      color: "#0f172a",
      borderBottom: "1px solid #eef2f7",
      verticalAlign: "middle" as const,
      whiteSpace: "nowrap" as const,
      textAlign: "right" as const,
      fontVariantNumeric: "tabular-nums",
      fontWeight: 400,
    },

    cellPrimary: {
      fontWeight: 400,
      color: "#0f172a",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },

    cellMuted: {
      marginTop: 4,
      fontSize: 12,
      color: "#64748b",
      overflow: "hidden",
      textOverflow: "ellipsis",
      fontWeight: 400,
    },

    btLink: {
  color: "#334155",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
},
    statusPill: {
      display: "inline-flex",
      alignItems: "center",
      padding: "6px 12px",
      borderRadius: 999,
      border: "1px solid",
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1,
    },

    lockPill: {
      display: "inline-flex",
      alignItems: "center",
      padding: "6px 12px",
      borderRadius: 999,
      border: "1px solid #fed7aa",
      background: "#fff7ed",
      color: "#c2410c",
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1,
      marginLeft: 6,
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
      fontWeight: 900,
    },

    pagerWrap: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      padding: 16,
      background: "#fff",
    },

    pagerLeft: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },

    pagerRight: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },

    emptyWrap: {
      padding: 28,
      textAlign: "center" as const,
      color: "#64748b",
      fontWeight: 700,
    },

    modalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.38)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 3000,
      padding: 20,
    },

    modalCard: {
      width: "100%",
      maxWidth: 620,
      background: "#fff",
      borderRadius: 22,
      border: "1px solid #e2e8f0",
      boxShadow: "0 25px 80px rgba(15,23,42,.24)",
      padding: 24,
    },

    modalHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 18,
    },

    modalTitle: {
      margin: 0,
      fontSize: 22,
      fontWeight: 950,
      color: "#0f172a",
    },

    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      border: "1px solid #d6dbe7",
      background: "#fff",
      color: "#475569",
      fontSize: 24,
      lineHeight: 1,
      cursor: "pointer",
    },

    fieldBlock: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginBottom: 16,
    },

    fieldLabel: {
      fontSize: 14,
      fontWeight: 900,
      color: "#334155",
    },

    unitPickerWrap: {
      position: "relative",
    },

    modalInput: {
      height: 48,
      borderRadius: 14,
      border: "1px solid #d6dbe7",
      background: "#fff",
      padding: "0 14px",
      fontSize: 15,
      color: "#0f172a",
      outline: "none",
      width: "100%",
      boxSizing: "border-box" as const,
    },

    pickerInfo: {
      marginTop: 6,
      fontSize: 12,
      color: "#64748b",
    },

    unitDropdown: {
      position: "absolute" as const,
      top: 54,
      left: 0,
      right: 0,
      background: "#fff",
      border: "1px solid #d6dbe7",
      borderRadius: 14,
      boxShadow: "0 18px 40px rgba(15,23,42,.14)",
      overflow: "hidden",
      zIndex: 30,
      maxHeight: 280,
      overflowY: "auto" as const,
    },

    unitOption: {
      padding: "12px 14px",
      borderBottom: "1px solid #eef2f7",
      cursor: "pointer",
      background: "#fff",
    },

    unitOptionActive: {
      padding: "12px 14px",
      borderBottom: "1px solid #eef2f7",
      cursor: "pointer",
      background: "#f8fafc",
    },

    unitTop: {
      fontSize: 15,
      color: "#0f172a",
      fontWeight: 700,
    },

    unitSub: {
      marginTop: 3,
      fontSize: 12,
      color: "#64748b",
      fontWeight: 400,
    },

    modalFooter: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 18,
      flexWrap: "wrap",
    },

    modalError: {
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      color: "#9f1239",
      padding: 10,
      borderRadius: 12,
      fontWeight: 700,
      marginTop: 8,
    },
  };

  function SortArrow({ col }: { col: typeof sortKey }) {
    if (sortKey !== col) return <span style={{ opacity: 0.35 }}>▼</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function renderSortableHeader(label: string, key: typeof sortKey, amount = false) {
  return (
    <th style={amount ? styles.thAmount : styles.thBase}>
      <button type="button" style={styles.sortBtn} onClick={() => handleSort(key)}>
        <span>{label}</span>
        <SortArrow col={key} />
      </button>
    </th>
  );
}

return (
  <div style={styles.page}>
    <div style={styles.topBar}>
      <div style={styles.titleBlock}>
        <h1 style={styles.h1}>Bons de travail</h1>
        <div style={styles.subtitle}>Vue liste dans le style nolisé</div>
      </div>

      <div style={styles.topActions}>
        <button type="button" style={styles.primaryBtn} onClick={openNewModal}>
          + Nouveau BT
        </button>
      </div>
    </div>

    {err ? <div style={styles.errorBox}>Erreur : {err}</div> : null}

    <div style={styles.toolbarCard}>
      <input
        style={styles.searchInput}
        placeholder="Recherche BT, unité, client, statut, kilométrage..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <select
        style={styles.select}
        value={statut}
        onChange={(e) => setStatut(e.target.value as any)}
      >
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

      <div style={styles.toolbarRight}>
        <div style={styles.resultsText}>
          {filteredSorted.length} résultat{filteredSorted.length > 1 ? "s" : ""}
        </div>
      </div>
    </div>

    <div style={styles.tableShell}>
      {loading ? (
        <div style={styles.emptyWrap}>Chargement…</div>
      ) : (
        <>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.theadRow}>
                  {renderSortableHeader("No BT", "numero")}
                  {renderSortableHeader("Unité", "unite")}
                  {renderSortableHeader("Client", "client")}
                  {renderSortableHeader("KM", "km")}
                  {renderSortableHeader("Date", "date")}
                  {renderSortableHeader("Pièces + atelier", "pieces", true)}
                  {renderSortableHeader("Main-d’œuvre", "mo", true)}
                  {renderSortableHeader("Total", "total", true)}
                  {renderSortableHeader("Statut", "statut")}
                </tr>
              </thead>

              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div style={styles.emptyWrap}>Aucun bon de travail.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((bt, index) => {
                    const u = unitesById[bt.unite_id];
                    const kmVal = (bt as any).km ?? (bt as any).kilometrage ?? null;
                    const opened = (bt as any).date_ouverture ?? (bt as any).created_at ?? null;
                    const client = resolveClientName(bt);
                    const totalPiecesAtelier = resolvePiecesAtelier(bt);
                    const totalMainOeuvre = resolveMainOeuvre(bt);
                    const grandTotal = resolveGrandTotal(bt);
                    const tone = statutTone(bt.statut);
                    const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";

                    return (
                      <tr
                        key={bt.id}
                        style={{
                          background: rowBg,
                          cursor: "default",
                          transition: "background 0.15s ease",
                        }}
                        onClick={() => nav(`/bt/${bt.id}`)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#eef2f7";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = rowBg;
                        }}
                      >
                        <td style={{ ...styles.td, background: "transparent" }}>
                          <div style={styles.btLink} title="Cliquer pour ouvrir">
                            {bt.numero || (bt as any).no_bt || "(BT)"}
                          </div>
                        </td>

                        <td style={{ ...styles.td, background: "transparent" }}>
                          <div
                            style={{
                              ...styles.cellPrimary,
                              fontWeight: 900,
                              fontSize: 16,
                              letterSpacing: "0.3px",
                            }}
                          >
                            {u?.no_unite ?? "—"}
                          </div>

                          <div style={styles.cellMuted}>
                            {u ? [u.marque, u.modele, u.annee].filter(Boolean).join(" ") : ""}
                          </div>
                        </td>

                        <td style={{ ...styles.td, background: "transparent" }} title={client}>
                          <div style={styles.cellPrimary}>{client}</div>
                        </td>

                        <td style={{ ...styles.td, background: "transparent" }}>
                          <div style={styles.cellPrimary}>{kmVal ?? "—"}</div>
                        </td>

                        <td style={{ ...styles.td, background: "transparent" }}>
                          <div style={styles.cellPrimary}>{fmtDate(opened)}</div>
                        </td>

                        <td style={{ ...styles.tdAmount, background: "transparent" }}>
                          {money(totalPiecesAtelier)}
                        </td>

                        <td style={{ ...styles.tdAmount, background: "transparent" }}>
                          {money(totalMainOeuvre)}
                        </td>

                        <td style={{ ...styles.tdAmount, background: "transparent" }}>
                          {money(grandTotal)}
                        </td>

                        <td style={{ ...styles.td, background: "transparent" }}>
                          <span
                            style={{
                              ...styles.statusPill,
                              background: tone.bg,
                              borderColor: tone.border,
                              color: tone.color,
                            }}
                          >
                            {statutLabel(bt.statut)}
                          </span>

                          {Boolean(bt.verrouille) && (
                            <span style={styles.lockPill}>Verrouillé</span>
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
                <span style={styles.resultsText}>
                  Affichage {fromRow} à {toRow} sur {filteredSorted.length}
                </span>
              </div>

              <div style={styles.pagerRight}>
                <button
                  type="button"
                  style={page <= 1 ? styles.ghostBtnDisabled : styles.ghostBtn}
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                >
                  « Première
                </button>

                <button
                  type="button"
                  style={page <= 1 ? styles.ghostBtnDisabled : styles.ghostBtn}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  ‹ Précédente
                </button>

                <button type="button" style={styles.primaryBtn}>
                  Page {page} / {totalPages}
                </button>

                <button
                  type="button"
                  style={page >= totalPages ? styles.ghostBtnDisabled : styles.ghostBtn}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Suivante ›
                </button>

                <button
                  type="button"
                  style={page >= totalPages ? styles.ghostBtnDisabled : styles.ghostBtn}
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

      {showNewModal && (
        <div style={styles.modalOverlay} onMouseDown={closeNewModal}>
          <div style={styles.modalCard} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Nouveau bon de travail</h2>
              <button
                type="button"
                style={styles.iconBtn}
                onClick={closeNewModal}
                disabled={creating}
                aria-label="Fermer"
                title="Fermer"
              >
                ×
              </button>
            </div>

            <div style={styles.fieldBlock}>
              <label style={styles.fieldLabel}>Unité</label>

              <div style={styles.unitPickerWrap} ref={unitDropdownRef}>
                <input
                  style={styles.modalInput}
                  value={unitSearch}
                  placeholder="Taper une unité, modèle ou client..."
                  onChange={(e) => {
                    setUnitSearch(e.target.value);
                    setShowUnitDropdown(true);
                  }}
                  onFocus={() => setShowUnitDropdown(true)}
                  disabled={creating}
                />

                <div style={styles.pickerInfo}>
                  {selectedUnite ? (
                    <>
                      Sélectionné : {selectedUnite.no_unite}
                      {"  "}
                      •
                      {"  "}
                      Client : {resolveUnitClientName(selectedUnite)}
                    </>
                  ) : (
                    "Aucune unité sélectionnée"
                  )}
                </div>

                {showUnitDropdown && (
                  <div style={styles.unitDropdown}>
                    {filteredUnits.length === 0 ? (
                      <div style={styles.unitOption}>
                        <div style={styles.unitTop}>Aucun résultat</div>
                      </div>
                    ) : (
                      filteredUnits.map((u) => {
                        const client = resolveUnitClientName(u);
                        const desc = [u.marque, u.modele, u.annee].filter(Boolean).join(" ");
                        const active = u.id === newUniteId;

                        return (
                          <div
                            key={u.id}
                            style={active ? styles.unitOptionActive : styles.unitOption}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectUnit(u);
                            }}
                          >
                            <div style={styles.unitTop}>{u.no_unite}</div>
                            <div style={styles.unitSub}>
                              {[desc, client].filter(Boolean).join(" • ")}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {createErr ? <div style={styles.modalError}>{createErr}</div> : null}

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.ghostBtn}
                onClick={closeNewModal}
                disabled={creating}
              >
                Annuler
              </button>

              <button
                type="button"
                style={creating || !newUniteId ? styles.primaryBtnDisabled : styles.primaryBtn}
                onClick={createBT}
                disabled={creating || !newUniteId}
              >
                {creating ? "Ouverture…" : "Ouvrir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}