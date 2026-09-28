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
  date_mise_en_service?: string | null;
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

type ComplianceOverrideRow = {
  id: string;
  unite_id: string;
  gap_start: string;
  gap_end: string;
  gap_days: number;
  justification: string;
  created_at: string;
};

type PepImportDraft = {
  id: string;
  file: File;
  datePep: string;
  odometre: string;
  mecano: string;
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
  const clean = String(value).slice(0, 10);
  const d = new Date(`${clean}T12:00:00`);
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


function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfToday() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
}

type CoverageInterval = {
  start: Date;
  end: Date;
  source: "pep" | "cvm" | "grace";
};

function buildRegulatoryCoverage(
  peps: Array<{ date_pep?: string | null; date?: string | null; created_at?: string | null; date_prochain?: string | null }>,
  cvms: Array<{ date_expiration?: string | null }>,
  miseEnServiceValue?: string | null,
) {
  const intervals: CoverageInterval[] = [];

  const miseEnService = parseLocalDate(miseEnServiceValue);
  if (miseEnService) {
    intervals.push({
      start: miseEnService,
      end: addMonths(miseEnService, 3),
      source: "grace",
    });
  }

  for (const pep of peps) {
    const start = parseLocalDate(pep.date_pep || pep.date || pep.created_at);
    if (!start) continue;
    const explicitEnd = parseLocalDate(pep.date_prochain);
    const end = explicitEnd ?? addDays(start, 90);
    intervals.push({ start, end, source: "pep" });
  }

  for (const cvm of cvms) {
    const end = parseLocalDate(cvm.date_expiration);
    if (!end) continue;
    intervals.push({ start: addMonths(end, -6), end, source: "cvm" });
  }

  return intervals.sort((a, b) => a.start.getTime() - b.start.getTime());
}

type CoverageGap = {
  start: Date;
  end: Date;
  days: number;
};

function getCoverageGaps(
  peps: Array<{ date_pep?: string | null; date?: string | null; created_at?: string | null; date_prochain?: string | null }>,
  cvms: Array<{ date_expiration?: string | null }>,
  miseEnServiceValue?: string | null,
) {
  const today = startOfToday();
  const twentyFourMonthsAgo = addMonths(today, -24);
  const miseEnService = parseLocalDate(miseEnServiceValue);
  const requiredStart =
    miseEnService && miseEnService.getTime() > twentyFourMonthsAgo.getTime()
      ? miseEnService
      : twentyFourMonthsAgo;

  const intervals = buildRegulatoryCoverage(
    peps,
    cvms,
    miseEnServiceValue,
  ).filter(
    (interval) =>
      interval.end.getTime() >= requiredStart.getTime() &&
      interval.start.getTime() <= today.getTime(),
  );

  const gaps: CoverageGap[] = [];
  let coveredUntil = new Date(requiredStart);

  for (const interval of intervals) {
    if (interval.end.getTime() < coveredUntil.getTime()) continue;

    if (interval.start.getTime() > coveredUntil.getTime()) {
      gaps.push({
        start: new Date(coveredUntil),
        end: new Date(interval.start),
        days: Math.ceil(
          (interval.start.getTime() - coveredUntil.getTime()) / 86400000,
        ),
      });
    }

    if (interval.end.getTime() > coveredUntil.getTime()) {
      coveredUntil = new Date(interval.end);
    }

    if (coveredUntil.getTime() >= today.getTime()) break;
  }

  // Important :
  // La période entre la dernière couverture PEP/CVM et aujourd'hui n'est
  // PAS un trou historique. Si le dernier PEP est dépassé, il s'agit d'un
  // retard courant, déjà géré séparément par pepStatus().
  return gaps;
}

type PepGapContext = {
  previousPep: PepArchiveRow | null;
  nextPep: PepArchiveRow | null;
  daysBetweenPeps: number | null;
  daysOver90: number | null;
};

