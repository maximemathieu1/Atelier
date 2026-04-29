import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import BtPiecesCard, { type Piece as PieceFull } from "../components/bt/BtPiecesCard";
import BtTachePhotos from "../components/bt/BtTachePhotos";

type BonTravail = {
  id: string;
  numero?: string | null;
  unite_id: string;
  statut: string;
  date_ouverture?: string | null;
  km?: number | null;
  client_id?: string | null;
  client_nom?: string | null;
  marge_pieces_snapshot?: number | null;
};

type Unite = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  niv?: string | null;
  plaque?: string | null;
  client_id?: string | null;
  type_unite_id?: string | null;
  km_actuel?: number | null;
  km_updated_at?: string | null;
  km_last_bt_id?: string | null;
  km_status?: "ok" | "warning" | "anomaly" | string | null;
};

type ClientConfig = {
  id: string;
  client_id: string;
  marge_pieces: number | null;
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
  autorisation_tache_id?: string | null;
  decision_client?: AutorisationDecision | null;
  note_client?: string | null;
};

type UniteEntretienTemplate = {
  id: string;
  unite_id: string;
  template_id: string;
  actif: boolean;
};

type EntretienTemplate = {
  id: string;
  nom: string;
  description: string | null;
  actif: boolean;
};

type EntretienTemplateItem = {
  id: string;
  template_id: string;
  nom: string;
  description: string | null;
  periodicite_km: number | null;
  periodicite_jours: number | null;
  ordre: number;
  actif: boolean;
};

type UniteEntretienItem = {
  id: string;
  unite_id: string;
  titre?: string | null;
  details?: string | null;
  periodicite_km?: number | null;
  periodicite_jours?: number | null;
  nom: string;
  description: string | null;
  frequence_km: number | null;
  frequence_jours: number | null;
  ordre: number;
  actif: boolean;
};

type EntretienHistorique = {
  id: string;
  unite_id: string;
  template_item_id: string | null;
  unite_item_id: string | null;
  bt_id: string | null;
  km_log_id: string | null;
  nom_snapshot: string;
  frequence_km_snapshot: number | null;
  frequence_jours_snapshot: number | null;
  date_effectuee: string;
  km_effectue: number | null;
  note: string | null;
  created_at: string;
};

type ItemRow = {
  sourceType: "template" | "unite";
  sourceId: string;
  nom: string;
  description: string | null;
  frequence_km: number | null;
  frequence_jours: number | null;
  templateNom?: string | null;
  templateId?: string | null;
  assignedTemplateLinkId?: string | null;
  lastDone?: EntretienHistorique | null;
};

type KmRpcResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  last_km?: number | null;
  last_bt_id?: string | null;
  last_bt_numero?: string | null;
  last_date?: string | null;
  log_id?: string | null;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onstart: null | (() => void);
  onerror: null | ((event: { error?: string }) => void);
  onend: null | (() => void);
  onresult: null | ((event: any) => void);
  start: () => void;
  stop: () => void;
};

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type VoiceCorrection = {
  id: string;
  entendu: string;
  remplacement: string;
  actif: boolean;
};

type AutorisationDecision = "autorise" | "refuse" | "attente" | "a_discuter";

type AutorisationInfo = {
  decision: AutorisationDecision;
  note_client: string | null;
  autorisation_tache_id: string;
};

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-CA");
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

function fmtKm(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(Number(v));
}

