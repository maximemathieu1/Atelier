import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabaseClient";
import { LION_SRT_CATALOG } from "../../data/lionSrtCatalog";

export type CentreServiceFabricant = "Lion" | "Girardin" | "Thomas";
export type CentreServicePayeur = "client" | "fabricant" | "partage";
export type LignePayeur = "client" | "fabricant";

type PieceRow = {
  id: string;
  sku?: string | null;
  code?: string | null;
  description?: string | null;
  nom?: string | null;
  titre?: string | null;
  quantite?: number | string | null;
};

type MainOeuvreRow = {
  id: string;
  mecano_nom?: string | null;
  description?: string | null;
  heures?: number | string | null;
};

type PointageRow = {
  id: string;
  mecano_nom?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_minutes?: number | null;
};

type Repartition = {
  pieces: Record<string, LignePayeur>;
  main_oeuvre: Record<string, LignePayeur>;
  pointages: Record<string, LignePayeur>;
};

type ClaimMainOeuvreType = "diagnostic" | "srt";

type ClaimMainOeuvreRow = {
  id: string;
  type: ClaimMainOeuvreType;
  code: string | null;
  description: string;
  heures: number | string;
};

type CentreServiceRow = {
  id: string;
  bt_id: string;
  fabricant: CentreServiceFabricant;
  numero_case: string | null;
  numero_reclamation: string | null;
  statut: string;
  payeur: CentreServicePayeur;
  preautorisation: string | null;
  date_ouverture: string | null;
  date_fermeture: string | null;
  commentaires: string | null;
  repartition: Repartition | null;
  travaux_centre_service?: boolean | null;
  piece_achetee_lion?: boolean | null;
  composant_important?: boolean | null;
  remplacement_approuve?: boolean | null;
  plainte?: string | null;
  cause?: string | null;
  correction?: string | null;
  serie_piece_defectueuse?: string | null;
  serie_piece_remplacement?: string | null;
  date_achat_1?: string | null;
  facture_achat_1?: string | null;
  km_achat_1?: number | string | null;
  date_achat_2?: string | null;
  facture_achat_2?: string | null;
  km_achat_2?: number | string | null;
  signature_demandeur?: string | null;
  claim_pdf_generated_at?: string | null;
  heures_diagnostic?: number | string | null;
  heures_srt?: number | string | null;
  main_oeuvre_claim?: ClaimMainOeuvreRow[] | null;
};

type BtDocumentRow = {
  id: string;
  type: string;
  nom_fichier: string;
  storage_path: string;
  mime_type?: string | null;
  source: string;
  created_at?: string | null;
};

type Props = {
  btId: string;
  pieces: PieceRow[];
  mainOeuvre: MainOeuvreRow[];
  pointages: PointageRow[];
  isReadOnly: boolean;
  documents: BtDocumentRow[];
  onDocumentGenerated?: () => void | Promise<void>;
};

const FABRICANTS: CentreServiceFabricant[] = ["Lion", "Girardin", "Thomas"];
const STATUTS = [
  "Diagnostic",
  "En attente du fabricant",
  "Préautorisation",
  "Pièces commandées",
  "Pièces reçues",
  "Réparation en cours",
  "Réclamation soumise",
  "En attente de paiement",
  "Fermé",
  "Refusé",
];

const EMPTY_REPARTITION: Repartition = {
  pieces: {},
  main_oeuvre: {},
  pointages: {},
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeRepartition(value: unknown): Repartition {
  const raw = (value || {}) as Partial<Repartition>;
  return {
    pieces: raw.pieces || {},
    main_oeuvre: raw.main_oeuvre || {},
    pointages: raw.pointages || {},
  };
}

function pointageLabel(row: PointageRow) {
  const minutes = Number(row.duration_minutes || 0);
  const hours = minutes > 0 ? `${(minutes / 60).toFixed(2)} h` : "";
  return [row.mecano_nom || "Pointage", hours].filter(Boolean).join(" — ");
}

function makeClaimLaborRow(type: ClaimMainOeuvreType): ClaimMainOeuvreRow {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    code: null,
    description:
      type === "diagnostic"
        ? "Main-d’œuvre diagnostic"
        : "Main-d’œuvre réparation (SRT)",
    heures: "",
  };
}

function normalizeClaimLabor(value: unknown): ClaimMainOeuvreRow[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((row: any) => ({
      id: String(row?.id || `labor-${Math.random().toString(36).slice(2, 8)}`),
      type: (row?.type === "srt"
        ? "srt"
        : "diagnostic") as ClaimMainOeuvreType,
      code: row?.code ? String(row.code) : null,
      description: String(row?.description || ""),
      heures: row?.heures ?? "",
    }))
    .filter((row) => row.description || row.heures !== "");
}

