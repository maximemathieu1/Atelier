import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const BUCKET_NAME = "vehicle-documents";

type TabKey = "apercu" | "pep" | "bt" | "rondes" | "documents";

type UniteRow = {
  id: string;
  numero?: string | null;
  no_unite?: string | null;
  nom?: string | null;
  plaque?: string | null;
  immatriculation?: string | null;
  niv?: string | null;
  vin?: string | null;
  marque?: string | null;
  modele?: string | null;
  annee?: number | string | null;
  km_actuel?: number | string | null;
  odometre?: number | string | null;
  pep_vignette_no?: string | null;
  pep_vignette_expiration?: string | null;
  statut?: string | null;
};

type PepArchiveRow = {
  id: string;
  unite_id?: string | null;
  unite?: string | null;
  date_pep?: string | null;
  date_prochain?: string | null;
  num_mecano?: string | null;
  odometre?: number | string | null;
  payload_json?: unknown;
  signature_data_url?: string | null;
  html_complet?: string | null;
  pages_html?: unknown;
  created_at?: string | null;
  archive_key?: string | null;
};

type BtRow = {
  id: string;
  numero?: string | null;
  unite_id?: string | null;
  date_ouverture?: string | null;
  date_fermeture?: string | null;
  created_at?: string | null;
  statut?: string | null;
  km?: number | string | null;
  total_final?: number | string | null;
  total?: number | string | null;
};

type VehicleDocumentRow = {
  id: string;
  unite_id: string;
  type_document: string;
  nom_fichier: string;
  storage_path: string;
  mime_type?: string | null;
  taille_bytes?: number | null;
  note?: string | null;
  date_expiration?: string | null;
  created_at: string;
};

type ExpirationDefaultRow = {
  type_document: string;
  date_expiration: string | null;
};

const DOCUMENT_TYPES = [
  { value: "immatriculation", label: "Immatriculation" },
  { value: "assurance", label: "Assurance" },
  { value: "contrat_location", label: "Contrat de location" },
  { value: "rappel_constructeur", label: "Rappel constructeur" },
  { value: "cvm", label: "CVM" },
  { value: "autre", label: "Autre" },
];

function unitLabel(u?: UniteRow | null) {
  if (!u) return "—";
  return u.numero || u.no_unite || u.nom || "—";
}

function plateLabel(u?: UniteRow | null) {
  if (!u) return "—";
  return u.plaque || u.immatriculation || "—";
}

function nivLabel(u?: UniteRow | null) {
  if (!u) return "—";
  return u.niv || u.vin || "—";
}

function kmLabel(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("fr-CA");
}

