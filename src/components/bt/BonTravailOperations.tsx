import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabaseClient";
import BtPiecesCard, { type Piece } from "./BtPiecesCard";
import BtTachePhotos from "./BtTachePhotos";
import BtAutorisationClient from "./BtAutorisationClient";

type SuiviTacheType = "a_planifier" | "urgent" | "hors_service";

type NoteMeca = {
  id: string;
  unite_id: string;
  titre: string;
  details: string | null;
  created_at: string;
  suivi_type?: SuiviTacheType | null;
};

type ClientContact = {
  id: string;
  client_id: string | null;
  nom: string;
  poste: string | null;
  telephone: string | null;
  courriel: string | null;
  principal: boolean | null;
  type_facturation: boolean;
};

type AutorisationDecision = "autorise" | "refuse" | "attente" | "a_discuter";

type AutorisationInfo = {
  decision: AutorisationDecision;
  note_client: string | null;
  autorisation_tache_id: string;
};

type AutorisationMessage = {
  id: string;
  autorisation_id: string;
  autorisation_tache_id: string;
  bt_id: string;
  unite_note_id: string | null;
  auteur_type: "client" | "atelier";
  auteur_nom: string | null;
  message: string;
  created_at: string;
};

type TacheEffectuee = {
  id: string;
  bt_id: string;
  unite_id: string;
  unite_note_id: string | null;
  titre: string;
  details: string | null;
  date_effectuee: string;
};

type MainOeuvreRow = {
  id: string;
  bt_id: string;
  mecano_nom: string;
  description: string | null;
  heures: number | string;
  taux_horaire: number | string;
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
  heures: number | string;
};

function money(v: number) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(v || 0);
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-CA");
}