function fmtKmLabel(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toLocaleString("fr-CA")} km`;
}

function fmtNumber(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("fr-CA");
}

function statusLabel(statut: string) {
  if (statut === "a_faire") return "À faire";
  if (statut === "en_cours") return "En cours";
  if (statut === "termine") return "Terminé";
  if (statut === "facture") return "Facturé";
  return statut || "—";
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}



function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\b(c|ce|cest|c'est)\b/g, "cest")
    .replace(/\s{2,}/g, " ")
    .trim();
}



function levenshtein(a: string, b: string) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);

  const rows = aa.length + 1;
  const cols = bb.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[rows - 1][cols - 1];
}

function areTokensClose(a: string, b: string) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);

  if (!aa || !bb) return false;
  if (aa === bb) return true;

  const dist = levenshtein(aa, bb);
  const maxLen = Math.max(aa.length, bb.length);

  if (maxLen <= 4) return dist <= 1;
  if (maxLen <= 7) return dist <= 2;
  return dist <= 3;
}



function normalizeVoiceNote(input: string, corrections: VoiceCorrection[]) {
  let text = input.toLowerCase();

  // 1️⃣ expressions longues en premier
  const multiWordRules = corrections
    .filter(c => c.actif && c.entendu.includes(" "))
    .sort((a, b) => b.entendu.length - a.entendu.length);

  for (const rule of multiWordRules) {
    const pattern = normalizeText(rule.entendu);
    const replacement = rule.remplacement.toLowerCase();

    if (!pattern) continue;

    if (normalizeText(text).includes(pattern)) {
      const regex = new RegExp(rule.entendu, "gi");
      text = text.replace(regex, replacement);
    }
  }

  // 2️⃣ correction mot par mot (très important)
  const words = text.split(/\s+/);

  const singleWordRules = corrections.filter(
    c => c.actif && !c.entendu.includes(" ")
  );

  const correctedWords = words.map(word => {
  const normWord = normalizeText(word);

  // 🔒 FIX BUG GAUCHE
  if (normWord === "gauche") return word;

  for (const rule of singleWordRules) {
    const normRule = normalizeText(rule.entendu);

    if (areTokensClose(normWord, normRule)) {
      return rule.remplacement.toLowerCase();
    }
  }

  return word;
});

  text = correctedWords.join(" ");

  // nettoyage
  return text
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function dueStatus(row: ItemRow, currentKm: number | null) {
  const h = row.lastDone;
  const today = new Date();

  let overdue = false;
  let soon = false;

  if (row.frequence_km != null && h?.km_effectue != null && currentKm != null) {
    const nextKm = Number(h.km_effectue) + Number(row.frequence_km);
    const remainingKm = nextKm - Number(currentKm);
    if (remainingKm <= 0) overdue = true;
    else if (remainingKm <= 2500) soon = true;
  }

  if (row.frequence_jours != null && h?.date_effectuee) {
    const dueDate = addDays(h.date_effectuee, Number(row.frequence_jours));
    if (dueDate) {
      const diffDays = daysBetween(today, dueDate);
      if (diffDays <= 0) overdue = true;
      else if (diffDays <= 30) soon = true;
    }
  }

  if (!h) {
    return {
      label: "Jamais fait",
      tone: "#92400e",
      bg: "#fff7ed",
      border: "#fed7aa",
    };
  }

  if (overdue) {
    return {
      label: "En retard",
      tone: "#991b1b",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  }

  if (soon) {
    return {
      label: "À prévoir",
      tone: "#92400e",
      bg: "#fff7ed",
      border: "#fed7aa",
    };
  }

  return {
    label: "OK",
    tone: "#065f46",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  };
}

function nextDueText(row: ItemRow, currentKm: number | null) {
  const h = row.lastDone;
  const today = new Date();

  if (!h) {
    const parts: string[] = [];
    if (row.frequence_km != null) parts.push(`${fmtNumber(row.frequence_km)} km`);
    if (row.frequence_jours != null) parts.push(`${fmtNumber(row.frequence_jours)} jours`);
    return parts.length ? parts.join(" • ") : "—";
  }

  const parts: string[] = [];

  if (row.frequence_km != null && h.km_effectue != null && currentKm != null) {
    const nextKm = Number(h.km_effectue) + Number(row.frequence_km);
    const remainingKm = nextKm - Number(currentKm);
    if (remainingKm <= 0) parts.push("0 km");
    else parts.push(`${fmtNumber(remainingKm)} km`);
  } else if (row.frequence_km != null) {
    parts.push(`${fmtNumber(row.frequence_km)} km`);
  }

  if (row.frequence_jours != null && h.date_effectuee) {
    const dueDate = addDays(h.date_effectuee, Number(row.frequence_jours));
    if (dueDate) {
      const remainingDays = daysBetween(today, dueDate);
      if (remainingDays <= 0) parts.push("0 jour");
      else parts.push(`${fmtNumber(remainingDays)} jours`);
    }
  } else if (row.frequence_jours != null) {
    parts.push(`${fmtNumber(row.frequence_jours)} jours`);
  }

  return parts.length ? parts.join(" • ") : "—";
}

const badgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  border: "1px solid rgba(0,0,0,.12)",
};

function StatutBadge({ statut }: { statut: string }) {
  return <span style={badgeStyle}>{statusLabel(statut)}</span>;
}

export default function BonTravailMecanoPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [bt, setBt] = useState<BonTravail | null>(null);
  const [unite, setUnite] = useState<Unite | null>(null);
  const [clientCfg, setClientCfg] = useState<ClientConfig | null>(null);

  const [notes, setNotes] = useState<NoteMeca[]>([]);
  const [tachesEffectuees, setTachesEffectuees] = useState<TacheEffectuee[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectedDone, setSelectedDone] = useState<Record<string, boolean>>({});
  const [autorisationMap, setAutorisationMap] = useState<Record<string, AutorisationInfo>>({});
  const [newTask, setNewTask] = useState("");
  const [taskInterim, setTaskInterim] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechListening, setSpeechListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [assignedTemplates, setAssignedTemplates] = useState<UniteEntretienTemplate[]>([]);
  const [templates, setTemplates] = useState<EntretienTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<EntretienTemplateItem[]>([]);
  const [unitItems, setUnitItems] = useState<UniteEntretienItem[]>([]);
  const [historique, setHistorique] = useState<EntretienHistorique[]>([]);

  const [pieces, setPieces] = useState<PieceFull[]>([]);
  const [piecesTableAvailable, setPiecesTableAvailable] = useState(true);

  const [kmInput, setKmInput] = useState("");
  const [kmSaving, setKmSaving] = useState(false);
  const [kmInfo, setKmInfo] = useState<string | null>(null);

  const [editKmInline, setEditKmInline] = useState(false);
  const [editKmInput, setEditKmInput] = useState("");

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [voiceCorrections, setVoiceCorrections] = useState<VoiceCorrection[]>([]);

  useEffect(() => {
    const w = window as WindowWithSpeechRecognition;
    setSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  async function loadVoiceCorrections() {
    try {
      const { data, error } = await supabase
        .from("systeme_dictee_corrections")
        .select("id,entendu,remplacement,actif")
        .eq("actif", true)
        .order("entendu", { ascending: true });

      if (error) throw error;
      setVoiceCorrections((data || []) as VoiceCorrection[]);
    } catch {
      setVoiceCorrections([]);
    }
  }

  useEffect(() => {
    loadVoiceCorrections();
  }, []);

  function stopDictation() {
    try {
      recognitionRef.current?.stop();
    } catch {}
  }

  function startDictation() {
    const w = window as WindowWithSpeechRecognition;
    const RecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      setSpeechError("Dictée vocale non supportée sur cet appareil.");
      return;
    }

    setSpeechError(null);

    try {
      stopDictation();

      const recognition = new RecognitionCtor();
      recognition.lang = "fr-CA";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setSpeechListening(true);
      };

      recognition.onerror = (event) => {
        const errCode = event?.error || "Erreur de dictée vocale.";
        if (errCode === "not-allowed") {
          setSpeechError("Accès au micro refusé.");
        } else if (errCode === "no-speech") {
          setSpeechError("Aucune voix détectée.");
        } else if (errCode === "audio-capture") {
          setSpeechError("Microphone introuvable.");
        } else {
          setSpeechError(errCode);
        }
        setSpeechListening(false);
      };

      recognition.onend = () => {
        setSpeechListening(false);
        recognitionRef.current = null;
      };

      recognition.onresult = (e: any) => {
        let interim = "";
        let final = "";

        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const txt = e.results[i][0]?.transcript ?? "";
          if (e.results[i].isFinal) final += txt;
          else interim += txt;
        }

        setTaskInterim(interim.trim());

        if (final.trim()) {
          const corrected = normalizeVoiceNote(final.trim(), voiceCorrections);

          setNewTask((prev) => {
            const base = prev.trim();
            return base ? `${base} ${corrected}` : corrected;
          });

          setTaskInterim("");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      setSpeechListening(false);
      setSpeechError(e?.message || "Impossible de démarrer la dictée.");
      recognitionRef.current = null;
    }
  }

  function resetTaskModalState() {
    stopDictation();
    setSpeechListening(false);
    setSpeechError(null);
    setTaskInterim("");
    setNewTask("");
    setTaskModalOpen(false);
  }

  const isReadOnly = useMemo(() => {
    if (!bt) return false;
    return bt.statut === "termine" || bt.statut === "facture";
  }, [bt]);

  const hasBtKm = useMemo(() => bt?.km != null, [bt?.km]);

  const isBtOpenPricing = useMemo(() => {
    if (!bt) return false;
    return bt.statut === "a_faire" || bt.statut === "en_cours";
  }, [bt]);

  const effectiveMargePiecesPct = useMemo(() => {
    if (isBtOpenPricing) return Number(clientCfg?.marge_pieces || 0);
    if (bt?.marge_pieces_snapshot != null) return Number(bt.marge_pieces_snapshot || 0);
    return Number(clientCfg?.marge_pieces || 0);
  }, [isBtOpenPricing, bt, clientCfg]);

  const displayTaskValue = useMemo(() => {
    const base = newTask.trim();
    const interim = taskInterim.trim();
    if (!interim) return newTask;
    return base ? `${base} ${interim}` : interim;
  }, [newTask, taskInterim]);

  const rows = useMemo(() => {
    const assignedSet = new Set(assignedTemplates.map((x) => x.template_id));
    const templateMap = new Map(templates.map((t) => [t.id, t]));
    const assignedTemplateByTemplateId = new Map(assignedTemplates.map((x) => [x.template_id, x]));

    const hByTemplateItem = new Map<string, EntretienHistorique>();
    const hByUnitItem = new Map<string, EntretienHistorique>();

    for (const h of historique) {
      if (h.template_item_id && !hByTemplateItem.has(h.template_item_id)) {
        hByTemplateItem.set(h.template_item_id, h);
      }
      if (h.unite_item_id && !hByUnitItem.has(h.unite_item_id)) {
        hByUnitItem.set(h.unite_item_id, h);
      }
    }

    const fromTemplates: ItemRow[] = templateItems
      .filter((it) => assignedSet.has(it.template_id))
      .map((it) => ({
        sourceType: "template" as const,
        sourceId: it.id,
        nom: it.nom,
        description: it.description,
        frequence_km: it.periodicite_km,
        frequence_jours: it.periodicite_jours,
        templateNom: templateMap.get(it.template_id)?.nom ?? null,
        templateId: it.template_id,
        assignedTemplateLinkId: assignedTemplateByTemplateId.get(it.template_id)?.id ?? null,
        lastDone: hByTemplateItem.get(it.id) ?? null,
      }));

    const fromUnit: ItemRow[] = unitItems.map((it) => ({
      sourceType: "unite" as const,
      sourceId: it.id,
      nom: it.nom || it.titre || "",
      description: it.description || it.details || null,
      frequence_km: it.frequence_km ?? it.periodicite_km ?? null,
      frequence_jours: it.frequence_jours ?? it.periodicite_jours ?? null,
      templateNom: null,
      templateId: null,
      assignedTemplateLinkId: null,
      lastDone: hByUnitItem.get(it.id) ?? null,
    }));

    return [...fromTemplates, ...fromUnit].sort((a, b) => a.nom.localeCompare(b.nom, "fr-CA"));
  }, [assignedTemplates, templates, templateItems, unitItems, historique]);

  const entretiensAVenir = useMemo(() => {
    const currentKm = bt?.km ?? unite?.km_actuel ?? null;

    return rows
      .map((row) => {
        const status = dueStatus(row, currentKm);
        const titre = `Entretien périodique - ${row.nom}`;
        const alreadyOpen = notes.some(
          (n) =>
            n.titre.trim().toLowerCase() === titre.trim().toLowerCase() &&
            ((row.sourceType === "template" && n.entretien_template_item_id === row.sourceId) ||
              (row.sourceType === "unite" && n.entretien_unite_item_id === row.sourceId))
        );

        return {
          row,
          status,
          nextDue: nextDueText(row, currentKm),
          alreadyOpen,
        };
      })
      .filter(({ status, alreadyOpen }) => status.label !== "OK" && !alreadyOpen);
  }, [rows, bt?.km, unite?.km_actuel, notes]);

  async function loadPieces(btId: string) {
    try {
      const { data, error } = await supabase
        .from("bt_pieces")
        .select("*")
        .eq("bt_id", btId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setPieces((data || []) as PieceFull[]);
      setPiecesTableAvailable(true);
    } catch {
      setPieces([]);
      setPiecesTableAvailable(false);
    }
  }

  async function loadAutorisations(btId: string) {
    try {
      const { data, error } = await supabase
        .from("bt_autorisation_taches")
        .select("id, unite_note_id, decision, note_client, created_at")
        .eq("bt_id", btId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const map: Record<string, AutorisationInfo> = {};
      for (const row of data || []) {
        const uniteNoteId = String((row as any).unite_note_id || "");
        if (!uniteNoteId || map[uniteNoteId]) continue;

        const rawDecision = String((row as any).decision || "attente");
        const decision: AutorisationDecision =
          rawDecision === "autorise" || rawDecision === "refuse" || rawDecision === "a_discuter"
            ? rawDecision
            : "attente";

        map[uniteNoteId] = {
          autorisation_tache_id: String((row as any).id || ""),
          decision,
          note_client: (row as any).note_client ?? null,
        };
      }

      setAutorisationMap(map);
    } catch (e) {
      console.error("Erreur chargement autorisations BT:", e);
      setAutorisationMap({});
    }
  }

  function getAutorisationLabel(decision?: AutorisationDecision | null) {
    if (decision === "autorise") return "Accepté";
    if (decision === "refuse") return "Refusé";
    if (decision === "a_discuter") return "À discuter";
    if (decision === "attente") return "En attente";
    return "—";
  }

  function getAutorisationBadgeStyle(decision?: AutorisationDecision | null): CSSProperties {
    const base: CSSProperties = { ...badgeStyle, whiteSpace: "nowrap" };
    if (decision === "autorise") return { ...base, color: "#065f46", background: "rgba(16,185,129,.12)", borderColor: "rgba(16,185,129,.28)" };
    if (decision === "refuse") return { ...base, color: "#991b1b", background: "rgba(239,68,68,.12)", borderColor: "rgba(239,68,68,.28)" };
    if (decision === "a_discuter") return { ...base, color: "#1d4ed8", background: "rgba(59,130,246,.12)", borderColor: "rgba(59,130,246,.28)" };
    if (decision === "attente") return { ...base, color: "#92400e", background: "rgba(245,158,11,.14)", borderColor: "rgba(245,158,11,.30)" };
    return base;
  }

  async function confirmerCompletionSelonAutorisation(t: NoteMeca) {
    const decision = autorisationMap[t.id]?.decision;

    if (decision === "refuse") {
      return window.confirm(`ATTENTION\n\nCette tâche a été REFUSÉE par le client.\n\n${t.titre}\n\nVoulez-vous continuer ?`);
    }

    if (decision === "a_discuter") {
      return window.confirm(`Cette tâche est À DISCUTER avec le client.\n\n${t.titre}\n\nVoulez-vous continuer ?`);
    }

    if (decision === "attente") {
      return window.confirm(`Cette tâche est EN ATTENTE d’autorisation.\n\n${t.titre}\n\nVoulez-vous continuer ?`);
    }

    return true;
  }

  async function loadAll() {
    if (!id) return;

    setLoading(true);
    setErr(null);

    try {
      const { data: btData, error: btErr } = await supabase
        .from("bons_travail")
        .select("id,numero,unite_id,statut,date_ouverture,km,client_id,client_nom,marge_pieces_snapshot")
        .eq("id", id)
        .single();

      if (btErr) throw btErr;
      const btRow = btData as BonTravail;
      setBt(btRow);

      const { data: uData, error: uErr } = await supabase
        .from("unites")
        .select("id,no_unite,marque,modele,niv,plaque,client_id,type_unite_id,km_actuel,km_updated_at,km_last_bt_id,km_status")
        .eq("id", btRow.unite_id)
        .single();

      if (uErr) throw uErr;
      const uniteRow = uData as Unite;
      setUnite(uniteRow);

      await supabase.rpc("sync_entretien_due_tasks", {
        p_unite_id: btRow.unite_id,
      });

      let cfg: ClientConfig | null = null;
      const resolvedClientId = btRow.client_id ?? uniteRow.client_id ?? null;
      if (resolvedClientId) {
        const { data: cfgData } = await supabase
          .from("client_configuration")
          .select("id,client_id,marge_pieces")
          .eq("client_id", resolvedClientId)
          .maybeSingle();

        cfg = (cfgData as ClientConfig | null) ?? null;
      }
      setClientCfg(cfg);

      const [
        notesRes,
        doneRes,
        assignedRes,
        templatesRes,
        templateItemsRes,
        unitItemsRes,
        historiqueRes,
      ] = await Promise.all([
        supabase
          .from("unite_notes")
          .select(
            "id,unite_id,titre,details,created_at,entretien_template_item_id,entretien_unite_item_id,entretien_auto"
          )
          .eq("unite_id", btRow.unite_id)
          .order("created_at", { ascending: false }),

        supabase
          .from("bt_taches_effectuees")
          .select(
            "id,bt_id,unite_id,unite_note_id,titre,details,date_effectuee,entretien_template_item_id,entretien_unite_item_id,entretien_auto,autorisation_tache_id,decision_client,note_client"
          )
          .eq("bt_id", btRow.id)
          .order("date_effectuee", { ascending: true }),

        supabase
          .from("unite_entretien_templates")
          .select("id,unite_id,template_id,actif")
          .eq("unite_id", btRow.unite_id)
          .eq("actif", true),

        supabase
          .from("entretien_templates")
          .select("id,nom,description,actif")
          .eq("actif", true)
          .order("nom", { ascending: true }),

        supabase
          .from("entretien_template_items")
          .select("id,template_id,nom,description,periodicite_km,periodicite_jours,ordre,actif")
          .eq("actif", true)
          .order("ordre", { ascending: true })
          .order("nom", { ascending: true }),

        supabase
          .from("unite_entretien_items")
          .select("id,unite_id,titre,details,periodicite_km,periodicite_jours,nom,description,frequence_km,frequence_jours,ordre,actif")
          .eq("unite_id", btRow.unite_id)
          .eq("actif", true)
          .order("ordre", { ascending: true })
          .order("nom", { ascending: true }),

        supabase
          .from("unite_entretien_historique")
          .select(
            "id,unite_id,template_item_id,unite_item_id,bt_id,km_log_id,nom_snapshot,frequence_km_snapshot,frequence_jours_snapshot,date_effectuee,km_effectue,note,created_at"
          )
          .eq("unite_id", btRow.unite_id)
          .order("date_effectuee", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (notesRes.error) throw notesRes.error;
      if (doneRes.error) throw doneRes.error;
      if (assignedRes.error) throw assignedRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (templateItemsRes.error) throw templateItemsRes.error;
      if (unitItemsRes.error) throw unitItemsRes.error;
      if (historiqueRes.error) throw historiqueRes.error;

      setNotes((notesRes.data || []) as NoteMeca[]);
      setSelected({});
      setSelectedDone({});
      setTachesEffectuees((doneRes.data || []) as TacheEffectuee[]);
      setAssignedTemplates((assignedRes.data || []) as UniteEntretienTemplate[]);
      setTemplates((templatesRes.data || []) as EntretienTemplate[]);
      setTemplateItems((templateItemsRes.data || []) as EntretienTemplateItem[]);
      setUnitItems((unitItemsRes.data || []) as UniteEntretienItem[]);
      setHistorique((historiqueRes.data || []) as EntretienHistorique[]);

      await Promise.all([loadPieces(btRow.id), loadAutorisations(btRow.id)]);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  async function saveKmValue(
    value: string,
    force = false,
    overrideReason?: string | null
  ) {
    if (!bt) return false;
    if (isReadOnly) {
      alert("BT fermé/facturé : impossible de modifier.");
      return false;
    }

    const raw = value.trim().replace(/\s/g, "").replace(",", ".");
    if (!raw) {
      alert("Le nouveau kilométrage est obligatoire.");
      return false;
    }

    const kmNumber = Number(raw);
    if (!Number.isFinite(kmNumber) || kmNumber < 0) {
      alert("Le kilométrage est invalide.");
      return false;
    }

    setKmSaving(true);
    setKmInfo(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase.rpc("enregistrer_km_bt", {
        p_bt_id: bt.id,
        p_unite_id: bt.unite_id,
        p_km: kmNumber,
        p_source: "bt_open",
        p_note: null,
        p_force: force,
        p_override_reason: overrideReason ?? null,
        p_created_by: user?.id ?? null,
      });

      if (error) throw error;

      const res = (data || {}) as KmRpcResponse;

      if (res.ok === false && res.code === "KM_LOWER_THAN_LAST") {
        const message =
          `Dernier KM enregistré : ${fmtKm(res.last_km)}\n` +
          `Dernier BT : ${res.last_bt_numero || "—"}\n` +
          `Date : ${fmtDateTime(res.last_date)}\n\n` +
          `Le nouveau KM saisi est plus petit. Voulez-vous continuer ?`;

        const confirmed = window.confirm(message);
        if (!confirmed) return false;

        return await saveKmValue(value, true, "KM inférieur confirmé manuellement");
      }

      if (res.ok === false) {
        alert(res.message || "Impossible d'enregistrer le kilométrage.");
        return false;
      }

      await supabase
        .from("unite_entretien_historique")
        .update({ km_effectue: kmNumber })
        .eq("bt_id", bt.id);

      await supabase.rpc("sync_entretien_due_tasks", {
        p_unite_id: bt.unite_id,
      });

      setBt((prev) => (prev ? { ...prev, km: kmNumber } : prev));
      setKmInfo("Kilométrage enregistré.");
      setKmInput("");

      await loadAll();
      return true;
    } catch (e: any) {
      alert(e?.message || "Erreur lors de l'enregistrement du kilométrage.");
      return false;
    } finally {
      setKmSaving(false);
    }
  }

  async function saveKm() {
    await saveKmValue(kmInput);
  }

  function openInlineKmEdit() {
    if (isReadOnly || !hasBtKm) return;
    setEditKmInput(bt?.km != null ? String(bt.km) : "");
    setEditKmInline(true);
  }

  async function submitInlineKmEdit() {
    const ok = await saveKmValue(editKmInput);
    if (ok) {
      setEditKmInline(false);
      setEditKmInput("");
    }
  }

  function cancelInlineKmEdit() {
    setEditKmInline(false);
    setEditKmInput("");
  }

  async function addTask() {
    if (!bt) return false;
    const titre = newTask.trim();
    if (!titre) return false;

    if (isReadOnly) {
      alert("BT fermé/facturé : impossible de modifier.");
      return false;
    }

    const { error } = await supabase.from("unite_notes").insert({
      unite_id: bt.unite_id,
      titre,
      details: null,
    });

    if (error) {
      alert(error.message);
      return false;
    }

    stopDictation();
    setSpeechListening(false);
    setSpeechError(null);
    setTaskInterim("");
    setNewTask("");

    await loadAll();
    return true;
  }

  async function addEntretienToOpenTasks(row: ItemRow, checked: boolean) {
    if (!bt || isReadOnly) return;
    if (!checked) return;

    const titre = `Entretien périodique - ${row.nom}`;

    const alreadyOpen = notes.some(
      (n) =>
        n.titre.trim().toLowerCase() === titre.trim().toLowerCase() &&
        ((row.sourceType === "template" && n.entretien_template_item_id === row.sourceId) ||
          (row.sourceType === "unite" && n.entretien_unite_item_id === row.sourceId))
    );

    if (alreadyOpen) return;

    const { error } = await supabase.from("unite_notes").insert({
      unite_id: bt.unite_id,
      titre,
      details: row.templateNom ? `Template : ${row.templateNom}` : row.description,
      entretien_template_item_id: row.sourceType === "template" ? row.sourceId : null,
      entretien_unite_item_id: row.sourceType === "unite" ? row.sourceId : null,
      entretien_auto: true,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await loadAll();
  }

  async function completeTask(t: NoteMeca, checked: boolean) {
    if (!bt || isReadOnly) return;
    if (!checked) return;

    const canContinue = await confirmerCompletionSelonAutorisation(t);
    if (!canContinue) {
      setSelected((s) => ({ ...s, [t.id]: false }));
      return;
    }

    const isEntretienTask =
      !!t.entretien_template_item_id || !!t.entretien_unite_item_id || !!t.entretien_auto;

    if (isEntretienTask) {
      if (bt.km == null || !Number.isFinite(Number(bt.km))) {
        alert("Impossible de compléter un entretien périodique sans kilométrage au BT.");
        return;
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

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        const { error: updErr } = await supabase
          .from("unite_entretien_historique")
          .update({
            nom_snapshot: nomEntretien,
            date_effectuee: new Date().toISOString().slice(0, 10),
            km_effectue: bt.km,
          })
          .eq("id", existing.id);

        if (updErr) {
          alert(updErr.message);
          return;
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
          alert(histErr.message);
          return;
        }
      }
    }

    const { data: insertedDoneTask, error: insertErr } = await supabase
  .from("bt_taches_effectuees")
  .insert({
    bt_id: bt.id,
    unite_id: bt.unite_id,
    unite_note_id: t.id,
    titre: t.titre,
    details: t.details,
    date_effectuee: new Date().toISOString(),
    entretien_template_item_id: t.entretien_template_item_id ?? null,
    entretien_unite_item_id: t.entretien_unite_item_id ?? null,
    entretien_auto: Boolean(t.entretien_auto),
    autorisation_tache_id: autorisationMap[t.id]?.autorisation_tache_id || null,
    decision_client: autorisationMap[t.id]?.decision ?? null,
    note_client: autorisationMap[t.id]?.note_client || null,
  })
  .select("id")
  .single();

if (insertErr) {
  alert(insertErr.message);
  return;
}

await supabase
  .from("bt_tache_photos")
  .update({
    unite_note_id: null,
    tache_effectuee_id: insertedDoneTask.id,
  })
  .eq("bt_id", bt.id)
  .eq("unite_note_id", t.id);

    const { error: deleteErr } = await supabase.from("unite_notes").delete().eq("id", t.id);

    if (deleteErr) {
      alert(deleteErr.message);
      return;
    }

    await supabase.rpc("sync_entretien_due_tasks", {
      p_unite_id: bt.unite_id,
    });

    await loadAll();
  }

  async function reopenCompletedTask(t: TacheEffectuee, checked: boolean) {
    if (isReadOnly) return;
    if (!checked) return;

    const isEntretienTask =
      !!t.entretien_template_item_id || !!t.entretien_unite_item_id || !!t.entretien_auto;

    try {
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

      const { error: delErr } = await supabase
        .from("bt_taches_effectuees")
        .delete()
        .eq("id", t.id);

      if (delErr) {
        alert(delErr.message);
        return;
      }

      if (bt) {
        await supabase.rpc("sync_entretien_due_tasks", {
          p_unite_id: bt.unite_id,
        });
      }

      await loadAll();
    } catch (e: any) {
      alert(e?.message || "Erreur lors de la réouverture.");
    }
  }

  async function deleteCompletedTask(t: TacheEffectuee) {
    if (isReadOnly) return;
    if (!window.confirm("Supprimer cette tâche complétée ?")) return;

    try {
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

      const { error } = await supabase.from("bt_taches_effectuees").delete().eq("id", t.id);

      if (error) {
        alert(error.message);
        return;
      }

      if (bt) {
        await supabase.rpc("sync_entretien_due_tasks", {
          p_unite_id: bt.unite_id,
        });
      }

      await loadAll();
    } catch (e: any) {
      alert(e?.message || "Erreur lors de la suppression.");
    }
  }

  const styles: Record<string, CSSProperties> = {
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
    h1: { margin: 0, fontSize: 22, fontWeight: 900 },
    muted: { color: "rgba(0,0,0,.6)" },
    btn: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 800,
      cursor: "pointer",
    },
    btnPrimary: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    btnSuccess: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#065f46",
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
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: {
      textAlign: "left" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
    },
    td: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top" as const,
    },
    warn: {
      background: "rgba(245,158,11,.10)",
      border: "1px solid rgba(245,158,11,.25)",
      borderRadius: 12,
      padding: 10,
      color: "rgba(0,0,0,.78)",
      fontWeight: 700,
      fontSize: 13,
      marginTop: 10,
    },
    ok: {
      background: "rgba(16,185,129,.10)",
      border: "1px solid rgba(16,185,129,.25)",
      borderRadius: 12,
      padding: 10,
      color: "rgba(0,0,0,.78)",
      fontWeight: 700,
      fontSize: 13,
      marginTop: 10,
    },
    headerCompact: {
      display: "grid",
      gridTemplateColumns: "1.2fr 1.8fr 1.8fr 1fr 1fr",
      gap: 14,
      marginTop: 12,
      alignItems: "start",
    },
    headerCell: {
      minWidth: 0,
    },
    headerLabel: {
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      marginBottom: 4,
    },
    headerMain: {
      fontWeight: 900,
      fontSize: 16,
      lineHeight: 1.2,
    },
    headerMainClickable: {
      fontWeight: 900,
      fontSize: 16,
      lineHeight: 1.2,
      cursor: "pointer",
      display: "inline-block",
    },
    headerMainInput: {
      width: 120,
      border: "none",
      outline: "none",
      background: "transparent",
      fontWeight: 900,
      fontSize: 16,
      lineHeight: 1.2,
      padding: 0,
      margin: 0,
      appearance: "textfield" as const,
      MozAppearance: "textfield" as const,
    },
    headerSub: {
      fontSize: 12,
      color: "rgba(0,0,0,.6)",
      marginTop: 3,
    },
    kmCard: {
      marginTop: 14,
      paddingTop: 14,
      borderTop: "1px solid rgba(0,0,0,.08)",
    },
    kmInlineRow: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap",
      marginTop: 12,
    },
    completedBox: {
      marginTop: 18,
      padding: 12,
      borderRadius: 12,
      background: "rgba(0,0,0,.035)",
      border: "1px solid rgba(0,0,0,.06)",
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 1000,
    },
    modalCard: {
      width: "100%",
      maxWidth: 520,
      background: "#fff",
      borderRadius: 14,
      padding: 16,
      boxShadow: "0 20px 50px rgba(0,0,0,.20)",
      border: "1px solid rgba(0,0,0,.08)",
    },
    modalFieldWrap: {
      display: "grid",
      gridTemplateColumns: "1fr 60px",
      gap: 10,
      alignItems: "start",
    },
    textarea: {
      width: "100%",
      minHeight: 100,
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      resize: "vertical" as const,
      fontFamily: "inherit",
      fontSize: 14,
      lineHeight: 1.4,
      boxSizing: "border-box" as const,
    },
    micBtn: {
      height: 52,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontSize: 22,
      cursor: "pointer",
    },
    micBtnActive: {
      height: 52,
      borderRadius: 10,
      border: "2px solid #dc2626",
      background: "#fff",
      color: "#dc2626",
      fontSize: 22,
      cursor: "pointer",
    },
    helperText: {
      fontSize: 12,
      marginTop: 8,
      color: "rgba(0,0,0,.68)",
    },
    helperError: {
      fontSize: 12,
      marginTop: 6,
      color: "#dc2626",
      fontWeight: 700,
    },
  };

  if (!id) return <div style={styles.page}>BT introuvable</div>;

  return (
    <div style={styles.page}>
      <div style={{ ...styles.row, justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={styles.h1}>Bon de travail</div>
          <div style={styles.muted}>Vue simplifiée mécano</div>
        </div>

        <button style={styles.btn} onClick={() => nav(-1)}>
          Retour
        </button>
      </div>

      {err && (
        <div style={{ ...styles.card, borderColor: "rgba(220,38,38,.35)" }}>
          <b>Erreur :</b> {err}
        </div>
      )}

      {loading || !bt || !unite ? (
        <div style={styles.card}>Chargement…</div>
      ) : (
        <>
          <div style={styles.card}>
            <div style={{ ...styles.row, justifyContent: "space-between", alignItems: "center" }}>
              <div style={styles.row}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{bt.numero || "(BT)"}</div>
                <StatutBadge statut={bt.statut} />
              </div>
            </div>

            <div style={styles.headerCompact}>
              <div style={styles.headerCell}>
                <div style={styles.headerLabel}>Unité</div>
                <div style={styles.headerMain}>{unite.no_unite}</div>
                {unite.plaque ? <div style={styles.headerSub}>Plaque {unite.plaque}</div> : null}
              </div>

              <div style={styles.headerCell}>
                <div style={styles.headerLabel}>Véhicule</div>
                <div style={styles.headerMain}>
                  {[unite.marque, unite.modele].filter(Boolean).join(" ") || "—"}
                </div>
              </div>

              <div style={styles.headerCell}>
                <div style={styles.headerLabel}>N° de série</div>
                <div style={styles.headerMain}>{unite.niv || "—"}</div>
              </div>

              <div style={styles.headerCell}>
                <div style={styles.headerLabel}>KM actuel</div>
                {!hasBtKm ? (
                  <div style={styles.headerMain}>—</div>
                ) : !editKmInline ? (
                  <div
                    style={isReadOnly ? styles.headerMain : styles.headerMainClickable}
                    onDoubleClick={openInlineKmEdit}
                    title={isReadOnly ? undefined : "Double-cliquer pour modifier"}
                  >
                    {fmtKmLabel(bt.km)}
                  </div>
                ) : (
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    style={styles.headerMainInput}
                    value={editKmInput}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^\d]/g, "");
                      setEditKmInput(cleaned);
                    }}
                    onBlur={submitInlineKmEdit}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        await submitInlineKmEdit();
                      } else if (e.key === "Escape") {
                        cancelInlineKmEdit();
                      }
                    }}
                    disabled={kmSaving}
                  />
                )}
              </div>

              <div style={styles.headerCell}>
                <div style={styles.headerLabel}>Ouvert</div>
                <div style={styles.headerMain}>{fmtDate(bt.date_ouverture)}</div>
              </div>
            </div>

            <div style={styles.kmCard}>
              {!hasBtKm ? (
                <>
                  <div style={styles.kmInlineRow}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      style={{ ...styles.input, flex: 1, minWidth: 260 }}
                      placeholder="Entrer le nouveau KM"
                      value={kmInput}
                      onChange={(e) => setKmInput(e.target.value)}
                      disabled={isReadOnly || kmSaving}
                    />

                    <button
                      style={styles.btnSuccess}
                      type="button"
                      onClick={saveKm}
                      disabled={isReadOnly || kmSaving}
                    >
                      {kmSaving ? "Enregistrement..." : "Enregistrer KM"}
                    </button>
                  </div>

                  {unite.km_actuel != null &&
                    kmInput.trim() !== "" &&
                    Number.isFinite(Number(kmInput)) &&
                    Number(kmInput) < Number(unite.km_actuel) && (
                      <div style={styles.warn}>
                        Attention : le nouveau KM est inférieur au dernier KM enregistré de l’unité.
                        Une confirmation apparaîtra à l’enregistrement.
                      </div>
                    )}
                </>
              ) : null}

              {editKmInline &&
                unite?.km_actuel != null &&
                editKmInput.trim() !== "" &&
                Number.isFinite(Number(editKmInput)) &&
                Number(editKmInput) < Number(unite.km_actuel) && (
                  <div style={styles.warn}>
                    Attention : le nouveau KM est inférieur au dernier KM enregistré de l’unité.
                    Une confirmation apparaîtra à l’enregistrement.
                  </div>
                )}

              {kmInfo && <div style={styles.ok}>{kmInfo}</div>}
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Entretiens périodiques à venir</div>

            {entretiensAVenir.length === 0 ? (
              <div style={{ ...styles.muted, marginTop: 10 }}>
                Aucun entretien à prévoir pour le moment.
              </div>
            ) : (
              <table style={{ ...styles.table, marginTop: 10 }}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 40 }} />
                    <th style={styles.th}>Entretien</th>
                    <th style={styles.th}>Dernier fait</th>
                    <th style={styles.th}>Prochain dû</th>
                    <th style={styles.th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {entretiensAVenir.map(({ row, status, nextDue }) => (
                    <tr key={`${row.sourceType}-${row.sourceId}`}>
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          onChange={(ev) => {
                            if (ev.target.checked) addEntretienToOpenTasks(row, true);
                          }}
                          disabled={isReadOnly}
                        />
                      </td>

                      <td style={styles.td}>
                        <div style={{ fontWeight: 900 }}>{row.nom}</div>
                        {row.description ? (
                          <div style={{ ...styles.muted, fontSize: 12 }}>{row.description}</div>
                        ) : null}
                        <div style={{ ...styles.muted, fontSize: 12, marginTop: 4 }}>
                          {row.sourceType === "template"
                            ? `Template${row.templateNom ? ` • ${row.templateNom}` : ""}`
                            : "Entretien propre à l’unité"}
                        </div>
                      </td>

                      <td style={styles.td}>
                        {row.lastDone ? (
                          <>
                            <div>{fmtDate(row.lastDone.date_effectuee)}</div>
                            <div style={{ ...styles.muted, fontSize: 12 }}>
                              {fmtKmLabel(row.lastDone.km_effectue)}
                            </div>
                          </>
                        ) : (
                          <span style={styles.muted}>Jamais fait</span>
                        )}
                      </td>

                      <td style={styles.td}>{nextDue}</td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...badgeStyle,
                            color: status.tone,
                            background: status.bg,
                            borderColor: status.border,
                          }}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={styles.card}>
            <div style={{ ...styles.row, justifyContent: "space-between" }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Tâches ouvertes</div>

              <button
                style={styles.btnPrimary}
                onClick={() => setTaskModalOpen(true)}
                disabled={isReadOnly}
              >
                Ajouter une tâche
              </button>
            </div>

            <table style={{ ...styles.table, marginTop: 10 }}>
              <thead>
  <tr>
    <th style={{ ...styles.th, width: 40 }}>
      <input
        type="checkbox"
        checked={notes.length > 0 && notes.every((t) => selected[t.id])}
        onChange={(e) => {
          const on = e.target.checked;
          const next: Record<string, boolean> = {};
          notes.forEach((t) => {
            next[t.id] = on;
          });
          setSelected(next);

          if (on) {
            notes.forEach((t) => {
              completeTask(t, true);
            });
          }
        }}
        disabled={isReadOnly && notes.length > 0}
      />
    </th>

    <th style={styles.th}>Titre</th>
    <th style={{ ...styles.th, width: 140 }}>Autorisation</th>
    <th style={{ ...styles.th, width: 180 }}>Créé</th>
    <th style={{ ...styles.th, width: 90, textAlign: "center" }}>Photos</th>
  </tr>
</thead>
              <tbody>
                {notes.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={5}>
                      <span style={styles.muted}>Aucune tâche ouverte.</span>
                    </td>
                  </tr>
                ) : (
                  notes.map((t) => (
                    <tr key={t.id}>
  <td style={styles.td}>
    <input
      type="checkbox"
      checked={Boolean(selected[t.id])}
      onChange={async (e) => {
        const checked = e.target.checked;
        setSelected((s) => ({ ...s, [t.id]: checked }));
        await completeTask(t, checked);
      }}
      disabled={isReadOnly}
    />
  </td>

  {/* Titre */}
  <td style={styles.td}>
    <div style={{ fontWeight: 900 }}>{t.titre}</div>

    {t.entretien_auto ? (
      <div style={{ ...styles.muted, fontSize: 12 }}>
        Entretien périodique
      </div>
    ) : null}
  </td>

  <td style={styles.td}>
    {autorisationMap[t.id] ? (
      <>
        <span style={getAutorisationBadgeStyle(autorisationMap[t.id]?.decision)}>
          {getAutorisationLabel(autorisationMap[t.id]?.decision)}
        </span>
        {autorisationMap[t.id]?.note_client ? (
          <div style={{ ...styles.muted, fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap" }}>
            {autorisationMap[t.id]?.note_client}
          </div>
        ) : null}
      </>
    ) : (
      <span style={styles.muted}>—</span>
    )}
  </td>

  {/* Date */}
  <td style={styles.td}>
    {fmtDateTime(t.created_at)}
  </td>

<td style={{ ...styles.td, textAlign: "center", verticalAlign: "middle" }}>
    <BtTachePhotos
      btId={bt.id}
      uniteId={bt.unite_id}
      uniteNoteId={t.id}
      isReadOnly={isReadOnly}
    />
  </td>
</tr>
                  ))
                )}
              </tbody>
            </table>

            {!hasBtKm && notes.some((t) => t.entretien_auto) && (
              <div style={styles.warn}>
                Les tâches d’entretien périodique ne peuvent pas être cochées tant que le KM du BT n’est pas saisi.
              </div>
            )}

            <div style={styles.completedBox}>
              <div style={{ fontSize: 15, fontWeight: 950, marginBottom: 8, opacity: 0.8 }}>
                Tâches effectuées
              </div>

              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 40 }}>
                      <input
                        type="checkbox"
                        checked={
                          tachesEffectuees.length > 0 &&
                          tachesEffectuees.every((t) => selectedDone[t.id])
                        }
                        onChange={(e) => {
                          const on = e.target.checked;
                          const next: Record<string, boolean> = {};
                          tachesEffectuees.forEach((t) => {
                            next[t.id] = on;
                          });
                          setSelectedDone(next);

                          if (on) {
                            tachesEffectuees.forEach((t) => {
                              reopenCompletedTask(t, true);
                            });
                          }
                        }}
                        disabled={isReadOnly && tachesEffectuees.length > 0}
                      />
                    </th>
                    <th style={styles.th}>Titre</th>
                    <th style={{ ...styles.th, width: 140 }}>Autorisation</th>
                    <th style={{ ...styles.th, width: 190 }}>Date</th>
                    <th style={{ ...styles.th, width: 90, textAlign: "center" }}>Photos</th>
                    <th style={{ ...styles.th, width: 140 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tachesEffectuees.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={6}>
                        <span style={styles.muted}>Aucune tâche effectuée.</span>
                      </td>
                    </tr>
                  ) : (
                    tachesEffectuees.map((t) => (
                      <tr key={t.id}>
                        <td style={styles.td}>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedDone[t.id])}
                            onChange={async (e) => {
                              const checked = e.target.checked;
                              setSelectedDone((s) => ({ ...s, [t.id]: checked }));
                              await reopenCompletedTask(t, checked);
                            }}
                            disabled={isReadOnly}
                          />
                        </td>
                      <td style={styles.td}>
  <div style={{ fontWeight: 900 }}>{t.titre}</div>
</td>

<td style={styles.td}>
  {t.decision_client ? (
    <>
      <span style={getAutorisationBadgeStyle(t.decision_client)}>
        {getAutorisationLabel(t.decision_client)}
      </span>
      {t.note_client ? (
        <div style={{ ...styles.muted, fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap" }}>
          {t.note_client}
        </div>
      ) : null}
    </>
  ) : (
    <span style={styles.muted}>—</span>
  )}
</td>

<td style={styles.td}>
  {fmtDateTime(t.date_effectuee)}
</td>

<td style={{ ...styles.td, textAlign: "center", verticalAlign: "middle" }}>
  <BtTachePhotos
    btId={bt.id}
    uniteId={t.unite_id}
    tacheEffectueeId={t.id}
    isReadOnly={isReadOnly}
  />
</td>
                        <td style={styles.td}>
                          <button
                            style={styles.btn}
                            disabled={isReadOnly}
                            onClick={() => deleteCompletedTask(t)}
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <BtPiecesCard
            btId={bt.id}
            pieces={pieces}
            setPieces={setPieces}
            isReadOnly={isReadOnly}
            piecesTableAvailable={piecesTableAvailable}
            isBtOpenPricing={isBtOpenPricing}
            effectiveMargePiecesPct={effectiveMargePiecesPct}
            onReload={loadPieces}
          />
        </>
      )}

      {taskModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>
              Ajouter une tâche
            </div>

            <div style={styles.modalFieldWrap}>
              <textarea
                style={styles.textarea}
                placeholder="Nouvelle tâche…"
                value={displayTaskValue}
                onChange={(e) => {
                  setNewTask(e.target.value);
                  setTaskInterim("");
                }}
                autoFocus
              />

              <button
                type="button"
                style={speechListening ? styles.micBtnActive : styles.micBtn}
                onClick={() => {
                  if (speechListening) stopDictation();
                  else startDictation();
                }}
                disabled={!speechSupported}
                title={
                  !speechSupported
                    ? "Dictée non supportée"
                    : speechListening
                    ? "Arrêter la dictée"
                    : "Démarrer la dictée"
                }
              >
                {speechListening ? "⏹" : "🎤"}
              </button>
            </div>

            {!speechSupported ? (
              <div style={styles.helperText}>
                Dictée vocale non disponible sur cet appareil ou navigateur.
              </div>
            ) : speechListening ? (
              <div style={styles.helperText}>Écoute en cours… parle normalement.</div>
            ) : (
              <div style={styles.helperText}>Clique sur le micro pour dicter la tâche.</div>
            )}

            {speechError ? <div style={styles.helperError}>{speechError}</div> : null}

            <div style={{ ...styles.row, justifyContent: "flex-end", marginTop: 14 }}>
              <button style={styles.btn} type="button" onClick={resetTaskModalState}>
                Annuler
              </button>

              <button
                style={styles.btnPrimary}
                type="button"
                onClick={async () => {
                  const ok = await addTask();
                  if (ok) resetTaskModalState();
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}