function moneyLabel(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

function documentTypeLabel(value: string) {
  return DOCUMENT_TYPES.find((t) => t.value === value)?.label || value;
}

function fileSizeLabel(size?: number | null) {
  if (!size) return "—";
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / 1024 / 1024).toFixed(1)} Mo`;
}

function normalizeStatus(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

type AlertBadge = {
  label: string;
  style: React.CSSProperties;
};

function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const clean = String(value).slice(0, 10);
  const date = new Date(`${clean}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysExpired(value?: string | null) {
  const expiration = parseLocalDate(value);
  if (!expiration) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diff = Math.floor((today.getTime() - expiration.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

function daysUntilExpiration(value?: string | null) {
  const expiration = parseLocalDate(value);
  if (!expiration) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diff = Math.ceil((expiration.getTime() - today.getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getPepDueDate(pep?: PepArchiveRow | null) {
  if (!pep) return null;

  const explicit = parseLocalDate(pep.date_prochain);
  if (explicit) return explicit;

  const source = parseLocalDate(pep.date_pep || pep.created_at);
  return source ? addDays(source, 90) : null;
}

function getPepDate(pep?: PepArchiveRow | null) {
  if (!pep) return null;
  return parseLocalDate(pep.date_pep || pep.created_at);
}

function getDaysBetweenDates(
  older?: Date | null,
  newer?: Date | null,
) {
  if (!older || !newer) return null;
  return Math.floor((newer.getTime() - older.getTime()) / 86400000);
}

function isPepValidOnDate(
  pep: PepArchiveRow,
  referenceValue?: string | null,
) {
  const pepDate = getPepDate(pep);
  const referenceDate = parseLocalDate(referenceValue);
  if (!pepDate || !referenceDate) return false;

  const ageDays = getDaysBetweenDates(pepDate, referenceDate);
  return ageDays != null && ageDays >= 0 && ageDays <= 90;
}

function isPepAfterDate(
  pep: PepArchiveRow,
  dateValue?: string | null,
) {
  const pepDate = getPepDate(pep);
  const compareDate = parseLocalDate(dateValue);
  if (!pepDate || !compareDate) return false;
  return pepDate.getTime() > compareDate.getTime();
}

function getPepOverdueDays(pep?: PepArchiveRow | null) {
  const due = getPepDueDate(pep);
  if (!due) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

function administrativeExpirationStatus(
  value?: string | null,
  missingLabel = "Manquant",
): AlertBadge {
  if (!value) return { label: missingLabel, style: styles.statusDanger };

  const expired = daysExpired(value);

  if (expired && expired > 30) {
    return { label: `Expiré depuis ${expired} j`, style: styles.statusDanger };
  }

  if (expired && expired > 0) {
    return { label: `Expiré depuis ${expired} j`, style: styles.statusWarning };
  }

  return { label: "OK", style: styles.statusOk };
}

function optionalExpirationStatus(
  value?: string | null,
  yellowLimit = 15,
): AlertBadge {
  if (!value) return { label: "—", style: styles.statusNeutral };

  const expired = daysExpired(value);

  if (expired && expired > yellowLimit) {
    return { label: `Expiré depuis ${expired} j`, style: styles.statusDanger };
  }

  if (expired && expired > 0) {
    return { label: `Expiré depuis ${expired} j`, style: styles.statusWarning };
  }

  return { label: "OK", style: styles.statusOk };
}

function pepStatus(pep?: PepArchiveRow | null): AlertBadge {
  if (!pep) return { label: "PEP manquant", style: styles.statusDanger };

  const overdue = getPepOverdueDays(pep) ?? 0;

  if (overdue > 15) {
    return { label: `Passé dû depuis ${overdue} j`, style: styles.statusDanger };
  }

  if (overdue > 0) {
    return { label: `Passé dû depuis ${overdue} j`, style: styles.statusWarning };
  }

  return { label: "Valide", style: styles.statusOk };
}

function requiresExpiration(type: string) {
  return type === "assurance" || type === "immatriculation" || type === "cvm";
}

function mostFrequentValidDate(values: Array<string | null | undefined>) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const counts = new Map<string, number>();

  for (const raw of values) {
    const date = parseLocalDate(raw);
    if (!date || date.getTime() < today.getTime()) continue;

    const key = String(raw).slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let bestDate = "";
  let bestCount = 0;

  for (const [date, count] of counts.entries()) {
    if (count > bestCount || (count == bestCount && date > bestDate)) {
      bestDate = date;
      bestCount = count;
    }
  }

  return bestDate;
}

function findLinkedBtForPep(pep: PepArchiveRow, bts: BtRow[]) {
  if (!pep.unite_id || !pep.date_pep) return null;

  const pepDate = new Date(`${pep.date_pep}T00:00:00`);
  if (Number.isNaN(pepDate.getTime())) return null;

  const sameUnit = bts.filter((bt) => bt.unite_id === pep.unite_id);

  const sameMonth = sameUnit.find((bt) => {
    const sourceDate = bt.date_ouverture || bt.created_at;
    if (!sourceDate) return false;

    const btDate = new Date(sourceDate);

    return (
      btDate.getFullYear() === pepDate.getFullYear() &&
      btDate.getMonth() === pepDate.getMonth()
    );
  });

  if (sameMonth) return sameMonth;

  const closest = sameUnit
    .map((bt) => {
      const sourceDate = bt.date_ouverture || bt.created_at;
      const btDate = sourceDate ? new Date(sourceDate) : null;
      const diff = btDate
        ? Math.abs(btDate.getTime() - pepDate.getTime())
        : Number.MAX_SAFE_INTEGER;

      return { bt, diff };
    })
    .sort((a, b) => a.diff - b.diff)[0];

  if (!closest) return null;

  const maxDays = 45;
  const maxMs = maxDays * 24 * 60 * 60 * 1000;

  return closest.diff <= maxMs ? closest.bt : null;
}

export default function DossierVehiculeDetailPage() {
  const { uniteId } = useParams<{ uniteId: string }>();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("apercu");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [savingVignette, setSavingVignette] = useState(false);

  const [unite, setUnite] = useState<UniteRow | null>(null);
  const [peps, setPeps] = useState<PepArchiveRow[]>([]);
  const [bts, setBts] = useState<BtRow[]>([]);
  const [documents, setDocuments] = useState<VehicleDocumentRow[]>([]);

  const [docType, setDocType] = useState("immatriculation");
  const [docNote, setDocNote] = useState("");
  const [docExpiration, setDocExpiration] = useState("");

  const [vignetteNo, setVignetteNo] = useState("");
  const [vignetteExpiration, setVignetteExpiration] = useState("");
  const [defaultExpirationByType, setDefaultExpirationByType] = useState<
    Record<string, string>
  >({});
  const [defaultVignetteExpiration, setDefaultVignetteExpiration] = useState("");

  useEffect(() => {
    if (!uniteId) return;

    void Promise.all([load(), loadExpirationDefaults()]);
  }, [uniteId]);

  async function loadExpirationDefaults() {
    const [docsRes, vignetteRes] = await Promise.all([
      supabase
        .from("vehicle_documents")
        .select("type_document,date_expiration")
        .in("type_document", ["assurance", "immatriculation", "cvm"])
        .not("date_expiration", "is", null),

      supabase
        .from("unites")
        .select("pep_vignette_expiration")
        .not("pep_vignette_expiration", "is", null),
    ]);

    if (!docsRes.error) {
      const grouped: Record<string, Array<string | null>> = {};

      for (const row of (docsRes.data ?? []) as ExpirationDefaultRow[]) {
        if (!grouped[row.type_document]) grouped[row.type_document] = [];
        grouped[row.type_document].push(row.date_expiration);
      }

      const defaults: Record<string, string> = {};

      for (const [type, dates] of Object.entries(grouped)) {
        const bestDate = mostFrequentValidDate(dates);
        if (bestDate) defaults[type] = bestDate;
      }

      setDefaultExpirationByType(defaults);
    }

    if (!vignetteRes.error) {
      const dates = (vignetteRes.data ?? []).map(
        (row: { pep_vignette_expiration?: string | null }) =>
          row.pep_vignette_expiration ?? null,
      );

      setDefaultVignetteExpiration(mostFrequentValidDate(dates));
    }
  }

  async function load() {
    if (!uniteId) return;
    setLoading(true);

    const [uniteRes, pepRes, btRes, docsRes] = await Promise.all([
      supabase.from("unites").select("*").eq("id", uniteId).maybeSingle(),
      supabase
        .from("pep_archives")
        .select("*")
        .eq("unite_id", uniteId)
        .order("created_at", { ascending: false }),
      supabase
        .from("bons_travail")
        .select("*")
        .eq("unite_id", uniteId)
        .order("created_at", { ascending: false }),
      supabase
        .from("vehicle_documents")
        .select("*")
        .eq("unite_id", uniteId)
        .order("created_at", { ascending: false }),
    ]);

    if (uniteRes.data) {
      const u = uniteRes.data as UniteRow;

      if (normalizeStatus(u.statut) === "inactif") {
        setUnite(null);
        setPeps([]);
        setBts([]);
        setDocuments([]);
        setLoading(false);
        return;
      }

      setUnite(u);
      setVignetteNo(u.pep_vignette_no || "");
      setVignetteExpiration(
        u.pep_vignette_expiration || defaultVignetteExpiration || "",
      );
    }

    if (pepRes.data) setPeps(pepRes.data as PepArchiveRow[]);
    if (btRes.data) setBts(btRes.data as BtRow[]);
    if (docsRes.data) setDocuments(docsRes.data as VehicleDocumentRow[]);

    setLoading(false);
  }

  const cvmDocuments = useMemo(
    () => documents.filter((d) => d.type_document === "cvm"),
    [documents]
  );

  const adminDocuments = useMemo(
    () => documents.filter((d) => d.type_document !== "cvm"),
    [documents]
  );

  const lastPep = peps[0] || null;

  const pepGapWarning = useMemo(() => {
    for (let index = 0; index < peps.length - 1; index += 1) {
      const newerPep = peps[index];
      const olderPep = peps[index + 1];
      const gapDays = getDaysBetweenDates(
        getPepDate(olderPep),
        getPepDate(newerPep),
      );

      if (gapDays != null && gapDays > 90) {
        return `Écart de ${gapDays} jours entre deux PEP`;
      }
    }

    return "";
  }, [peps]);
  const recentBts = bts.slice(0, 5);
  const recentDocs = documents.slice(0, 5);

  const assuranceDocs = useMemo(
    () => documents.filter((d) => d.type_document === "assurance"),
    [documents]
  );

  const immatriculationDocs = useMemo(
    () => documents.filter((d) => d.type_document === "immatriculation"),
    [documents]
  );

  const lastAssurance = assuranceDocs[0] || null;
  const lastImmatriculation = immatriculationDocs[0] || null;

  useEffect(() => {
    if (!requiresExpiration(docType)) {
      setDocExpiration("");
      return;
    }

    setDocExpiration(defaultExpirationByType[docType] ?? "");
  }, [docType, defaultExpirationByType]);

  useEffect(() => {
    if (
      !vignetteExpiration &&
      !unite?.pep_vignette_expiration &&
      defaultVignetteExpiration
    ) {
      setVignetteExpiration(defaultVignetteExpiration);
    }
  }, [
    vignetteExpiration,
    unite?.pep_vignette_expiration,
    defaultVignetteExpiration,
  ]);

  async function getSignedUrl(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      alert("Impossible d'ouvrir le document.");
      return null;
    }
    return data.signedUrl;
  }

  async function openVehicleDocument(doc: VehicleDocumentRow) {
    const url = await getSignedUrl(doc.storage_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function openPepArchive(pep: PepArchiveRow) {
  const linkedBt = findLinkedBtForPep(pep, bts);

  if (linkedBt?.id) {
    const folderPath = `bt/${linkedBt.id}/pep`;

    const { data: files, error: listError } = await supabase.storage
      .from("bt-documents")
      .list(folderPath);

    if (!listError && files && files.length > 0) {
      const pdfFile =
        files.find((f) => f.name.toLowerCase().endsWith(".pdf")) || files[0];

      const fullPath = `${folderPath}/${pdfFile.name}`;

      const { data: signed, error: signedError } = await supabase.storage
        .from("bt-documents")
        .createSignedUrl(fullPath, 60 * 10);

      if (!signedError && signed?.signedUrl) {
        window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
    }
  }

  if (!pep.html_complet) {
    alert("Aucun PEP disponible.");
    return;
  }

  const blob = new Blob([pep.html_complet], {
    type: "text/html;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

  async function saveVignette() {
    if (!uniteId) return;

    setSavingVignette(true);

    const { error } = await supabase
      .from("unites")
      .update({
        pep_vignette_no: vignetteNo.trim() || null,
        pep_vignette_expiration: vignetteExpiration || null,
      })
      .eq("id", uniteId);

    if (error) {
      setSavingVignette(false);
      alert(`Erreur sauvegarde vignette : ${error.message}`);
      return;
    }

    await load();
    setSavingVignette(false);
  }

  function handleDocumentDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      void uploadDocument(file);
    }
  }

  async function uploadDocument(file: File) {
    if (!uniteId) return;

    if (requiresExpiration(docType) && !docExpiration) {
      alert("Une date d'expiration est requise pour ce type de document.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);

    const safeName = file.name.replace(/[^\w.\-À-ÿ ]+/g, "_");
    const path = `${uniteId}/${Date.now()}-${safeName}`;

    const uploadRes = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

    if (uploadRes.error) {
      setUploading(false);
      alert(`Erreur upload : ${uploadRes.error.message}`);
      return;
    }

    const userRes = await supabase.auth.getUser();

    const insertRes = await supabase.from("vehicle_documents").insert({
      unite_id: uniteId,
      type_document: docType,
      nom_fichier: file.name,
      storage_path: path,
      mime_type: file.type || null,
      taille_bytes: file.size,
      note: docNote.trim() || null,
      date_expiration: docExpiration || null,
      uploaded_by: userRes.data.user?.id || null,
    });

    if (insertRes.error) {
      setUploading(false);
      alert(`Erreur sauvegarde document : ${insertRes.error.message}`);
      return;
    }

    setDocNote("");
    setDocExpiration("");
    if (fileRef.current) fileRef.current.value = "";
    await load();
    setUploading(false);
  }

  async function deleteDocument(doc: VehicleDocumentRow) {
    const ok = window.confirm(`Supprimer le document "${doc.nom_fichier}" ?`);
    if (!ok) return;

    const deleteStorageRes = await supabase.storage.from(BUCKET_NAME).remove([doc.storage_path]);

    if (deleteStorageRes.error) {
      alert(`Erreur suppression fichier : ${deleteStorageRes.error.message}`);
      return;
    }

    const deleteDbRes = await supabase.from("vehicle_documents").delete().eq("id", doc.id);

    if (deleteDbRes.error) {
      alert(`Erreur suppression document : ${deleteDbRes.error.message}`);
      return;
    }

    await load();
  }

  if (loading) {
    return <div style={styles.page}>Chargement…</div>;
  }

  if (!unite) {
    return (
      <div style={styles.page}>
        <button type="button" onClick={() => navigate("/admin/dossiers-vehicules")} style={styles.backBtn}>
          ← Retour
        </button>
        <div style={styles.card}>Unité introuvable.</div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "apercu", label: "Aperçu" },
    { key: "pep", label: "PEP / CVM" },
    { key: "bt", label: "Bons de travail" },
    { key: "rondes", label: "Rondes de sécurité" },
    { key: "documents", label: "Documents" },
  ];

  const lastCvm = cvmDocuments[0] || null;
  const cvmExpiredDays = daysExpired(lastCvm?.date_expiration);
  const cvmIsValid = Boolean(
    lastCvm?.date_expiration &&
    (!cvmExpiredDays || cvmExpiredDays === 0),
  );

  const applicablePep = cvmIsValid
    ? null
    : lastCvm?.date_expiration
      ? peps.find((pep) =>
          isPepAfterDate(pep, lastCvm.date_expiration),
        ) ??
        peps.find((pep) =>
          isPepValidOnDate(pep, lastCvm.date_expiration),
        ) ??
        null
      : peps[0] ?? null;

  const pepCurrentStatus: AlertBadge = cvmIsValid
    ? { label: "Non requis — CVM valide", style: styles.statusOk }
    : lastCvm?.date_expiration && !applicablePep
      ? {
          label: "Nouveau CVM ou PEP valide requis",
          style: styles.statusDanger,
        }
      : pepStatus(applicablePep);

  const vignetteExpiredDays = daysExpired(unite.pep_vignette_expiration);
  const vignetteDaysRemaining = daysUntilExpiration(
    unite.pep_vignette_expiration,
  );

  const pepVignetteStatus: AlertBadge = cvmIsValid
    ? { label: "Non requise — CVM valide", style: styles.statusOk }
    : !applicablePep
      ? {
          label: "En attente d’un PEP valide",
          style: styles.statusDanger,
        }
      : !unite.pep_vignette_expiration
        ? { label: "Vignette manquante", style: styles.statusDanger }
        : vignetteExpiredDays && vignetteExpiredDays > 30
          ? {
              label: `Expirée depuis ${vignetteExpiredDays} j`,
              style: styles.statusDanger,
            }
          : vignetteExpiredDays
            ? {
                label: `Expirée depuis ${vignetteExpiredDays} j`,
                style: styles.statusWarning,
              }
            : vignetteDaysRemaining != null && vignetteDaysRemaining <= 15
              ? {
                  label: `Expire dans ${vignetteDaysRemaining} j`,
                  style: styles.statusWarning,
                }
              : { label: "OK", style: styles.statusOk };

  const assuranceStatus = administrativeExpirationStatus(
    lastAssurance?.date_expiration,
    "Assurance manquante",
  );
  const immatStatus = administrativeExpirationStatus(
    lastImmatriculation?.date_expiration,
    "Immatriculation manquante",
  );

  const cvmStatus: AlertBadge = !lastCvm
    ? { label: "Aucun CVM", style: styles.statusNeutral }
    : cvmIsValid
      ? { label: "Valide", style: styles.statusOk }
      : applicablePep
        ? {
            label: "Expiré — PEP valide disponible",
            style: styles.statusWarning,
          }
        : {
            label: `Expiré depuis ${cvmExpiredDays ?? 0} j`,
            style: styles.statusDanger,
          };


  return (
    <div style={styles.page}>
      <button type="button" onClick={() => navigate("/admin/dossiers-vehicules")} style={styles.backBtn}>
        ← Retour aux dossiers véhicules
      </button>

      <div style={styles.headerCard}>
        <div>
          <h1 style={styles.title}>Dossier véhicule — {unitLabel(unite)}</h1>
          <p style={styles.subtitle}>
            Consultation officielle : PEP / CVM, BT, rondes Cybercat et documents administratifs.
          </p>
        </div>

        <div style={styles.headerGrid}>
          <Info label="Plaque" value={plateLabel(unite)} />
          <Info label="NIV" value={nivLabel(unite)} />
          <Info label="Véhicule" value={[unite.marque, unite.modele, unite.annee].filter(Boolean).join(" ") || "—"} />
          <Info label="KM actuel" value={kmLabel(unite.km_actuel ?? unite.odometre)} />
          <Info label="PEP" value={formatDate(applicablePep?.date_pep || applicablePep?.created_at)} badge={pepCurrentStatus} />
          <Info label="Vignette PEP" value={unite.pep_vignette_no || "—"} />
          <Info label="Expiration vignette PEP" value={formatDate(unite.pep_vignette_expiration)} badge={pepVignetteStatus} />
          <Info label="Assurance" value={formatDate(lastAssurance?.date_expiration)} badge={assuranceStatus} />
          <Info label="Immatriculation" value={formatDate(lastImmatriculation?.date_expiration)} badge={immatStatus} />
          <Info label="CVM" value={formatDate(lastCvm?.date_expiration)} badge={cvmStatus} />
        </div>
      </div>

      <div style={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            style={{
              ...styles.tab,
              ...(activeTab === t.key ? styles.tabActive : {}),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "apercu" && (
        <div style={styles.grid2}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Résumé</h2>
            <div style={styles.summaryRows}>
            <Summary label="Dernier PEP" value={formatDate(applicablePep?.date_pep || applicablePep?.created_at)} />
              <Summary label="Vignette PEP" value={unite.pep_vignette_no || "—"} />
              <Summary label="Expiration vignette PEP" value={formatDate(unite.pep_vignette_expiration)} />
              <Summary label="CVM importés" value={String(cvmDocuments.length)} />
              <Summary label="BT au dossier" value={String(bts.length)} />
              <Summary label="Documents administratifs" value={String(adminDocuments.length)} />
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Surveillance</h2>
            <div style={styles.summaryRows}>
              <SummaryWithBadge label="PEP" value={formatDate(applicablePep?.date_pep || applicablePep?.created_at)} badge={pepCurrentStatus} />
              {pepGapWarning ? (
                <SummaryWithBadge
                  label="Continuité PEP"
                  value={pepGapWarning}
                  badge={{
                    label: "À vérifier",
                    style: styles.statusWarning,
                  }}
                />
              ) : null}
              <SummaryWithBadge label="Assurance" value={formatDate(lastAssurance?.date_expiration)} badge={assuranceStatus} />
              <SummaryWithBadge label="Immatriculation" value={formatDate(lastImmatriculation?.date_expiration)} badge={immatStatus} />
              <SummaryWithBadge label="Vignette PEP" value={formatDate(unite.pep_vignette_expiration)} badge={pepVignetteStatus} />
              <SummaryWithBadge label="CVM" value={formatDate(lastCvm?.date_expiration)} badge={cvmStatus} />
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Documents récents</h2>
            {recentDocs.length === 0 ? (
              <div style={styles.empty}>Aucun document importé.</div>
            ) : (
              recentDocs.map((doc) => (
                <div key={doc.id} style={styles.miniRow}>
                  <div>
                    <strong>{documentTypeLabel(doc.type_document)}</strong>
                    <div style={styles.muted}>{doc.nom_fichier}</div>
                  </div>
                  <div style={styles.muted}>{formatDate(doc.created_at)}</div>
                </div>
              ))
            )}
          </div>

          <div style={styles.cardWide}>
            <h2 style={styles.cardTitle}>BT récents</h2>
            {recentBts.length === 0 ? (
              <div style={styles.empty}>Aucun BT pour cette unité.</div>
            ) : (
              <SimpleBtTable bts={recentBts} navigate={navigate} />
            )}
          </div>
        </div>
      )}

      {activeTab === "pep" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Vignette PEP installée</h2>

          <div style={styles.vignetteBox}>
            <div style={styles.fieldGroupWide}>
              <label style={styles.fieldLabel}>Numéro de vignette PEP</label>
              <input
                value={vignetteNo}
                onChange={(e) => setVignetteNo(e.target.value)}
                placeholder="Numéro de vignette"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Expiration vignette PEP</label>
              <input
                value={vignetteExpiration}
                onChange={(e) => setVignetteExpiration(e.target.value)}
                type="date"
                style={styles.input}
              />
            </div>

            <button
              type="button"
              onClick={saveVignette}
              style={styles.primaryBtn}
              disabled={savingVignette}
            >
              {savingVignette ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          </div>

          <div style={{ height: 22 }} />

          <h2 style={styles.cardTitle}>PEP générés par le système</h2>
          <DataTable>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>KM</Th>
                <Th>Mécano</Th>
                <Th>BT lié</Th>
                <Th>Document</Th>
              </tr>
            </thead>
            <tbody>
              {peps.map((pep) => {
                const linkedBt = findLinkedBtForPep(pep, bts);

                return (
                  <tr key={pep.id}>
                    <Td>{formatDate(pep.date_pep || pep.created_at)}</Td>
                    <Td>{kmLabel(pep.odometre)}</Td>
                    <Td>{pep.num_mecano || "—"}</Td>
                    <Td>
                      {linkedBt ? (
                        <button
                          style={styles.linkBtn}
                          onClick={() => navigate(`/bt/${linkedBt.id}`)}
                          type="button"
                        >
                          {linkedBt.numero || "Ouvrir BT"}
                        </button>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>Aucun BT lié</span>
                      )}
                    </Td>
                    <Td>
                      <button style={styles.linkBtn} onClick={() => openPepArchive(pep)} type="button">
                        Voir PEP
                      </button>
                    </Td>
                  </tr>
                );
              })}{peps.length === 0 && <EmptyRow colSpan={5} label="Aucun PEP archivé." />}
            </tbody>
          </DataTable>

          <div style={{ height: 22 }} />

          <h2 style={styles.cardTitle}>CVM importés manuellement</h2>
          <DocumentsTable
            documents={cvmDocuments}
            onOpen={openVehicleDocument}
            onDelete={deleteDocument}
          />
        </div>
      )}

      {activeTab === "bt" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Bons de travail</h2>
          <SimpleBtTable bts={bts} navigate={navigate} />
        </div>
      )}

      {activeTab === "rondes" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Rondes de sécurité</h2>
          <p style={styles.subtitle}>
            Les rondes sont consultées dans Cybercat / Penless. Cette section sert de raccourci.
          </p>

          <button
            type="button"
            style={styles.primaryBtn}
            onClick={() =>
              window.open("https://rondedesecurite.penless.app/home", "_blank", "noopener,noreferrer")
            }
          >
            Ouvrir Cybercat
          </button>
        </div>
      )}

      {activeTab === "documents" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Documents administratifs</h2>
          <p style={styles.subtitle}>
            Import manuel seulement : immatriculation, assurance, contrat, rappel constructeur, CVM ou autre.
            Les PEP et BT ne doivent pas être importés ici.
          </p>

          <div style={styles.uploadBox}>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Type de document</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} style={styles.select}>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Expiration document</label>
              <input
                value={docExpiration}
                onChange={(e) => setDocExpiration(e.target.value)}
                type="date"
                style={styles.input}
                title="Date d'expiration du document"
              />
            </div>

            <div style={styles.fieldGroupNote}>
              <label style={styles.fieldLabel}>Note interne</label>
              <input
                value={docNote}
                onChange={(e) => setDocNote(e.target.value)}
                placeholder="Note interne optionnelle"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroupFile}>
              <label style={styles.fieldLabel}>Document</label>

              <div
                style={{
                  ...styles.dropZone,
                  ...(dragActive ? styles.dropZoneActive : {}),
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                }}
                onDrop={handleDocumentDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    fileRef.current?.click();
                  }
                }}
              >
                <strong>
                  {dragActive
                    ? "Dépose le document ici"
                    : "Glisser-déposer un document"}
                </strong>
                <span style={styles.dropZoneHint}>
                  ou cliquer pour sélectionner un fichier
                </span>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadDocument(file);
                }}
              />
            </div>

            {uploading && <div style={styles.muted}>Téléversement en cours…</div>}
            {requiresExpiration(docType) && (
              <div style={styles.expirationHint}>
                Date d'expiration requise pour ce type de document.
              </div>
            )}
          </div>

          <DocumentsTable
            documents={documents}
            onOpen={openVehicleDocument}
            onDelete={deleteDocument}
          />
        </div>
      )}
    </div>
  );
}

function Info({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: { label: string; style: React.CSSProperties };
}) {
  return (
    <div style={styles.infoBox}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
      {badge && badge.label !== "—" && <span style={{ ...styles.statusBadge, ...badge.style }}>{badge.label}</span>}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryWithBadge({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge: { label: string; style: React.CSSProperties };
}) {
  return (
    <div style={styles.summaryRow}>
      <span>{label}</span>
      <span style={styles.summaryRight}>
        <strong>{value}</strong>
        {badge.label !== "—" && <span style={{ ...styles.statusBadge, ...badge.style }}>{badge.label}</span>}
      </span>
    </div>
  );
}

function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={styles.th}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={styles.td}>{children}</td>;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={styles.emptyTd}>
        {label}
      </td>
    </tr>
  );
}

function SimpleBtTable({
  bts,
  navigate,
}: {
  bts: BtRow[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Numéro</Th>
          <Th>Ouverture</Th>
          <Th>Fermeture</Th>
          <Th>KM</Th>
          <Th>Statut</Th>
          <Th>Total</Th>
        </tr>
      </thead>
      <tbody>
        {bts.map((bt) => (
          <tr key={bt.id} onDoubleClick={() => navigate(`/bt/${bt.id}`)} style={{ cursor: "default" }}>
            <Td>{bt.numero || "—"}</Td>
            <Td>{formatDate(bt.date_ouverture || bt.created_at)}</Td>
            <Td>{formatDate(bt.date_fermeture)}</Td>
            <Td>{kmLabel(bt.km)}</Td>
            <Td>{bt.statut || "—"}</Td>
            <Td>{moneyLabel(bt.total_final ?? bt.total)}</Td>
          </tr>
        ))}
        {bts.length === 0 && <EmptyRow colSpan={6} label="Aucun BT pour cette unité." />}
      </tbody>
    </DataTable>
  );
}

function DocumentsTable({
  documents,
  onOpen,
  onDelete,
}: {
  documents: VehicleDocumentRow[];
  onOpen: (doc: VehicleDocumentRow) => void;
  onDelete: (doc: VehicleDocumentRow) => void;
}) {
  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Type</Th>
          <Th>Fichier</Th>
          <Th>Expiration</Th>
          <Th>Statut</Th>
          <Th>Date ajout</Th>
          <Th>Taille</Th>
          <Th>Note</Th>
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {documents.map((doc) => {
          const status = optionalExpirationStatus(doc.date_expiration, 30);

          return (
            <tr key={doc.id}>
              <Td>{documentTypeLabel(doc.type_document)}</Td>
              <Td>{doc.nom_fichier}</Td>
              <Td>{formatDate(doc.date_expiration)}</Td>
              <Td>
                {status.label === "—" ? (
                  "—"
                ) : (
                  <span style={{ ...styles.statusBadge, ...status.style }}>{status.label}</span>
                )}
              </Td>
              <Td>{formatDate(doc.created_at)}</Td>
              <Td>{fileSizeLabel(doc.taille_bytes)}</Td>
              <Td>{doc.note || "—"}</Td>
              <Td>
                <button type="button" style={styles.linkBtn} onClick={() => onOpen(doc)}>
                  Ouvrir
                </button>
                <button type="button" style={styles.dangerBtn} onClick={() => onDelete(doc)}>
                  Supprimer
                </button>
              </Td>
            </tr>
          );
        })}
        {documents.length === 0 && <EmptyRow colSpan={8} label="Aucun document importé." />}
      </tbody>
    </DataTable>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    width: "100%",
    maxWidth: "none",
    margin: 0,
  },
  backBtn: {
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: 10,
    padding: "8px 12px",
    cursor: "pointer",
    marginBottom: 14,
  },
  headerCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    color: "#111827",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#6b7280",
    fontSize: 14,
  },
  headerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginTop: 16,
  },
  infoBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
  tabs: {
    display: "flex",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  tab: {
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: 999,
    padding: "8px 13px",
    cursor: "pointer",
    fontSize: 14,
    color: "#374151",
  },
  tabActive: {
    background: "#111827",
    borderColor: "#111827",
    color: "#fff",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  cardWide: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    gridColumn: "1 / -1",
  },
  cardTitle: {
    margin: "0 0 12px",
    fontSize: 18,
    color: "#111827",
  },
  summaryRows: {
    display: "grid",
    gap: 8,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: "1px solid #f1f5f9",
    padding: "8px 0",
    color: "#374151",
  },
  summaryRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  miniRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: "1px solid #f1f5f9",
    padding: "9px 0",
  },
  muted: {
    color: "#6b7280",
    fontSize: 13,
  },
  empty: {
    color: "#6b7280",
    padding: "8px 0",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.04,
    color: "#374151",
    background: "#f3f4f6",
    padding: "11px 12px",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 800,
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
    color: "#374151",
    verticalAlign: "top",
  },
  emptyTd: {
    padding: 24,
    textAlign: "center",
    color: "#6b7280",
  },
  primaryBtn: {
    border: "1px solid #111827",
    background: "#111827",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 18px",
    height: 38,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    cursor: "pointer",
    padding: "2px 6px 2px 0",
    fontWeight: 700,
  },
  dangerBtn: {
    border: "none",
    background: "transparent",
    color: "#dc2626",
    cursor: "pointer",
    padding: "2px 6px",
    fontWeight: 700,
  },
  vignetteBox: {
    display: "flex",
    alignItems: "flex-end",
    gap: 12,
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#f9fafb",
    flexWrap: "wrap",
    width: "fit-content",
    maxWidth: "100%",
  },
  uploadBox: {
    display: "flex",
    alignItems: "flex-end",
    gap: 12,
    margin: "16px 0",
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#f9fafb",
    flexWrap: "wrap",
  },
  fieldGroup: {
    display: "grid",
    gap: 4,
    minWidth: 220,
  },
  fieldGroupWide: {
    display: "grid",
    gap: 4,
    minWidth: 320,
  },
  fieldGroupNote: {
    display: "grid",
    gap: 4,
    minWidth: 320,
    flex: "1 1 320px",
  },
  fieldGroupFile: {
    display: "grid",
    gap: 4,
    minWidth: 260,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#6b7280",
  },
  select: {
    height: 38,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 10px",
    background: "#fff",
  },
  input: {
    height: 38,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 10px",
  },
  file: {
    fontSize: 13,
    height: 38,
    display: "flex",
    alignItems: "center",
  },
  dropZone: {
    minHeight: 96,
    border: "2px dashed #cbd5e1",
    borderRadius: 12,
    background: "#ffffff",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 4,
    padding: 14,
    cursor: "pointer",
    textAlign: "center",
    color: "#334155",
  },
  dropZoneActive: {
    borderColor: "#2563eb",
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  dropZoneHint: {
    fontSize: 12,
    color: "#64748b",
  },
  expirationHint: {
    width: "100%",
    color: "#92400e",
    fontSize: 13,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 800,
    marginTop: 6,
  },
  statusOk: {
    background: "#dcfce7",
    color: "#166534",
  },
  statusWarning: {
    background: "#fef3c7",
    color: "#92400e",
  },
  statusDanger: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  statusNeutral: {
    background: "#f3f4f6",
    color: "#374151",
  },
};