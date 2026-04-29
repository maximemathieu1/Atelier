import { useEffect, useMemo, useRef, useState, type CSSProperties, type SetStateAction } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { type Piece } from "../components/bt/BtPiecesCard";
import BonTravailHeaderCard from "../components/bt/BonTravailHeaderCard";
import BonTravailOperations from "../components/bt/BonTravailOperations";
import btPrintTemplate from "../templates/btPrintTemplate";


type Unite = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  km_actuel: number | null;
  statut: string;
  niv?: string | null;
  plaque?: string | null;
  client_id?: string | null;
  type_unite_id?: string | null;
};

type Client = {
  id: string;
  nom: string;
};

type ClientConfig = {
  id: string;
  client_id: string;
  taux_horaire: number | null;
  marge_pieces: number | null;
  frais_atelier_pourcentage: number | null;
  actif?: boolean | null;
  note_facturation?: string | null;
};

type ClientTauxMO = {
  id: string;
  client_id: string;
  type_unite_id: string | null;
  taux_horaire: number;
  actif: boolean;
};

type BonTravail = {
  id: string;
  numero?: string | null;
  bon_commande?: string | null;
  unite_id: string;
  statut: string;
  verrouille?: boolean | null;
  note?: string | null;
  date_ouverture?: string | null;
  date_fermeture?: string | null;
  km?: number | null;
  client_id?: string | null;
  client_nom?: string | null;
  taux_horaire_snapshot?: number | null;
  marge_pieces_snapshot?: number | null;
  frais_atelier_pct_snapshot?: number | null;
  tps_rate_snapshot?: number | null;
  tvq_rate_snapshot?: number | null;
  total_pieces?: number | null;
  total_main_oeuvre?: number | null;
  total_frais_atelier?: number | null;
  total_general?: number | null;
  total_tps?: number | null;
  total_tvq?: number | null;
  total_final?: number | null;
};

type ParametresEntreprise = {
  tps_rate: number | null;
  tvq_rate: number | null;
};

type NoteMeca = {
  id: string;
  unite_id: string;
  titre: string;
  details: string | null;
  created_at: string;
  entretien_template_item_id?: string | null;
  entretien_unite_item_id?: string | null;
  entretien_auto?: boolean | null;
};

type TacheEffectuee = {
  id: string;
  bt_id: string;
  unite_id: string;
  unite_note_id: string | null;
  titre: string;
  details: string | null;
  date_effectuee: string;
  entretien_template_item_id?: string | null;
  entretien_unite_item_id?: string | null;
  entretien_auto?: boolean | null;
};

type AutorisationDecision = "autorise" | "refuse" | "attente" | "a_discuter";

type AutorisationInfo = {
  decision: AutorisationDecision;
  note_client: string | null;
  autorisation_tache_id: string;
};

type MainOeuvreRow = {
  id: string;
  bt_id: string;
  mecano_nom: string;
  description: string | null;
  heures: number;
  taux_horaire: number;
  created_at?: string | null;
};

type BtPointage = {
  id: string;
  bt_id: string;
  mecano_nom: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  actif: boolean;
  note: string | null;
  created_at?: string | null;
};

type PointageResume = {
  mecano_nom: string;
  minutes: number;
  heures: number;
};

function isOpenStatut(statut: string | null | undefined) {
  return statut === "ouvert" || statut === "a_faire" || statut === "en_cours";
}

function isClosedStatut(statut: string | null | undefined) {
  return statut === "ferme" || statut === "termine" || statut === "a_facturer";
}

function isFacturedStatut(statut: string | null | undefined) {
  return statut === "facture";
}

function round2(v: number) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
}