function fmtDateTimeNoSeconds(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtHours(hours: number | string | null | undefined) {
  return `${decimalToNumber(hours).toFixed(2)} h`;
}

function decimalToNumber(value: number | string | null | undefined) {
  const normalized = String(value ?? "")
    .replace(",", ".")
    .trim();

  if (!normalized || normalized === ".") return 0;

  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function isDecimalInput(value: string) {
  return /^\d*([.,]\d*)?$/.test(value);
}

function localToIsoOrNull(v: string) {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type Props = {
  btId: string;
  uniteId?: string | null;
  btKm?: number | string | null;
  clientId?: string | null;
  uniteNo?: string | null;
  autorisationClientUrl?: string | null;
  notes: NoteMeca[];
  autorisationMap: Record<string, AutorisationInfo>;
  selected: Record<string, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedIds: string[];
  tachesEffectuees: TacheEffectuee[];
  isReadOnly: boolean;
  onOpenTaskModal: () => void;
  onCompleteSelectedTasks: () => void;
  onDeleteSelectedTasks: () => void;
  onAutoriserManuellementTache: (t: NoteMeca) => void;
  onCompleteSingleTaskFromAutorisation: (t: NoteMeca) => void;
  onUpdateNoteSuiviType: (
    noteId: string,
    suiviType: SuiviTacheType | null,
  ) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  onRemettreTacheOuverte: (t: TacheEffectuee) => void;

  pieces: Piece[];
  setPieces: React.Dispatch<React.SetStateAction<Piece[]>>;
  piecesTableAvailable: boolean;
  isBtOpenPricing: boolean;
  effectiveMargePiecesPct: number;
  onReloadPiecesAndRecalc: (btId: string) => Promise<void>;

  pointagesTableAvailable: boolean;
  pointagesResume: PointageResume[];
  pointages: BtPointage[];
  effectiveTauxHoraire: number;
  pointageMenuOpenId: string | null;
  setPointageMenuOpenId: React.Dispatch<React.SetStateAction<string | null>>;
  editingPointageId: string | null;
  setEditingPointageId: React.Dispatch<React.SetStateAction<string | null>>;
  editingPointageStart: string;
  setEditingPointageStart: React.Dispatch<React.SetStateAction<string>>;
  editingPointageEnd: string;
  setEditingPointageEnd: React.Dispatch<React.SetStateAction<string>>;
  onOpenEditPointage: (p: BtPointage) => void;
  onSavePointageRow: (pointageId: string) => void;
  onDeletePointage: (pointageId: string) => void;

  mainOeuvreTableAvailable: boolean;
  mainOeuvre: MainOeuvreRow[];
  mainOeuvreMenuOpenId: string | null;
  setMainOeuvreMenuOpenId: React.Dispatch<React.SetStateAction<string | null>>;
  editingMainOeuvreId: string | null;
  onOpenEditMainOeuvre: (rowId: string) => void;
  onSaveMainOeuvreRow: (row: MainOeuvreRow) => void | Promise<void>;
  onDeleteMainOeuvreRow: (rowId: string) => void;
  updateMainOeuvreLocal: (rowId: string, patch: Partial<MainOeuvreRow>) => void;
  onOpenTempsModal: () => void;

  totalPiecesCout: number;
  totalPiecesFacture: number;
  totalPointagesMainOeuvre: number;
  totalMainOeuvreManuelle: number;
  totalMainOeuvre: number;
  totalFraisAtelier: number;
  totalGeneral: number;
  totalTPS: number;
  totalTVQ: number;
  totalFinal: number;
  effectiveFraisAtelierPct: number;
  effectiveTpsRate: number;
  effectiveTvqRate: number;
};

export default function BonTravailOperations(props: Props) {
  const [showPointageDetails, setShowPointageDetails] = useState(false);
  const [suiviModalTask, setSuiviModalTask] = useState<NoteMeca | null>(null);

  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [discussionMessagesByNote, setDiscussionMessagesByNote] = useState<
    Record<string, AutorisationMessage[]>
  >({});
  const [discussionCountByTask, setDiscussionCountByTask] = useState<Record<string, number>>({});
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [discussionReplies, setDiscussionReplies] = useState<Record<string, string>>({});
  const [discussionSending, setDiscussionSending] = useState(false);

  const initialUniteNo = String(props.uniteNo || "").trim();
  const initialVehicleReadyMessage = initialUniteNo
    ? `Groupe Breton: votre véhicule/unité ${initialUniteNo} est prêt. Vous pouvez passer le récupérer.`
    : "Groupe Breton: votre véhicule est prêt. Vous pouvez passer le récupérer.";

  const [sendClientChoiceOpen, setSendClientChoiceOpen] = useState(false);
  const [taskAuthSmsOpen, setTaskAuthSmsOpen] = useState(false);
  const [taskAuthSmsSending, setTaskAuthSmsSending] = useState(false);
  const [taskAuthSmsMessage, setTaskAuthSmsMessage] = useState("");
  const [vehicleReadyOpen, setVehicleReadyOpen] = useState(false);
  const [vehicleReadySending, setVehicleReadySending] = useState(false);

  const [clientContacts, setClientContacts] = useState<ClientContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [vehicleReadyPhone, setVehicleReadyPhone] = useState("");
  const [vehicleReadyEmail, setVehicleReadyEmail] = useState("");
  const [vehicleReadySendSms, setVehicleReadySendSms] = useState(true);
  const [vehicleReadySendEmail, setVehicleReadySendEmail] = useState(false);
  const [vehicleReadyMessage, setVehicleReadyMessage] = useState(
    initialVehicleReadyMessage,
  );

  const styles: Record<string, CSSProperties> = {
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      marginBottom: 12,
    },
    row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
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
    btnLink: {
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontWeight: 800,
      cursor: "pointer",
      fontSize: 13,
    },
    btnMini: {
      padding: "6px 9px",
      borderRadius: 9,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontWeight: 850,
      cursor: "pointer",
      fontSize: 12,
    },
    btnMiniPrimary: {
      padding: "6px 9px",
      borderRadius: 9,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 850,
      cursor: "pointer",
      fontSize: 12,
    },
    authStatusText: {
      marginTop: 3,
      fontSize: 11,
      fontWeight: 850,
    },
    clientNoteBox: {
      marginTop: 6,
      padding: "7px 9px",
      borderRadius: 10,
      background: "rgba(255,255,255,.75)",
      border: "1px solid rgba(0,0,0,.08)",
      color: "#334155",
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: "pre-wrap",
    },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
      background: "#fff",
    },
    textarea: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minHeight: 96,
      resize: "vertical",
      background: "#fff",
      width: "100%",
    },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      textAlign: "left",
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
    },
    td: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top",
    },
    photoTh: {
      textAlign: "center",
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
      width: 80,
    },
    photoTd: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "middle",
      textAlign: "center",
      width: 80,
    },
    tableWrap: {
      width: "100%",
      overflowX: "auto",
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
    menuWrap: {
      position: "relative",
      display: "inline-block",
    },
    menu: {
      position: "absolute",
      top: "calc(100% + 6px)",
      right: 0,
      minWidth: 140,
      background: "#fff",
      border: "1px solid rgba(0,0,0,.12)",
      borderRadius: 10,
      boxShadow: "0 10px 24px rgba(0,0,0,.12)",
      zIndex: 200,
      overflow: "hidden",
    },
    menuItem: {
      width: "100%",
      padding: "10px 12px",
      textAlign: "left",
      background: "#fff",
      border: "none",
      borderBottom: "1px solid rgba(0,0,0,.06)",
      cursor: "pointer",
      fontWeight: 700,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    sectionHeaderRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 6,
      marginTop: 14,
    },
    totalCard: {
      border: "1px solid rgba(0,0,0,.06)",
      borderRadius: 12,
      background: "#f8fafc",
      overflow: "hidden",
    },
    totalRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 14px",
      borderTop: "1px solid rgba(0,0,0,.06)",
      gap: 12,
      minHeight: 52,
    },
    totalRowFirst: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 14px",
      gap: 12,
      minHeight: 52,
    },
    totalLeft: {
      display: "flex",
      alignItems: "center",
      minWidth: 0,
      flex: 1,
    },
    totalLabel: {
      fontSize: 17,
      fontWeight: 950,
      color: "#111827",
      lineHeight: 1.1,
    },
    totalValue: {
      fontSize: 16,
      fontWeight: 900,
      color: "#111827",
      whiteSpace: "nowrap",
      lineHeight: 1,
    },
    grandTotalRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 14px",
      background: "#e5e7eb",
      borderTop: "1px solid rgba(0,0,0,.08)",
      gap: 12,
      minHeight: 58,
    },
    grandTotalLabel: {
      fontSize: 18,
      fontWeight: 950,
      color: "#111827",
    },
    grandTotalValue: {
      fontSize: 24,
      fontWeight: 950,
      color: "#111827",
      whiteSpace: "nowrap",
      lineHeight: 1,
    },
    detailSubTitle: {
      fontSize: 13,
      fontWeight: 900,
      margin: "14px 0 6px",
      color: "#111827",
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16,
    },
    modalCard: {
      width: "min(560px, 100%)",
      background: "#fff",
      borderRadius: 18,
      border: "1px solid rgba(0,0,0,.10)",
      boxShadow: "0 24px 80px rgba(0,0,0,.25)",
      padding: 18,
      position: "relative",
    },
    modalCardLarge: {
      width: "min(680px, 100%)",
      maxHeight: "calc(100vh - 48px)",
      overflowY: "auto",
      background: "#fff",
      borderRadius: 18,
      border: "1px solid rgba(0,0,0,.10)",
      boxShadow: "0 24px 80px rgba(0,0,0,.25)",
      padding: 18,
      position: "relative",
    },
    modalClose: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontWeight: 950,
      cursor: "pointer",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 950,
      margin: "0 46px 6px 0",
    },
    modalText: {
      fontSize: 14,
      color: "#475569",
      marginBottom: 14,
    },
    modalActionsColumn: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    checkRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontWeight: 850,
      color: "#111827",
    },
    discussionButton: {
      marginTop: 7,
      padding: "7px 10px",
      borderRadius: 10,
      border: "1px solid #bfdbfe",
      background: "#eff6ff",
      color: "#1d4ed8",
      fontWeight: 900,
      fontSize: 12,
      cursor: "pointer",
    },
    discussionList: {
      display: "grid",
      gap: 10,
      marginTop: 12,
      marginBottom: 14,
      maxHeight: 380,
      overflowY: "auto",
      paddingRight: 4,
    },
    discussionClient: {
      marginLeft: "auto",
      maxWidth: "86%",
      padding: "10px 12px",
      borderRadius: "14px 14px 4px 14px",
      background: "#dbeafe",
      border: "1px solid #bfdbfe",
    },
    discussionAtelier: {
      marginRight: "auto",
      maxWidth: "86%",
      padding: "10px 12px",
      borderRadius: "14px 14px 14px 4px",
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
    },
    discussionMeta: {
      fontSize: 11,
      fontWeight: 900,
      color: "#64748b",
      marginBottom: 4,
    },
    discussionText: {
      fontSize: 14,
      fontWeight: 650,
      color: "#1e293b",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    },
    helpBox: {
      background: "#f8fafc",
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 12,
      padding: 10,
      color: "#475569",
      fontSize: 13,
      fontWeight: 700,
      lineHeight: 1.35,
    },
  };

  const {
    btId,
    uniteId,
    btKm,
    clientId,
    uniteNo,
    autorisationClientUrl,
    notes,
    autorisationMap,
    selected,
    setSelected,
    selectedIds,
    tachesEffectuees,
    isReadOnly,
    onOpenTaskModal,
    onCompleteSelectedTasks,
    onDeleteSelectedTasks,
    onAutoriserManuellementTache,
    onUpdateNoteSuiviType,
    onRefresh,
    onRemettreTacheOuverte,
    pieces,
    setPieces,
    piecesTableAvailable,
    isBtOpenPricing,
    effectiveMargePiecesPct,
    onReloadPiecesAndRecalc,
    pointagesTableAvailable,
    pointagesResume,
    pointages,
    effectiveTauxHoraire,
    pointageMenuOpenId,
    setPointageMenuOpenId,
    editingPointageId,
    editingPointageStart,
    setEditingPointageStart,
    editingPointageEnd,
    setEditingPointageEnd,
    onOpenEditPointage,
    onSavePointageRow,
    onDeletePointage,
    mainOeuvreTableAvailable,
    mainOeuvre,
    mainOeuvreMenuOpenId,
    setMainOeuvreMenuOpenId,
    editingMainOeuvreId,
    onOpenEditMainOeuvre,
    onSaveMainOeuvreRow,
    onDeleteMainOeuvreRow,
    updateMainOeuvreLocal,
    onOpenTempsModal,
    totalPiecesFacture,
    totalMainOeuvre,
    totalFraisAtelier,
    totalGeneral,
  } = props;

  useEffect(() => {
    async function loadClientContacts() {
      if (!clientId) {
        setClientContacts([]);
        setSelectedContactId("");
        setVehicleReadyPhone("");
        setVehicleReadyEmail("");
        return;
      }

      const { data, error } = await supabase
        .from("client_contacts")
        .select(
          "id, client_id, nom, poste, telephone, courriel, principal, type_facturation",
        )
        .eq("client_id", clientId)
        .order("principal", { ascending: false })
        .order("type_facturation", { ascending: false })
        .order("nom", { ascending: true });

      if (error) {
        console.error("Erreur contacts client:", error);
        setClientContacts([]);
        return;
      }

      const contacts = data || [];
      setClientContacts(contacts);

      // Aucun auto-remplissage
      setSelectedContactId("");
      setVehicleReadyPhone("");
      setVehicleReadyEmail("");
    }

    void loadClientContacts();
  }, [clientId]);

  useEffect(() => {
    const currentUniteNo = String(uniteNo || "").trim();
    setVehicleReadyMessage(
      currentUniteNo
        ? `Groupe Breton: votre véhicule/unité ${currentUniteNo} est prêt. Vous pouvez passer le récupérer.`
        : "Groupe Breton: votre véhicule est prêt. Vous pouvez passer le récupérer.",
    );
  }, [uniteNo]);

  useEffect(() => {
    if (!taskAuthSmsOpen) return;

    const selectedTasks = notes.filter((t) => selected[t.id]);
    const taskLines = selectedTasks
      .slice(0, 6)
      .map((t) => `- ${String(t.titre || "Tâche").trim()}`)
      .join("\n");

    const more =
      selectedTasks.length > 6
        ? `\n- +${selectedTasks.length - 6} autre(s) tâche(s)`
        : "";
    const url = getAutorisationUrl();
    const currentUniteNo = String(uniteNo || "").trim();
    const intro = currentUniteNo
      ? `Groupe Breton: des travaux sont à autoriser pour le véhicule/unité ${currentUniteNo}.`
      : "Groupe Breton: des travaux sont à autoriser pour votre véhicule.";

    setTaskAuthSmsMessage(`${intro}\n${taskLines}${more}\nLien: ${url}`.trim());
  }, [taskAuthSmsOpen, selected, notes, uniteNo, autorisationClientUrl, btId]);

  function getAutorisationUrl() {
    const provided = String(autorisationClientUrl || "").trim();
    if (provided) return provided;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/autorisation-client/${btId}`;
  }

  function onSelectVehicleReadyContact(contactId: string) {
    setSelectedContactId(contactId);

    const contact = clientContacts.find((c) => c.id === contactId);
    if (!contact) return;

    setVehicleReadyPhone(contact.telephone || "");
    setVehicleReadyEmail(contact.courriel || "");
  }

  async function sendTaskAutorisationSms() {
    const phone = vehicleReadyPhone.trim();
    const message = taskAuthSmsMessage.trim();
    const selectedTasks = notes.filter((t) => selected[t.id]);

    if (!phone) {
      alert("Inscris un numéro de téléphone.");
      return;
    }

    if (!selectedTasks.length) {
      alert(
        "Sélectionne au moins une tâche dans le tableau avant d’envoyer le SMS.",
      );
      return;
    }

    if (!message) {
      alert("Le message ne peut pas être vide.");
      return;
    }

    try {
      setTaskAuthSmsSending(true);

      const { error } = await supabase.functions.invoke("send-ready-sms", {
        body: {
          to: phone,
          message,
        },
      });

      if (error) throw error;

      alert("SMS d’autorisation envoyé au client.");
      setTaskAuthSmsOpen(false);
      void onRefresh?.();
    } catch (err: any) {
      console.error(err);
      alert("Erreur SMS autorisation: " + (err?.message || String(err)));
    } finally {
      setTaskAuthSmsSending(false);
    }
  }

  async function sendVehicleReadySms() {
    const phone = vehicleReadyPhone.trim();
    const email = vehicleReadyEmail.trim();
    const message = vehicleReadyMessage.trim();

    if (!vehicleReadySendSms && !vehicleReadySendEmail) {
      alert("Choisis au moins SMS ou courriel.");
      return;
    }

    if (vehicleReadySendSms && !phone) {
      alert("Inscris un numéro de téléphone.");
      return;
    }

    if (vehicleReadySendEmail && !email) {
      alert("Inscris un courriel.");
      return;
    }

    if (!message) {
      alert("Le message ne peut pas être vide.");
      return;
    }

    try {
      setVehicleReadySending(true);

      if (vehicleReadySendSms) {
        const { error } = await supabase.functions.invoke("send-ready-sms", {
          body: {
            to: phone,
            message,
          },
        });

        if (error) throw error;
      }

      if (vehicleReadySendEmail) {
        const { error } = await supabase.functions.invoke("send-ready-email", {
          body: {
            to: email,
            subject: "Véhicule prêt - Groupe Breton",
            message,
          },
        });

        if (error) throw error;
      }

      alert("Avis envoyé au client.");
      setVehicleReadyOpen(false);
      void onRefresh?.();
    } catch (err: any) {
      console.error(err);
      alert("Erreur envoi client: " + (err?.message || String(err)));
    } finally {
      setVehicleReadySending(false);
    }
  }


  useEffect(() => {
    const taskIds = Object.values(autorisationMap)
      .map((a) => String(a?.autorisation_tache_id || "").trim())
      .filter(Boolean);

    if (!taskIds.length) {
      setDiscussionCountByTask({});
      return;
    }

    let cancelled = false;

    async function loadDiscussionCounts() {
      const { data, error } = await supabase
        .from("bt_autorisation_messages")
        .select("autorisation_tache_id")
        .in("autorisation_tache_id", taskIds);

      if (cancelled) return;

      if (error) {
        console.error("Erreur chargement compte discussions:", error);
        return;
      }

      const byAutorisationTask: Record<string, number> = {};
      for (const row of data || []) {
        const id = String((row as any).autorisation_tache_id || "");
        if (!id) continue;
        byAutorisationTask[id] = (byAutorisationTask[id] || 0) + 1;
      }

      const byNote: Record<string, number> = {};
      for (const note of notes) {
        const authTaskId = autorisationMap[note.id]?.autorisation_tache_id;
        if (!authTaskId) continue;
        byNote[note.id] = byAutorisationTask[authTaskId] || 0;
      }

      setDiscussionCountByTask(byNote);
    }

    void loadDiscussionCounts();

    return () => {
      cancelled = true;
    };
  }, [autorisationMap, notes]);

  const discussionTasks = notes.filter(
    (task) => autorisationMap[task.id]?.decision === "a_discuter",
  );

  async function loadAllDiscussions() {
    const activeDiscussionTasks = notes.filter(
      (task) => autorisationMap[task.id]?.decision === "a_discuter",
    );

    if (!activeDiscussionTasks.length) {
      setDiscussionMessagesByNote({});
      setDiscussionReplies({});
      return;
    }

    const authTaskIds = activeDiscussionTasks
      .map((task) =>
        String(autorisationMap[task.id]?.autorisation_tache_id || "").trim(),
      )
      .filter(Boolean);

    if (!authTaskIds.length) {
      setDiscussionMessagesByNote({});
      return;
    }

    setDiscussionLoading(true);

    try {
      const { data, error } = await supabase
        .from("bt_autorisation_messages")
        .select(
          "id,autorisation_id,autorisation_tache_id,bt_id,unite_note_id,auteur_type,auteur_nom,message,created_at",
        )
        .in("autorisation_tache_id", authTaskIds)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const byNote: Record<string, AutorisationMessage[]> = {};

      for (const task of activeDiscussionTasks) {
        const authTaskId = autorisationMap[task.id]?.autorisation_tache_id;
        byNote[task.id] = (data || []).filter(
          (row: any) => row.autorisation_tache_id === authTaskId,
        ) as AutorisationMessage[];
      }

      setDiscussionMessagesByNote(byNote);

      const counts: Record<string, number> = {};
      for (const task of activeDiscussionTasks) {
        counts[task.id] = byNote[task.id]?.length || 0;
      }

      setDiscussionCountByTask((prev) => ({
        ...prev,
        ...counts,
      }));
    } catch (err: any) {
      console.error(err);
      alert(
        "Erreur chargement discussions: " +
          (err?.message || String(err)),
      );
    } finally {
      setDiscussionLoading(false);
    }
  }

  async function openDiscussions() {
    if (!discussionTasks.length) {
      alert("Aucune tâche n’est actuellement À discuter.");
      return;
    }

    setDiscussionOpen(true);
    setDiscussionReplies({});
    await loadAllDiscussions();
  }

  async function sendAllDiscussionReplies() {
    const activeDiscussionTasks = notes.filter(
      (task) => autorisationMap[task.id]?.decision === "a_discuter",
    );

    if (!activeDiscussionTasks.length) {
      alert("Aucune tâche n’est actuellement À discuter.");
      return;
    }

    const missingReply = activeDiscussionTasks.find(
      (task) => !String(discussionReplies[task.id] || "").trim(),
    );

    if (missingReply) {
      alert(
        `Ajoute une réponse pour chaque tâche À discuter.

Réponse manquante : ${missingReply.titre}`,
      );
      return;
    }

    setDiscussionSending(true);

    try {
      const authTaskIds = activeDiscussionTasks
        .map((task) =>
          String(autorisationMap[task.id]?.autorisation_tache_id || "").trim(),
        )
        .filter(Boolean);

      const { data: taskAuthRows, error: taskAuthErr } = await supabase
        .from("bt_autorisation_taches")
        .select("id,autorisation_id,titre,unite_note_id")
        .in("id", authTaskIds);

      if (taskAuthErr) throw taskAuthErr;

      const rows = taskAuthRows || [];
      if (!rows.length) {
        throw new Error("Aucune autorisation À discuter trouvée.");
      }

      const autorisationIds = Array.from(
        new Set(rows.map((row: any) => String(row.autorisation_id || "")).filter(Boolean)),
      );

      if (autorisationIds.length !== 1) {
        throw new Error(
          "Les tâches À discuter ne sont pas rattachées à la même demande d’autorisation.",
        );
      }

      const autorisationId = autorisationIds[0];

      const { data: auth, error: authErr } = await supabase
        .from("bt_autorisations")
        .select("id,token,client_email,client_nom")
        .eq("id", autorisationId)
        .maybeSingle();

      if (authErr) throw authErr;
      if (!auth) throw new Error("Demande d’autorisation introuvable.");

      const clientEmail = String(auth.client_email || "").trim();
      if (!clientEmail) {
        throw new Error(
          "Aucun courriel client n’est associé à cette demande.",
        );
      }

      const inserts = activeDiscussionTasks.map((task) => {
        const taskAuth = rows.find(
          (row: any) =>
            String(row.id) ===
            String(autorisationMap[task.id]?.autorisation_tache_id || ""),
        );

        if (!taskAuth) {
          throw new Error(`Autorisation introuvable pour : ${task.titre}`);
        }

        return {
          autorisation_id: autorisationId,
          autorisation_tache_id: taskAuth.id,
          bt_id: btId,
          unite_note_id: task.id,
          auteur_type: "atelier",
          auteur_nom: "Atelier",
          message: String(discussionReplies[task.id] || "").trim(),
        };
      });

      const { error: insertErr } = await supabase
        .from("bt_autorisation_messages")
        .insert(inserts);

      if (insertErr) throw insertErr;

      const lienAutorisation = `${window.location.origin}/autorisation-bt/${auth.token}`;

      const emailTasks = activeDiscussionTasks.map((task) => ({
        titre: task.titre,
        message: String(discussionReplies[task.id] || "").trim(),
      }));

      const { error: emailErr } = await supabase.functions.invoke(
        "bt-autorisation-email",
        {
          body: {
            type: "send_reponse_atelier",
            bt_id: btId,
            autorisation_id: autorisationId,
            client_email: clientEmail,
            client_nom: auth.client_nom || null,
            lien_autorisation: lienAutorisation,
            discussions: emailTasks,
          },
        },
      );

      if (emailErr) throw emailErr;

      setDiscussionReplies({});
      await loadAllDiscussions();
      void onRefresh?.();

      alert("Toutes les réponses ont été envoyées au client dans un seul courriel.");
    } catch (err: any) {
      console.error(err);
      alert(
        "Erreur envoi réponses: " +
          (err?.message || String(err)),
      );
    } finally {
      setDiscussionSending(false);
    }
  }

  return (
    <>
      <div style={styles.card}>
        <div style={{ ...styles.row, justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>
            Tâches à compléter
          </div>

          <div style={styles.row}>
            <button
              style={styles.btn}
              onClick={onCompleteSelectedTasks}
              disabled={!selectedIds.length || isReadOnly}
            >
              Effectuer
            </button>

            <button
              style={styles.btn}
              onClick={onDeleteSelectedTasks}
              disabled={!selectedIds.length || isReadOnly}
            >
              Supprimer
            </button>

            <button
              type="button"
              style={styles.btnPrimary}
              onClick={() => setSendClientChoiceOpen(true)}
              disabled={isReadOnly}
            >
              Envoyer au client
            </button>
          </div>
        </div>

        <div style={{ ...styles.row, marginTop: 10 }}>
          <button
            style={styles.btnPrimary}
            onClick={onOpenTaskModal}
            disabled={isReadOnly}
          >
            Ajouter une tâche
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={
                      notes.length > 0 && notes.every((t) => selected[t.id])
                    }
                    onChange={(e) => {
                      const on = e.target.checked;
                      const next: Record<string, boolean> = { ...selected };
                      notes.forEach((t) => (next[t.id] = on));
                      setSelected(next);
                    }}
                    disabled={isReadOnly && notes.length > 0}
                  />
                </th>
                <th style={styles.th}>Titre</th>
                <th style={{ ...styles.th, width: 180 }}>Créé</th>
                <th style={{ ...styles.th, width: 170 }}>Suivi</th>
                <th style={styles.photoTh}>Photos</th>
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
                notes.map((t) => {
                  const autorisation = autorisationMap[t.id];
                  const decision = autorisation?.decision;
                  const noteClient = String(
                    autorisation?.note_client || "",
                  ).trim();
                  const isPendingClient = decision === "attente";
                  const isRefusedClient = decision === "refuse";
                  const isADiscuterClient = decision === "a_discuter";
                  const suiviType = t.suivi_type || null;

                  

                  const rowStyle: CSSProperties = {
                    background: isRefusedClient
                      ? "#fef2f2"
                      : isPendingClient
                        ? "#fefce8"
                        : isADiscuterClient
                          ? "#eff6ff"
                          : suiviType === "hors_service"
                            ? "#fff1f2"
                            : suiviType === "urgent"
                              ? "#fff7ed"
                              : suiviType === "a_planifier"
                                ? "#eff6ff"
                                : "transparent",
                    opacity: isRefusedClient
                      ? 0.62
                      : isPendingClient || isADiscuterClient
                        ? 0.9
                        : 1,
                    transition: "background .15s ease, opacity .15s ease",
                  };

                  return (
                    <tr key={t.id} style={rowStyle}>
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          checked={Boolean(selected[t.id])}
                          onChange={(e) =>
                            setSelected((s) => ({
                              ...s,
                              [t.id]: e.target.checked,
                            }))
                          }
                          disabled={isReadOnly}
                        />
                      </td>

                      <td style={styles.td}>
                        <div
                          style={{
                            fontWeight: 500,
                            textTransform: "uppercase",
                          }}
                        >
                          {String(t.titre || "")}
                        </div>

                        {isPendingClient && (
                          <div
                            style={{
                              ...styles.authStatusText,
                              color: "#a16207",
                            }}
                          >
                            En attente client
                          </div>
                        )}

                        {isADiscuterClient && (
                          <div
                            style={{
                              ...styles.authStatusText,
                              color: "#2563eb",
                            }}
                          >
                            À discuter
                          </div>
                        )}

                        {isRefusedClient && (
                          <div
                            style={{
                              ...styles.authStatusText,
                              color: "#dc2626",
                            }}
                          >
                            Refusé par le client
                          </div>
                        )}

                        {(isADiscuterClient ||
                          (discussionCountByTask[t.id] || 0) > 0) && (
                          <button
                            type="button"
                            style={styles.discussionButton}
                            onClick={() => void openDiscussions()}
                          >
                            💬 Discussion
                            {(discussionCountByTask[t.id] || 0) > 0
                              ? ` (${discussionCountByTask[t.id]})`
                              : ""}
                          </button>
                        )}

                        {noteClient &&
                          (discussionCountByTask[t.id] || 0) === 0 && (
                            <div style={styles.clientNoteBox}>
                              Note client : {noteClient}
                            </div>
                          )}

                        {isRefusedClient && !isReadOnly && (
                          <div style={{ ...styles.row, gap: 6, marginTop: 8 }}>
                            <button
                              type="button"
                              style={styles.btnMiniPrimary}
                              onClick={() => onAutoriserManuellementTache(t)}
                            >
                              Autoriser à faire
                            </button>
                          </div>
                        )}
                      </td>

                      <td style={styles.td}>
                        {fmtDateTimeNoSeconds(t.created_at)}
                      </td>

                      <td style={styles.td}>
                       <button
  type="button"
  disabled={isReadOnly}
  onClick={() => setSuiviModalTask(t)}
  style={{
    border: "none",
    background: "transparent",
    padding: 0,
    fontWeight: 400,
    cursor: isReadOnly ? "default" : "pointer",
    color: "#111827",
    fontSize: 18,
    lineHeight: 1,
  }}
>
  +
</button>
                      </td>

                      <td style={styles.photoTd}>
                        <BtTachePhotos
                          btId={btId}
                          uniteId={t.unite_id}
                          uniteNoteId={t.id}
                          isReadOnly={isReadOnly}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, fontSize: 14, fontWeight: 950 }}>
          Tâches effectuées{" "}
          <span style={styles.muted}>({tachesEffectuees.length})</span>
        </div>

        <table style={{ ...styles.table, marginTop: 6 }}>
          <thead>
            <tr>
              <th style={styles.th}>Titre</th>
              <th style={{ ...styles.th, width: 180 }}>Date</th>
              <th style={styles.photoTh}>Photos</th>
              <th style={{ ...styles.th, width: 140 }}>Action</th>
            </tr>
          </thead>

          <tbody>
            {tachesEffectuees.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={4}>
                  <span style={styles.muted}>Aucune tâche effectuée.</span>
                </td>
              </tr>
            ) : (
              tachesEffectuees.map((t) => (
                <tr key={t.id}>
                  <td style={styles.td}>
                    <div
                      style={{ fontWeight: 500, textTransform: "uppercase" }}
                    >
                      {String(t.titre || "")}
                    </div>
                  </td>

                  <td style={styles.td}>
                    {fmtDateTimeNoSeconds(t.date_effectuee)}
                  </td>

                  <td style={styles.photoTd}>
                    <BtTachePhotos
                      btId={btId}
                      uniteId={t.unite_id}
                      tacheEffectueeId={t.id}
                      isReadOnly={isReadOnly}
                    />
                  </td>

                  <td style={styles.td}>
                    <button
                      style={styles.btn}
                      disabled={isReadOnly}
                      onClick={() => onRemettreTacheOuverte(t)}
                    >
                      Remettre
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <BtPiecesCard
        btId={btId}
        uniteId={uniteId}
        btKm={btKm}
        pieces={pieces}
        setPieces={setPieces}
        isReadOnly={isReadOnly}
        piecesTableAvailable={piecesTableAvailable}
        isBtOpenPricing={isBtOpenPricing}
        effectiveMargePiecesPct={effectiveMargePiecesPct}
        onReload={onReloadPiecesAndRecalc}
      />

      <div style={styles.card}>
        <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 10 }}>
          Temps pointé
        </div>

        <div style={{ ...styles.row, marginBottom: 10 }}>
          <button
            style={styles.btnPrimary}
            onClick={onOpenTempsModal}
            disabled={isReadOnly || !mainOeuvreTableAvailable}
          >
            Ajouter du temps
          </button>
        </div>

        {!pointagesTableAvailable && (
          <div style={styles.warn}>
            ⚠️ La table <b>bt_pointages</b> n’existe pas encore. Ajoute-la pour
            activer cette section.
          </div>
        )}

        {pointagesTableAvailable && (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Mécano</th>
                    <th style={{ ...styles.th, width: 120 }}>Heures</th>
                    <th style={{ ...styles.th, width: 140 }}>Taux horaire</th>
                    <th style={{ ...styles.th, width: 140 }}>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {pointagesResume.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={4}>
                        <span style={styles.muted}>
                          Aucun temps pointé pour ce BT.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    pointagesResume.map((r) => (
                      <tr key={r.mecano_nom}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 900 }}>{r.mecano_nom}</div>
                        </td>
                        <td style={styles.td}>{fmtHours(r.heures)}</td>
                        <td style={styles.td}>{money(effectiveTauxHoraire)}</td>
                        <td style={styles.td}>
                          {money(
                            decimalToNumber(r.heures) * effectiveTauxHoraire,
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {(pointages.length > 0 || mainOeuvre.length > 0) && (
              <div style={{ marginTop: 14 }}>
                <div style={styles.sectionHeaderRow}>
                  <div style={{ fontSize: 14, fontWeight: 950 }}>
                    Détail des pointages
                  </div>
                  <button
                    type="button"
                    style={styles.btnLink}
                    onClick={() => setShowPointageDetails((v) => !v)}
                  >
                    {showPointageDetails ? "Masquer détails" : "Voir détails"}
                  </button>
                </div>

                {showPointageDetails && (
                  <>
                    {pointages.length > 0 && (
                      <div style={styles.tableWrap}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Mécano</th>
                              <th style={{ ...styles.th, minWidth: 210 }}>
                                Début
                              </th>
                              <th style={{ ...styles.th, minWidth: 210 }}>
                                Fin
                              </th>
                              <th style={{ ...styles.th, width: 110 }}>
                                Durée
                              </th>
                              <th style={{ ...styles.th, minWidth: 180 }}>
                                Note
                              </th>
                              <th style={{ ...styles.th, width: 90 }}>
                                Action
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {pointages.map((p) => (
                              <tr key={p.id}>
                                <td style={styles.td}>{p.mecano_nom}</td>

                                <td style={styles.td}>
                                  {editingPointageId === p.id ? (
                                    <input
                                      type="datetime-local"
                                      style={{
                                        ...styles.input,
                                        minWidth: 190,
                                        width: "100%",
                                      }}
                                      value={editingPointageStart}
                                      onChange={(e) =>
                                        setEditingPointageStart(e.target.value)
                                      }
                                      disabled={isReadOnly}
                                    />
                                  ) : (
                                    fmtDateTime(p.started_at)
                                  )}
                                </td>

                                <td style={styles.td}>
                                  {editingPointageId === p.id ? (
                                    <input
                                      type="datetime-local"
                                      style={{
                                        ...styles.input,
                                        minWidth: 190,
                                        width: "100%",
                                      }}
                                      value={editingPointageEnd}
                                      onChange={(e) =>
                                        setEditingPointageEnd(e.target.value)
                                      }
                                      disabled={isReadOnly}
                                    />
                                  ) : (
                                    fmtDateTime(p.ended_at)
                                  )}
                                </td>

                                <td style={styles.td}>
                                  {editingPointageId === p.id
                                    ? fmtHours(
                                        Math.max(
                                          0,
                                          (new Date(
                                            localToIsoOrNull(
                                              editingPointageEnd,
                                            ) || 0,
                                          ).getTime() -
                                            new Date(
                                              localToIsoOrNull(
                                                editingPointageStart,
                                              ) || 0,
                                            ).getTime()) /
                                            3600000,
                                        ),
                                      )
                                    : fmtHours(
                                        p.duration_minutes != null
                                          ? Number(p.duration_minutes || 0) / 60
                                          : Math.max(
                                              0,
                                              (new Date(
                                                p.ended_at ||
                                                  new Date().toISOString(),
                                              ).getTime() -
                                                new Date(
                                                  p.started_at,
                                                ).getTime()) /
                                                3600000,
                                            ),
                                      )}
                                </td>

                                <td style={styles.td}>{p.note || "—"}</td>

                                <td style={styles.td}>
                                  <div
                                    style={styles.menuWrap}
                                    data-menu-root="pointage"
                                  >
                                    <button
                                      type="button"
                                      style={styles.iconBtn}
                                      onClick={() =>
                                        setPointageMenuOpenId((cur) =>
                                          cur === p.id ? null : p.id,
                                        )
                                      }
                                      disabled={isReadOnly}
                                    >
                                      ...
                                    </button>

                                    {pointageMenuOpenId === p.id && (
                                      <div style={styles.menu}>
                                        {editingPointageId === p.id ? (
                                          <>
                                            <button
                                              type="button"
                                              style={styles.menuItem}
                                              onClick={() =>
                                                onSavePointageRow(p.id)
                                              }
                                            >
                                              Enregistrer
                                            </button>
                                            <button
                                              type="button"
                                              style={{
                                                ...styles.menuItem,
                                                borderBottom: "none",
                                              }}
                                              onClick={() =>
                                                onDeletePointage(p.id)
                                              }
                                            >
                                              Supprimer
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              style={styles.menuItem}
                                              onClick={() =>
                                                onOpenEditPointage(p)
                                              }
                                            >
                                              Modifier
                                            </button>
                                            <button
                                              type="button"
                                              style={{
                                                ...styles.menuItem,
                                                borderBottom: "none",
                                              }}
                                              onClick={() =>
                                                onDeletePointage(p.id)
                                              }
                                            >
                                              Supprimer
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {mainOeuvre.length > 0 && (
                      <>
                        <div style={styles.detailSubTitle}>Temps manuel</div>

                        <div style={styles.tableWrap}>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                <th style={styles.th}>Mécano</th>
                                <th style={{ ...styles.th, minWidth: 220 }}>
                                  Description
                                </th>
                                <th style={{ ...styles.th, width: 110 }}>
                                  Heures
                                </th>
                                <th style={{ ...styles.th, width: 140 }}>
                                  Taux horaire
                                </th>
                                <th style={{ ...styles.th, width: 130 }}>
                                  Total
                                </th>
                                <th style={{ ...styles.th, width: 90 }}>
                                  Action
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {mainOeuvre.map((row) => {
                                const heuresValue = decimalToNumber(row.heures);
                                const tauxHoraireValue = isBtOpenPricing
                                  ? effectiveTauxHoraire
                                  : decimalToNumber(row.taux_horaire);
                                const total = heuresValue * tauxHoraireValue;

                                const isEditing =
                                  editingMainOeuvreId === row.id;

                                return (
                                  <tr key={row.id}>
                                    <td style={styles.td}>
                                      {isEditing ? (
                                        <input
                                          style={{
                                            ...styles.input,
                                            minWidth: 160,
                                            width: "100%",
                                          }}
                                          value={row.mecano_nom ?? ""}
                                          onChange={(e) =>
                                            updateMainOeuvreLocal(row.id, {
                                              mecano_nom: e.target.value,
                                            })
                                          }
                                          disabled={
                                            isReadOnly ||
                                            !mainOeuvreTableAvailable
                                          }
                                        />
                                      ) : (
                                        row.mecano_nom || "—"
                                      )}
                                    </td>

                                    <td style={styles.td}>
                                      {isEditing ? (
                                        <input
                                          style={{
                                            ...styles.input,
                                            minWidth: 220,
                                            width: "100%",
                                          }}
                                          value={row.description ?? ""}
                                          onChange={(e) =>
                                            updateMainOeuvreLocal(row.id, {
                                              description: e.target.value,
                                            })
                                          }
                                          disabled={
                                            isReadOnly ||
                                            !mainOeuvreTableAvailable
                                          }
                                        />
                                      ) : (
                                        row.description || "—"
                                      )}
                                    </td>

                                    <td style={styles.td}>
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          style={{
                                            ...styles.input,
                                            minWidth: 90,
                                            width: "100%",
                                          }}
                                          inputMode="decimal"
                                          value={String(row.heures ?? "")}
                                          onChange={(e) => {
                                            const val = e.target.value;

                                            if (isDecimalInput(val)) {
                                              updateMainOeuvreLocal(row.id, {
                                                heures: val,
                                              });
                                            }
                                          }}
                                          disabled={
                                            isReadOnly ||
                                            !mainOeuvreTableAvailable
                                          }
                                        />
                                      ) : (
                                        fmtHours(decimalToNumber(row.heures))
                                      )}
                                    </td>

                                    <td style={styles.td}>
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          style={{
                                            ...styles.input,
                                            minWidth: 110,
                                            width: "100%",
                                          }}
                                          inputMode="decimal"
                                          value={String(row.taux_horaire ?? "")}
                                          onChange={(e) => {
                                            const val = e.target.value;

                                            if (isDecimalInput(val)) {
                                              updateMainOeuvreLocal(row.id, {
                                                taux_horaire: val,
                                              });
                                            }
                                          }}
                                          disabled={
                                            isReadOnly ||
                                            !mainOeuvreTableAvailable
                                          }
                                        />
                                      ) : (
                                        money(
                                          isBtOpenPricing
                                            ? effectiveTauxHoraire
                                            : decimalToNumber(row.taux_horaire),
                                        )
                                      )}
                                    </td>

                                    <td style={styles.td}>{money(total)}</td>

                                    <td style={styles.td}>
                                      <div
                                        style={styles.menuWrap}
                                        data-menu-root="mainoeuvre"
                                      >
                                        <button
                                          type="button"
                                          style={styles.iconBtn}
                                          onClick={() =>
                                            setMainOeuvreMenuOpenId((cur) =>
                                              cur === row.id ? null : row.id,
                                            )
                                          }
                                          disabled={
                                            isReadOnly ||
                                            !mainOeuvreTableAvailable
                                          }
                                        >
                                          ...
                                        </button>

                                        {mainOeuvreMenuOpenId === row.id && (
                                          <div style={styles.menu}>
                                            {isEditing ? (
                                              <>
                                                <button
                                                  type="button"
                                                  style={styles.menuItem}
                                                  onClick={() =>
                                                    onSaveMainOeuvreRow(row)
                                                  }
                                                >
                                                  Enregistrer
                                                </button>
                                                <button
                                                  type="button"
                                                  style={{
                                                    ...styles.menuItem,
                                                    borderBottom: "none",
                                                  }}
                                                  onClick={() =>
                                                    onDeleteMainOeuvreRow(
                                                      row.id,
                                                    )
                                                  }
                                                >
                                                  Supprimer
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  type="button"
                                                  style={styles.menuItem}
                                                  onClick={() =>
                                                    onOpenEditMainOeuvre(row.id)
                                                  }
                                                >
                                                  Modifier
                                                </button>
                                                <button
                                                  type="button"
                                                  style={{
                                                    ...styles.menuItem,
                                                    borderBottom: "none",
                                                  }}
                                                  onClick={() =>
                                                    onDeleteMainOeuvreRow(
                                                      row.id,
                                                    )
                                                  }
                                                >
                                                  Supprimer
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div style={styles.card}>
        <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 8 }}>
          Total
        </div>

        <div style={styles.totalCard}>
          <div style={styles.totalRowFirst}>
            <div style={styles.totalLeft}>
              <div style={styles.totalLabel}>Pièces</div>
            </div>
            <div style={styles.totalValue}>{money(totalPiecesFacture)}</div>
          </div>

          <div style={styles.totalRow}>
            <div style={styles.totalLeft}>
              <div style={styles.totalLabel}>Main-d’œuvre</div>
            </div>
            <div style={styles.totalValue}>{money(totalMainOeuvre)}</div>
          </div>

          <div style={styles.totalRow}>
            <div style={styles.totalLeft}>
              <div style={styles.totalLabel}>Frais d’atelier</div>
            </div>
            <div style={styles.totalValue}>{money(totalFraisAtelier)}</div>
          </div>

          <div style={styles.grandTotalRow}>
            <div style={styles.grandTotalLabel}>Total</div>
            <div style={styles.grandTotalValue}>{money(totalGeneral)}</div>
          </div>
        </div>
      </div>

      {sendClientChoiceOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <button
              type="button"
              style={styles.modalClose}
              onClick={() => setSendClientChoiceOpen(false)}
            >
              ×
            </button>

            <div style={styles.modalTitle}>Envoyer au client</div>
            <div style={styles.modalText}>Choisissez le type d’envoi.</div>

            <div style={styles.modalActionsColumn}>
              <BtAutorisationClient
                btId={btId}
                clientId={clientId}
                uniteNo={uniteNo}
                notes={notes}
                isReadOnly={isReadOnly}
                onSent={() => {
                  setSendClientChoiceOpen(false);
                  void onRefresh?.();
                }}
              />

              <button
                type="button"
                style={styles.btnPrimary}
                onClick={() => {
                  setSendClientChoiceOpen(false);
                  setVehicleReadyOpen(true);
                }}
              >
                Aviser que le véhicule est prêt
              </button>

              <button
                type="button"
                style={styles.btn}
                onClick={() => setSendClientChoiceOpen(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {taskAuthSmsOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCardLarge}>
            <button
              type="button"
              style={styles.modalClose}
              onClick={() => setTaskAuthSmsOpen(false)}
            >
              ×
            </button>

            <div style={styles.modalTitle}>Tâches à autoriser par SMS</div>
            <div style={styles.modalText}>
              Sélectionne les tâches dans le tableau avant d’envoyer. Le contact
              principal est sélectionné par défaut, mais tu peux choisir un
              autre contact ou écrire le numéro manuellement.
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <select
                style={{ ...styles.input, width: "100%" }}
                value={selectedContactId}
                onChange={(e) => onSelectVehicleReadyContact(e.target.value)}
              >
                <option value="">Sélectionner un contact</option>
                {clientContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                    {c.principal ? " — Principal" : ""}
                    {c.type_facturation ? " — Facturation" : ""}
                    {c.telephone ? ` — ${c.telephone}` : ""}
                    {c.courriel ? ` — ${c.courriel}` : ""}
                  </option>
                ))}
              </select>

              <input
                style={{ ...styles.input, width: "100%" }}
                placeholder="Téléphone client ex: +14189575921"
                value={vehicleReadyPhone}
                onChange={(e) => setVehicleReadyPhone(e.target.value)}
              />

              <div style={styles.helpBox}>
                Tâches sélectionnées : {selectedIds.length}. Le lien utilisé
                sera : {getAutorisationUrl()}
              </div>

              <textarea
                style={styles.textarea}
                value={taskAuthSmsMessage}
                onChange={(e) => setTaskAuthSmsMessage(e.target.value)}
              />

              <button
                type="button"
                style={styles.btnPrimary}
                onClick={sendTaskAutorisationSms}
                disabled={taskAuthSmsSending || !selectedIds.length}
              >
                {taskAuthSmsSending ? "Envoi..." : "Envoyer SMS au client"}
              </button>

              <button
                type="button"
                style={styles.btn}
                onClick={() => setTaskAuthSmsOpen(false)}
                disabled={taskAuthSmsSending}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {vehicleReadyOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCardLarge}>
            <button
              type="button"
              style={styles.modalClose}
              onClick={() => setVehicleReadyOpen(false)}
            >
              ×
            </button>

            <div style={styles.modalTitle}>Véhicule prêt</div>
            <div style={styles.modalText}>
              Le contact principal est sélectionné par défaut. Tu peux choisir
              un autre contact ou écrire les informations manuellement.
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <select
                style={{ ...styles.input, width: "100%" }}
                value={selectedContactId}
                onChange={(e) => onSelectVehicleReadyContact(e.target.value)}
              >
                <option value="">Sélectionner un contact</option>
                {clientContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                    {c.principal ? " — Principal" : ""}
                    {c.type_facturation ? " — Facturation" : ""}
                    {c.telephone ? ` — ${c.telephone}` : ""}
                    {c.courriel ? ` — ${c.courriel}` : ""}
                  </option>
                ))}
              </select>

              <input
                style={{ ...styles.input, width: "100%" }}
                placeholder="Téléphone client ex: +14189575921"
                value={vehicleReadyPhone}
                onChange={(e) => setVehicleReadyPhone(e.target.value)}
              />

              <input
                style={{ ...styles.input, width: "100%" }}
                placeholder="Courriel client"
                value={vehicleReadyEmail}
                onChange={(e) => setVehicleReadyEmail(e.target.value)}
              />

              <div style={{ ...styles.row, gap: 14 }}>
                <label style={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={vehicleReadySendSms}
                    onChange={(e) => setVehicleReadySendSms(e.target.checked)}
                  />
                  SMS
                </label>

                <label style={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={vehicleReadySendEmail}
                    onChange={(e) => setVehicleReadySendEmail(e.target.checked)}
                  />
                  Courriel
                </label>
              </div>

              <textarea
                style={styles.textarea}
                value={vehicleReadyMessage}
                onChange={(e) => setVehicleReadyMessage(e.target.value)}
              />

              <button
                type="button"
                style={styles.btnPrimary}
                onClick={sendVehicleReadySms}
                disabled={vehicleReadySending}
              >
                {vehicleReadySending ? "Envoi..." : "Envoyer au client"}
              </button>

              <button
                type="button"
                style={styles.btn}
                onClick={() => setVehicleReadyOpen(false)}
                disabled={vehicleReadySending}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {discussionOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={() => {
            if (!discussionSending) setDiscussionOpen(false);
          }}
        >
          <div
            style={{
              ...styles.modalCardLarge,
              width: "min(820px, 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              style={styles.modalClose}
              onClick={() => setDiscussionOpen(false)}
              disabled={discussionSending}
            >
              ×
            </button>

            <div style={styles.modalTitle}>Répondre aux tâches à discuter</div>
            <div style={styles.modalText}>
              Réponds à toutes les tâches ci-dessous, puis envoie une seule fois au client.
              Les tâches déjà autorisées ou refusées sont ignorées.
            </div>

            {discussionLoading ? (
              <div style={styles.helpBox}>Chargement des discussions...</div>
            ) : discussionTasks.length === 0 ? (
              <div style={styles.helpBox}>
                Aucune tâche n’est actuellement À discuter.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {discussionTasks.map((task) => {
                  const taskMessages = discussionMessagesByNote[task.id] || [];
                  const reply = discussionReplies[task.id] || "";

                  return (
                    <div
                      key={task.id}
                      style={{
                        border: "1px solid rgba(0,0,0,.10)",
                        borderRadius: 14,
                        padding: 14,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 950,
                          textTransform: "uppercase",
                          marginBottom: 10,
                        }}
                      >
                        {task.titre}
                      </div>

                      <div style={styles.discussionList}>
                        {taskMessages.length === 0 ? (
                          <div style={styles.helpBox}>
                            Aucun message enregistré.
                          </div>
                        ) : (
                          taskMessages.map((m) => {
                            const isClient = m.auteur_type === "client";

                            return (
                              <div
                                key={m.id}
                                style={{
                                  display: "flex",
                                  justifyContent: isClient
                                    ? "flex-end"
                                    : "flex-start",
                                }}
                              >
                                <div
                                  style={
                                    isClient
                                      ? styles.discussionClient
                                      : styles.discussionAtelier
                                  }
                                >
                                  <div style={styles.discussionMeta}>
                                    {isClient
                                      ? m.auteur_nom || "Client"
                                      : m.auteur_nom || "Atelier"}{" "}
                                    · {fmtDateTimeNoSeconds(m.created_at)}
                                  </div>

                                  <div style={styles.discussionText}>
                                    {m.message}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <textarea
                        style={styles.textarea}
                        value={reply}
                        onChange={(e) =>
                          setDiscussionReplies((prev) => ({
                            ...prev,
                            [task.id]: e.target.value,
                          }))
                        }
                        placeholder="Réponse de l'atelier pour cette tâche..."
                        disabled={discussionSending || isReadOnly}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div
              style={{
                ...styles.row,
                justifyContent: "flex-end",
                marginTop: 14,
              }}
            >
              <button
                type="button"
                style={styles.btn}
                onClick={() => setDiscussionOpen(false)}
                disabled={discussionSending}
              >
                Fermer
              </button>

              {!isReadOnly && (
                <button
                  type="button"
                  style={styles.btnPrimary}
                  onClick={() => void sendAllDiscussionReplies()}
                  disabled={
                    discussionSending ||
                    discussionTasks.length === 0 ||
                    discussionTasks.some(
                      (task) =>
                        !String(discussionReplies[task.id] || "").trim(),
                    )
                  }
                >
                  {discussionSending
                    ? "Envoi..."
                    : `Envoyer les réponses (${discussionTasks.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {suiviModalTask && (
        <div
          style={styles.modalBackdrop}
          onClick={() => setSuiviModalTask(null)}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              style={styles.modalClose}
              onClick={() => setSuiviModalTask(null)}
            >
              ×
            </button>

            <div style={styles.modalTitle}>Suivi de la tâche</div>
            <div style={styles.modalText}>{suiviModalTask.titre}</div>

            <div style={styles.modalActionsColumn}>
              {([
                {
                  value: null,
                  label: "Aucun",
                  bg: "#f3f4f6",
                  color: "#374151",
                  border: "#e5e7eb",
                },
                {
                  value: "a_planifier",
                  label: "🔵 À planifier",
                  bg: "#dbeafe",
                  color: "#1d4ed8",
                  border: "#bfdbfe",
                },
                {
                  value: "urgent",
                  label: "🟠 Urgent",
                  bg: "#ffedd5",
                  color: "#9a3412",
                  border: "#fed7aa",
                },
                {
                  value: "hors_service",
                  label: "🔴 Hors service",
                  bg: "#fee2e2",
                  color: "#991b1b",
                  border: "#fecaca",
                },
              ] as const).map((option) => (
                <button
                  key={option.value || "aucun"}
                  type="button"
                  style={{
                    ...styles.btn,
                    background: option.bg,
                    color: option.color,
                    border: `1px solid ${option.border}`,
                    textAlign: "left",
                  }}
                  onClick={async () => {
                    await onUpdateNoteSuiviType(
                      suiviModalTask.id,
                      option.value,
                    );
                    setSuiviModalTask(null);
                  }}
                >
                  {option.label}
                </button>
              ))}

              <button
                type="button"
                style={styles.btn}
                onClick={() => setSuiviModalTask(null)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}