export default function BtCentreServiceCard({
  btId,
  pieces,
  mainOeuvre,
  pointages,
  isReadOnly,
  documents,
  onDocumentGenerated,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rowId, setRowId] = useState<string | null>(null);
  const [fabricant, setFabricant] = useState<CentreServiceFabricant>("Lion");
  const [numeroCase, setNumeroCase] = useState("");
  const [numeroReclamation, setNumeroReclamation] = useState("");
  const [statut, setStatut] = useState("Diagnostic");
  const [payeur, setPayeur] = useState<CentreServicePayeur>("fabricant");
  const [preautorisation, setPreautorisation] = useState("");
  const [dateOuverture, setDateOuverture] = useState(todayDate());
  const [dateFermeture, setDateFermeture] = useState("");
  const [commentaires, setCommentaires] = useState("");
  const [repartition, setRepartition] = useState<Repartition>(EMPTY_REPARTITION);
  const [travauxCentreService, setTravauxCentreService] = useState(true);
  const [pieceAcheteeLion, setPieceAcheteeLion] = useState<boolean | null>(null);
  const [composantImportant, setComposantImportant] = useState<boolean | null>(null);
  const [remplacementApprouve, setRemplacementApprouve] = useState<boolean | null>(null);
  const [plainte, setPlainte] = useState("");
  const [cause, setCause] = useState("");
  const [correction, setCorrection] = useState("");
  const [seriePieceDefectueuse, setSeriePieceDefectueuse] = useState("");
  const [seriePieceRemplacement, setSeriePieceRemplacement] = useState("");
  const [dateAchat1, setDateAchat1] = useState("");
  const [factureAchat1, setFactureAchat1] = useState("");
  const [kmAchat1, setKmAchat1] = useState("");
  const [dateAchat2, setDateAchat2] = useState("");
  const [factureAchat2, setFactureAchat2] = useState("");
  const [kmAchat2, setKmAchat2] = useState("");
  const [signatureDemandeur, setSignatureDemandeur] = useState("");
  const [claimPdfGeneratedAt, setClaimPdfGeneratedAt] = useState("");
  const [generatingClaim, setGeneratingClaim] = useState(false);
  const [mainOeuvreClaim, setMainOeuvreClaim] = useState<ClaimMainOeuvreRow[]>([]);
  const [sendClaimOpen, setSendClaimOpen] = useState(false);
  const [sendingClaim, setSendingClaim] = useState(false);
  const [claimRecipientEmail, setClaimRecipientEmail] = useState("");
  const [claimRecipientName, setClaimRecipientName] = useState("");
  const [claimSubject, setClaimSubject] = useState("");
  const [claimMessage, setClaimMessage] = useState("");
  const [includeBtInClaim, setIncludeBtInClaim] = useState(true);
  const [selectedClaimDocumentIds, setSelectedClaimDocumentIds] = useState<
    Record<string, boolean>
  >({});
  const [claimHistory, setClaimHistory] = useState<any[]>([]);

  const exists = Boolean(rowId);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("bt_garanties")
        .select("*")
        .eq("bt_id", btId)
        .maybeSingle();

      if (queryError) throw queryError;

      if (!data) {
        setRowId(null);
        setFabricant("Lion");
        setNumeroCase("");
        setNumeroReclamation("");
        setStatut("Diagnostic");
        setPayeur("fabricant");
        setPreautorisation("");
        setDateOuverture(todayDate());
        setDateFermeture("");
        setCommentaires("");
        setRepartition(EMPTY_REPARTITION);
        setTravauxCentreService(true);
        setPieceAcheteeLion(null);
        setComposantImportant(null);
        setRemplacementApprouve(null);
        setPlainte("");
        setCause("");
        setCorrection("");
        setSeriePieceDefectueuse("");
        setSeriePieceRemplacement("");
        setDateAchat1("");
        setFactureAchat1("");
        setKmAchat1("");
        setDateAchat2("");
        setFactureAchat2("");
        setKmAchat2("");
        setSignatureDemandeur("");
        setClaimPdfGeneratedAt("");
        setMainOeuvreClaim([]);
        return;
      }

      const row = data as CentreServiceRow;
      setRowId(row.id);
      setFabricant(row.fabricant || "Lion");
      setNumeroCase(row.numero_case || "");
      setNumeroReclamation(row.numero_reclamation || "");
      setStatut(row.statut || "Diagnostic");
      setPayeur(row.payeur || "fabricant");
      setPreautorisation(row.preautorisation || "");
      setDateOuverture(row.date_ouverture || todayDate());
      setDateFermeture(row.date_fermeture || "");
      setCommentaires(row.commentaires || "");
      setRepartition(normalizeRepartition(row.repartition));
      setTravauxCentreService(row.travaux_centre_service !== false);
      setPieceAcheteeLion(row.piece_achetee_lion ?? null);
      setComposantImportant(row.composant_important ?? null);
      setRemplacementApprouve(row.remplacement_approuve ?? null);
      setPlainte(row.plainte || "");
      setCause(row.cause || "");
      setCorrection(row.correction || "");
      setSeriePieceDefectueuse(row.serie_piece_defectueuse || "");
      setSeriePieceRemplacement(row.serie_piece_remplacement || "");
      setDateAchat1(row.date_achat_1 || "");
      setFactureAchat1(row.facture_achat_1 || "");
      setKmAchat1(row.km_achat_1 == null ? "" : String(row.km_achat_1));
      setDateAchat2(row.date_achat_2 || "");
      setFactureAchat2(row.facture_achat_2 || "");
      setKmAchat2(row.km_achat_2 == null ? "" : String(row.km_achat_2));
      setSignatureDemandeur(row.signature_demandeur || "");
      setClaimPdfGeneratedAt(row.claim_pdf_generated_at || "");
      const loadedLabor = normalizeClaimLabor(row.main_oeuvre_claim);
      if (loadedLabor.length > 0) {
        setMainOeuvreClaim(loadedLabor);
      } else {
        const legacyRows: ClaimMainOeuvreRow[] = [];
        if (row.heures_diagnostic != null) {
          legacyRows.push({
            ...makeClaimLaborRow("diagnostic"),
            heures: String(row.heures_diagnostic),
          });
        }
        if (row.heures_srt != null) {
          legacyRows.push({
            ...makeClaimLaborRow("srt"),
            heures: String(row.heures_srt),
          });
        }
        setMainOeuvreClaim(legacyRows);
      }
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [btId]);

  useEffect(() => {
    const eventName = `open-centre-service-claim-${btId}`;
    const handler = () => {
      void openSendClaim();
    };

    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  });

  useEffect(() => {
    if (statut === "Fermé" && !dateFermeture) setDateFermeture(todayDate());
  }, [statut, dateFermeture]);

  const repartitionComplete = useMemo(() => {
    if (payeur !== "partage") return true;
    return (
      pieces.every((p) => Boolean(repartition.pieces[p.id])) &&
      mainOeuvre.every((m) => Boolean(repartition.main_oeuvre[m.id])) &&
      pointages.every((p) => Boolean(repartition.pointages[p.id]))
    );
  }, [payeur, pieces, mainOeuvre, pointages, repartition]);

  function initializeSharedFrom(source: CentreServicePayeur) {
    if (source === "partage") return;
    const defaultPayer: LignePayeur = source === "client" ? "client" : "fabricant";
    setRepartition({
      pieces: Object.fromEntries(pieces.map((p) => [p.id, repartition.pieces[p.id] || defaultPayer])),
      main_oeuvre: Object.fromEntries(
        mainOeuvre.map((m) => [m.id, repartition.main_oeuvre[m.id] || defaultPayer]),
      ),
      pointages: Object.fromEntries(
        pointages.map((p) => [p.id, repartition.pointages[p.id] || defaultPayer]),
      ),
    });
  }

  async function save() {
    if (isReadOnly) return false;
    if (payeur === "partage" && !repartitionComplete) {
      setError("Choisis le payeur de chaque ligne avant d'enregistrer.");
      return false;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        bt_id: btId,
        fabricant,
        numero_case: numeroCase.trim() || null,
        numero_reclamation: numeroReclamation.trim() || null,
        statut,
        payeur,
        preautorisation: preautorisation.trim() || null,
        date_ouverture: dateOuverture || todayDate(),
        date_fermeture: dateFermeture || null,
        commentaires: commentaires.trim() || null,
        repartition,
        travaux_centre_service: travauxCentreService,
        piece_achetee_lion: pieceAcheteeLion,
        composant_important: composantImportant,
        remplacement_approuve: remplacementApprouve,
        plainte: plainte.trim() || null,
        cause: cause.trim() || null,
        correction: correction.trim() || null,
        serie_piece_defectueuse: seriePieceDefectueuse.trim() || null,
        serie_piece_remplacement: seriePieceRemplacement.trim() || null,
        date_achat_1: dateAchat1 || null,
        facture_achat_1: factureAchat1.trim() || null,
        km_achat_1: kmAchat1.trim() ? Number(kmAchat1.replace(",", ".")) : null,
        date_achat_2: dateAchat2 || null,
        facture_achat_2: factureAchat2.trim() || null,
        km_achat_2: kmAchat2.trim() ? Number(kmAchat2.replace(",", ".")) : null,
        signature_demandeur: signatureDemandeur.trim() || null,
        main_oeuvre_claim: mainOeuvreClaim.map((row) => ({
          ...row,
          code: row.code || null,
          description: row.description.trim(),
          heures:
            String(row.heures).trim() === ""
              ? null
              : Number(String(row.heures).replace(",", ".")),
        })),
        updated_at: new Date().toISOString(),
      };

      const { data, error: saveError } = await supabase
        .from("bt_garanties")
        .upsert(payload, { onConflict: "bt_id" })
        .select("id")
        .single();

      if (saveError) throw saveError;
      setRowId(data.id);
      return true;
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'enregistrement.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function addClaimLaborRow(type: ClaimMainOeuvreType) {
    setMainOeuvreClaim((rows) => [...rows, makeClaimLaborRow(type)]);
  }

  function updateClaimLaborRow(
    id: string,
    patch: Partial<ClaimMainOeuvreRow>,
  ) {
    setMainOeuvreClaim((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeClaimLaborRow(id: string) {
    setMainOeuvreClaim((rows) => rows.filter((row) => row.id !== id));
  }

  function applySrtDescription(id: string, description: string) {
    const normalized = description.trim().toLocaleLowerCase("fr-CA");
    const item = LION_SRT_CATALOG.find(
      (entry) =>
        entry.descriptionFr.trim().toLocaleLowerCase("fr-CA") === normalized,
    );

    if (!item) {
      updateClaimLaborRow(id, { description });
      return;
    }

    updateClaimLaborRow(id, {
      type: "srt",
      code: item.code,
      description: item.descriptionFr,
      heures: item.heures,
    });
  }

  async function generateLionClaim() {
    if (fabricant !== "Lion") {
      setError("Le formulaire FO-0187 est disponible seulement pour Lion.");
      return;
    }

    setGeneratingClaim(true);
    setError("");

    try {
      if (!isReadOnly) {
        const saved = await save();
        if (!saved) return;
      } else if (!exists) {
        setError("Enregistre d'abord le dossier Centre de service.");
        return;
      }

      const { data, error: functionError } = await supabase.functions.invoke(
        "generate-lion-claim",
        {
          body: { bt_id: btId },
        },
      );

      if (functionError) throw functionError;
      if (data?.error) throw new Error(data.error);

      setClaimPdfGeneratedAt(data?.generated_at || new Date().toISOString());
      await onDocumentGenerated?.();

      if (data?.signed_url) {
        window.open(data.signed_url, "_blank");
      }

      alert(
        data?.appendix_added
          ? "Claim Lion généré et enregistré dans les documents du BT. Une annexe a été ajoutée pour les pièces supplémentaires."
          : "Claim Lion généré et enregistré dans les documents du BT.",
      );
    } catch (e: any) {
      setError(e?.message || "Erreur pendant la génération du claim Lion.");
    } finally {
      setGeneratingClaim(false);
    }
  }

  async function openSendClaim() {
    setError("");

    try {
      const { data: manufacturer, error: manufacturerError } = await supabase
        .from("clients")
        .select("id,nom,courriel")
        .eq("est_fabricant", true)
        .eq("fabricant", fabricant)
        .maybeSingle();

      if (manufacturerError) throw manufacturerError;
      if (!manufacturer) {
        throw new Error(`Aucune fiche client fabricant ${fabricant}.`);
      }
      if (!String(manufacturer.courriel || "").trim()) {
        throw new Error(
          `Aucun courriel n'est enregistré dans la fiche du fabricant ${fabricant}.`,
        );
      }

      const latestClaim = documents
        .filter(
          (doc) =>
            doc.source === "centre_service_lion" ||
            String(doc.nom_fichier || "").toLowerCase().includes("claim"),
        )
        .sort((a, b) =>
          String(b.created_at || "").localeCompare(String(a.created_at || "")),
        )[0];

      const selected: Record<string, boolean> = {};
      if (latestClaim?.id) selected[latestClaim.id] = true;

      setClaimRecipientEmail(String(manufacturer.courriel || ""));
      setClaimRecipientName(String(manufacturer.nom || fabricant));
      setIncludeBtInClaim(true);
      setSelectedClaimDocumentIds(selected);
      setClaimSubject(
        `Réclamation de garantie ${fabricant} - ${
          numeroCase || numeroReclamation || "sans numéro"
        }`,
      );
      setClaimMessage(`Bonjour,

Veuillez trouver ci-joint les documents concernant notre réclamation de garantie.

Fabricant : ${fabricant}
Numéro de case : ${numeroCase || numeroReclamation || "—"}

Merci.`);
      setSendClaimOpen(true);

      const { data: history } = await supabase
        .from("bt_garantie_envois")
        .select("*")
        .eq("bt_id", btId)
        .order("sent_at", { ascending: false });

      setClaimHistory(history || []);
    } catch (e: any) {
      setError(e?.message || "Impossible de préparer l'envoi.");
    }
  }

  function toggleClaimDocument(id: string) {
    setSelectedClaimDocumentIds((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  async function sendClaim() {
    const documentIds = Object.entries(selectedClaimDocumentIds)
      .filter(([, checked]) => checked)
      .map(([id]) => id);

    if (!includeBtInClaim && documentIds.length === 0) {
      setError("Sélectionne au moins une pièce jointe.");
      return;
    }

    setSendingClaim(true);
    setError("");

    try {
      if (!isReadOnly) {
        const saved = await save();
        if (!saved) return;
      }

      const { data, error: functionError } = await supabase.functions.invoke(
        "send-centre-service-claim",
        {
          body: {
            bt_id: btId,
            include_bt: includeBtInClaim,
            document_ids: documentIds,
            subject: claimSubject.trim(),
            message: claimMessage.trim(),
          },
        },
      );

      if (functionError) throw functionError;
      if (data?.error) throw new Error(data.error);

      setStatut("Réclamation soumise");
      setSendClaimOpen(false);

      const { data: history } = await supabase
        .from("bt_garantie_envois")
        .select("*")
        .eq("bt_id", btId)
        .order("sent_at", { ascending: false });

      setClaimHistory(history || []);

      alert(
        `Claim envoyé à ${data?.to_email || claimRecipientEmail}.`,
      );
    } catch (e: any) {
      setError(e?.message || "Erreur pendant l'envoi du claim.");
    } finally {
      setSendingClaim(false);
    }
  }

  async function remove() {
    if (!rowId || isReadOnly) return;
    if (!window.confirm("Retirer ce BT du Centre de service?")) return;

    const { error: deleteError } = await supabase
      .from("bt_garanties")
      .delete()
      .eq("id", rowId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await load();
  }

  function setLinePayer(
    section: keyof Repartition,
    id: string,
    value: LignePayeur,
  ) {
    setRepartition((prev) => ({
      ...prev,
      [section]: { ...prev[section], [id]: value },
    }));
  }

  const styles: Record<string, CSSProperties> = {
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 16,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      marginBottom: 12,
    },
    title: { margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" },
    muted: { marginTop: 4, color: "#64748b", fontSize: 13 },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
      gap: 14,
      marginTop: 18,
    },
    field: { display: "grid", gap: 6 },
    label: { fontSize: 13, fontWeight: 900, color: "#334155" },
    input: {
      width: "100%",
      minWidth: 0,
      boxSizing: "border-box",
      height: 42,
      padding: "0 12px",
      borderRadius: 10,
      border: "1px solid #d6dbe7",
      background: "#fff",
      color: "#0f172a",
      fontSize: 14,
    },
    textarea: {
      width: "100%",
      minHeight: 120,
      boxSizing: "border-box",
      padding: 12,
      borderRadius: 10,
      border: "1px solid #d6dbe7",
      background: "#fff",
      color: "#0f172a",
      resize: "vertical",
      fontSize: 14,
    },
    actions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 16,
    },
    btn: {
      height: 40,
      padding: "0 14px",
      borderRadius: 10,
      border: "1px solid #d6dbe7",
      background: "#fff",
      color: "#0f172a",
      fontWeight: 800,
      cursor: "pointer",
    },
    primary: {
      height: 40,
      padding: "0 16px",
      borderRadius: 10,
      border: "1px solid #0f172a",
      background: "#0f172a",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    danger: {
      height: 40,
      padding: "0 14px",
      borderRadius: 10,
      border: "1px solid #dc2626",
      background: "#fff",
      color: "#dc2626",
      fontWeight: 800,
      cursor: "pointer",
    },
    error: {
      marginTop: 14,
      padding: 10,
      borderRadius: 10,
      border: "1px solid #fecdd3",
      background: "#fff1f2",
      color: "#9f1239",
      fontWeight: 700,
    },
    shared: {
      marginTop: 18,
      paddingTop: 18,
      borderTop: "1px solid #e2e8f0",
    },
    sectionTitle: { margin: "0 0 10px", fontSize: 16, fontWeight: 900 },
    tableWrap: { width: "100%", overflowX: "auto", marginBottom: 18 },
    table: { width: "100%", borderCollapse: "collapse", minWidth: 620 },
    th: {
      padding: "10px 12px",
      borderBottom: "1px solid #e2e8f0",
      background: "#f8fafc",
      textAlign: "left",
      fontSize: 13,
      fontWeight: 900,
    },
    td: { padding: "10px 12px", borderBottom: "1px solid #eef2f7", fontSize: 14 },
    claimSection: {
      marginTop: 18,
      paddingTop: 18,
      borderTop: "1px solid #e2e8f0",
    },
    claimGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: 12,
      marginTop: 12,
    },
    radioRow: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      minHeight: 42,
      flexWrap: "wrap",
    },
    generatedInfo: {
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      border: "1px solid #bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
      fontWeight: 700,
      fontSize: 13,
    },
    laborBox: {
      marginTop: 14,
      border: "1px solid #e2e8f0",
      borderRadius: 12,
      overflow: "hidden",
    },
    laborHeader: {
      display: "grid",
      gridTemplateColumns: "130px minmax(280px, 1fr) 130px 110px 44px",
      gap: 8,
      padding: "9px 10px",
      background: "#f8fafc",
      borderBottom: "1px solid #e2e8f0",
      fontSize: 12,
      fontWeight: 900,
      color: "#475569",
    },
    laborRow: {
      display: "grid",
      gridTemplateColumns: "130px minmax(280px, 1fr) 130px 110px 44px",
      gap: 8,
      padding: 10,
      borderBottom: "1px solid #eef2f7",
      alignItems: "center",
    },
    laborRemove: {
      width: 36,
      height: 36,
      borderRadius: 9,
      border: "1px solid #fecaca",
      background: "#fff",
      color: "#dc2626",
      fontWeight: 900,
      cursor: "pointer",
    },
    laborActions: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginTop: 10,
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.48)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 11000,
    },
    modalCard: {
      width: "min(760px, 100%)",
      maxHeight: "92vh",
      overflowY: "auto",
      background: "#fff",
      borderRadius: 16,
      boxShadow: "0 28px 80px rgba(0,0,0,.25)",
      border: "1px solid rgba(0,0,0,.08)",
    },
    modalHeader: {
      padding: "14px 16px",
      borderBottom: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    modalBody: { padding: 16 },
    attachmentRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      marginBottom: 8,
    },
    payerSelect: {
      width: 150,
      height: 36,
      borderRadius: 9,
      border: "1px solid #d6dbe7",
      background: "#fff",
      padding: "0 8px",
    },
  };

  if (loading) return <div style={styles.card}>Chargement du Centre de service…</div>;

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Centre de service</h2>
      <div style={styles.muted}>
        {exists ? "Ce BT est suivi dans le Centre de service." : "Complète les champs pour ajouter ce BT au Centre de service."}
      </div>

      <div style={styles.grid}>
        <label style={styles.field}>
          <span style={styles.label}>Fabricant</span>
          <select
            style={styles.input}
            value={fabricant}
            onChange={(e) => setFabricant(e.target.value as CentreServiceFabricant)}
            disabled={isReadOnly || saving}
          >
            {FABRICANTS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Numéro de case</span>
          <input style={styles.input} value={numeroCase} onChange={(e) => setNumeroCase(e.target.value)} disabled={isReadOnly || saving} />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Numéro de réclamation</span>
          <input style={styles.input} value={numeroReclamation} onChange={(e) => setNumeroReclamation(e.target.value)} disabled={isReadOnly || saving} />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Préautorisation</span>
          <input style={styles.input} value={preautorisation} onChange={(e) => setPreautorisation(e.target.value)} disabled={isReadOnly || saving} />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Statut</span>
          <select style={styles.input} value={statut} onChange={(e) => setStatut(e.target.value)} disabled={isReadOnly || saving}>
            {STATUTS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Payeur</span>
          <select
            style={styles.input}
            value={payeur}
            onChange={(e) => {
              const next = e.target.value as CentreServicePayeur;
              if (next === "partage") initializeSharedFrom(payeur);
              setPayeur(next);
            }}
            disabled={isReadOnly || saving}
          >
            <option value="client">Client</option>
            <option value="fabricant">Fabricant</option>
            <option value="partage">Partagé</option>
          </select>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Date d'ouverture</span>
          <input type="date" style={styles.input} value={dateOuverture} onChange={(e) => setDateOuverture(e.target.value)} disabled={isReadOnly || saving} />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Date de fermeture</span>
          <input type="date" style={styles.input} value={dateFermeture} onChange={(e) => setDateFermeture(e.target.value)} disabled={isReadOnly || saving} />
        </label>
      </div>

      <label style={{ ...styles.field, marginTop: 14 }}>
        <span style={styles.label}>Commentaires</span>
        <textarea style={styles.textarea} value={commentaires} onChange={(e) => setCommentaires(e.target.value)} disabled={isReadOnly || saving} />
      </label>

      {fabricant === "Lion" && (
        <div style={styles.claimSection}>
          <h3 style={styles.sectionTitle}>Réclamation Lion FO-0187</h3>
          <div style={styles.muted}>
            Ces renseignements seront inscrits directement dans le formulaire officiel Lion.
          </div>

          <div style={styles.claimGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Travaux faits dans un centre de service</span>
              <select
                style={styles.input}
                value={travauxCentreService ? "oui" : "non"}
                onChange={(e) => setTravauxCentreService(e.target.value === "oui")}
                disabled={isReadOnly || saving}
              >
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Pièce de rechange achetée chez Lion</span>
              <select
                style={styles.input}
                value={pieceAcheteeLion === null ? "" : pieceAcheteeLion ? "oui" : "non"}
                onChange={(e) =>
                  setPieceAcheteeLion(
                    e.target.value === "" ? null : e.target.value === "oui",
                  )
                }
                disabled={isReadOnly || saving}
              >
                <option value="">À déterminer</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Composant important</span>
              <select
                style={styles.input}
                value={composantImportant === null ? "" : composantImportant ? "oui" : "non"}
                onChange={(e) =>
                  setComposantImportant(
                    e.target.value === "" ? null : e.target.value === "oui",
                  )
                }
                disabled={isReadOnly || saving}
              >
                <option value="">À déterminer</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Remplacement approuvé par Lion</span>
              <select
                style={styles.input}
                value={remplacementApprouve === null ? "" : remplacementApprouve ? "oui" : "non"}
                onChange={(e) =>
                  setRemplacementApprouve(
                    e.target.value === "" ? null : e.target.value === "oui",
                  )
                }
                disabled={isReadOnly || saving}
              >
                <option value="">À déterminer</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Date d'achat nº 1</span>
              <input type="date" style={styles.input} value={dateAchat1} onChange={(e) => setDateAchat1(e.target.value)} disabled={isReadOnly || saving} />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Facture d'achat nº 1</span>
              <input style={styles.input} value={factureAchat1} onChange={(e) => setFactureAchat1(e.target.value)} disabled={isReadOnly || saving} />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Kilométrage à l'achat nº 1</span>
              <input inputMode="numeric" style={styles.input} value={kmAchat1} onChange={(e) => setKmAchat1(e.target.value)} disabled={isReadOnly || saving} />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Date d'achat nº 2</span>
              <input type="date" style={styles.input} value={dateAchat2} onChange={(e) => setDateAchat2(e.target.value)} disabled={isReadOnly || saving} />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Facture d'achat nº 2</span>
              <input style={styles.input} value={factureAchat2} onChange={(e) => setFactureAchat2(e.target.value)} disabled={isReadOnly || saving} />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Kilométrage à l'achat nº 2</span>
              <input inputMode="numeric" style={styles.input} value={kmAchat2} onChange={(e) => setKmAchat2(e.target.value)} disabled={isReadOnly || saving} />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>No série pièce défectueuse</span>
              <input style={styles.input} value={seriePieceDefectueuse} onChange={(e) => setSeriePieceDefectueuse(e.target.value)} disabled={isReadOnly || saving} />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>No série pièce de remplacement</span>
              <input style={styles.input} value={seriePieceRemplacement} onChange={(e) => setSeriePieceRemplacement(e.target.value)} disabled={isReadOnly || saving} />
            </label>

          </div>

          <div style={{ marginTop: 16 }}>
            <h4 style={styles.sectionTitle}>Main-d’œuvre du claim</h4>
            <div style={styles.muted}>
              Ajoute autant de lignes de diagnostic et de réparation SRT que nécessaire.
              Pour une réparation SRT, commence à taper la description de la composante.
              Le code et les heures se remplissent automatiquement. Tu peux aussi saisir
              manuellement un code de bulletin de service et le temps autorisé.
            </div>

            <div style={styles.laborBox}>
              <div style={styles.laborHeader}>
                <div>Type</div>
                <div>Description / composante</div>
                <div>Code</div>
                <div>Heures</div>
                <div></div>
              </div>

              {mainOeuvreClaim.length === 0 ? (
                <div style={{ padding: 14, color: "#64748b" }}>
                  Aucune ligne de main-d’œuvre.
                </div>
              ) : (
                mainOeuvreClaim.map((row) => (
                  <div key={row.id} style={styles.laborRow}>
                    <select
                      style={{ ...styles.input, height: 38 }}
                      value={row.type}
                      onChange={(e) => {
                        const type = e.target.value as ClaimMainOeuvreType;
                        updateClaimLaborRow(row.id, {
                          type,
                          code: type === "diagnostic" ? null : row.code,
                          description:
                            type === "diagnostic" && !row.description
                              ? "Main-d’œuvre diagnostic"
                              : row.description,
                        });
                      }}
                      disabled={isReadOnly || saving}
                    >
                      <option value="diagnostic">Diagnostic</option>
                      <option value="srt">Réparation SRT</option>
                    </select>

                    <div>
                      <input
                        list={`lion-srt-${row.id}`}
                        style={{ ...styles.input, height: 38 }}
                        value={row.description}
                        onChange={(e) =>
                          applySrtDescription(row.id, e.target.value)
                        }
                        disabled={isReadOnly || saving}
                        placeholder={
                          row.type === "srt"
                            ? "Taper ou choisir une description SRT"
                            : "Description du diagnostic"
                        }
                      />

                      {row.type === "srt" && (
                        <datalist id={`lion-srt-${row.id}`}>
                          {LION_SRT_CATALOG.map((item) => (
                            <option
                              key={item.code}
                              value={item.descriptionFr}
                            >
                              {item.code} — {item.heures} h
                            </option>
                          ))}
                        </datalist>
                      )}
                    </div>

                    <input
                      style={{ ...styles.input, height: 38 }}
                      value={row.code || ""}
                      onChange={(e) =>
                        updateClaimLaborRow(row.id, {
                          code: e.target.value || null,
                        })
                      }
                      disabled={isReadOnly || saving}
                      placeholder={
                        row.type === "srt"
                          ? "Ex. 01-05 ou bulletin"
                          : "Optionnel"
                      }
                    />

                    <input
                      inputMode="decimal"
                      style={{ ...styles.input, height: 38 }}
                      value={String(row.heures ?? "")}
                      onChange={(e) =>
                        updateClaimLaborRow(row.id, {
                          heures: e.target.value,
                        })
                      }
                      disabled={isReadOnly || saving}
                    />

                    <button
                      type="button"
                      style={styles.laborRemove}
                      onClick={() => removeClaimLaborRow(row.id)}
                      disabled={isReadOnly || saving}
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={styles.laborActions}>
              <button
                type="button"
                style={styles.btn}
                onClick={() => addClaimLaborRow("diagnostic")}
                disabled={isReadOnly || saving}
              >
                Ajouter diagnostic
              </button>
              <button
                type="button"
                style={styles.btn}
                onClick={() => addClaimLaborRow("srt")}
                disabled={isReadOnly || saving}
              >
                Ajouter réparation SRT
              </button>
            </div>
          </div>

          <div style={styles.claimGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Signature du demandeur</span>
              <input style={styles.input} value={signatureDemandeur} onChange={(e) => setSignatureDemandeur(e.target.value)} disabled={isReadOnly || saving} placeholder="Ex. Maxime Mathieu" />
            </label>
          </div>

          <label style={{ ...styles.field, marginTop: 12 }}>
            <span style={styles.label}>Plainte</span>
            <textarea style={styles.textarea} value={plainte} onChange={(e) => setPlainte(e.target.value)} disabled={isReadOnly || saving} />
          </label>

          <label style={{ ...styles.field, marginTop: 12 }}>
            <span style={styles.label}>Cause</span>
            <textarea style={styles.textarea} value={cause} onChange={(e) => setCause(e.target.value)} disabled={isReadOnly || saving} />
          </label>

          <label style={{ ...styles.field, marginTop: 12 }}>
            <span style={styles.label}>Correction</span>
            <textarea style={{ ...styles.textarea, minHeight: 150 }} value={correction} onChange={(e) => setCorrection(e.target.value)} disabled={isReadOnly || saving} />
          </label>

          {claimPdfGeneratedAt && (
            <div style={styles.generatedInfo}>
              Dernier claim généré : {new Date(claimPdfGeneratedAt).toLocaleString("fr-CA")}
            </div>
          )}

          <div style={{ ...styles.actions, justifyContent: "flex-start" }}>
            <button
              type="button"
              style={styles.primary}
              onClick={() => void generateLionClaim()}
              disabled={generatingClaim || saving}
            >
              {generatingClaim ? "Génération du PDF…" : "Générer le claim PDF"}
            </button>
            <button
              type="button"
              style={styles.btn}
              onClick={() => void openSendClaim()}
              disabled={saving || generatingClaim}
            >
              Envoyer le claim
            </button>
          </div>
        </div>
      )}

      {payeur === "partage" && (
        <div style={styles.shared}>
          <h3 style={styles.sectionTitle}>Répartition de la facturation</h3>
          <div style={styles.muted}>Les choix ci-dessous apparaissent uniquement parce que le payeur est « Partagé ».</div>

          {pieces.length > 0 && (
            <>
              <h4 style={styles.sectionTitle}>Pièces</h4>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Pièce</th><th style={styles.th}>Quantité</th><th style={styles.th}>Payeur</th></tr></thead>
                  <tbody>
                    {pieces.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>{[item.sku || item.code, item.description || item.nom || item.titre].filter(Boolean).join(" — ") || "Pièce"}</td>
                        <td style={styles.td}>{item.quantite ?? "—"}</td>
                        <td style={styles.td}>
                          <select style={styles.payerSelect} value={repartition.pieces[item.id] || ""} onChange={(e) => setLinePayer("pieces", item.id, e.target.value as LignePayeur)} disabled={isReadOnly || saving}>
                            <option value="">Choisir</option><option value="client">Client</option><option value="fabricant">Fabricant</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {mainOeuvre.length > 0 && (
            <>
              <h4 style={styles.sectionTitle}>Main-d'œuvre manuelle</h4>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Description</th><th style={styles.th}>Heures</th><th style={styles.th}>Payeur</th></tr></thead>
                  <tbody>
                    {mainOeuvre.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>{[item.mecano_nom, item.description].filter(Boolean).join(" — ") || "Main-d'œuvre"}</td>
                        <td style={styles.td}>{item.heures ?? "—"}</td>
                        <td style={styles.td}>
                          <select style={styles.payerSelect} value={repartition.main_oeuvre[item.id] || ""} onChange={(e) => setLinePayer("main_oeuvre", item.id, e.target.value as LignePayeur)} disabled={isReadOnly || saving}>
                            <option value="">Choisir</option><option value="client">Client</option><option value="fabricant">Fabricant</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {pointages.length > 0 && (
            <>
              <h4 style={styles.sectionTitle}>Pointages</h4>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Mécanicien</th><th style={styles.th}>Payeur</th></tr></thead>
                  <tbody>
                    {pointages.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>{pointageLabel(item)}</td>
                        <td style={styles.td}>
                          <select style={styles.payerSelect} value={repartition.pointages[item.id] || ""} onChange={(e) => setLinePayer("pointages", item.id, e.target.value as LignePayeur)} disabled={isReadOnly || saving}>
                            <option value="">Choisir</option><option value="client">Client</option><option value="fabricant">Fabricant</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {pieces.length === 0 && mainOeuvre.length === 0 && pointages.length === 0 && (
            <div style={styles.muted}>Aucune ligne à répartir pour le moment.</div>
          )}
        </div>
      )}

      {sendClaimOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={() => {
            if (!sendingClaim) setSendClaimOpen(false);
          }}
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Envoyer le claim</h3>
              <button
                type="button"
                style={styles.btn}
                onClick={() => setSendClaimOpen(false)}
                disabled={sendingClaim}
              >
                Fermer
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.claimGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>Fabricant</span>
                  <input
                    style={styles.input}
                    value={claimRecipientName}
                    readOnly
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Courriel</span>
                  <input
                    style={styles.input}
                    value={claimRecipientEmail}
                    readOnly
                  />
                </label>
              </div>

              <label style={{ ...styles.field, marginTop: 12 }}>
                <span style={styles.label}>Sujet</span>
                <input
                  style={styles.input}
                  value={claimSubject}
                  onChange={(e) => setClaimSubject(e.target.value)}
                  disabled={sendingClaim}
                />
              </label>

              <label style={{ ...styles.field, marginTop: 12 }}>
                <span style={styles.label}>Message</span>
                <textarea
                  style={styles.textarea}
                  value={claimMessage}
                  onChange={(e) => setClaimMessage(e.target.value)}
                  disabled={sendingClaim}
                />
              </label>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>
                  Pièces jointes
                </div>

                <label style={styles.attachmentRow}>
                  <input
                    type="checkbox"
                    checked={includeBtInClaim}
                    onChange={(e) => setIncludeBtInClaim(e.target.checked)}
                    disabled={sendingClaim}
                  />
                  <div>
                    <div style={{ fontWeight: 800 }}>Bon de travail PDF</div>
                    <div style={styles.muted}>
                      Généré au moment de l'envoi
                    </div>
                  </div>
                </label>

                {documents.length === 0 ? (
                  <div style={styles.muted}>
                    Aucun document disponible dans ce BT.
                  </div>
                ) : (
                  documents.map((doc) => (
                    <label key={doc.id} style={styles.attachmentRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedClaimDocumentIds[doc.id])}
                        onChange={() => toggleClaimDocument(doc.id)}
                        disabled={sendingClaim}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            wordBreak: "break-word",
                          }}
                        >
                          {doc.nom_fichier}
                        </div>
                        <div style={styles.muted}>
                          {doc.source === "centre_service_lion"
                            ? "Claim généré"
                            : doc.type === "photo"
                              ? "Photo"
                              : "Document"}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>

              {claimHistory.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Historique
                  </div>
                  {claimHistory.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "9px 10px",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {new Date(item.sent_at).toLocaleString("fr-CA")}
                      </div>
                      <div style={styles.muted}>
                        {item.destinataire_courriel} —{" "}
                        {(item.noms_documents || []).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={styles.actions}>
                <button
                  type="button"
                  style={styles.btn}
                  onClick={() => setSendClaimOpen(false)}
                  disabled={sendingClaim}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  style={styles.primary}
                  onClick={() => void sendClaim()}
                  disabled={sendingClaim}
                >
                  {sendingClaim ? "Envoi…" : "Envoyer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.actions}>
        {exists && !isReadOnly && <button type="button" style={styles.danger} onClick={() => void remove()} disabled={saving}>Retirer du Centre de service</button>}
        <button type="button" style={styles.primary} onClick={() => void save()} disabled={isReadOnly || saving}>
          {saving ? "Enregistrement…" : exists ? "Enregistrer" : "Ajouter au Centre de service"}
        </button>
      </div>
    </div>
  );
}