function isoToDateTimeLocal(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localToIsoOrNull(v: string) {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function minutesFromPointage(p: BtPointage) {
  if (p.duration_minutes != null) return Number(p.duration_minutes || 0);
  const a = new Date(p.started_at).getTime();
  const b = new Date(p.ended_at || new Date().toISOString()).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 60000);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value: number | null | undefined) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDateTimePrint(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatDatePrint(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function fmtHours(value: number | null | undefined) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("fr-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function BonTravailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [bt, setBt] = useState<BonTravail | null>(null);
  const [unite, setUnite] = useState<Unite | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [clientCfg, setClientCfg] = useState<ClientConfig | null>(null);
  const [clientTauxRows, setClientTauxRows] = useState<ClientTauxMO[]>([]);
  const [paramEntreprise, setParamEntreprise] = useState<ParametresEntreprise | null>(null);

  const [notes, setNotes] = useState<NoteMeca[]>([]);
  const [autorisationMap, setAutorisationMap] = useState<Record<string, AutorisationInfo>>({});
  const [tachesEffectuees, setTachesEffectuees] = useState<TacheEffectuee[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [mainOeuvre, setMainOeuvre] = useState<MainOeuvreRow[]>([]);
  const [pointages, setPointages] = useState<BtPointage[]>([]);
  const [pointagesTableAvailable, setPointagesTableAvailable] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [kmInput, setKmInput] = useState<string>("");
  const [poInput, setPoInput] = useState<string>("");
  const [dateOuvertureInput, setDateOuvertureInput] = useState<string>("");
  const [dateFermetureInput, setDateFermetureInput] = useState<string>("");

  const [piecesTableAvailable, setPiecesTableAvailable] = useState(true);
  const [mainOeuvreTableAvailable, setMainOeuvreTableAvailable] = useState(true);

  const [newMoMecano, setNewMoMecano] = useState("");
  const [newMoDesc, setNewMoDesc] = useState("");
  const [newMoHeures, setNewMoHeures] = useState("");
  const [newMoTaux, setNewMoTaux] = useState("");

  const [pointageMenuOpenId, setPointageMenuOpenId] = useState<string | null>(null);
  const [editingPointageId, setEditingPointageId] = useState<string | null>(null);
  const [editingPointageStart, setEditingPointageStart] = useState("");
  const [editingPointageEnd, setEditingPointageEnd] = useState("");

  const [mainOeuvreMenuOpenId, setMainOeuvreMenuOpenId] = useState<string | null>(null);
  const [editingMainOeuvreId, setEditingMainOeuvreId] = useState<string | null>(null);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalValue, setTaskModalValue] = useState("");

  const [autorisationModalTask, setAutorisationModalTask] = useState<NoteMeca | null>(null);
  const [autorisationModalNote, setAutorisationModalNote] = useState("");
  const [savingAutorisationModal, setSavingAutorisationModal] = useState(false);

  const [tempsModalOpen, setTempsModalOpen] = useState(false);

  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHeaderRef = useRef<string>("");

  const [confirmTerminerOpen, setConfirmTerminerOpen] = useState(false);
  const [savingTerminer, setSavingTerminer] = useState(false);

  const [activeTab, setActiveTab] = useState<"details" | "documents">("details");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [draggingDocuments, setDraggingDocuments] = useState(false);

  const selectedIds = useMemo(() => {
  return selectedOrder.filter((id) => selected[id]);
}, [selected, selectedOrder]);

  function setSelectedInClickOrder(value: SetStateAction<Record<string, boolean>>) {
    setSelected((prev) => {
      const next = typeof value === "function" ? value(prev) : value;

      setSelectedOrder((prevOrder) => {
        const stillSelected = prevOrder.filter((selectedId) => next[selectedId]);
        const newlySelected = Object.keys(next).filter(
          (selectedId) => next[selectedId] && !prev[selectedId] && !stillSelected.includes(selectedId)
        );
        const missingSelected = Object.keys(next).filter(
          (selectedId) => next[selectedId] && !stillSelected.includes(selectedId) && !newlySelected.includes(selectedId)
        );
        return [...stillSelected, ...newlySelected, ...missingSelected];
      });

      return next;
    });
  }

  const snapshotClientNom = useMemo(() => bt?.client_nom?.trim() || client?.nom || "—", [bt, client]);

  const dynamicTauxHoraire = useMemo(() => {
    if (!unite || !clientCfg) return Number(clientCfg?.taux_horaire || 0);
    const typeId = unite.type_unite_id ?? null;
    const specific = clientTauxRows.find((r) => r.actif && r.type_unite_id === typeId);
    if (specific) return Number(specific.taux_horaire || 0);
    return Number(clientCfg.taux_horaire || 0);
  }, [unite, clientCfg, clientTauxRows]);

  const liveTpsRate = Number(paramEntreprise?.tps_rate ?? 0.05);
  const liveTvqRate = Number(paramEntreprise?.tvq_rate ?? 0.09975);

  const isBtOpenPricing = useMemo(() => {
    if (!bt) return false;
    return isOpenStatut(bt.statut);
  }, [bt]);

  const effectiveMargePiecesPct = useMemo(() => {
    if (isBtOpenPricing) return Number(clientCfg?.marge_pieces || 0);
    if (bt?.marge_pieces_snapshot != null) return Number(bt.marge_pieces_snapshot || 0);
    return Number(clientCfg?.marge_pieces || 0);
  }, [isBtOpenPricing, bt, clientCfg]);

  const effectiveFraisAtelierPct = useMemo(() => {
    if (isBtOpenPricing) return Number(clientCfg?.frais_atelier_pourcentage || 0);
    if (bt?.frais_atelier_pct_snapshot != null) return Number(bt.frais_atelier_pct_snapshot || 0);
    return Number(clientCfg?.frais_atelier_pourcentage || 0);
  }, [isBtOpenPricing, bt, clientCfg]);

  const effectiveTauxHoraire = useMemo(() => {
    if (isBtOpenPricing) return dynamicTauxHoraire;
    if (bt?.taux_horaire_snapshot != null) return Number(bt.taux_horaire_snapshot || 0);
    return dynamicTauxHoraire;
  }, [isBtOpenPricing, bt, dynamicTauxHoraire]);

  const effectiveTpsRate = useMemo(() => {
    if (isBtOpenPricing) return liveTpsRate;
    if (bt?.tps_rate_snapshot != null) return Number(bt.tps_rate_snapshot || 0);
    return liveTpsRate;
  }, [isBtOpenPricing, bt, liveTpsRate]);

  const effectiveTvqRate = useMemo(() => {
    if (isBtOpenPricing) return liveTvqRate;
    if (bt?.tvq_rate_snapshot != null) return Number(bt.tvq_rate_snapshot || 0);
    return liveTvqRate;
  }, [isBtOpenPricing, bt, liveTvqRate]);

  const pointagesResume = useMemo<PointageResume[]>(() => {
    const map = new Map<string, number>();

    for (const p of pointages) {
      const nom = String(p.mecano_nom || "").trim() || "—";
      const mins = minutesFromPointage(p);
      map.set(nom, (map.get(nom) || 0) + mins);
    }

    return Array.from(map.entries())
      .map(([mecano_nom, minutes]) => ({
        mecano_nom,
        minutes,
        heures: minutes / 60,
      }))
      .sort((a, b) => a.mecano_nom.localeCompare(b.mecano_nom, "fr"));
  }, [pointages]);

  const totalPointagesMainOeuvre = useMemo(
    () => pointagesResume.reduce((sum, r) => sum + r.heures * effectiveTauxHoraire, 0),
    [pointagesResume, effectiveTauxHoraire]
  );

  function getPieceFactureU(p: Piece) {
    if (isBtOpenPricing) {
      const coutU = Number((p as any).prix_unitaire || 0);
      return coutU * (1 + effectiveMargePiecesPct / 100);
    }

    if ((p as any).prix_facture_unitaire_snapshot != null) {
      return Number((p as any).prix_facture_unitaire_snapshot || 0);
    }

    const coutU = Number((p as any).prix_unitaire || 0);
    const margePct =
      (p as any).marge_pct_snapshot != null
        ? Number((p as any).marge_pct_snapshot || 0)
        : effectiveMargePiecesPct;

    return coutU * (1 + margePct / 100);
  }

  function getPieceTotalFacture(p: Piece) {
    if (isBtOpenPricing) {
      return Number((p as any).quantite || 0) * getPieceFactureU(p);
    }

    if ((p as any).total_facture_snapshot != null) {
      return Number((p as any).total_facture_snapshot || 0);
    }

    return Number((p as any).quantite || 0) * getPieceFactureU(p);
  }

  const totalPiecesCout = useMemo(
    () =>
      pieces.reduce((sum, p) => {
        const q = Number((p as any).quantite || 0);
        const pu = Number((p as any).prix_unitaire || 0);
        return sum + q * pu;
      }, 0),
    [pieces]
  );

  const totalPiecesFacture = useMemo(
    () => pieces.reduce((sum, p) => sum + getPieceTotalFacture(p), 0),
    [pieces, effectiveMargePiecesPct, isBtOpenPricing]
  );

  const totalMainOeuvreManuelle = useMemo(
    () =>
      mainOeuvre.reduce((sum, row) => {
        const h = Number(row.heures || 0);
        const t = isBtOpenPricing ? effectiveTauxHoraire : Number(row.taux_horaire || 0);
        return sum + h * t;
      }, 0),
    [mainOeuvre, isBtOpenPricing, effectiveTauxHoraire]
  );

  const totalMainOeuvre = useMemo(
    () => totalPointagesMainOeuvre + totalMainOeuvreManuelle,
    [totalPointagesMainOeuvre, totalMainOeuvreManuelle]
  );

  const totalFraisAtelier = useMemo(
    () => totalMainOeuvre * (effectiveFraisAtelierPct / 100),
    [totalMainOeuvre, effectiveFraisAtelierPct]
  );

  const totalGeneral = useMemo(
    () => totalPiecesFacture + totalMainOeuvre + totalFraisAtelier,
    [totalPiecesFacture, totalMainOeuvre, totalFraisAtelier]
  );

  const totalTPS = useMemo(() => round2(totalGeneral * effectiveTpsRate), [totalGeneral, effectiveTpsRate]);
  const totalTVQ = useMemo(() => round2(totalGeneral * effectiveTvqRate), [totalGeneral, effectiveTvqRate]);
  const totalFinal = useMemo(() => round2(totalGeneral + totalTPS + totalTVQ), [totalGeneral, totalTPS, totalTVQ]);

  const hasKmColumn = useMemo(() => {
    if (!bt) return false;
    return Object.prototype.hasOwnProperty.call(bt as any, "km");
  }, [bt]);

  const isClosed = useMemo(() => {
    if (!bt) return false;
    return isClosedStatut(bt.statut) || Boolean(bt.date_fermeture);
  }, [bt]);

  const isReadOnly = useMemo(() => {
    if (!bt) return false;
    return Boolean(bt.verrouille) || isFacturedStatut(bt.statut) || isClosed;
  }, [bt, isClosed]);

  const currentHeaderSignature = useMemo(() => {
    const rawKm = kmInput.trim();
    const km = rawKm ? Number(rawKm) : null;

    return JSON.stringify({
      km: rawKm && km !== null && Number.isFinite(km) ? km : null,
      bon_commande: poInput.trim() || null,
      date_ouverture: localToIsoOrNull(dateOuvertureInput),
      date_fermeture: localToIsoOrNull(dateFermetureInput),
    });
  }, [kmInput, poInput, dateOuvertureInput, dateFermetureInput]);

  useEffect(() => {
    if (effectiveTauxHoraire > 0 && !newMoTaux.trim()) {
      setNewMoTaux(String(effectiveTauxHoraire));
    }
  }, [effectiveTauxHoraire, newMoTaux]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const inPointageMenu = target.closest('[data-menu-root="pointage"]');
      const inMainOeuvreMenu = target.closest('[data-menu-root="mainoeuvre"]');

      if (!inPointageMenu) setPointageMenuOpenId(null);
      if (!inMainOeuvreMenu) setMainOeuvreMenuOpenId(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, []);

  async function loadPieces(btId: string) {
    try {
      const { data, error } = await supabase
        .from("bt_pieces")
        .select("*")
        .eq("bt_id", btId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setPieces((data || []) as Piece[]);
      setPiecesTableAvailable(true);
    } catch {
      setPieces([]);
      setPiecesTableAvailable(false);
    }
  }

  async function loadMainOeuvre(btId: string) {
    try {
      const { data, error } = await supabase
        .from("bt_main_oeuvre")
        .select("*")
        .eq("bt_id", btId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMainOeuvre((data || []) as MainOeuvreRow[]);
      setMainOeuvreTableAvailable(true);
    } catch {
      setMainOeuvre([]);
      setMainOeuvreTableAvailable(false);
    }
  }

  async function loadPointages(btId: string) {
    try {
      const { data, error } = await supabase
        .from("bt_pointages")
        .select("*")
        .eq("bt_id", btId)
        .order("started_at", { ascending: true });

      if (error) throw error;
      setPointages((data || []) as BtPointage[]);
      setPointagesTableAvailable(true);
    } catch {
      setPointages([]);
      setPointagesTableAvailable(false);
    }
  }

  async function loadDocuments(btId: string) {
    setDocumentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("bt_documents")
        .select("*")
        .eq("bt_id", btId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch {
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  }


  async function loadAutorisations(btId: string) {
    try {
      const { data, error } = await supabase
        .from("bt_autorisation_taches")
        .select("id, unite_note_id, decision, note_client, created_at")
        .eq("bt_id", btId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const map: Record<string, AutorisationInfo> = {};

      for (const row of data || []) {
        const noteId = String((row as any).unite_note_id || "").trim();
        if (!noteId) continue;

        const decision = String((row as any).decision || "").trim();

        map[noteId] = {
          autorisation_tache_id: String((row as any).id || ""),
          decision:
            decision === "autorise" || decision === "refuse" || decision === "a_discuter"
              ? decision
              : "attente",
          note_client: (row as any).note_client ?? null,
        };
      }

      setAutorisationMap(map);
    } catch (e) {
      console.error("Erreur chargement autorisations BT:", e);
      setAutorisationMap({});
    }
  }

  async function openDocument(doc: any) {
    try {
      if (doc.type === "pep" && doc.pep_id) {
        const { data, error } = await supabase
          .from("pep_archives")
          .select("html_complet")
          .eq("id", doc.pep_id)
          .maybeSingle();

        if (!error && data?.html_complet) {
          const w = window.open("", "_blank");
          if (!w) {
            alert("Popup bloqué");
            return;
          }
          w.document.open();
          w.document.write(String(data.html_complet || ""));
          w.document.close();
          return;
        }
      }

      const { data, error } = await supabase.storage
        .from("bt-documents")
        .createSignedUrl(String(doc.storage_path || ""), 60);

      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      alert(e?.message || "Impossible d'ouvrir le document.");
    }
  }

  async function handleUploadDocuments(files: FileList | File[]) {
    if (!bt?.id) return;

    const validFiles = Array.from(files || []).filter(Boolean);
    if (!validFiles.length) return;

    setUploadingDocuments(true);

    try {
      for (const file of validFiles) {
        const cleanName = String(file.name || "document")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .replace(/_+/g, "_");

        const path = `bt/${bt.id}/manual/${Date.now()}-${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from("bt-documents")
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        const mimeType = (file as any).type || null;
        const size = Number((file as any).size || 0) || null;

        const { error: insertError } = await supabase.from("bt_documents").insert({
          bt_id: bt.id,
          type: mimeType?.startsWith("image/") ? "photo" : "autre",
          nom_fichier: file.name,
          storage_path: path,
          mime_type: mimeType,
          taille_bytes: size,
          source: "manuel",
        });

        if (insertError) throw insertError;
      }

      await loadDocuments(bt.id);
    } catch (e: any) {
      alert(e?.message || "Erreur lors de l'ajout du document.");
    } finally {
      setUploadingDocuments(false);
      setDraggingDocuments(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteDocument(doc: any) {
  if (!bt?.id) return;

  const isPep = doc.type === "pep";

  const ok = window.confirm(
    isPep
      ? "Supprimer complètement ce PEP ? Le PDF, l’archive, la tâche effectuée et l’historique d’entretien seront supprimés."
      : "Supprimer ce document ?"
  );

  if (!ok) return;

  const storagePath = String(doc.storage_path || "");
  const pepId = String(doc.pep_id || "");

  try {
    // 1. Supprimer fichier storage si vrai fichier
    if (storagePath && !storagePath.startsWith("pep_archive:")) {
      await supabase.storage.from("bt-documents").remove([storagePath]);
    }

    // 2. Si PEP, supprimer historique + tâche effectuée + archive
    if (isPep) {
      await supabase
        .from("bt_taches_effectuees")
        .delete()
        .eq("bt_id", bt.id)
        .eq("entretien_template_item_id", "d71006cc-cfd7-4e49-83dd-918ee4201b89");

      await supabase
        .from("unite_entretien_historique")
        .delete()
        .eq("bt_id", bt.id)
        .eq("template_item_id", "d71006cc-cfd7-4e49-83dd-918ee4201b89");

      if (pepId) {
        await supabase
          .from("pep_archives")
          .delete()
          .eq("id", pepId);
      }
    }

    // 3. Supprimer lien document BT
    const { error: docErr } = await supabase
      .from("bt_documents")
      .delete()
      .eq("id", doc.id);

    if (docErr) throw docErr;

    // 4. Recalculer les entretiens à venir
    if (isPep) {
      await supabase.rpc("sync_entretien_due_tasks", {
        p_unite_id: bt.unite_id,
        p_bt_id: bt.id,
      });
    }

    await loadDocuments(bt.id);
  } catch (e: any) {
    alert(e?.message || "Erreur pendant la suppression du document.");
  }
}

  function onDocumentsDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDraggingDocuments(false);
    if (isReadOnly) return;
    const files = e.dataTransfer?.files;
    if (files?.length) void handleUploadDocuments(files);
  }

  async function syncInventaireInstallationsForBt(btId: string) {
    try {
      const { error } = await supabase.rpc("atelier_sync_installations_bt", {
        p_bt_id: btId,
      });

      if (error) {
        console.error("Sync inventaire_installations BT:", error);
      }
    } catch (e) {
      console.error("Sync inventaire_installations BT:", e);
    }
  }

  async function recalcAndPersistTotals(btId: string) {
    const { data: btRaw, error: eBt } = await supabase
      .from("bons_travail")
      .select("*")
      .eq("id", btId)
      .single();

    if (eBt) throw eBt;

    const btRow = btRaw as BonTravail;

    const { data: uRaw, error: eU } = await supabase
      .from("unites")
      .select("*")
      .eq("id", btRow.unite_id)
      .single();

    if (eU) throw eU;

    const unitRow = uRaw as Unite;

    let liveCfg: ClientConfig | null = null;
    let liveTaux: ClientTauxMO[] = [];
    let liveParams: ParametresEntreprise | null = null;

    if (unitRow.client_id) {
      const [cfgRes, tauxRes, paramsRes] = await Promise.all([
        supabase
          .from("client_configuration")
          .select("id,client_id,taux_horaire,marge_pieces,frais_atelier_pourcentage,actif,note_facturation")
          .eq("client_id", unitRow.client_id)
          .maybeSingle(),
        supabase
          .from("client_taux_main_oeuvre")
          .select("id,client_id,type_unite_id,taux_horaire,actif")
          .eq("client_id", unitRow.client_id),
        supabase
          .from("parametres_entreprise")
          .select("tps_rate,tvq_rate")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cfgRes.data) liveCfg = cfgRes.data as ClientConfig;
      if (tauxRes.data) liveTaux = (tauxRes.data || []) as ClientTauxMO[];
      if (paramsRes.data) liveParams = paramsRes.data as ParametresEntreprise;
    } else {
      const { data: paramsData } = await supabase
        .from("parametres_entreprise")
        .select("tps_rate,tvq_rate")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paramsData) liveParams = paramsData as ParametresEntreprise;
    }

    const typeId = unitRow.type_unite_id ?? null;
    const specificRate = liveTaux.find((r) => r.actif && r.type_unite_id === typeId);

    const dynamicRate = specificRate
      ? Number(specificRate.taux_horaire || 0)
      : Number(liveCfg?.taux_horaire || 0);

    const liveTps = Number(liveParams?.tps_rate ?? 0.05);
    const liveTvq = Number(liveParams?.tvq_rate ?? 0.09975);

    const btIsOpenPricing = isOpenStatut(btRow.statut);

    const recalcMargePiecesPct = btIsOpenPricing
      ? Number(liveCfg?.marge_pieces || 0)
      : Number(btRow.marge_pieces_snapshot ?? liveCfg?.marge_pieces ?? 0);

    const recalcFraisAtelierPct = btIsOpenPricing
      ? Number(liveCfg?.frais_atelier_pourcentage || 0)
      : Number(btRow.frais_atelier_pct_snapshot ?? liveCfg?.frais_atelier_pourcentage ?? 0);

    const recalcTauxHoraire = btIsOpenPricing
      ? Number(dynamicRate || 0)
      : Number(btRow.taux_horaire_snapshot ?? dynamicRate ?? 0);

    const recalcTpsRate = btIsOpenPricing ? liveTps : Number(btRow.tps_rate_snapshot ?? liveTps ?? 0);
    const recalcTvqRate = btIsOpenPricing ? liveTvq : Number(btRow.tvq_rate_snapshot ?? liveTvq ?? 0);

    const [
      { data: piecesRaw, error: ePieces },
      { data: moRaw, error: eMo },
      { data: pointagesRaw, error: ePointages },
    ] = await Promise.all([
      supabase.from("bt_pieces").select("*").eq("bt_id", btId),
      supabase.from("bt_main_oeuvre").select("*").eq("bt_id", btId),
      supabase.from("bt_pointages").select("*").eq("bt_id", btId),
    ]);

    if (ePieces) throw ePieces;
    if (eMo) throw eMo;
    if (ePointages) throw ePointages;

    const piecesRows = (piecesRaw || []) as Piece[];
    const moRows = (moRaw || []) as MainOeuvreRow[];
    const pointagesRows = (pointagesRaw || []) as BtPointage[];

    const recalcTotalPieces = piecesRows.reduce((sum, p) => {
      const q = Number((p as any).quantite || 0);

      if (btIsOpenPricing) {
        const coutU = Number((p as any).prix_unitaire || 0);
        const prixFactureU = coutU * (1 + recalcMargePiecesPct / 100);
        return sum + q * prixFactureU;
      }

      if ((p as any).total_facture_snapshot != null) {
        return sum + Number((p as any).total_facture_snapshot || 0);
      }

      const coutU = Number((p as any).prix_unitaire || 0);
      const margePct =
        (p as any).marge_pct_snapshot != null
          ? Number((p as any).marge_pct_snapshot || 0)
          : recalcMargePiecesPct;

      return sum + q * (coutU * (1 + margePct / 100));
    }, 0);

    const minutesByMecano = new Map<string, number>();
    for (const p of pointagesRows) {
      const nom = String(p.mecano_nom || "").trim() || "—";
      let mins = 0;

      if (p.duration_minutes != null) {
        mins = Number(p.duration_minutes || 0);
      } else {
        const a = new Date(p.started_at).getTime();
        const b = new Date(p.ended_at || new Date().toISOString()).getTime();
        if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
          mins = Math.round((b - a) / 60000);
        }
      }

      minutesByMecano.set(nom, (minutesByMecano.get(nom) || 0) + mins);
    }

    const recalcTotalPointagesMainOeuvre = Array.from(minutesByMecano.values()).reduce(
      (sum, minutes) => sum + (minutes / 60) * recalcTauxHoraire,
      0
    );

    const recalcTotalMainOeuvreManuelle = moRows.reduce((sum, row) => {
      const h = Number(row.heures || 0);
      const t = btIsOpenPricing ? recalcTauxHoraire : Number(row.taux_horaire || 0);
      return sum + h * t;
    }, 0);

    const recalcTotalMainOeuvre = recalcTotalPointagesMainOeuvre + recalcTotalMainOeuvreManuelle;
    const recalcTotalFraisAtelier = recalcTotalMainOeuvre * (recalcFraisAtelierPct / 100);
    const recalcTotalGeneral = recalcTotalPieces + recalcTotalMainOeuvre + recalcTotalFraisAtelier;
    const recalcTotalTps = round2(recalcTotalGeneral * recalcTpsRate);
    const recalcTotalTvq = round2(recalcTotalGeneral * recalcTvqRate);
    const recalcTotalFinal = round2(recalcTotalGeneral + recalcTotalTps + recalcTotalTvq);

    const payload = {
      taux_horaire_snapshot: Number(recalcTauxHoraire.toFixed(2)),
      marge_pieces_snapshot: Number(recalcMargePiecesPct.toFixed(2)),
      frais_atelier_pct_snapshot: Number(recalcFraisAtelierPct.toFixed(2)),
      tps_rate_snapshot: Number(recalcTpsRate.toFixed(5)),
      tvq_rate_snapshot: Number(recalcTvqRate.toFixed(5)),
      total_pieces: Number(recalcTotalPieces.toFixed(2)),
      total_main_oeuvre: Number(recalcTotalMainOeuvre.toFixed(2)),
      total_frais_atelier: Number(recalcTotalFraisAtelier.toFixed(2)),
      total_general: Number(recalcTotalGeneral.toFixed(2)),
      total_tps: Number(recalcTotalTps.toFixed(2)),
      total_tvq: Number(recalcTotalTvq.toFixed(2)),
      total_final: Number(recalcTotalFinal.toFixed(2)),
    };

    const { error: eUpdate } = await supabase.from("bons_travail").update(payload).eq("id", btId);
    if (eUpdate) throw eUpdate;

    return payload;
  }

  async function reloadPiecesAndRecalc(btId: string) {
    await loadPieces(btId);
    await syncInventaireInstallationsForBt(btId);
    const totals = await recalcAndPersistTotals(btId);
    setBt((prev) => (prev ? { ...prev, ...totals } : prev));
  }

  async function upsertEntretienHistoriqueForTask(t: NoteMeca) {
    if (!bt) return { ok: false as const, message: "BT introuvable." };

    const isEntretienTask =
      !!t.entretien_template_item_id || !!t.entretien_unite_item_id || !!t.entretien_auto;

    if (!isEntretienTask) return { ok: true as const };

    if (bt.km == null || !Number.isFinite(Number(bt.km))) {
      return {
        ok: false as const,
        message: "Impossible de compléter un entretien périodique sans kilométrage au BT.",
      };
    }

    const nomEntretien =
      String(t.titre || "").replace(/^Entretien périodique\s*-\s*/i, "").trim() || t.titre;

    let existingQuery = supabase
      .from("unite_entretien_historique")
      .select("id")
      .eq("unite_id", bt.unite_id)
      .eq("bt_id", bt.id);

    if (t.entretien_template_item_id) {
      existingQuery = existingQuery.eq("template_item_id", t.entretien_template_item_id);
    } else {
      existingQuery = existingQuery.is("template_item_id", null);
    }

    if (t.entretien_unite_item_id) {
      existingQuery = existingQuery.eq("unite_item_id", t.entretien_unite_item_id);
    } else {
      existingQuery = existingQuery.is("unite_item_id", null);
    }

    const { data: existing, error: existingErr } = await existingQuery.maybeSingle();
    if (existingErr) {
      return { ok: false as const, message: existingErr.message };
    }

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("unite_entretien_historique")
        .update({
          nom_snapshot: nomEntretien,
          date_effectuee: new Date().toISOString().slice(0, 10),
          km_effectue: bt.km,
        })
        .eq("id", existing.id);

      if (updErr) {
        return { ok: false as const, message: updErr.message };
      }
    } else {
      const { error: histErr } = await supabase.from("unite_entretien_historique").insert({
        unite_id: bt.unite_id,
        template_item_id: t.entretien_template_item_id ?? null,
        unite_item_id: t.entretien_unite_item_id ?? null,
        bt_id: bt.id,
        nom_snapshot: nomEntretien,
        frequence_km_snapshot: null,
        frequence_jours_snapshot: null,
        date_effectuee: new Date().toISOString().slice(0, 10),
        km_effectue: bt.km,
        note: null,
      });

      if (histErr) {
        return { ok: false as const, message: histErr.message };
      }
    }

    return { ok: true as const };
  }

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setErr(null);

    try {
      const { data: btData, error: eBt } = await supabase
        .from("bons_travail")
        .select("*")
        .eq("id", id)
        .single();

      if (eBt) throw eBt;

      const btRow = btData as BonTravail;

      const kmVal = (btRow as any).km ?? (btRow as any).kilometrage ?? null;
      const nextKmInput = kmVal === null || kmVal === undefined ? "" : String(kmVal);
      const nextPoInput = String(btRow.bon_commande ?? "");
      const nextDateOuvertureInput = isoToDateTimeLocal(btRow.date_ouverture);
      const nextDateFermetureInput = isoToDateTimeLocal(btRow.date_fermeture);

      setKmInput(nextKmInput);
      setPoInput(nextPoInput);
      setDateOuvertureInput(nextDateOuvertureInput);
      setDateFermetureInput(nextDateFermetureInput);

      const headerSignature = JSON.stringify({
        km: kmVal == null ? null : Number(kmVal),
        bon_commande: btRow.bon_commande?.trim() || null,
        date_ouverture: btRow.date_ouverture ?? null,
        date_fermeture: btRow.date_fermeture ?? null,
      });
      lastSavedHeaderRef.current = headerSignature;

      const { data: uData, error: eU } = await supabase
        .from("unites")
        .select("*")
        .eq("id", btRow.unite_id)
        .single();

      if (eU) throw eU;
      const unitRow = uData as Unite;
      setUnite(unitRow);

      await supabase.rpc("sync_entretien_due_tasks", {
        p_unite_id: btRow.unite_id,
      });

      let liveClient: Client | null = null;
      let liveCfg: ClientConfig | null = null;
      let liveTaux: ClientTauxMO[] = [];
      let liveParams: ParametresEntreprise | null = null;

      const paramsRes = await supabase
        .from("parametres_entreprise")
        .select("tps_rate,tvq_rate")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paramsRes.data) {
        liveParams = paramsRes.data as ParametresEntreprise;
      }

      if (unitRow.client_id) {
        const [clientRes, cfgRes, tauxRes] = await Promise.all([
          supabase.from("clients").select("id,nom").eq("id", unitRow.client_id).maybeSingle(),
          supabase
            .from("client_configuration")
            .select("id,client_id,taux_horaire,marge_pieces,frais_atelier_pourcentage,actif,note_facturation")
            .eq("client_id", unitRow.client_id)
            .maybeSingle(),
          supabase
            .from("client_taux_main_oeuvre")
            .select("id,client_id,type_unite_id,taux_horaire,actif")
            .eq("client_id", unitRow.client_id),
        ]);

        if (!clientRes.error && clientRes.data) liveClient = clientRes.data as Client;
        if (!cfgRes.error && cfgRes.data) liveCfg = cfgRes.data as ClientConfig;
        if (!tauxRes.error && tauxRes.data) liveTaux = (tauxRes.data || []) as ClientTauxMO[];
      }

      setClient(liveClient);
      setClientCfg(liveCfg);
      setClientTauxRows(liveTaux);
      setParamEntreprise(liveParams);

      const resolvedDynamicRate = (() => {
        if (!unitRow || !liveCfg) return Number(liveCfg?.taux_horaire || 0);
        const typeId = unitRow.type_unite_id ?? null;
        const specific = liveTaux.find((r) => r.actif && r.type_unite_id === typeId);
        if (specific) return Number(specific.taux_horaire || 0);
        return Number(liveCfg.taux_horaire || 0);
      })();

      const resolvedTpsRate = Number(liveParams?.tps_rate ?? 0.05);
      const resolvedTvqRate = Number(liveParams?.tvq_rate ?? 0.09975);

      let nextBtRow = btRow;
      const needsBtSnapshotUpdate =
        btRow.client_id == null ||
        !btRow.client_nom ||
        btRow.taux_horaire_snapshot == null ||
        btRow.marge_pieces_snapshot == null ||
        btRow.frais_atelier_pct_snapshot == null ||
        btRow.tps_rate_snapshot == null ||
        btRow.tvq_rate_snapshot == null;

      if (needsBtSnapshotUpdate) {
        const btPayload = {
          client_id: btRow.client_id ?? unitRow.client_id ?? null,
          client_nom: btRow.client_nom?.trim() || liveClient?.nom || null,
          taux_horaire_snapshot:
            btRow.taux_horaire_snapshot ?? (Number.isFinite(resolvedDynamicRate) ? resolvedDynamicRate : null),
          marge_pieces_snapshot: btRow.marge_pieces_snapshot ?? liveCfg?.marge_pieces ?? null,
          frais_atelier_pct_snapshot:
            btRow.frais_atelier_pct_snapshot ?? liveCfg?.frais_atelier_pourcentage ?? null,
          tps_rate_snapshot: btRow.tps_rate_snapshot ?? (Number.isFinite(resolvedTpsRate) ? resolvedTpsRate : null),
          tvq_rate_snapshot: btRow.tvq_rate_snapshot ?? (Number.isFinite(resolvedTvqRate) ? resolvedTvqRate : null),
        };

        const { error: snapErr } = await supabase.from("bons_travail").update(btPayload).eq("id", btRow.id);
        if (snapErr) throw snapErr;

        nextBtRow = {
          ...btRow,
          ...btPayload,
        };
      }

      const { data: nData, error: eN } = await supabase
        .from("unite_notes")
        .select(
          "id,unite_id,titre,details,created_at,entretien_template_item_id,entretien_unite_item_id,entretien_auto"
        )
        .eq("unite_id", btRow.unite_id)
        .order("created_at", { ascending: true });

      if (eN) throw eN;
      setNotes((nData || []) as NoteMeca[]);
      setSelected({});
      setSelectedOrder([]);

      const { data: teData, error: eTe } = await supabase
        .from("bt_taches_effectuees")
        .select("*")
        .eq("bt_id", btRow.id)
        .order("date_effectuee", { ascending: true });

      if (eTe) throw eTe;
      setTachesEffectuees((teData || []) as TacheEffectuee[]);

      await Promise.all([
        loadPieces(id),
        loadMainOeuvre(id),
        loadPointages(id),
        loadDocuments(id),
        loadAutorisations(btRow.id),
      ]);
      await syncInventaireInstallationsForBt(btRow.id);

      const persistedTotals = await recalcAndPersistTotals(btRow.id);

      setBt({
        ...nextBtRow,
        ...persistedTotals,
      } as BonTravail);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveBTHeaderSilently() {
    if (!bt || !hasKmColumn || loading || isReadOnly) return false;

    const rawKm = kmInput.trim();
    const km = rawKm ? Number(rawKm) : null;
    if (rawKm && (km === null || Number.isNaN(km) || km < 0)) return false;

    const bon_commande = poInput.trim() || null;
    const date_ouverture = localToIsoOrNull(dateOuvertureInput);
    const date_fermeture = localToIsoOrNull(dateFermetureInput);

    setIsAutoSaving(true);

    try {
      const { error } = await supabase
        .from("bons_travail")
        .update({ km, bon_commande, date_ouverture, date_fermeture })
        .eq("id", bt.id);

      if (error) throw error;

      const savedSignature = JSON.stringify({
        km,
        bon_commande,
        date_ouverture,
        date_fermeture,
      });

      lastSavedHeaderRef.current = savedSignature;
      setBt((prev) => (prev ? { ...prev, km, bon_commande, date_ouverture, date_fermeture } : prev));
      setErr(null);
      return true;
    } catch (e: any) {
      setErr(e?.message ?? "Erreur autosave");
      return false;
    } finally {
      setIsAutoSaving(false);
    }
  }

  useEffect(() => {
    if (!bt || loading || !hasKmColumn || isReadOnly) return;
    if (currentHeaderSignature === lastSavedHeaderRef.current) return;

    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

    autoSaveTimeoutRef.current = setTimeout(() => {
      void saveBTHeaderSilently();
    }, 700);

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [bt, loading, hasKmColumn, isReadOnly, currentHeaderSignature]);

  async function addTask() {
    if (!bt) return;

    const titre = taskModalValue.trim().toUpperCase();
    if (!titre) return;

    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }

    const { error } = await supabase.from("unite_notes").insert({
      unite_id: bt.unite_id,
      titre,
      details: null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setTaskModalValue("");
    setTaskModalOpen(false);
    await loadAll();
  }

  async function completeTaskIds(taskIds: string[], opts?: { skipConfirm?: boolean; forceAuthorize?: boolean }) {
    if (!bt || !taskIds.length) return;
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }

    const selectedTasks = taskIds
      .map((taskId) => notes.find((n) => n.id === taskId))
      .filter((n): n is NoteMeca => Boolean(n));
    if (!selectedTasks.length) return;

    for (const task of selectedTasks) {
  const decision = autorisationMap[task.id]?.decision;

  if (decision === "refuse") {
    const ok = window.confirm(
      `ATTENTION\n\nCette tâche a été REFUSÉE par le client.\n\n${task.titre}\n\nVoulez-vous continuer ?`
    );
    if (!ok) return;
  }

  if (decision === "a_discuter") {
    const ok = window.confirm(
      `Cette tâche est À DISCUTER avec le client.\n\n${task.titre}\n\nVoulez-vous continuer ?`
    );
    if (!ok) return;
  }

  if (decision === "attente") {
    const ok = window.confirm(
      `Cette tâche est EN ATTENTE d’autorisation.\n\n${task.titre}\n\nVoulez-vous continuer ?`
    );
    if (!ok) return;
  }
}

    if (!opts?.skipConfirm && !confirm(`Marquer ${selectedTasks.length} tâche(s) comme effectuée(s) ?`)) return;

    if (opts?.forceAuthorize) {
  const tasksToAuthorize = selectedTasks.filter((t) => {
    const decision = autorisationMap[t.id]?.decision;
    return decision === "attente" || decision === "refuse" || decision === "a_discuter";
  });

  for (const task of tasksToAuthorize) {
    const { error } = await supabase
      .from("bt_autorisation_taches")
      .update({ decision: "autorise" })
      .eq("bt_id", bt.id)
      .eq("unite_note_id", task.id);

    if (error) {
      alert(error.message);
      return;
    }
  }
}

    for (const task of selectedTasks) {
      const res = await upsertEntretienHistoriqueForTask(task);
      if (!res.ok) {
        alert(res.message);
        return;
      }
    }

    const completedAtBase = Date.now();

    const insertRows = selectedTasks.map((t, index) => {
      const autorisation = autorisationMap[t.id];

      return {
        bt_id: bt.id,
        unite_id: bt.unite_id,
        unite_note_id: t.id,
        titre: t.titre,
        details: t.details,
        date_effectuee: new Date(completedAtBase + index).toISOString(),
        entretien_template_item_id: t.entretien_template_item_id ?? null,
        entretien_unite_item_id: t.entretien_unite_item_id ?? null,
        entretien_auto: Boolean(t.entretien_auto),
        autorisation_tache_id: autorisation?.autorisation_tache_id || null,
        decision_client: autorisation?.decision ?? null,
        note_client: autorisation?.note_client || null,
      };
    });

    const { error: insertErr } = await supabase.from("bt_taches_effectuees").insert(insertRows);
    if (insertErr) {
      alert(insertErr.message);
      return;
    }

    const { error: deleteErr } = await supabase.from("unite_notes").delete().in("id", taskIds);
    if (deleteErr) {
      alert(deleteErr.message);
      return;
    }

    const currentBt = bt;
    if (!currentBt) return;

    await supabase.rpc("sync_entretien_due_tasks", {
      p_unite_id: currentBt.unite_id,
    });

    setSelected({});
    setSelectedOrder([]);
    await loadAll();
  }

  async function completeSelectedTasks() {
    await completeTaskIds(selectedIds);
  }

  function autoriserManuellementTache(t: NoteMeca) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }

    setAutorisationModalTask(t);
    setAutorisationModalNote("");
  }

  function closeAutorisationModal() {
    if (savingAutorisationModal) return;
    setAutorisationModalTask(null);
    setAutorisationModalNote("");
  }

  async function confirmerAutoriserAFaire() {
    if (!bt || !autorisationModalTask) return;

    const note = autorisationModalNote.trim();
    if (!note) {
      alert("Ajoute une note pour conserver la raison du changement.");
      return;
    }

    setSavingAutorisationModal(true);

    try {
      const current = autorisationMap[autorisationModalTask.id];
      const now = new Date().toLocaleString("fr-CA");
      const existingNote = String(current?.note_client || "").trim();
      const nextNote = [existingNote, `[${now}] Autorisé à faire : ${note}`]
        .filter(Boolean)
        .join("\n\n");

      const { error } = await supabase
        .from("bt_autorisation_taches")
        .update({ decision: "autorise", note_client: nextNote })
        .eq("bt_id", bt.id)
        .eq("unite_note_id", autorisationModalTask.id);

      if (error) throw error;

      closeAutorisationModal();
      await loadAutorisations(bt.id);
    } catch (e: any) {
      alert(e?.message || "Erreur lors de l’autorisation manuelle.");
    } finally {
      setSavingAutorisationModal(false);
    }
  }

  async function completeSingleTaskFromAutorisation(t: NoteMeca) {
    const ok = confirm(`Autoriser manuellement et marquer cette tâche comme effectuée ?\n\n${t.titre}`);
    if (!ok) return;
    await completeTaskIds([t.id], { skipConfirm: true, forceAuthorize: true });
  }

  async function deleteSelectedTasks() {
    if (!selectedIds.length) return;
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!confirm(`Supprimer ${selectedIds.length} tâche(s) ?`)) return;

    const { error } = await supabase.from("unite_notes").delete().in("id", selectedIds);
    if (error) {
      alert(error.message);
      return;
    }

    const currentBt = bt;
    if (!currentBt) return;

    await supabase.rpc("sync_entretien_due_tasks", {
      p_unite_id: currentBt.unite_id,
    });

    await loadAll();
  }

  async function remettreTacheOuverte(t: TacheEffectuee) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }

    const isEntretienTask =
      !!t.entretien_template_item_id || !!t.entretien_unite_item_id || !!t.entretien_auto;

    if (isEntretienTask && bt) {
      let histQuery = supabase
        .from("unite_entretien_historique")
        .delete()
        .eq("unite_id", t.unite_id)
        .eq("bt_id", bt.id);

      if (t.entretien_template_item_id) {
        histQuery = histQuery.eq("template_item_id", t.entretien_template_item_id);
      } else {
        histQuery = histQuery.is("template_item_id", null);
      }

      if (t.entretien_unite_item_id) {
        histQuery = histQuery.eq("unite_item_id", t.entretien_unite_item_id);
      } else {
        histQuery = histQuery.is("unite_item_id", null);
      }

      const { error: histDeleteError } = await histQuery;
      if (histDeleteError) {
        alert(histDeleteError.message);
        return;
      }
    }

    const { error: insErr } = await supabase.from("unite_notes").insert({
      unite_id: t.unite_id,
      titre: t.titre,
      details: t.details,
      entretien_template_item_id: t.entretien_template_item_id ?? null,
      entretien_unite_item_id: t.entretien_unite_item_id ?? null,
      entretien_auto: Boolean(t.entretien_auto),
    });

    if (insErr) {
      alert(insErr.message);
      return;
    }

    const { error: delErr } = await supabase.from("bt_taches_effectuees").delete().eq("id", t.id);
    if (delErr) {
      alert(delErr.message);
      return;
    }

    const currentBt = bt;
    if (!currentBt) return;

    await supabase.rpc("sync_entretien_due_tasks", {
      p_unite_id: currentBt.unite_id,
    });

    await loadAll();
  }

  async function handleTerminerBt(mode: "facturer" | "fermer") {
    if (!bt || !unite) return;

    if (Boolean(bt.verrouille) || isFacturedStatut(bt.statut)) {
      alert("BT verrouillé / facturé : impossible de modifier.");
      return;
    }

    if (!hasKmColumn) {
      alert("La colonne 'km' n'existe pas dans la DB. Ajoute-la via la migration SQL.");
      return;
    }

    const resolvedClientId = bt.client_id || unite.client_id || null;
    if (!resolvedClientId) {
      alert("Impossible de fermer ce bon de travail : aucun client n'est assigné à l'unité / au BT.");
      return;
    }

    const activePointages = pointages.filter((p) => Boolean(p.actif) || !p.ended_at);
    if (activePointages.length > 0) {
      const noms = Array.from(
        new Set(activePointages.map((p) => String(p.mecano_nom || "Mécano").trim() || "Mécano"))
      ).join(", ");
      alert(`Impossible de fermer ce bon de travail : mécano encore punché dessus.\n\n${noms}`);
      return;
    }

    const rawKm = kmInput.trim();
    const km = rawKm ? Number(rawKm) : null;

    if (rawKm && (km === null || Number.isNaN(km) || km < 0)) {
      alert("KM invalide");
      return;
    }

    const bon_commande = poInput.trim() || null;
    const date_ouverture = localToIsoOrNull(dateOuvertureInput);
    const date_fermeture = localToIsoOrNull(dateFermetureInput) ?? new Date().toISOString();
    const nouveauStatut = mode === "facturer" ? "a_facturer" : "ferme";

    setSavingTerminer(true);

    try {
      const { error: eBt } = await supabase
        .from("bons_travail")
        .update({
          km,
          bon_commande,
          statut: nouveauStatut,
          date_ouverture,
          date_fermeture,
        })
        .eq("id", bt.id);

      if (eBt) throw eBt;

      if (km !== null) {
        const nextKm = Math.max(unite.km_actuel ?? 0, km);
        const { error: eU } = await supabase.from("unites").update({ km_actuel: nextKm }).eq("id", unite.id);

        if (eU) {
          alert(`BT fermé, mais mise à jour km unité a échoué: ${eU.message}`);
          return;
        }
      }

      const totals = await recalcAndPersistTotals(bt.id);

      setBt((prev) =>
        prev
          ? {
              ...prev,
              statut: nouveauStatut,
              km,
              bon_commande,
              date_ouverture,
              date_fermeture,
              ...totals,
            }
          : prev
      );

      setConfirmTerminerOpen(false);
      await loadAll();
    } catch (e: any) {
      alert(e?.message || "Erreur fermeture BT");
    } finally {
      setSavingTerminer(false);
    }
  }

  async function reopenBT() {
    if (!bt) return;
    if (Boolean(bt.verrouille) || isFacturedStatut(bt.statut)) {
      alert("BT verrouillé / facturé : impossible de modifier.");
      return;
    }

    const { error } = await supabase
      .from("bons_travail")
      .update({ statut: "ouvert", date_fermeture: null })
      .eq("id", bt.id);

    if (error) {
      alert(error.message);
      return;
    }

    setDateFermetureInput("");
    const totals = await recalcAndPersistTotals(bt.id);
    setBt((prev) => (prev ? { ...prev, statut: "ouvert", date_fermeture: null, ...totals } : prev));
    await loadAll();
  }

  function closeTempsModal() {
    setTempsModalOpen(false);
    setNewMoMecano("");
    setNewMoDesc("");
    setNewMoHeures("");
    setNewMoTaux(String(effectiveTauxHoraire || 0));
  }

  async function addMainOeuvre() {
    if (!id) return;
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!mainOeuvreTableAvailable) {
      alert("La table bt_main_oeuvre n'existe pas encore dans la DB.");
      return;
    }

    const mecano_nom = newMoMecano.trim();
    const description = newMoDesc.trim() || null;
    const heures = Number.parseFloat(
  String(newMoHeures || "0").replace(",", ".")
);
    const taux_horaire = Number(newMoTaux || 0);

    if (!mecano_nom) {
      alert("Nom du mécano requis.");
      return;
    }
    if (!Number.isFinite(heures) || heures < 0) {
      alert("Heures invalides.");
      return;
    }
    if (!Number.isFinite(taux_horaire) || taux_horaire < 0) {
      alert("Taux horaire invalide.");
      return;
    }

    const { error } = await supabase.from("bt_main_oeuvre").insert({
      bt_id: id,
      mecano_nom,
      description,
      heures,
      taux_horaire,
    });

    if (error) {
      alert(error.message);
      return;
    }

    closeTempsModal();
    await loadMainOeuvre(id);
    const totals = await recalcAndPersistTotals(id);
    setBt((prev) => (prev ? { ...prev, ...totals } : prev));
  }

  async function saveMainOeuvreRow(row: MainOeuvreRow) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!mainOeuvreTableAvailable) return;

    const mecano_nom = String(row.mecano_nom || "").trim();
    const heures = Number(row.heures || 0);
    const taux_horaire = Number(row.taux_horaire || 0);

    if (!mecano_nom) {
      alert("Nom du mécano requis.");
      return;
    }
    if (!Number.isFinite(heures) || heures < 0) {
      alert("Heures invalides.");
      return;
    }
    if (!Number.isFinite(taux_horaire) || taux_horaire < 0) {
      alert("Taux horaire invalide.");
      return;
    }

    const { error } = await supabase
      .from("bt_main_oeuvre")
      .update({
        mecano_nom,
        description: row.description?.trim() || null,
        heures,
        taux_horaire,
      })
      .eq("id", row.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (id) {
      await loadMainOeuvre(id);
      const totals = await recalcAndPersistTotals(id);
      setBt((prev) => (prev ? { ...prev, ...totals } : prev));
    }
    setMainOeuvreMenuOpenId(null);
    setEditingMainOeuvreId(null);
  }

  async function deleteMainOeuvreRow(rowId: string) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!mainOeuvreTableAvailable) return;
    if (!confirm("Supprimer cette ligne de main-d’œuvre ?")) return;

    const { error } = await supabase.from("bt_main_oeuvre").delete().eq("id", rowId);
    if (error) {
      alert(error.message);
      return;
    }

    setMainOeuvreMenuOpenId(null);
    if (id) {
      await loadMainOeuvre(id);
      const totals = await recalcAndPersistTotals(id);
      setBt((prev) => (prev ? { ...prev, ...totals } : prev));
    }
  }

  async function deletePointage(pointageId: string) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!pointagesTableAvailable) return;
    if (!confirm("Supprimer ce pointage ?")) return;

    const { error } = await supabase.from("bt_pointages").delete().eq("id", pointageId);

    if (error) {
      alert(error.message);
      return;
    }

    setPointageMenuOpenId(null);
    if (id) {
      await loadPointages(id);
      const totals = await recalcAndPersistTotals(id);
      setBt((prev) => (prev ? { ...prev, ...totals } : prev));
    }
  }

  function openEditPointage(p: BtPointage) {
    setPointageMenuOpenId(null);
    setEditingPointageId(p.id);
    setEditingPointageStart(isoToDateTimeLocal(p.started_at));
    setEditingPointageEnd(isoToDateTimeLocal(p.ended_at));
  }

  async function savePointageRow(pointageId: string) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }
    if (!pointagesTableAvailable) return;

    const started_at = localToIsoOrNull(editingPointageStart);
    const ended_at = localToIsoOrNull(editingPointageEnd);

    if (!started_at || !ended_at) {
      alert("Début et fin requis.");
      return;
    }

    const startMs = new Date(started_at).getTime();
    const endMs = new Date(ended_at).getTime();

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      alert("La fin doit être après le début.");
      return;
    }

    const duration_minutes = Math.round((endMs - startMs) / 60000);

    const { error } = await supabase
      .from("bt_pointages")
      .update({
        started_at,
        ended_at,
        duration_minutes,
      })
      .eq("id", pointageId);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingPointageId(null);
    setEditingPointageStart("");
    setEditingPointageEnd("");
    setPointageMenuOpenId(null);

    if (id) {
      await loadPointages(id);
      const totals = await recalcAndPersistTotals(id);
      setBt((prev) => (prev ? { ...prev, ...totals } : prev));
    }
  }

  function openEditMainOeuvre(rowId: string) {
    setMainOeuvreMenuOpenId(null);
    setEditingMainOeuvreId(rowId);
  }

  function updateMainOeuvreLocal(rowId: string, patch: Partial<MainOeuvreRow>) {
    setMainOeuvre((rows) => rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function handlePrint() {
    if (!bt || !unite) return;

    const entrepriseNom = "Atelier";

    const bonCommandeRow = bt.bon_commande?.trim()
      ? `
      <tr>
        <td class="k">Bon de commande</td>
        <td class="v">${escapeHtml(bt.bon_commande)}</td>
      </tr>
    `
      : "";

    const tachesEffectueesRowsHtml =
      tachesEffectuees.length > 0
        ? tachesEffectuees
            .map(
              (t) => `
              <tr>
                <td>${escapeHtml(t.titre || "—")}</td>
                <td class="center">${escapeHtml(formatDatePrint(t.date_effectuee))}</td>
              </tr>
            `
            )
            .join("")
        : `
        <tr>
          <td colspan="2" style="text-align:center;color:#666;">Aucun travail effectué</td>
        </tr>
      `;

    const tachesOuvertesSection =
      notes.length > 0
        ? `
        <div class="section">
          <div class="section-h">Tâches ouvertes</div>
          <div class="section-b">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="center" style="width:160px;">Créée le</th>
                </tr>
              </thead>
              <tbody>
                ${notes
                  .map(
                    (n) => `
                      <tr>
                        <td>${escapeHtml(n.titre || "—")}</td>
                        <td class="center">${escapeHtml(formatDatePrint(n.created_at))}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `
        : "";

    const piecesRowsHtml =
      pieces.length > 0
        ? pieces
            .map((p: any) => {
              const sku = p.sku || p.code || "—";
              const description = p.description || p.nom || p.titre || "—";
              const quantite = Number(p.quantite || 0);
              const unitePiece = p.unite || p.unite_mesure || "";
              const prixUnitaire = getPieceFactureU(p as Piece);
              const totalLigne = getPieceTotalFacture(p as Piece);

              return `
              <tr>
                <td>${escapeHtml(sku)}</td>
                <td>${escapeHtml(description)}</td>
                <td class="center">${quantite}</td>
                <td>${escapeHtml(unitePiece)}</td>
                <td class="amount">${formatMoney(prixUnitaire)}</td>
                <td class="amount">${formatMoney(totalLigne)}</td>
              </tr>
            `;
            })
            .join("")
        : `
        <tr>
          <td colspan="6" style="text-align:center;color:#666;">Aucune pièce</td>
        </tr>
      `;

    const totalHeuresPointages = pointagesResume.reduce((s, r) => s + Number(r.heures || 0), 0);
    const totalHeuresMainOeuvre = mainOeuvre.reduce((s, r) => s + Number(r.heures || 0), 0);
    const totalHeuresGlobal = totalHeuresPointages + totalHeuresMainOeuvre;

    const html = btPrintTemplate
      .replace(/{{entreprise_nom_affiche}}/g, escapeHtml(entrepriseNom))
      .replace(/{{entreprise_adresse_l1}}/g, "")
      .replace(/{{entreprise_ville}}/g, "")
      .replace(/{{entreprise_province}}/g, "")
      .replace(/{{entreprise_code_postal}}/g, "")
      .replace(/{{bt_numero}}/g, escapeHtml(bt.numero || "—"))
      .replace(/{{date_ouverture}}/g, formatDateTimePrint(bt.date_ouverture))
      .replace(/{{date_fermeture}}/g, formatDateTimePrint(bt.date_fermeture))
      .replace(/{{bt_statut}}/g, "")
      .replace(/{{bon_commande_row}}/g, bonCommandeRow)
      .replace(/{{client_nom}}/g, escapeHtml(snapshotClientNom))
      .replace(/{{client_adresse_l1}}/g, "")
      .replace(/{{client_ville}}/g, "")
      .replace(/{{client_telephone}}/g, "")
      .replace(/{{unite_no}}/g, escapeHtml(unite.no_unite || "—"))
      .replace(/{{unite_plaque}}/g, escapeHtml(unite.plaque || "—"))
      .replace(/{{unite_niv}}/g, escapeHtml(unite.niv || "—"))
      .replace(/{{bt_km}}/g, bt.km != null ? String(bt.km) : "—")
      .replace(/{{taches_effectuees_rows}}/g, tachesEffectueesRowsHtml)
      .replace(/{{taches_ouvertes_section}}/g, tachesOuvertesSection)
      .replace(/{{pieces_rows}}/g, piecesRowsHtml)
      .replace(/{{total_pieces}}/g, formatMoney(totalPiecesFacture))
      .replace(/{{total_heures}}/g, fmtHours(totalHeuresGlobal))
      .replace(/{{total_main_oeuvre}}/g, formatMoney(totalMainOeuvre))
      .replace(/{{total_frais_atelier}}/g, formatMoney(totalFraisAtelier))
      .replace(/{{total_general}}/g, formatMoney(totalGeneral));

    const w = window.open("", "_blank");
    if (!w) {
      alert("Popup bloqué");
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();

    w.onload = () => {
      setTimeout(() => {
        w.focus();
        w.print();
        w.onafterprint = () => w.close();
      }, 100);
    };
  }

  const styles: Record<string, CSSProperties> = {
    page: {
      maxWidth: 1180,
      margin: "24px auto",
      padding: "0 14px",
      position: "relative",
      zIndex: 1,
    },
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      marginBottom: 12,
    },
    row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    h1: { margin: 0, fontSize: 22, fontWeight: 900 },
    muted: { color: "rgba(0,0,0,.6)" },
    btn: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 800,
      cursor: "pointer",
    },
    btnPrimary: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    btnDanger: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #dc2626",
      background: "#dc2626",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
      background: "#fff",
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 9999,
    },
    modalCard: {
      width: "100%",
      maxWidth: 640,
      background: "#fff",
      borderRadius: 16,
      border: "1px solid rgba(0,0,0,.08)",
      boxShadow: "0 24px 60px rgba(0,0,0,.18)",
      overflow: "hidden",
    },
    modalHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      borderBottom: "1px solid rgba(0,0,0,.08)",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 900,
      margin: 0,
    },
    modalBody: {
      padding: 16,
    },
    modalFooter: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      padding: 16,
      borderTop: "1px solid rgba(0,0,0,.08)",
    },
    iconCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontSize: 18,
      fontWeight: 900,
      cursor: "pointer",
    },
    tabsWrap: {
      display: "flex",
      gap: 8,
      marginBottom: 12,
    },
    tabBtn: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    tabBtnActive: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid #0f172a",
      background: "#0f172a",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    dropZone: {
      border: "2px dashed #cfd6e4",
      borderRadius: 14,
      padding: 26,
      textAlign: "center",
      background: "#f8fafc",
      cursor: "pointer",
      transition: "all .15s ease",
    },
    dropZoneDragging: {
      border: "2px dashed #2563eb",
      background: "#eff6ff",
    },
    docRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 12,
      background: "#fff",
      marginBottom: 8,
    },
    docBadge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      background: "#eef2ff",
      color: "#1d4ed8",
      border: "1px solid #c7d2fe",
      marginTop: 4,
    },
  };

  if (!id) return <div style={styles.page}>BT introuvable</div>;

  return (
    <div style={styles.page}>
      <style>
        {`
          @media print {
            @page {
              size: auto;
              margin: 12mm;
            }

            body {
              background: #fff !important;
            }

            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div
        className="no-print"
        style={{ ...styles.row, justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <div style={styles.row}>
          <div>
            <div style={styles.h1}>Bon de travail</div>
            <div style={styles.muted}>
              Gestion BT
              {isAutoSaving ? " • Enregistrement..." : " • Sauvegarde auto"}
            </div>
          </div>
        </div>

        <div style={styles.row}>
          <button style={styles.btn} onClick={() => nav(-1)}>
            Retour
          </button>

          {!isClosed ? (
            <>
              <button style={styles.btn} onClick={handlePrint} disabled={loading}>
                Imprimer
              </button>
              <button
                style={styles.btnPrimary}
                onClick={() => setConfirmTerminerOpen(true)}
                disabled={loading || Boolean(bt?.verrouille) || isFacturedStatut(bt?.statut) || !hasKmColumn}
              >
                Fermer bon de travail
              </button>
            </>
          ) : (
            <>
              <button style={styles.btn} onClick={handlePrint} disabled={loading}>
                Imprimer
              </button>
              <button
                style={styles.btnPrimary}
                onClick={reopenBT}
                disabled={loading || Boolean(bt?.verrouille) || isFacturedStatut(bt?.statut)}
              >
                Réouvrir BT
              </button>
            </>
          )}
        </div>
      </div>

      {err && (
        <div style={{ ...styles.card, borderColor: "rgba(220,38,38,.35)" }}>
          <b>Erreur:</b> {err}
        </div>
      )}

      {loading || !bt || !unite ? (
        <div style={styles.card}>Chargement…</div>
      ) : (
        <>
          <div className="no-print" style={styles.tabsWrap}>
            <button
              type="button"
              style={activeTab === "details" ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => setActiveTab("details")}
            >
              Détails
            </button>
            <button
              type="button"
              style={activeTab === "documents" ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => setActiveTab("documents")}
            >
              Documents ({documents.length})
            </button>
          </div>

          {activeTab === "details" ? (
            <>
              <BonTravailHeaderCard
                bt={bt}
                unite={unite}
                snapshotClientNom={snapshotClientNom}
                dateOuvertureInput={dateOuvertureInput}
                setDateOuvertureInput={setDateOuvertureInput}
                dateFermetureInput={dateFermetureInput}
                setDateFermetureInput={setDateFermetureInput}
                kmInput={kmInput}
                setKmInput={setKmInput}
                poInput={poInput}
                setPoInput={setPoInput}
                isReadOnly={isReadOnly}
                hasKmColumn={hasKmColumn}
                clientNoteFacturation={clientCfg?.note_facturation}
              />

              <BonTravailOperations
                btId={id}
clientId={bt?.client_id || unite?.client_id || null}
  uniteNo={unite?.no_unite || ""}
                notes={notes}
                autorisationMap={autorisationMap}
                selected={selected}
                setSelected={setSelectedInClickOrder}
                selectedIds={selectedIds}
                tachesEffectuees={tachesEffectuees}
                isReadOnly={isReadOnly}
                onOpenTaskModal={() => {
                  setTaskModalValue("");
                  setTaskModalOpen(true);
                }}
                onCompleteSelectedTasks={completeSelectedTasks}
                onDeleteSelectedTasks={deleteSelectedTasks}
                onAutoriserManuellementTache={autoriserManuellementTache}
                onCompleteSingleTaskFromAutorisation={completeSingleTaskFromAutorisation}
                onRefresh={loadAll}
                onRemettreTacheOuverte={remettreTacheOuverte}
                pieces={pieces}
                setPieces={setPieces}
                piecesTableAvailable={piecesTableAvailable}
                isBtOpenPricing={isBtOpenPricing}
                effectiveMargePiecesPct={effectiveMargePiecesPct}
                onReloadPiecesAndRecalc={reloadPiecesAndRecalc}
                pointagesTableAvailable={pointagesTableAvailable}
                pointagesResume={pointagesResume}
                pointages={pointages}
                effectiveTauxHoraire={effectiveTauxHoraire}
                pointageMenuOpenId={pointageMenuOpenId}
                setPointageMenuOpenId={setPointageMenuOpenId}
                editingPointageId={editingPointageId}
                setEditingPointageId={setEditingPointageId}
                editingPointageStart={editingPointageStart}
                setEditingPointageStart={setEditingPointageStart}
                editingPointageEnd={editingPointageEnd}
                setEditingPointageEnd={setEditingPointageEnd}
                onOpenEditPointage={openEditPointage}
                onSavePointageRow={savePointageRow}
                onDeletePointage={deletePointage}
                mainOeuvreTableAvailable={mainOeuvreTableAvailable}
                mainOeuvre={mainOeuvre}
                mainOeuvreMenuOpenId={mainOeuvreMenuOpenId}
                setMainOeuvreMenuOpenId={setMainOeuvreMenuOpenId}
                editingMainOeuvreId={editingMainOeuvreId}
                onOpenEditMainOeuvre={openEditMainOeuvre}
                onSaveMainOeuvreRow={saveMainOeuvreRow}
                onDeleteMainOeuvreRow={deleteMainOeuvreRow}
                updateMainOeuvreLocal={updateMainOeuvreLocal}
                onOpenTempsModal={() => {
                  setNewMoMecano("");
                  setNewMoDesc("");
                  setNewMoHeures("");
                  setNewMoTaux(String(effectiveTauxHoraire || 0));
                  setTempsModalOpen(true);
                }}
                totalPiecesCout={totalPiecesCout}
                totalPiecesFacture={totalPiecesFacture}
                totalPointagesMainOeuvre={totalPointagesMainOeuvre}
                totalMainOeuvreManuelle={totalMainOeuvreManuelle}
                totalMainOeuvre={totalMainOeuvre}
                totalFraisAtelier={totalFraisAtelier}
                totalGeneral={totalGeneral}
                totalTPS={totalTPS}
                totalTVQ={totalTVQ}
                totalFinal={totalFinal}
                effectiveFraisAtelierPct={effectiveFraisAtelierPct}
                effectiveTpsRate={effectiveTpsRate}
                effectiveTvqRate={effectiveTvqRate}
              />
            </>
          ) : (
            <div style={styles.card}>
              <div style={{ ...styles.row, justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Documents</div>
                  <div style={styles.muted}>Ajouter et consulter les documents liés à ce bon de travail.</div>
                </div>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isReadOnly) setDraggingDocuments(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraggingDocuments(false);
                }}
                onDrop={onDocumentsDrop}
                onClick={() => {
                  if (!isReadOnly) fileInputRef.current?.click();
                }}
                style={{
                  ...styles.dropZone,
                  ...(draggingDocuments ? styles.dropZoneDragging : {}),
                  opacity: isReadOnly ? 0.7 : 1,
                  cursor: isReadOnly ? "default" : "pointer",
                }}
              >
                {uploadingDocuments ? (
                  <div style={{ fontWeight: 800 }}>Upload en cours…</div>
                ) : (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>
                      Glisser-déposer des fichiers ici
                    </div>
                    <div style={{ ...styles.muted, marginTop: 6 }}>
                      ou cliquer pour parcourir
                    </div>
                    <div style={{ ...styles.muted, marginTop: 8, fontSize: 12 }}>
                      Formats courants acceptés : PDF, images, documents Office, etc.
                    </div>
                    {isReadOnly && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#b45309", fontWeight: 800 }}>
                        BT fermé / verrouillé : ajout désactivé.
                      </div>
                    )}
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.length) void handleUploadDocuments(e.target.files);
                }}
              />

              <div style={{ marginTop: 16 }}>
                {documentsLoading ? (
                  <div style={styles.muted}>Chargement des documents…</div>
                ) : documents.length === 0 ? (
                  <div style={styles.muted}>Aucun document lié à ce bon de travail.</div>
                ) : (
                  documents.map((doc) => {
                    const isPepDoc = doc.type === "pep" || doc.source === "auto_pep";
                    return (
                      <div key={doc.id} style={styles.docRow}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, wordBreak: "break-word" }}>
                            {String(doc.nom_fichier || "Document")}
                          </div>
                          <div style={styles.docBadge}>
                            {isPepDoc ? "PEP" : doc.type === "photo" ? "Photo" : "Document"}
                          </div>
                          <div style={{ ...styles.muted, marginTop: 6, fontSize: 12 }}>
                            Ajouté le {formatDateTimePrint(doc.created_at)}
                          </div>
                        </div>

                        <div style={{ ...styles.row, justifyContent: "flex-end" }}>
                          <button type="button" style={styles.btn} onClick={() => void openDocument(doc)}>
                            Ouvrir
                          </button>
                          {!isReadOnly && (
  <button
    type="button"
    style={styles.btnDanger}
    onClick={() => void deleteDocument(doc)}
  >
    Supprimer
  </button>
)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}

      {taskModalOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={() => {
            setTaskModalOpen(false);
            setTaskModalValue("");
          }}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Nouvelle tâche</h3>
              <button
                type="button"
                style={styles.iconCloseBtn}
                onClick={() => {
                  setTaskModalOpen(false);
                  setTaskModalValue("");
                }}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <input
                style={{ ...styles.input, width: "100%", minWidth: 0 }}
                placeholder="Entrer la tâche"
                value={taskModalValue}
                onChange={(e) => setTaskModalValue(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTask();
                }}
                autoFocus
              />
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btnDanger}
                onClick={() => {
                  setTaskModalOpen(false);
                  setTaskModalValue("");
                }}
              >
                Annuler
              </button>
              <button type="button" style={styles.btnPrimary} onClick={addTask}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {autorisationModalTask && (
        <div style={styles.modalBackdrop} onClick={closeAutorisationModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Autoriser à faire</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeAutorisationModal} disabled={savingAutorisationModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>{autorisationModalTask.titre}</div>
              <div style={{ ...styles.muted, marginBottom: 12 }}>
                Cette note sera conservée avec le suivi d’autorisation de la tâche.
              </div>
              <textarea
                style={{ ...styles.input, width: "100%", minWidth: 0, minHeight: 110, resize: "vertical" }}
                placeholder="Ex. Client a rappelé et autorise finalement cette tâche."
                value={autorisationModalNote}
                onChange={(e) => setAutorisationModalNote(e.target.value)}
                autoFocus
              />
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btnDanger} onClick={closeAutorisationModal} disabled={savingAutorisationModal}>
                Annuler
              </button>
              <button type="button" style={styles.btnPrimary} onClick={confirmerAutoriserAFaire} disabled={savingAutorisationModal}>
                {savingAutorisationModal ? "Enregistrement..." : "Autoriser à faire"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tempsModalOpen && (
        <div style={styles.modalBackdrop} onClick={closeTempsModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ajouter du temps</h3>
              <button type="button" style={styles.iconCloseBtn} onClick={closeTempsModal}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={{ ...styles.row, alignItems: "flex-start" }}>
                <input
                  style={{ ...styles.input, minWidth: 220 }}
                  placeholder="Mécano"
                  value={newMoMecano}
                  onChange={(e) => setNewMoMecano(e.target.value)}
                  disabled={isReadOnly || !mainOeuvreTableAvailable}
                />

                <input
                  style={{ ...styles.input, flex: 1, minWidth: 260 }}
                  placeholder="Description (optionnel)"
                  value={newMoDesc}
                  onChange={(e) => setNewMoDesc(e.target.value)}
                  disabled={isReadOnly || !mainOeuvreTableAvailable}
                />
              </div>

              <div style={{ ...styles.row, marginTop: 10, alignItems: "flex-start" }}>
                <input
  type="number"
  step="0.25"
  min="0"
  style={{ ...styles.input, width: 120, minWidth: 120 }}
  placeholder="Heures"
  value={newMoHeures}
  onChange={(e) => setNewMoHeures(e.target.value)}
  disabled={isReadOnly || !mainOeuvreTableAvailable}
/>

                <input
                  style={{ ...styles.input, width: 140, minWidth: 140 }}
                  inputMode="decimal"
                  placeholder="Taux horaire"
                  value={newMoTaux}
                  onChange={(e) => setNewMoTaux(e.target.value)}
                  disabled={isReadOnly || !mainOeuvreTableAvailable}
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btnDanger} onClick={closeTempsModal}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={addMainOeuvre}
                disabled={isReadOnly || !mainOeuvreTableAvailable}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTerminerOpen && (
        <div style={styles.modalBackdrop} onClick={() => setConfirmTerminerOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Terminer le bon de travail</h3>
              <button
                type="button"
                style={styles.iconCloseBtn}
                onClick={() => setConfirmTerminerOpen(false)}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={{ marginTop: 0 }}>Que veux-tu faire avec ce bon de travail ?</p>

              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  style={styles.btnPrimary}
                  onClick={() => handleTerminerBt("facturer")}
                  disabled={savingTerminer}
                >
                  Envoyer à facturer
                </button>

                <button
                  type="button"
                  style={styles.btn}
                  onClick={() => handleTerminerBt("fermer")}
                  disabled={savingTerminer}
                >
                  Fermer seulement
                </button>

                <button
                  type="button"
                  style={styles.btnDanger}
                  onClick={() => setConfirmTerminerOpen(false)}
                  disabled={savingTerminer}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}