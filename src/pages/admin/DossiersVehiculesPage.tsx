import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

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
  statut?: string | null;
  pep_vignette_expiration?: string | null;
  date_mise_en_service?: string | null;
};

type ComplianceOverrideRow = {
  id: string;
  unite_id: string;
  gap_start: string;
  gap_end: string;
  gap_days: number;
  justification: string;
};

type PepRow = {
  id: string;
  unite_id?: string | null;
  date_pep?: string | null;
  date?: string | null;
  date_prochain?: string | null;
  created_at?: string | null;
};

type VehicleDocumentRow = {
  id: string;
  unite_id: string;
  type_document: string;
  created_at: string;
  date_expiration?: string | null;
};

function unitLabel(u: UniteRow) {
  return u.numero || u.no_unite || u.nom || "—";
}

function plateLabel(u: UniteRow) {
  return u.plaque || u.immatriculation || "—";
}

function nivLabel(u: UniteRow) {
  return u.niv || u.vin || "—";
}

function kmLabel(u: UniteRow) {
  const value = u.km_actuel ?? u.odometre;
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("fr-CA");
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

const REQUIRED_DOCUMENT_TYPES = [
  { value: "assurance", label: "Assurance" },
  { value: "immatriculation", label: "Immatriculation" },
] as const;

function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const clean = String(value).slice(0, 10);
  const date = new Date(`${clean}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
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

function getCoverageGap(
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
  const intervals = buildRegulatoryCoverage(peps, cvms, miseEnServiceValue).filter(
    (interval) =>
      interval.end.getTime() >= requiredStart.getTime() &&
      interval.start.getTime() <= today.getTime(),
  );

  let coveredUntil = new Date(requiredStart);

  for (const interval of intervals) {
    if (interval.end.getTime() < coveredUntil.getTime()) continue;

    if (interval.start.getTime() > coveredUntil.getTime()) {
      return {
        start: coveredUntil,
        end: interval.start,
        days: Math.ceil(
          (interval.start.getTime() - coveredUntil.getTime()) / 86400000,
        ),
      };
    }

    if (interval.end.getTime() > coveredUntil.getTime()) {
      coveredUntil = new Date(interval.end);
    }

    if (coveredUntil.getTime() >= today.getTime()) return null;
  }

  return coveredUntil.getTime() < today.getTime()
    ? {
        start: coveredUntil,
        end: today,
        days: Math.ceil((today.getTime() - coveredUntil.getTime()) / 86400000),
      }
    : null;
}

function daysExpired(value?: string | null) {
  const expiration = parseLocalDate(value);
  if (!expiration) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diff = Math.floor(
    (today.getTime() - expiration.getTime()) / 86400000,
  );

  return diff > 0 ? diff : 0;
}

function daysUntilExpiration(value?: string | null) {
  const expiration = parseLocalDate(value);
  if (!expiration) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diff = Math.ceil(
    (expiration.getTime() - today.getTime()) / 86400000,
  );

  return diff >= 0 ? diff : null;
}

function getPepDueDate(pep?: PepRow | null) {
  if (!pep) return null;

  const explicitDue = parseLocalDate(pep.date_prochain);
  if (explicitDue) return explicitDue;

  const sourceDate = pep.date_pep || pep.date || pep.created_at;
  const pepDate = parseLocalDate(sourceDate);
  return pepDate ? addDays(pepDate, 90) : null;
}

function getPepDate(pep?: PepRow | null) {
  if (!pep) return null;
  return parseLocalDate(pep.date_pep || pep.date || pep.created_at);
}

function getDaysBetweenDates(
  older?: Date | null,
  newer?: Date | null,
) {
  if (!older || !newer) return null;
  return Math.floor((newer.getTime() - older.getTime()) / 86400000);
}

function isPepValidOnDate(
  pep: PepRow,
  referenceValue?: string | null,
) {
  const pepDate = getPepDate(pep);
  const referenceDate = parseLocalDate(referenceValue);
  if (!pepDate || !referenceDate) return false;

  const ageDays = getDaysBetweenDates(pepDate, referenceDate);
  return ageDays != null && ageDays >= 0 && ageDays <= 90;
}

function isDateAfter(
  left?: string | null,
  right?: string | null,
) {
  const leftDate = parseLocalDate(left);
  const rightDate = parseLocalDate(right);
  if (!leftDate || !rightDate) return false;
  return leftDate.getTime() > rightDate.getTime();
}

function getPepOverdueDays(pep?: PepRow | null) {
  const dueDate = getPepDueDate(pep);
  if (!dueDate) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diff = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export default function DossiersVehiculesPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [unites, setUnites] = useState<UniteRow[]>([]);
  const [peps, setPeps] = useState<PepRow[]>([]);
  const [documents, setDocuments] = useState<VehicleDocumentRow[]>([]);
  const [complianceOverrides, setComplianceOverrides] = useState<ComplianceOverrideRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const [unitesRes, pepRes, docsRes, overridesRes] = await Promise.all([
    supabase
  .from("unites")
  .select("*")
  .or("mode_comptable.eq.interne,mode_comptable.eq.interne_ta")
  .not("niv", "is", null)
  .not("plaque", "is", null)
  .order("no_unite", { ascending: true }),

  supabase
    .from("pep_archives")
    .select("*")
    .order("created_at", { ascending: false }),

  supabase
    .from("vehicle_documents")
    .select("id, unite_id, type_document, created_at, date_expiration")
    .order("created_at", { ascending: false }),

  supabase
    .from("vehicle_compliance_overrides")
    .select("id, unite_id, gap_start, gap_end, gap_days, justification"),
]);

    if (unitesRes.data) {
      setUnites(
        (unitesRes.data as UniteRow[]).filter(
          (unite) =>
            String(unite.statut ?? "")
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim()
              .toLowerCase() !== "inactif",
        ),
      );
    }
    if (pepRes.data) setPeps(pepRes.data as PepRow[]);
    if (docsRes.data) setDocuments(docsRes.data as VehicleDocumentRow[]);
    if (overridesRes.data) setComplianceOverrides(overridesRes.data as ComplianceOverrideRow[]);

    setLoading(false);
  }

  const pepByUnite = useMemo(() => {
    const map = new Map<string, PepRow>();
    for (const pep of peps) {
      const uniteId = pep.unite_id;
      if (!uniteId) continue;
      const current = map.get(uniteId);
      if (!current || (getPepDate(pep)?.getTime() ?? 0) > (getPepDate(current)?.getTime() ?? 0)) {
        map.set(uniteId, pep);
      }
    }
    return map;
  }, [peps]);

  const pepsByUnite = useMemo(() => {
    const map = new Map<string, PepRow[]>();

    for (const pep of peps) {
      const uniteId = pep.unite_id;
      if (!uniteId) continue;

      const current = map.get(uniteId) ?? [];
      current.push(pep);
      map.set(uniteId, current);
    }

    for (const [uniteId, rows] of map.entries()) {
      rows.sort((a, b) => {
        const aDate = getPepDate(a)?.getTime() ?? 0;
        const bDate = getPepDate(b)?.getTime() ?? 0;
        return bDate - aDate;
      });
      map.set(uniteId, rows);
    }

    return map;
  }, [peps]);

  const docsCountByUnite = useMemo(() => {
    const map = new Map<string, number>();
    for (const doc of documents) {
      map.set(doc.unite_id, (map.get(doc.unite_id) || 0) + 1);
    }
    return map;
  }, [documents]);

  const alertsByUnite = useMemo(() => {
    type AlertState = {
      severity: "yellow" | "red";
      reasons: string[];
    };

    const docsByUnit = new Map<string, VehicleDocumentRow[]>();

    for (const doc of documents) {
      const current = docsByUnit.get(doc.unite_id) ?? [];
      current.push(doc);
      docsByUnit.set(doc.unite_id, current);
    }

    const alerts = new Map<string, AlertState>();

    for (const unite of unites) {
      const unitDocs = docsByUnit.get(unite.id) ?? [];
      const unitPeps = pepsByUnite.get(unite.id) ?? [];
      const yellowReasons: string[] = [];
      const redReasons: string[] = [];

      const addAdministrativeExpiration = (
        label: string,
        expiration?: string | null,
      ) => {
        const expiredDays = daysExpired(expiration);
        if (!expiredDays) return;

        if (expiredDays > 30) {
          redReasons.push(`${label} expiré depuis ${expiredDays} jours`);
        } else {
          yellowReasons.push(`${label} expiré depuis ${expiredDays} jours`);
        }
      };

      for (const required of REQUIRED_DOCUMENT_TYPES) {
        const matchingDocs = unitDocs
          .filter((doc) => doc.type_document === required.value)
          .sort((a, b) =>
            String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
          );

        const latest = matchingDocs[0];

        if (!latest) {
          redReasons.push(`${required.label} manquante`);
          continue;
        }

        addAdministrativeExpiration(required.label, latest.date_expiration);
      }

      const cvmDocs = unitDocs
        .filter((doc) => doc.type_document === "cvm")
        .sort((a, b) =>
          String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
        );

      const coverageGap = getCoverageGap(unitPeps, cvmDocs, unite.date_mise_en_service);
      if (coverageGap) {
        const gapStart = coverageGap.start.toISOString().slice(0, 10);
        const gapEnd = coverageGap.end.toISOString().slice(0, 10);
        const accepted = complianceOverrides.find(
          (row) =>
            row.unite_id === unite.id &&
            row.gap_start === gapStart &&
            row.gap_end === gapEnd,
        );

        if (!accepted) {
          redReasons.push(
            `Historique PEP/CVM incomplet — trou de ${coverageGap.days} jours`,
          );
        }
      }

      const latestCvm = cvmDocs[0] ?? null;
      const cvmExpiration = latestCvm?.date_expiration ?? null;
      const cvmExpiredDays = daysExpired(cvmExpiration);
      const cvmIsValid = Boolean(
        latestCvm &&
        cvmExpiration &&
        (!cvmExpiredDays || cvmExpiredDays === 0),
      );

      if (cvmIsValid) {
        // Pendant la validité du CVM, PEP et vignette ne sont pas obligatoires.
      } else {
        let applicablePep: PepRow | null = null;

        if (latestCvm && cvmExpiration) {
          const pepAfterCvmExpiration =
            unitPeps.find((pep) =>
              isDateAfter(
                pep.date_pep || pep.date || pep.created_at,
                cvmExpiration,
              ),
            ) ?? null;

          const pepStillValidAtCvmExpiration =
            unitPeps.find((pep) =>
              isPepValidOnDate(pep, cvmExpiration),
            ) ?? null;

          applicablePep =
            pepAfterCvmExpiration ?? pepStillValidAtCvmExpiration;

          if (!applicablePep) {
            redReasons.push(
              "CVM expiré — nouveau CVM ou PEP valide requis",
            );
          }
        } else {
          applicablePep = unitPeps[0] ?? null;
        }

        if (applicablePep) {
          const pepOverdueDays = getPepOverdueDays(applicablePep) ?? 0;

          if (pepOverdueDays > 15) {
            redReasons.push(
              `PEP passé dû depuis ${pepOverdueDays} jours`,
            );
          } else if (pepOverdueDays > 0) {
            yellowReasons.push(
              `PEP passé dû depuis ${pepOverdueDays} jours`,
            );
          }

          const vignetteExpiration = unite.pep_vignette_expiration ?? null;

          if (!vignetteExpiration) {
            redReasons.push("Vignette PEP manquante");
          } else {
            const vignetteExpiredDays = daysExpired(vignetteExpiration);
            const vignetteDaysRemaining =
              daysUntilExpiration(vignetteExpiration);

            if (vignetteExpiredDays && vignetteExpiredDays > 30) {
              redReasons.push(
                `Vignette PEP expirée depuis ${vignetteExpiredDays} jours`,
              );
            } else if (vignetteExpiredDays) {
              yellowReasons.push(
                `Vignette PEP expirée depuis ${vignetteExpiredDays} jours`,
              );
            } else if (
              vignetteDaysRemaining != null &&
              vignetteDaysRemaining <= 15
            ) {
              yellowReasons.push(
                `Vignette PEP expire dans ${vignetteDaysRemaining} jours`,
              );
            }
          }
        } else if (!latestCvm) {
          redReasons.push("PEP manquant");
        }
      }

      if (redReasons.length > 0) {
        alerts.set(unite.id, {
          severity: "red",
          reasons: [...redReasons, ...yellowReasons],
        });
      } else if (yellowReasons.length > 0) {
        alerts.set(unite.id, {
          severity: "yellow",
          reasons: yellowReasons,
        });
      }
    }

    return alerts;
  }, [documents, unites, pepsByUnite, complianceOverrides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return unites;

    return unites.filter((u) => {
      const haystack = [
        unitLabel(u),
        plateLabel(u),
        nivLabel(u),
        u.marque || "",
        u.modele || "",
        String(u.annee || ""),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [unites, search]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dossiers véhicules</h1>
          <p style={styles.subtitle}>
            Consultation des dossiers légaux par unité : PEP / CVM, BT, rondes et documents.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.toolbar}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par unité, plaque ou NIV..."
            style={styles.search}
          />
          <div style={styles.count}>{filtered.length} unité(s)</div>
        </div>

        {loading ? (
          <div style={styles.empty}>Chargement…</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Unité</th>
                  <th style={styles.th}>Plaque</th>
                  <th style={styles.th}>NIV</th>
                  <th style={styles.th}>Dernier PEP</th>
                  <th style={styles.th}>KM actuel</th>
                  <th style={styles.th}>Documents</th>
                  <th style={styles.th}>État dossier</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const lastPep = pepByUnite.get(u.id);
                  const lastPepDate = lastPep?.date_pep || lastPep?.date || lastPep?.created_at;
                  const docsCount = docsCountByUnite.get(u.id) || 0;
                  const alertState = alertsByUnite.get(u.id) ?? null;
                  const alertReasons = alertState?.reasons ?? [];
                  const hasAlert = Boolean(alertState);

                  return (
                    <tr
                      key={u.id}
                      style={{
                        ...styles.tr,
                        ...(alertState?.severity === "red" ? styles.trDanger : {}),
                        ...(alertState?.severity === "yellow" ? styles.trWarning : {}),
                      }}
                      onDoubleClick={() => navigate(`/admin/dossiers-vehicules/${u.id}`)}
                      title={
                        hasAlert
                          ? alertReasons.join("\n")
                          : "Double-cliquer pour ouvrir le dossier"
                      }
                    >
                      <td style={styles.tdStrong}>{unitLabel(u)}</td>
                      <td style={styles.td}>{plateLabel(u)}</td>
                      <td style={styles.td}>{nivLabel(u)}</td>
                      <td style={styles.td}>{formatDate(lastPepDate)}</td>
                      <td style={styles.td}>{kmLabel(u)}</td>
                      <td style={styles.td}>{docsCount}</td>
                      <td style={styles.td}>
                        {hasAlert ? (
                          <div style={styles.alertCell}>
                            <span
                              style={
                                alertState?.severity === "red"
                                  ? styles.alertBadge
                                  : styles.warningBadge
                              }
                            >
                              {alertState?.severity === "red"
                                ? "Action requise"
                                : "À surveiller"}
                            </span>
                          </div>
                        ) : (
                          <span style={styles.okBadge}>Complet</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={styles.emptyTd}>
                      Aucune unité trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
  padding: 24,
  width: "100%",
  maxWidth: "none",
  margin: 0,
},
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 18,
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
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  search: {
    width: "100%",
    maxWidth: 420,
    height: 38,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    fontSize: 14,
    outline: "none",
  },
  count: {
    color: "#6b7280",
    fontSize: 13,
    whiteSpace: "nowrap",
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
  tr: {
    cursor: "default",
  },
  trDanger: {
    background: "#fff1f2",
    boxShadow: "inset 4px 0 0 #dc2626",
  },
  trWarning: {
    background: "#fffbeb",
    boxShadow: "inset 4px 0 0 #f59e0b",
  },
  alertCell: {
    display: "grid",
    gap: 5,
    maxWidth: 360,
  },
  alertBadge: {
    display: "inline-flex",
    width: "fit-content",
    borderRadius: 999,
    padding: "3px 8px",
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 900,
  },
  warningBadge: {
    display: "inline-flex",
    width: "fit-content",
    borderRadius: 999,
    padding: "3px 8px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 12,
    fontWeight: 900,
  },
  okBadge: {
    display: "inline-flex",
    width: "fit-content",
    borderRadius: 999,
    padding: "3px 8px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: 12,
    fontWeight: 900,
  },
  alertReasons: {
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "normal",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
    color: "#374151",
  },
  tdStrong: {
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
    color: "#111827",
    fontWeight: 800,
  },
  empty: {
    padding: 24,
    color: "#6b7280",
  },
  emptyTd: {
    padding: 24,
    textAlign: "center",
    color: "#6b7280",
  },
};