function getPepGapContext(
  peps: PepArchiveRow[],
  gap?: CoverageGap | null,
): PepGapContext {
  if (!gap) {
    return {
      previousPep: null,
      nextPep: null,
      daysBetweenPeps: null,
      daysOver90: null,
    };
  }

  const sorted = [...peps]
    .filter((pep) => getPepDate(pep))
    .sort(
      (a, b) =>
        (getPepDate(a)?.getTime() ?? 0) -
        (getPepDate(b)?.getTime() ?? 0),
    );

  const previousPep =
    [...sorted]
      .reverse()
      .find(
        (pep) =>
          (getPepDate(pep)?.getTime() ?? Number.POSITIVE_INFINITY) <
          gap.end.getTime(),
      ) ?? null;

  const nextPep =
    sorted.find(
      (pep) =>
        (getPepDate(pep)?.getTime() ?? Number.NEGATIVE_INFINITY) >=
        gap.end.getTime(),
    ) ?? null;

  const previousDate = getPepDate(previousPep);
  const nextDate = getPepDate(nextPep);

  if (!previousDate || !nextDate || previousPep?.id === nextPep?.id) {
    return {
      previousPep,
      nextPep,
      daysBetweenPeps: null,
      daysOver90: null,
    };
  }

  const daysBetweenPeps = Math.floor(
    (nextDate.getTime() - previousDate.getTime()) / 86400000,
  );

  return {
    previousPep,
    nextPep,
    daysBetweenPeps,
    daysOver90: Math.max(0, daysBetweenPeps - 90),
  };
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

const AUTO_ACCEPT_PEP_GAP_DAYS = 15;
const PEP_RETENTION_MONTHS = 33;

function pepRetentionCutoff() {
  return addMonths(startOfToday(), -PEP_RETENTION_MONTHS);
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
  const pepImportFileRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("apercu");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [savingVignette, setSavingVignette] = useState(false);
  const [pepImportOpen, setPepImportOpen] = useState(false);
  const [pepImporting, setPepImporting] = useState(false);
  const [pepImportDrafts, setPepImportDrafts] = useState<PepImportDraft[]>([]);
  const [complianceOverrides, setComplianceOverrides] = useState<ComplianceOverrideRow[]>([]);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideHistoryOpen, setOverrideHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<"24" | "36" | "all">("24");
  const [exportSections, setExportSections] = useState({
    vehicle: true,
    pep: true,
    bt: true,
    documents: true,
    overrides: true,
  });

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

    const [uniteRes, pepRes, btRes, docsRes, overridesRes] = await Promise.all([
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
      supabase
        .from("vehicle_compliance_overrides")
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

    if (pepRes.data) {
      setPeps(
        [...(pepRes.data as PepArchiveRow[])].sort(
          (a, b) => (getPepDate(b)?.getTime() ?? 0) - (getPepDate(a)?.getTime() ?? 0),
        ),
      );
    }
    if (btRes.data) setBts(btRes.data as BtRow[]);
    if (docsRes.data) setDocuments(docsRes.data as VehicleDocumentRow[]);
    if (overridesRes.data) setComplianceOverrides(overridesRes.data as ComplianceOverrideRow[]);

    // 33 mois = 24 mois requis + 6 mois de couverture CVM + 3 mois tampon PEP.
    // Important : la purge se base sur date_pep et jamais sur created_at.
    const cutoff = pepRetentionCutoff().toISOString().slice(0, 10);
    const oldPepIds = ((pepRes.data ?? []) as PepArchiveRow[])
      .filter((pep) => pep.date_pep && String(pep.date_pep).slice(0, 10) < cutoff)
      .map((pep) => pep.id);

    if (oldPepIds.length > 0) {
      const { error: purgeError } = await supabase
        .from("pep_archives")
        .delete()
        .in("id", oldPepIds);

      if (!purgeError) {
        setPeps((current) => current.filter((pep) => !oldPepIds.includes(pep.id)));
      } else {
        console.error("Erreur purge anciens PEP :", purgeError);
      }
    }

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


  const coverageGaps = useMemo(
    () => getCoverageGaps(peps, cvmDocuments, unite?.date_mise_en_service),
    [peps, cvmDocuments, unite?.date_mise_en_service],
  );

  const unresolvedCoverageGaps = useMemo(
    () =>
      coverageGaps.filter((gap) => {
        // Un écart historique de moins de 15 jours est automatiquement accepté.
        // À partir de 15 jours, une justification manuelle est requise.
        if (gap.days < AUTO_ACCEPT_PEP_GAP_DAYS) return false;

        const gapStart = gap.start.toISOString().slice(0, 10);
        const gapEnd = gap.end.toISOString().slice(0, 10);

        return !complianceOverrides.some(
          (row) =>
            row.gap_start === gapStart &&
            row.gap_end === gapEnd,
        );
      }),
    [coverageGaps, complianceOverrides],
  );

  const coverageGap = unresolvedCoverageGaps[0] ?? null;

  const totalUnresolvedGapDays = useMemo(
    () =>
      unresolvedCoverageGaps.reduce(
        (total, gap) => total + gap.days,
        0,
      ),
    [unresolvedCoverageGaps],
  );

  const selectedGapPepContext = useMemo(
    () => getPepGapContext(peps, coverageGap),
    [peps, coverageGap],
  );

  async function acceptCoverageGap() {
    if (!uniteId || !coverageGap || !overrideJustification.trim()) return;
    setSavingOverride(true);
    const userRes = await supabase.auth.getUser();
    const { error } = await supabase.from("vehicle_compliance_overrides").insert({
      unite_id: uniteId,
      gap_start: coverageGap.start.toISOString().slice(0, 10),
      gap_end: coverageGap.end.toISOString().slice(0, 10),
      gap_days: coverageGap.days,
      justification: overrideJustification.trim(),
      created_by: userRes.data.user?.id || null,
    });
    setSavingOverride(false);
    if (error) {
      alert(`Erreur dérogation : ${error.message}`);
      return;
    }
    setOverrideJustification("");
    setOverrideOpen(false);
    await load();
  }

  const firstPepGraceEnd = useMemo(() => {
    const miseEnService = parseLocalDate(unite?.date_mise_en_service);
    return miseEnService ? addMonths(miseEnService, 3) : null;
  }, [unite?.date_mise_en_service]);

  const firstPepGraceActive = Boolean(
    firstPepGraceEnd &&
      startOfToday().getTime() <= firstPepGraceEnd.getTime() &&
      peps.length === 0,
  );
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
  const importedPath = importedPepStoragePath(pep);

  if (importedPath) {
    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(importedPath, 60 * 10);

    if (!signedError && signed?.signedUrl) {
      window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
      return;
    }
  }

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


  function isImportedPep(pep: PepArchiveRow) {
    const payload =
      pep.payload_json && typeof pep.payload_json === "object"
        ? (pep.payload_json as Record<string, unknown>)
        : null;
    return payload?.source === "imported";
  }

  function importedPepStoragePath(pep: PepArchiveRow) {
    const payload =
      pep.payload_json && typeof pep.payload_json === "object"
        ? (pep.payload_json as Record<string, unknown>)
        : null;
    return typeof payload?.storage_path === "string"
      ? payload.storage_path
      : null;
  }

 

  function closePepImportModal() {
    if (pepImporting) return;
    setPepImportOpen(false);
    setPepImportDrafts([]);
    if (pepImportFileRef.current) pepImportFileRef.current.value = "";
  }

  function extractPepDateFromFileName(fileName: string) {
    const nameWithoutExtension = fileName.replace(/\.pdf$/i, "");

    // La date est toujours à la fin du nom : YYYY_MM_DD
    // Ex. 2411_2025_03_14.pdf -> 2025-03-14
    const match = nameWithoutExtension.match(
      /(?:^|_)(\d{4})_(\d{2})_(\d{2})$/,
    );

    if (!match) return "";

    const [, year, month, day] = match;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      12,
      0,
      0,
      0,
    );

    // Validation pour éviter une date impossible.
    if (
      parsed.getFullYear() !== Number(year) ||
      parsed.getMonth() !== Number(month) - 1 ||
      parsed.getDate() !== Number(day)
    ) {
      return "";
    }

    return `${year}-${month}-${day}`;
  }

  function addPepImportFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf"),
    );

    if (pdfs.length === 0) {
      alert("Sélectionne au moins un fichier PDF.");
      return;
    }

    setPepImportDrafts((current) => [
      ...current,
      ...pdfs.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        datePep: extractPepDateFromFileName(file.name),
        odometre: "",
        mecano: "",
      })),
    ]);
  }

  function updatePepImportDraft(
    id: string,
    patch: Partial<Omit<PepImportDraft, "id" | "file">>,
  ) {
    setPepImportDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function removePepImportDraft(id: string) {
    setPepImportDrafts((current) =>
      current.filter((draft) => draft.id !== id),
    );
  }

  async function importPepDrafts() {
    if (!uniteId || pepImportDrafts.length === 0) return;

    const invalid = pepImportDrafts.find((draft) => !draft.datePep);
    if (invalid) {
      alert(`La date du PEP est requise pour "${invalid.file.name}".`);
      return;
    }

    setPepImporting(true);

    try {
      for (const draft of pepImportDrafts) {
        const safeName = draft.file.name.replace(/[^\w.\-À-ÿ ]+/g, "_");
        const storagePath = `${uniteId}/pep-imports/${Date.now()}-${safeName}`;

        const uploadRes = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, draft.file, {
            cacheControl: "3600",
            upsert: false,
            contentType: draft.file.type || "application/pdf",
          });

        if (uploadRes.error) {
          throw new Error(
            `Téléversement ${draft.file.name} : ${uploadRes.error.message}`,
          );
        }

        const pepDate = parseLocalDate(draft.datePep);
        const dueDate = pepDate ? addDays(pepDate, 90) : null;
        const dateProchain = dueDate
          ? dueDate.toISOString().slice(0, 10)
          : null;

        const insertRes = await supabase.from("pep_archives").insert({
          unite_id: uniteId,
          unite: unitLabel(unite),
          date_pep: draft.datePep,
          date_prochain: dateProchain,
          odometre: draft.odometre.trim()
            ? Number(draft.odometre.replace(",", "."))
            : null,
          num_mecano: draft.mecano.trim() || null,
          archive_key: `import-${Date.now()}-${safeName}`,
          html_complet: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>PEP importé</title></head><body><h1>PEP importé</h1><p>Document PDF importé dans le dossier véhicule.</p><p>Fichier : ${safeName}</p><p>Date du PEP : ${draft.datePep}</p></body></html>`,
          payload_json: {
            source: "imported",
            storage_bucket: BUCKET_NAME,
            storage_path: storagePath,
            file_name: draft.file.name,
          },
        });

        if (insertRes.error) {
          await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
          throw new Error(
            `Sauvegarde ${draft.file.name} : ${insertRes.error.message}`,
          );
        }
      }

      await load();
      setPepImportDrafts([]);
      setPepImportOpen(false);
      if (pepImportFileRef.current) pepImportFileRef.current.value = "";
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      alert(`Erreur import PEP : ${message}`);
    } finally {
      setPepImporting(false);
    }
  }

  async function deletePepArchive(pep: PepArchiveRow) {
    const pepDate = formatDate(pep.date_pep || pep.created_at);
    const ok = window.confirm(
      `Supprimer le PEP du ${pepDate} ?\n\nCette action est définitive.`,
    );
    if (!ok) return;

    const importedPath = importedPepStoragePath(pep);

    const { error: deleteDbError } = await supabase
      .from("pep_archives")
      .delete()
      .eq("id", pep.id);

    if (deleteDbError) {
      alert(`Erreur suppression PEP : ${deleteDbError.message}`);
      return;
    }

    if (importedPath) {
      const { error: deleteStorageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([importedPath]);

      if (deleteStorageError) {
        console.error(
          "PEP supprimé de l'historique, mais erreur suppression du PDF :",
          deleteStorageError,
        );
      }
    }

    await load();
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

  const serviceDateForPep = parseLocalDate(unite.date_mise_en_service);
  const initialPepGraceEnd = serviceDateForPep
    ? addMonths(serviceDateForPep, 3)
    : null;
  const initialPepGraceIsActive = Boolean(
    initialPepGraceEnd &&
      startOfToday().getTime() <= initialPepGraceEnd.getTime() &&
      peps.length === 0,
  );

  const pepCurrentStatus: AlertBadge = cvmIsValid
    ? { label: "Non requis — CVM valide", style: styles.statusOk }
    : initialPepGraceIsActive
      ? {
          label: `Grâce premier PEP jusqu’au ${initialPepGraceEnd!.toLocaleDateString("fr-CA")}`,
          style: styles.statusOk,
        }
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
    : initialPepGraceIsActive
      ? { label: "Non requise — grâce premier PEP", style: styles.statusOk }
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

  function exportCutoffDate() {
    if (exportPeriod === "all") return null;
    return addMonths(startOfToday(), -Number(exportPeriod));
  }

  function isInExportPeriod(value?: string | null) {
    const cutoff = exportCutoffDate();
    if (!cutoff) return true;
    const date = parseLocalDate(value);
    return Boolean(date && date.getTime() >= cutoff.getTime());
  }

  function toggleExportSection(key: keyof typeof exportSections) {
    setExportSections((current) => ({ ...current, [key]: !current[key] }));
  }

  async function generateVehicleDossierPdf() {
    if (!unite) return;
    if (!Object.values(exportSections).some(Boolean)) {
      alert("Sélectionne au moins une section à imprimer.");
      return;
    }

    setExporting(true);

    try {
      const [{ jsPDF }, { PDFDocument }] = await Promise.all([
        import("jspdf"),
        import("pdf-lib"),
      ]);

      const selectedPeps = peps.filter((pep) =>
        isInExportPeriod(pep.date_pep || pep.created_at),
      );
      const selectedBts = bts.filter((bt) =>
        isInExportPeriod(bt.date_fermeture || bt.date_ouverture || bt.created_at),
      );
      const selectedOverrides = complianceOverrides.filter((row) =>
        isInExportPeriod(row.created_at || row.gap_end),
      );

      const appendixWarnings: string[] = [];

      type AppendixItem = {
        label: string;
        category: "pep" | "cvm" | "document" | "bt";
        blob: Blob;
      };

      const appendixItems: AppendixItem[] = [];

      const downloadStorageBlob = async (
        bucket: string,
        path: string,
        label: string,
      ) => {
        const cleanPath = String(path || "").trim();
        if (!cleanPath) {
          appendixWarnings.push(`${label} : chemin de fichier manquant.`);
          return null;
        }

        const { data, error } = await supabase.storage
          .from(bucket)
          .download(cleanPath);

        if (error || !data) {
          appendixWarnings.push(
            `${label} : impossible de télécharger le fichier${
              error?.message ? ` (${error.message})` : ""
            }.`,
          );
          return null;
        }

        return data;
      };

      const renderPepHtmlToPdfBlob = async (html: string) => {
        const { default: html2canvas } = await import("html2canvas");

        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.left = "-10000px";
        iframe.style.top = "0";
        iframe.style.width = "816px";
        iframe.style.height = "1056px";
        iframe.style.border = "0";
        iframe.style.opacity = "0";
        iframe.setAttribute("aria-hidden", "true");
        document.body.appendChild(iframe);

        try {
          const doc = iframe.contentDocument;
          if (!doc) throw new Error("Impossible de préparer le PEP.");

          doc.open();
          doc.write(html);
          doc.close();

          await new Promise<void>((resolve) => {
            iframe.onload = () => resolve();
            window.setTimeout(resolve, 600);
          });

          const fonts = (doc as any).fonts;
          if (fonts?.ready) {
            await Promise.race([
              fonts.ready,
              new Promise((resolve) => window.setTimeout(resolve, 1500)),
            ]);
          }

          await new Promise((resolve) => window.setTimeout(resolve, 200));

          const pages = Array.from(
            doc.querySelectorAll(".page"),
          ) as HTMLElement[];

          const sourcePages =
            pages.length > 0
              ? pages
              : ([doc.body] as unknown as HTMLElement[]);

          const pepPdf = new jsPDF({
            orientation: "portrait",
            unit: "pt",
            format: "letter",
            compress: true,
          });

          for (let index = 0; index < sourcePages.length; index += 1) {
            const page = sourcePages[index];
            const canvas = await html2canvas(page, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: "#ffffff",
              logging: false,
              width: Math.max(816, page.scrollWidth || 816),
              height: Math.max(1056, page.scrollHeight || 1056),
              windowWidth: Math.max(816, page.scrollWidth || 816),
              windowHeight: Math.max(1056, page.scrollHeight || 1056),
            });

            if (index > 0) pepPdf.addPage("letter", "portrait");

            const imgData = canvas.toDataURL("image/jpeg", 0.95);
            const pageWidth = 612;
            const pageHeight = 792;
            const margin = 18;
            const maxWidth = pageWidth - margin * 2;
            const maxHeight = pageHeight - margin * 2;
            const ratio = Math.min(
              maxWidth / canvas.width,
              maxHeight / canvas.height,
            );
            const width = canvas.width * ratio;
            const height = canvas.height * ratio;

            pepPdf.addImage(
              imgData,
              "JPEG",
              (pageWidth - width) / 2,
              (pageHeight - height) / 2,
              width,
              height,
            );
          }

          return pepPdf.output("blob");
        } finally {
          iframe.remove();
        }
      };

      if (exportSections.pep) {
        for (const pep of selectedPeps) {
          const pepLabel = `PEP ${formatDate(pep.date_pep || pep.created_at)}`;
          const importedPath = importedPepStoragePath(pep);

          if (importedPath) {
            const blob = await downloadStorageBlob(
              BUCKET_NAME,
              importedPath,
              pepLabel,
            );
            if (blob) {
              appendixItems.push({
                label: pepLabel,
                category: "pep",
                blob,
              });
              continue;
            }
          }

          const linkedBt = findLinkedBtForPep(pep, bts);
          if (linkedBt?.id) {
            const folderPath = `bt/${linkedBt.id}/pep`;
            const { data: files, error: listError } = await supabase.storage
              .from("bt-documents")
              .list(folderPath);

            if (!listError && files && files.length > 0) {
              const pdfFile =
                files.find((file) =>
                  file.name.toLowerCase().endsWith(".pdf"),
                ) || files[0];

              const blob = await downloadStorageBlob(
                "bt-documents",
                `${folderPath}/${pdfFile.name}`,
                pepLabel,
              );

              if (blob) {
                appendixItems.push({
                  label: pepLabel,
                  category: "pep",
                  blob,
                });
                continue;
              }
            }
          }

          if (pep.html_complet) {
            try {
              const blob = await renderPepHtmlToPdfBlob(pep.html_complet);
              appendixItems.push({
                label: pepLabel,
                category: "pep",
                blob,
              });
            } catch (error) {
              appendixWarnings.push(
                `${pepLabel} : impossible de générer le PDF depuis l'archive HTML.`,
              );
              console.error("Erreur génération PEP HTML :", error);
            }
          } else {
            appendixWarnings.push(`${pepLabel} : aucun document disponible.`);
          }
        }

        for (const doc of cvmDocuments) {
          const blob = await downloadStorageBlob(
            BUCKET_NAME,
            doc.storage_path,
            `CVM ${doc.nom_fichier}`,
          );
          if (blob) {
            appendixItems.push({
              label: `CVM — ${doc.nom_fichier}`,
              category: "cvm",
              blob,
            });
          }
        }
      }

      if (exportSections.documents) {
        for (const doc of adminDocuments) {
          const blob = await downloadStorageBlob(
            BUCKET_NAME,
            doc.storage_path,
            `${documentTypeLabel(doc.type_document)} ${doc.nom_fichier}`,
          );
          if (blob) {
            appendixItems.push({
              label: `${documentTypeLabel(doc.type_document)} — ${doc.nom_fichier}`,
              category: "document",
              blob,
            });
          }
        }
      }

      if (exportSections.bt && selectedBts.length > 0) {
        const selectedBtIds = selectedBts.map((bt) => bt.id);
        const { data: btDocsData, error: btDocsError } = await supabase
          .from("bt_documents")
          .select("*")
          .in("bt_id", selectedBtIds);

        if (btDocsError) {
          appendixWarnings.push(
            `Pièces jointes BT : impossible de charger la liste (${btDocsError.message}).`,
          );
        } else {
          const btDocs = (btDocsData ?? []) as Array<{
            id?: string;
            bt_id?: string | null;
            type?: string | null;
            nom_fichier?: string | null;
            storage_path?: string | null;
            mime_type?: string | null;
          }>;

          for (const doc of btDocs) {
            if (!doc.storage_path) continue;
            if (String(doc.type || "").toLowerCase() === "pep") continue;

            const bt = selectedBts.find((row) => row.id === doc.bt_id);
            const label = `${bt?.numero || "BT"} — ${
              doc.nom_fichier || "Pièce jointe"
            }`;

            const blob = await downloadStorageBlob(
              "bt-documents",
              doc.storage_path,
              label,
            );

            if (blob) {
              appendixItems.push({
                label,
                category: "bt",
                blob,
              });
            }
          }
        }
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "letter",
        compress: true,
      });

      const pageWidth = 612;
      const marginX = 42;
      const topY = 46;
      const bottomY = 748;
      const contentWidth = pageWidth - marginX * 2;
      let y = topY;

      const addPage = () => {
        pdf.addPage("letter", "portrait");
        y = topY;
      };

      const ensureSpace = (height: number) => {
        if (y + height > bottomY) addPage();
      };

      const addSectionTitle = (title: string) => {
        ensureSpace(34);
        y += 8;
        pdf.setFillColor(243, 244, 246);
        pdf.roundedRect(marginX, y, contentWidth, 24, 5, 5, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(17, 24, 39);
        pdf.text(title, marginX + 10, y + 16);
        y += 34;
      };

      const addParagraph = (
        value: string,
        options?: { bold?: boolean; size?: number },
      ) => {
        pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
        pdf.setFontSize(options?.size ?? 9);
        pdf.setTextColor(55, 65, 81);
        const lines = pdf.splitTextToSize(value || "—", contentWidth);
        const height = Math.max(14, lines.length * 12);
        ensureSpace(height);
        pdf.text(lines, marginX, y);
        y += height;
      };

      const addKeyValue = (label: string, value: string) => {
        ensureSpace(18);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(75, 85, 99);
        pdf.text(label, marginX, y);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(17, 24, 39);
        const wrapped = pdf.splitTextToSize(
          value || "—",
          contentWidth - 150,
        );
        pdf.text(wrapped, marginX + 150, y);
        y += Math.max(16, wrapped.length * 11);
      };

      const addSimpleTable = (
        headers: string[],
        rows: string[][],
        widths: number[],
      ) => {
        const rowPad = 5;
        const headerHeight = 22;

        const drawHeader = () => {
          ensureSpace(headerHeight + 4);
          let x = marginX;
          pdf.setFillColor(249, 250, 251);
          pdf.rect(marginX, y, contentWidth, headerHeight, "F");
          pdf.setDrawColor(229, 231, 235);
          pdf.rect(marginX, y, contentWidth, headerHeight);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.setTextColor(55, 65, 81);
          headers.forEach((header, index) => {
            pdf.text(header, x + rowPad, y + 14);
            x += widths[index];
          });
          y += headerHeight;
        };

        drawHeader();

        if (rows.length === 0) {
          ensureSpace(24);
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(8);
          pdf.setTextColor(107, 114, 128);
          pdf.text("Aucune donnée.", marginX + rowPad, y + 15);
          y += 24;
          return;
        }

        for (const row of rows) {
          const wrapped = row.map((value, index) =>
            pdf.splitTextToSize(
              value || "—",
              Math.max(20, widths[index] - rowPad * 2),
            ),
          );
          const maxLines = Math.max(
            ...wrapped.map((cell) => cell.length),
          );
          const rowHeight = Math.max(
            22,
            maxLines * 10 + rowPad * 2,
          );

          if (y + rowHeight > bottomY) {
            addPage();
            drawHeader();
          }

          let x = marginX;
          pdf.setDrawColor(229, 231, 235);
          pdf.rect(marginX, y, contentWidth, rowHeight);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(31, 41, 55);

          wrapped.forEach((cell, index) => {
            pdf.text(cell, x + rowPad, y + 13);
            x += widths[index];
          });

          y += rowHeight;
        }

        y += 6;
      };

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.setTextColor(17, 24, 39);
      pdf.text("DOSSIER DE CONTRÔLE — VÉHICULE", marginX, y);
      y += 28;

      pdf.setFontSize(16);
      pdf.text(`Unité ${unitLabel(unite)}`, marginX, y);
      y += 18;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(107, 114, 128);
      pdf.text(
        `Document généré le ${new Date().toLocaleDateString("fr-CA")} — Groupe Breton`,
        marginX,
        y,
      );
      y += 24;

      if (exportSections.vehicle) {
        addSectionTitle("1. Identification et état du dossier");
        addKeyValue("Unité", unitLabel(unite));
        addKeyValue("Plaque", plateLabel(unite));
        addKeyValue("NIV", nivLabel(unite));
        addKeyValue(
          "Véhicule",
          [unite.marque, unite.modele, unite.annee]
            .filter(Boolean)
            .join(" ") || "—",
        );
        addKeyValue(
          "KM actuel",
          `${kmLabel(unite.km_actuel ?? unite.odometre)} km`,
        );
        addKeyValue(
          "Mise en service",
          formatDate(unite.date_mise_en_service),
        );
        addKeyValue(
          "PEP actuel",
          `${formatDate(
            applicablePep?.date_pep || applicablePep?.created_at,
          )} — ${pepCurrentStatus.label}`,
        );
        addKeyValue(
          "Vignette PEP",
          `${unite.pep_vignette_no || "—"} — ${pepVignetteStatus.label}`,
        );
        addKeyValue(
          "Assurance",
          `${formatDate(lastAssurance?.date_expiration)} — ${
            assuranceStatus.label
          }`,
        );
        addKeyValue(
          "Immatriculation",
          `${formatDate(lastImmatriculation?.date_expiration)} — ${
            immatStatus.label
          }`,
        );
        addKeyValue(
          "CVM",
          `${formatDate(lastCvm?.date_expiration)} — ${cvmStatus.label}`,
        );
        addKeyValue(
          "Historique PEP/CVM",
          unresolvedCoverageGaps.length > 0
            ? `${unresolvedCoverageGaps.length} période(s) non couverte(s) — ${totalUnresolvedGapDays} jours au total`
            : "Couverture conforme selon les données au dossier",
        );
      }

      if (exportSections.pep) {
        addSectionTitle("2. Historique PEP / CVM");
        const pepRows = selectedPeps.map((pep) => {
          const linkedBt = findLinkedBtForPep(pep, bts);
          return [
            formatDate(pep.date_pep || pep.created_at),
            kmLabel(pep.odometre),
            pep.num_mecano || "—",
            isImportedPep(pep) ? "Importé" : "Atelier",
            linkedBt?.numero || "—",
          ];
        });

        addSimpleTable(
          ["Date", "KM", "Mécano", "Provenance", "BT lié"],
          pepRows,
          [88, 88, 110, 110, 132],
        );

        const cvmRows = cvmDocuments.map((doc) => [
          formatDate(doc.created_at),
          formatDate(doc.date_expiration),
          doc.nom_fichier,
        ]);
        addParagraph("CVM au dossier", { bold: true, size: 10 });
        addSimpleTable(
          ["Ajouté", "Expiration", "Fichier"],
          cvmRows,
          [100, 110, 318],
        );
      }

      if (exportSections.bt) {
        addSectionTitle("3. Bons de travail");
        const btRows = selectedBts.map((bt) => [
          bt.numero || "—",
          formatDate(bt.date_ouverture || bt.created_at),
          formatDate(bt.date_fermeture),
          kmLabel(bt.km),
          bt.statut || "—",
          moneyLabel(bt.total_final ?? bt.total),
        ]);
        addSimpleTable(
          ["BT", "Ouverture", "Fermeture", "KM", "Statut", "Total"],
          btRows,
          [70, 82, 82, 76, 105, 113],
        );
      }

      if (exportSections.documents) {
        addSectionTitle("4. Documents administratifs");
        const documentRows = adminDocuments.map((doc) => [
          documentTypeLabel(doc.type_document),
          doc.nom_fichier,
          formatDate(doc.date_expiration),
          formatDate(doc.created_at),
        ]);
        addSimpleTable(
          ["Type", "Fichier", "Expiration", "Ajouté"],
          documentRows,
          [115, 223, 95, 95],
        );
      }

      if (exportSections.overrides) {
        addSectionTitle("5. Écarts PEP acceptés / dérogations");
        const overrideRows = selectedOverrides.map((row) => [
          `${formatDate(row.gap_start)} au ${formatDate(row.gap_end)}`,
          `${row.gap_days} j`,
          row.justification || "—",
          formatDate(row.created_at),
        ]);
        addSimpleTable(
          ["Période", "Écart", "Justification", "Accepté le"],
          overrideRows,
          [125, 55, 253, 95],
        );
      }

      if (
        exportSections.pep ||
        exportSections.documents ||
        exportSections.bt
      ) {
        addSectionTitle("Pièces justificatives annexées");
        const counts = {
          pep: appendixItems.filter((item) => item.category === "pep").length,
          cvm: appendixItems.filter((item) => item.category === "cvm").length,
          document: appendixItems.filter(
            (item) => item.category === "document",
          ).length,
          bt: appendixItems.filter((item) => item.category === "bt").length,
        };

        addParagraph(
          `Documents ajoutés à la suite du sommaire : ${counts.pep} PEP, ${counts.cvm} CVM, ${counts.document} document(s) administratif(s) et ${counts.bt} pièce(s) jointe(s) de BT.`,
        );

        if (appendixWarnings.length > 0) {
          addParagraph(
            `${appendixWarnings.length} document(s) n'ont pas pu être annexé(s). Le sommaire demeure généré; vérifier les fichiers manquants avant de remettre le dossier.`,
            { bold: true },
          );
        }
      }

      const summaryPageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= summaryPageCount; page += 1) {
        pdf.setPage(page);
        pdf.setDrawColor(229, 231, 235);
        pdf.line(marginX, 762, pageWidth - marginX, 762);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text(
          `Dossier véhicule — ${unitLabel(unite)}`,
          marginX,
          778,
        );
        pdf.text(
          `Sommaire ${page} / ${summaryPageCount}`,
          pageWidth - marginX,
          778,
          { align: "right" },
        );
      }

      const mergedPdf = await PDFDocument.create();
      const summaryPdf = await PDFDocument.load(
        pdf.output("arraybuffer"),
      );
      const summaryPages = await mergedPdf.copyPages(
        summaryPdf,
        summaryPdf.getPageIndices(),
      );
      summaryPages.forEach((page) => mergedPdf.addPage(page));

      const appendPdfBlob = async (blob: Blob, label: string) => {
        try {
          const source = await PDFDocument.load(await blob.arrayBuffer(), {
            ignoreEncryption: true,
          });
          const pages = await mergedPdf.copyPages(
            source,
            source.getPageIndices(),
          );
          pages.forEach((page) => mergedPdf.addPage(page));
          return true;
        } catch (error) {
          appendixWarnings.push(`${label} : PDF illisible ou protégé.`);
          console.error(`Erreur fusion PDF ${label} :`, error);
          return false;
        }
      };

      const appendImageBlob = async (blob: Blob, label: string) => {
        try {
          const bytes = await blob.arrayBuffer();
          const mime = String(blob.type || "").toLowerCase();
          const image =
            mime.includes("png")
              ? await mergedPdf.embedPng(bytes)
              : await mergedPdf.embedJpg(bytes);

          const page = mergedPdf.addPage([612, 792]);
          const maxWidth = 540;
          const maxHeight = 720;
          const ratio = Math.min(
            maxWidth / image.width,
            maxHeight / image.height,
            1,
          );
          const width = image.width * ratio;
          const height = image.height * ratio;

          page.drawImage(image, {
            x: (612 - width) / 2,
            y: (792 - height) / 2,
            width,
            height,
          });
          return true;
        } catch (error) {
          appendixWarnings.push(`${label} : image impossible à intégrer.`);
          console.error(`Erreur intégration image ${label} :`, error);
          return false;
        }
      };

      for (const item of appendixItems) {
        const mime = String(item.blob.type || "").toLowerCase();
        const lowerLabel = item.label.toLowerCase();

        if (
          mime.includes("pdf") ||
          lowerLabel.endsWith(".pdf")
        ) {
          await appendPdfBlob(item.blob, item.label);
          continue;
        }

        if (
          mime.startsWith("image/") ||
          /\.(jpe?g|png)$/i.test(lowerLabel)
        ) {
          await appendImageBlob(item.blob, item.label);
          continue;
        }

        appendixWarnings.push(
          `${item.label} : format non pris en charge dans le PDF consolidé.`,
        );
      }

      const finalBytes = await mergedPdf.save();
      const finalBlob = new Blob([finalBytes], {
        type: "application/pdf",
      });

      const url = URL.createObjectURL(finalBlob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");

      if (!opened) {
        const safeUnit = unitLabel(unite).replace(
          /[^a-zA-Z0-9_-]+/g,
          "_",
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `Dossier_controle_${safeUnit}_${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExportOpen(false);

      if (appendixWarnings.length > 0) {
        console.warn(
          "Dossier généré avec certains documents non annexés :",
          appendixWarnings,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      console.error("Erreur export dossier véhicule :", error);
      alert(`Impossible de générer le dossier : ${message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={styles.page}>
      <button type="button" onClick={() => navigate("/admin/dossiers-vehicules")} style={styles.backBtn}>
        ← Retour aux dossiers véhicules
      </button>

      <div style={styles.headerCard}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.title}>Dossier véhicule — {unitLabel(unite)}</h1>
            <p style={styles.subtitle}>
              Consultation officielle : PEP / CVM, BT, rondes Cybercat et documents administratifs.
            </p>
          </div>

          <button
            type="button"
            style={styles.exportBtn}
            onClick={() => setExportOpen(true)}
          >
            🖨️ Imprimer le dossier complet
          </button>
        </div>

        <div style={styles.headerGrid}>
          <Info label="Plaque" value={plateLabel(unite)} />
          <Info label="NIV" value={nivLabel(unite)} />
          <Info label="Véhicule" value={[unite.marque, unite.modele, unite.annee].filter(Boolean).join(" ") || "—"} />
          <Info label="KM actuel" value={kmLabel(unite.km_actuel ?? unite.odometre)} />
          <Info label="Mise en service" value={formatDate(unite.date_mise_en_service)} />
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
              <SummaryWithBadge
                label="Historique requis"
                value={
                  unresolvedCoverageGaps.length > 0
                    ? unresolvedCoverageGaps.length === 1
                      ? (() => {
                          const ctx = getPepGapContext(peps, unresolvedCoverageGaps[0]);
                          return ctx.daysBetweenPeps != null
                            ? `PEP manquant — ${ctx.daysBetweenPeps} jours entre les 2 PEP (${unresolvedCoverageGaps[0].days} jours non couverts)`
                            : `Historique incomplet — ${unresolvedCoverageGaps[0].days} jours non couverts`;
                        })()
                      : `${unresolvedCoverageGaps.length} trous de couverture — ${totalUnresolvedGapDays} jours au total`
                    : unite.date_mise_en_service &&
                      parseLocalDate(unite.date_mise_en_service) &&
                      parseLocalDate(unite.date_mise_en_service)!.getTime() >
                        addMonths(startOfToday(), -24).getTime()
                      ? `Couverture complète depuis la mise en service (${formatDate(unite.date_mise_en_service)})`
                      : "Couverture PEP / CVM complète sur 24 mois"
                }
                badge={
                  unresolvedCoverageGaps.length > 0
                    ? { label: "Non conforme", style: styles.statusDanger }
                    : { label: "Valide", style: styles.statusOk }
                }
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: -2, flexWrap: "wrap" }}>
                {coverageGap ? (
                  <button type="button" style={styles.secondaryBtn} onClick={() => setOverrideOpen(true)}>
                    Accepter l’écart
                  </button>
                ) : null}
                {complianceOverrides.length > 0 ? (
                  <button
                    type="button"
                    style={styles.linkHistoryBtn}
                    onClick={() => setOverrideHistoryOpen(true)}
                  >
                    Voir historique
                  </button>
                ) : null}
              </div>

              {unresolvedCoverageGaps.length > 0 ? (
                <div style={styles.coverageGapList}>
                  {unresolvedCoverageGaps.map((gap, index) => (
                    <div
                      key={`${gap.start.toISOString()}-${gap.end.toISOString()}`}
                      style={styles.coverageGapRow}
                    >
                      <div>
                        <strong>PEP manquant {index + 1}</strong>
                        <div style={styles.muted}>
                          {(() => {
                            const ctx = getPepGapContext(peps, gap);
                            const previousDate = getPepDate(ctx.previousPep);
                            const nextDate = getPepDate(ctx.nextPep);
                            return previousDate && nextDate && ctx.daysBetweenPeps != null
                              ? `PEP du ${previousDate.toLocaleDateString("fr-CA")} → PEP du ${nextDate.toLocaleDateString("fr-CA")} — ${ctx.daysBetweenPeps} jours entre les 2 PEP (${gap.days} jours non couverts)`
                              : `${gap.start.toLocaleDateString("fr-CA")} au ${gap.end.toLocaleDateString("fr-CA")} — ${gap.days} jours non couverts`;
                          })()}
                        </div>
                      </div>
                      {index === 0 ? (
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...styles.statusDanger,
                            marginTop: 0,
                          }}
                        >
                          À traiter
                        </span>
                      ) : (
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...styles.statusNeutral,
                            marginTop: 0,
                          }}
                        >
                          En attente
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {unite.date_mise_en_service && firstPepGraceEnd ? (
                <SummaryWithBadge
                  label="Premier PEP"
                  value={
                    firstPepGraceActive
                      ? `Période de grâce jusqu’au ${firstPepGraceEnd.toLocaleDateString("fr-CA")}`
                      : `Échéance initiale : ${firstPepGraceEnd.toLocaleDateString("fr-CA")}`
                  }
                  badge={
                    firstPepGraceActive
                      ? { label: "Grâce active", style: styles.statusOk }
                      : peps.length === 0
                        ? { label: "PEP requis", style: styles.statusDanger }
                        : { label: "Effectué", style: styles.statusOk }
                  }
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

          <div style={styles.sectionHeader}>
            <h2 style={{ ...styles.cardTitle, margin: 0 }}>Historique PEP</h2>
            <button
              type="button"
              style={styles.primaryBtn}
              onClick={() => setPepImportOpen(true)}
            >
              Importer PEP
            </button>
          </div>
          <DataTable>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>KM</Th>
                <Th>Mécano</Th>
                <Th>Provenance</Th>
                <Th>BT lié</Th>
                <Th>Document</Th>
                <Th>Actions</Th>
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
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...(isImportedPep(pep)
                            ? styles.statusNeutral
                            : styles.statusOk),
                          marginTop: 0,
                        }}
                      >
                        {isImportedPep(pep) ? "Importé" : "Atelier"}
                      </span>
                    </Td>
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
                    <Td>
                      <button
                        type="button"
                        style={styles.dangerBtn}
                        onClick={() => deletePepArchive(pep)}
                      >
                        Supprimer
                      </button>
                    </Td>
                  </tr>
                );
              })}{peps.length === 0 && <EmptyRow colSpan={7} label="Aucun PEP archivé." />}
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

      {exportOpen && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !exporting) setExportOpen(false);
          }}
        >
          <div style={{ ...styles.modalCard, width: "min(720px, 94vw)", maxHeight: "88vh" }}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Imprimer le dossier complet</h2>
                <p style={styles.modalSubtitle}>
                  Prépare un dossier réglementaire unique pour l’unité {unitLabel(unite)}.
                </p>
              </div>
              <button
                type="button"
                style={styles.modalCloseBtn}
                onClick={() => setExportOpen(false)}
                disabled={exporting}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.exportNotice}>
                Les sections sont cochées par défaut. La période s’applique aux historiques PEP, BT et écarts; les documents administratifs courants demeurent inclus.
              </div>

              <div style={{ height: 16 }} />

              <div style={styles.exportPeriodRow}>
                <div>
                  <div style={styles.exportSectionTitle}>Période du dossier</div>
                  <div style={styles.muted}>24 mois est recommandé pour un contrôle courant.</div>
                </div>
                <select
                  value={exportPeriod}
                  onChange={(e) => setExportPeriod(e.target.value as "24" | "36" | "all")}
                  style={{ ...styles.select, minWidth: 180 }}
                  disabled={exporting}
                >
                  <option value="24">24 derniers mois</option>
                  <option value="36">36 derniers mois</option>
                  <option value="all">Historique complet</option>
                </select>
              </div>

              <div style={{ height: 18 }} />

              <div style={styles.exportSectionTitle}>Sections à inclure</div>
              <div style={styles.exportGrid}>
                {[
                  ["vehicle", "Fiche véhicule et état du dossier"],
                  ["pep", "Historique PEP / CVM"],
                  ["bt", "Bons de travail"],
                  ["documents", "Documents administratifs"],
                  ["overrides", "Écarts PEP acceptés / dérogations"],
                ].map(([key, label]) => (
                  <label key={key} style={styles.exportCheckRow}>
                    <input
                      type="checkbox"
                      checked={exportSections[key as keyof typeof exportSections]}
                      onChange={() => toggleExportSection(key as keyof typeof exportSections)}
                      disabled={exporting}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <div style={styles.exportComingSoon}>
                <strong>Rondes de sécurité :</strong> elles seront ajoutées automatiquement au dossier lorsque l’intégration Samsara DVIR sera reliée à cette page.
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => setExportOpen(false)}
                disabled={exporting}
              >
                Annuler
              </button>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={() => void generateVehicleDossierPdf()}
                disabled={exporting || !Object.values(exportSections).some(Boolean)}
              >
                {exporting ? "Préparation du PDF…" : "Préparer l’impression"}
              </button>
            </div>
          </div>
        </div>
      )}

      {overrideHistoryOpen && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOverrideHistoryOpen(false);
          }}
        >
          <div style={{ ...styles.modalCard, width: "min(700px, 94vw)", maxHeight: "80vh" }}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Historique des écarts acceptés</h2>
                <p style={styles.modalSubtitle}>
                  Dérogations enregistrées pour cette unité.
                </p>
              </div>
              <button
                type="button"
                style={styles.modalCloseBtn}
                onClick={() => setOverrideHistoryOpen(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              {complianceOverrides.length === 0 ? (
                <div style={styles.empty}>Aucune dérogation enregistrée.</div>
              ) : (
                <div style={styles.overrideHistoryList}>
                  {complianceOverrides.map((row) => (
                    <div key={row.id} style={styles.overrideHistoryRow}>
                      <div style={styles.overrideHistoryTop}>
                        <strong>
                          {formatDate(row.gap_start)} au {formatDate(row.gap_end)}
                        </strong>
                        <span style={{ ...styles.statusBadge, ...styles.statusOk, marginTop: 0 }}>
                          {row.gap_days} jour{row.gap_days > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div style={styles.overrideReason}>{row.justification}</div>
                      <div style={styles.muted}>
                        Accepté le {formatDate(row.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={() => setOverrideHistoryOpen(false)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {overrideOpen && coverageGap && (
        <div style={styles.modalOverlay} onMouseDown={(e) => {
          if (e.target === e.currentTarget && !savingOverride) setOverrideOpen(false);
        }}>
          <div style={{ ...styles.modalCard, width: "min(520px, 94vw)", maxHeight: "none" }}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Accepter l’écart historique</h2>
                <p style={styles.modalSubtitle}>
                  {selectedGapPepContext.daysBetweenPeps != null
                    ? `PEP manquant : ${selectedGapPepContext.daysBetweenPeps} jours entre les deux PEP (${coverageGap.days} jours réellement non couverts).`
                    : `Historique incomplet : ${coverageGap.days} jours non couverts.`}
                </p>
              </div>
              <button type="button" style={styles.modalCloseBtn} onClick={() => setOverrideOpen(false)} disabled={savingOverride}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.gapAnalysisBox}>
                <div style={styles.gapAnalysisTitle}>Analyse de l’écart</div>

                <div style={styles.gapAnalysisGrid}>
                  <div style={styles.gapAnalysisItem}>
                    <span style={styles.fieldLabel}>PEP précédent</span>
                    <strong>
                      {selectedGapPepContext.previousPep
                        ? formatDate(
                            selectedGapPepContext.previousPep.date_pep ||
                              selectedGapPepContext.previousPep.created_at,
                          )
                        : "Aucun"}
                    </strong>
                  </div>

                  <div style={styles.gapAnalysisItem}>
                    <span style={styles.fieldLabel}>PEP suivant</span>
                    <strong>
                      {selectedGapPepContext.nextPep
                        ? formatDate(
                            selectedGapPepContext.nextPep.date_pep ||
                              selectedGapPepContext.nextPep.created_at,
                          )
                        : "Aucun"}
                    </strong>
                  </div>

                  <div style={styles.gapAnalysisItem}>
                    <span style={styles.fieldLabel}>Entre les 2 PEP</span>
                    <strong>
                      {selectedGapPepContext.daysBetweenPeps != null
                        ? `${selectedGapPepContext.daysBetweenPeps} jours`
                        : "—"}
                    </strong>
                  </div>

                  <div style={styles.gapAnalysisItem}>
                    <span style={styles.fieldLabel}>Au-delà de 90 jours</span>
                    <strong>
                      {selectedGapPepContext.daysOver90 != null
                        ? `${selectedGapPepContext.daysOver90} jour${
                            selectedGapPepContext.daysOver90 > 1 ? "s" : ""
                          }`
                        : "—"}
                    </strong>
                  </div>

                  <div style={styles.gapAnalysisItem}>
                    <span style={styles.fieldLabel}>Trou réel à accepter</span>
                    <strong>
                      {coverageGap.days} jour{coverageGap.days > 1 ? "s" : ""}
                    </strong>
                  </div>

                  <div style={styles.gapAnalysisItem}>
                    <span style={styles.fieldLabel}>Période non couverte</span>
                    <strong>
                      {coverageGap.start.toLocaleDateString("fr-CA")} au{" "}
                      {coverageGap.end.toLocaleDateString("fr-CA")}
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <div style={styles.autoAcceptHint}>
                Les écarts de moins de {AUTO_ACCEPT_PEP_GAP_DAYS} jours sont acceptés automatiquement.
                Celui-ci nécessite une justification puisqu’il atteint ou dépasse {AUTO_ACCEPT_PEP_GAP_DAYS} jours.
              </div>

              <div style={{ height: 16 }} />

              <label style={styles.fieldLabel}>Justification *</label>
              <textarea
                value={overrideJustification}
                onChange={(e) => setOverrideJustification(e.target.value)}
                placeholder="Ex. rendez-vous atelier retardé"
                rows={4}
                style={{ ...styles.input, width: "100%", height: "auto", padding: 10, resize: "vertical" }}
                autoFocus
              />
            </div>
            <div style={styles.modalFooter}>
              <button type="button" style={styles.secondaryBtn} onClick={() => setOverrideOpen(false)} disabled={savingOverride}>Annuler</button>
              <button
                type="button"
                style={{ ...styles.primaryBtn, ...(!overrideJustification.trim() ? styles.disabledBtn : {}) }}
                onClick={acceptCoverageGap}
                disabled={savingOverride || !overrideJustification.trim()}
              >
                {savingOverride ? "Sauvegarde…" : "Accepter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pepImportOpen && (
        <div
          style={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePepImportModal();
          }}
        >
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Importer PEP</h2>
                <p style={styles.modalSubtitle}>
                  Ajoute un ou plusieurs PEP papier ou réalisés à l’externe.
                </p>
              </div>
              <button
                type="button"
                style={styles.modalCloseBtn}
                onClick={closePepImportModal}
                disabled={pepImporting}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <input
                ref={pepImportFileRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files) addPepImportFiles(e.target.files);
                }}
              />

              <div
                style={styles.pepImportDropZone}
                onClick={() => pepImportFileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addPepImportFiles(e.dataTransfer.files);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    pepImportFileRef.current?.click();
                  }
                }}
              >
                <strong>Sélectionner les PDF</strong>
                <span style={styles.dropZoneHint}>
                  ou glisser-déposer plusieurs PEP ici
                </span>
              </div>

              {pepImportDrafts.length > 0 && (
                <div style={styles.pepImportList}>
                  {pepImportDrafts.map((draft) => (
                    <div key={draft.id} style={styles.pepImportRow}>
                      <div style={styles.pepImportFile}>
                        <strong>{draft.file.name}</strong>
                        <span style={styles.muted}>
                          {fileSizeLabel(draft.file.size)}
                        </span>
                      </div>

                      <div style={styles.pepImportField}>
                        <label style={styles.fieldLabel}>Date du PEP *</label>
                        <input
                          type="date"
                          value={draft.datePep}
                          onChange={(e) =>
                            updatePepImportDraft(draft.id, {
                              datePep: e.target.value,
                            })
                          }
                          style={styles.input}
                        />
                      </div>

                      <div style={styles.pepImportFieldSmall}>
                        <label style={styles.fieldLabel}>KM</label>
                        <input
                          type="number"
                          min="0"
                          value={draft.odometre}
                          onChange={(e) =>
                            updatePepImportDraft(draft.id, {
                              odometre: e.target.value,
                            })
                          }
                          placeholder="Optionnel"
                          style={styles.input}
                        />
                      </div>

                      <div style={styles.pepImportField}>
                        <label style={styles.fieldLabel}>Mécano / atelier</label>
                        <input
                          value={draft.mecano}
                          onChange={(e) =>
                            updatePepImportDraft(draft.id, {
                              mecano: e.target.value,
                            })
                          }
                          placeholder="Optionnel"
                          style={styles.input}
                        />
                      </div>

                      <button
                        type="button"
                        style={styles.removeImportBtn}
                        onClick={() => removePepImportDraft(draft.id)}
                        disabled={pepImporting}
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={closePepImportModal}
                disabled={pepImporting}
              >
                Annuler
              </button>
              <button
                type="button"
                style={{
                  ...styles.primaryBtn,
                  ...(pepImportDrafts.length === 0 ? styles.disabledBtn : {}),
                }}
                onClick={importPepDrafts}
                disabled={pepImporting || pepImportDrafts.length === 0}
              >
                {pepImporting
                  ? "Importation…"
                  : `Importer ${pepImportDrafts.length || ""} PEP`}
              </button>
            </div>
          </div>
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
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  exportBtn: {
    border: "1px solid #111827",
    background: "#111827",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 16px",
    minHeight: 40,
    cursor: "pointer",
    fontWeight: 800,
    whiteSpace: "nowrap",
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

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  exportNotice: {
    padding: 12,
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    background: "#eff6ff",
    color: "#1e40af",
    fontSize: 13,
    fontWeight: 650,
  },
  exportPeriodRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  exportSectionTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 6,
  },
  exportGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  exportCheckRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    minHeight: 44,
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fff",
    color: "#374151",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  exportComingSoon: {
    marginTop: 16,
    padding: 11,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#f9fafb",
    color: "#4b5563",
    fontSize: 12,
    lineHeight: 1.5,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.48)",
    display: "grid",
    placeItems: "center",
    padding: 20,
    zIndex: 1000,
  },
  modalCard: {
    width: "min(1100px, 96vw)",
    maxHeight: "90vh",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "18px 20px",
    borderBottom: "1px solid #e5e7eb",
  },
  modalTitle: {
    margin: 0,
    fontSize: 21,
    color: "#111827",
  },
  modalSubtitle: {
    margin: "5px 0 0",
    color: "#6b7280",
    fontSize: 13,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    border: "none",
    borderRadius: 9,
    background: "#f3f4f6",
    color: "#374151",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
  },
  modalBody: {
    padding: 20,
    overflowY: "auto",
  },
  pepImportDropZone: {
    minHeight: 110,
    border: "2px dashed #94a3b8",
    borderRadius: 12,
    background: "#f8fafc",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 5,
    padding: 16,
    cursor: "pointer",
    textAlign: "center",
    color: "#334155",
  },
  pepImportList: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },
  pepImportRow: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 1.4fr) 160px 120px minmax(170px, 1fr) auto",
    gap: 10,
    alignItems: "end",
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
  },
  pepImportFile: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    overflowWrap: "anywhere",
  },
  pepImportField: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  pepImportFieldSmall: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  removeImportBtn: {
    height: 38,
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#b91c1c",
    borderRadius: 10,
    padding: "0 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "14px 20px",
    borderTop: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  secondaryBtn: {
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#374151",
    borderRadius: 10,
    padding: "9px 16px",
    height: 38,
    cursor: "pointer",
  },
  disabledBtn: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  linkHistoryBtn: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    cursor: "pointer",
    padding: "8px 2px",
    fontWeight: 700,
  },
  coverageGapList: {
    display: "grid",
    gap: 8,
    marginTop: 6,
    padding: 10,
    border: "1px solid #fecaca",
    borderRadius: 10,
    background: "#fff7f7",
  },
  coverageGapRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "7px 0",
    borderBottom: "1px solid #fee2e2",
  },
  autoAcceptHint: {
    padding: "9px 10px",
    border: "1px solid #dbeafe",
    borderRadius: 9,
    background: "#eff6ff",
    color: "#1e40af",
    fontSize: 12,
    fontWeight: 700,
  },
  gapAnalysisBox: {
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#f9fafb",
  },
  gapAnalysisTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 10,
  },
  gapAnalysisGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  gapAnalysisItem: {
    display: "grid",
    gap: 3,
    padding: 9,
    border: "1px solid #e5e7eb",
    borderRadius: 9,
    background: "#fff",
    color: "#111827",
  },
  overrideHistoryList: {
    display: "grid",
    gap: 10,
  },
  overrideHistoryRow: {
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#f9fafb",
  },
  overrideHistoryTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  overrideReason: {
    marginTop: 6,
    color: "#374151",
    fontWeight: 600,
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