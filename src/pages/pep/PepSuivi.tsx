import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type UniteRow = {
  id: string;
  no_unite: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  statut: string | null;
  mode_comptable: string | null;
};

type PepArchiveRow = {
  id: string;
  unite_id: string;
  unite: string | null;
  date_pep: string | null;
  date_prochain: string | null;
  num_mecano: string | null;
  odometre: string | null;
  payload_json: Record<string, any> | null;
  signature_data_url: string | null;
  html_complet: string;
  pages_html: string[] | null;
  created_at: string;
};

type PepStatus = "overdue" | "soon" | "ok" | "missing";
type ParcFilter = "internes" | "externes" | "tous";

type PepSuiviItem = {
  unite_id: string;
  no_unite: string;
  description: string;
  statut_unite: string | null;
  mode_comptable: string | null;
  is_externe: boolean;
  date_pep: string | null;
  date_prochain: string | null;
  num_mecano: string | null;
  odometre: string | null;
  html_complet: string | null;
  archive_id: string | null;
  status: PepStatus;
  daysRemaining: number | null;
};

const SOON_DAYS = 15;

function todayLocalIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function diffDaysFromToday(dateStr: string | null | undefined): number | null {
  const target = parseIsoDate(dateStr);
  if (!target) return null;

  const today = parseIsoDate(todayLocalIso());
  if (!today) return null;

  const ms = target.getTime() - today.getTime();
  return Math.round(ms / 86400000);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = parseIsoDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("fr-CA");
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("fr-CA");
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isUniteExterne(modeComptable: string | null | undefined): boolean {
  return normalize(modeComptable) === "externe";
}

function isUniteInterne(modeComptable: string | null | undefined): boolean {
  const s = normalize(modeComptable);
  return s === "interne" || s === "interne_ta";
}

function modeComptableLabel(modeComptable: string | null | undefined): string {
  const s = normalize(modeComptable);
  if (s === "interne") return "Interne";
  if (s === "interne_ta") return "Interne TA";
  if (s === "externe") return "Externe";
  return "—";
}

function getStatus(
  dateProchain: string | null,
  hasArchive: boolean
): { status: PepStatus; daysRemaining: number | null } {
  if (!hasArchive) {
    return { status: "missing", daysRemaining: null };
  }

  const days = diffDaysFromToday(dateProchain);

  if (days == null) {
    return { status: "missing", daysRemaining: null };
  }

  if (days < 0) {
    return { status: "overdue", daysRemaining: days };
  }

  if (days <= SOON_DAYS) {
    return { status: "soon", daysRemaining: days };
  }

  return { status: "ok", daysRemaining: days };
}

function statusLabel(status: PepStatus, daysRemaining: number | null): string {
  if (status === "missing") return "Aucun PEP";
  if (status === "overdue") {
    const daysLate = Math.abs(daysRemaining ?? 0);
    return `Passé dû • ${daysLate} j`;
  }
  if (status === "soon") {
    return `À venir • ${daysRemaining ?? 0} j`;
  }
  return "Conforme";
}

function statusBadgeStyle(status: PepStatus): React.CSSProperties {
  if (status === "overdue") {
    return {
      background: "#fef2f2",
      border: "1px solid #fecaca",
      color: "#991b1b",
    };
  }

  if (status === "soon") {
    return {
      background: "#fffbeb",
      border: "1px solid #fde68a",
      color: "#92400e",
    };
  }

  if (status === "missing") {
    return {
      background: "#eef2ff",
      border: "1px solid #c7d2fe",
      color: "#3730a3",
    };
  }

  return {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#065f46",
  };
}

function printHtmlDocument(html: string) {
  if (!html) return;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 500);
  };

  iframe.onload = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        return;
      }

      win.focus();
      setTimeout(() => {
        win.print();
        cleanup();
      }, 250);
    } catch {
      cleanup();
    }
  };

  const doc = iframe.contentDocument;
  if (!doc) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();
}

function ActionMenu({
  item,
  open,
  onToggle,
  onClose,
  onView,
  onPrint,
  onHistory,
}: {
  item: PepSuiviItem;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onView: () => void;
  onPrint: () => void;
  onHistory: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        onClose();
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleOutside);
    }

    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, onClose]);

  const disabled = !item.html_complet;

  return (
    <div style={styles.actionWrap} ref={ref}>
      <button type="button" style={styles.actionBtn} onClick={onToggle}>
        ...
      </button>

      {open && (
        <div style={styles.actionMenu}>
          <button
            type="button"
            style={{
              ...styles.actionMenuItem,
              ...(disabled ? styles.actionMenuItemDisabled : {}),
            }}
            onClick={() => {
              if (disabled) return;
              onView();
              onClose();
            }}
          >
            Voir
          </button>

          <button
            type="button"
            style={{
              ...styles.actionMenuItem,
              ...(disabled ? styles.actionMenuItemDisabled : {}),
            }}
            onClick={() => {
              if (disabled) return;
              onPrint();
              onClose();
            }}
          >
            Imprimer
          </button>

          <button
            type="button"
            style={styles.actionMenuItem}
            onClick={() => {
              onHistory();
              onClose();
            }}
          >
            Historique complet
          </button>
        </div>
      )}
    </div>
  );
}

export default function PepSuivi() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unites, setUnites] = useState<UniteRow[]>([]);
  const [archives, setArchives] = useState<PepArchiveRow[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<PepStatus>("soon");
  const [parcFilter, setParcFilter] = useState<ParcFilter>("internes");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerHtml, setViewerHtml] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyUnitId, setHistoryUnitId] = useState<string | null>(null);
  const [historyUnitNo, setHistoryUnitNo] = useState("");
  const [selectedHistoryArchiveId, setSelectedHistoryArchiveId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [unitesRes, archivesRes] = await Promise.all([
          supabase
            .from("unites")
            .select("id, no_unite, marque, modele, annee, statut, mode_comptable")
            .order("no_unite", { ascending: true }),
          supabase
            .from("pep_archives")
            .select(
              "id, unite_id, unite, date_pep, date_prochain, num_mecano, odometre, payload_json, signature_data_url, html_complet, pages_html, created_at"
            )
            .order("created_at", { ascending: false }),
        ]);

        if (!alive) return;

        if (unitesRes.error) throw unitesRes.error;
        if (archivesRes.error) throw archivesRes.error;

        setUnites((unitesRes.data ?? []) as UniteRow[]);
        setArchives((archivesRes.data ?? []) as PepArchiveRow[]);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Erreur lors du chargement du suivi PEP.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, []);

  const latestArchiveByUnit = useMemo(() => {
    const map = new Map<string, PepArchiveRow>();

    for (const row of archives) {
      if (!row.unite_id) continue;
      if (!map.has(row.unite_id)) {
        map.set(row.unite_id, row);
      }
    }

    return map;
  }, [archives]);

  const archivesByUnit = useMemo(() => {
    const map = new Map<string, PepArchiveRow[]>();

    for (const row of archives) {
      if (!row.unite_id) continue;
      if (!map.has(row.unite_id)) {
        map.set(row.unite_id, []);
      }
      map.get(row.unite_id)!.push(row);
    }

    return map;
  }, [archives]);

  const suiviItems = useMemo<PepSuiviItem[]>(() => {
    return unites.map((u) => {
      const latest = latestArchiveByUnit.get(u.id) ?? null;
      const externe = isUniteExterne(u.mode_comptable);
      const { status, daysRemaining } = getStatus(latest?.date_prochain ?? null, Boolean(latest));

      const description = [u.marque, u.modele, u.annee]
        .filter((x) => x !== null && x !== undefined && x !== "")
        .join(" ");

      return {
        unite_id: u.id,
        no_unite: u.no_unite,
        description: description || "—",
        statut_unite: u.statut ?? null,
        mode_comptable: u.mode_comptable ?? null,
        is_externe: externe,
        date_pep: latest?.date_pep ?? null,
        date_prochain: latest?.date_prochain ?? null,
        num_mecano: latest?.num_mecano ?? null,
        odometre: latest?.odometre ?? null,
        html_complet: latest?.html_complet ?? null,
        archive_id: latest?.id ?? null,
        status,
        daysRemaining,
      };
    });
  }, [unites, latestArchiveByUnit]);

  const parcFilteredItems = useMemo(() => {
    if (parcFilter === "tous") return suiviItems;
    if (parcFilter === "externes") {
      return suiviItems.filter((x) => isUniteExterne(x.mode_comptable));
    }
    return suiviItems.filter((x) => isUniteInterne(x.mode_comptable));
  }, [suiviItems, parcFilter]);

  const filteredItems = useMemo(() => {
    const q = normalize(search);

    let rows = parcFilteredItems.filter((item) => item.status === activeTab);

    if (q) {
      rows = rows.filter((item) => {
        return (
          normalize(item.no_unite).includes(q) ||
          normalize(item.description).includes(q) ||
          normalize(item.num_mecano).includes(q) ||
          normalize(item.statut_unite).includes(q) ||
          normalize(item.mode_comptable).includes(q)
        );
      });
    }

    rows.sort((a, b) => {
      if (a.status === "overdue" && b.status === "overdue") {
        return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0);
      }

      if (a.status === "soon" && b.status === "soon") {
        return (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999);
      }

      if (a.status === "missing" && b.status === "missing") {
        return a.no_unite.localeCompare(b.no_unite, "fr", { sensitivity: "base" });
      }

      return a.no_unite.localeCompare(b.no_unite, "fr", { sensitivity: "base" });
    });

    return rows;
  }, [parcFilteredItems, activeTab, search]);

  const counters = useMemo(() => {
    return {
      overdue: parcFilteredItems.filter((x) => x.status === "overdue").length,
      soon: parcFilteredItems.filter((x) => x.status === "soon").length,
      ok: parcFilteredItems.filter((x) => x.status === "ok").length,
      missing: parcFilteredItems.filter((x) => x.status === "missing").length,
    };
  }, [parcFilteredItems]);

  const historyArchives = useMemo(() => {
    if (!historyUnitId) return [];
    return archivesByUnit.get(historyUnitId) ?? [];
  }, [archivesByUnit, historyUnitId]);

  const selectedHistoryArchive = useMemo(() => {
    if (!selectedHistoryArchiveId) return null;
    return historyArchives.find((x) => x.id === selectedHistoryArchiveId) ?? null;
  }, [historyArchives, selectedHistoryArchiveId]);

  function openViewer(title: string, html: string) {
    if (!html) return;
    setViewerTitle(title);
    setViewerHtml(html);
    setViewerOpen(true);
  }

  function openHistory(item: PepSuiviItem) {
    setHistoryUnitId(item.unite_id);
    setHistoryUnitNo(item.no_unite);

    const rows = archivesByUnit.get(item.unite_id) ?? [];
    setSelectedHistoryArchiveId(rows[0]?.id ?? null);
    setHistoryOpen(true);
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Suivi PEP</h1>
          <div style={styles.subtitle}>
            Vue d’échéance des PEP avec fenêtre d’alerte à {SOON_DAYS} jours.
          </div>
        </div>
      </div>

      {error ? <div style={styles.alertError}>{error}</div> : null}

      <div style={styles.card}>
        <div style={styles.cardHeaderRow}>
          <span>Parc</span>

          <div style={styles.segmentWrap}>
            <button
              type="button"
              style={{
                ...styles.segmentBtn,
                ...(parcFilter === "internes" ? styles.segmentBtnActive : {}),
              }}
              onClick={() => setParcFilter("internes")}
            >
              Internes
            </button>

            <button
              type="button"
              style={{
                ...styles.segmentBtn,
                ...(parcFilter === "externes" ? styles.segmentBtnActive : {}),
              }}
              onClick={() => setParcFilter("externes")}
            >
              Externes
            </button>

            <button
              type="button"
              style={{
                ...styles.segmentBtn,
                ...(parcFilter === "tous" ? styles.segmentBtnActive : {}),
              }}
              onClick={() => setParcFilter("tous")}
            >
              Tous
            </button>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span>Vue d’ensemble</span>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.kpiGrid}>
            <button
              type="button"
              style={{
                ...styles.kpiCard,
                ...(activeTab === "overdue" ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveTab("overdue")}
            >
              <div style={styles.kpiTitle}>Passés dus</div>
              <div style={styles.kpiValue}>{counters.overdue}</div>
            </button>

            <button
              type="button"
              style={{
                ...styles.kpiCard,
                ...(activeTab === "soon" ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveTab("soon")}
            >
              <div style={styles.kpiTitle}>À venir ({SOON_DAYS} j)</div>
              <div style={styles.kpiValue}>{counters.soon}</div>
            </button>

            <button
              type="button"
              style={{
                ...styles.kpiCard,
                ...(activeTab === "ok" ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveTab("ok")}
            >
              <div style={styles.kpiTitle}>Conformes</div>
              <div style={styles.kpiValue}>{counters.ok}</div>
            </button>

            <button
              type="button"
              style={{
                ...styles.kpiCard,
                ...(activeTab === "missing" ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveTab("missing")}
            >
              <div style={styles.kpiTitle}>Sans PEP</div>
              <div style={styles.kpiValue}>{counters.missing}</div>
            </button>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeaderRow}>
          <span>
            {activeTab === "overdue" && "PEP passés dus"}
            {activeTab === "soon" && `PEP à venir dans ${SOON_DAYS} jours`}
            {activeTab === "ok" && "PEP conformes"}
            {activeTab === "missing" && "Unités sans PEP"}
          </span>

          <div style={styles.searchWrap}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une unité"
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.cardBody}>
          {loading ? (
            <div style={styles.alertInfo}>Chargement du suivi PEP…</div>
          ) : filteredItems.length === 0 ? (
            <div style={styles.alertInfo}>Aucun résultat.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Unité</th>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Mode comptable</th>
                    <th style={styles.th}>Dernier PEP</th>
                    <th style={styles.th}>Prochaine inspection</th>
                    <th style={styles.th}>No mécano</th>
                    <th style={styles.th}>Statut</th>
                    <th style={styles.thRight}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.unite_id}>
                      <td style={styles.tdStrong}>{item.no_unite}</td>
                      <td style={styles.td}>{item.description}</td>
                      <td style={styles.td}>{modeComptableLabel(item.mode_comptable)}</td>
                      <td style={styles.td}>{formatDate(item.date_pep)}</td>
                      <td style={styles.td}>{formatDate(item.date_prochain)}</td>
                      <td style={styles.td}>{item.num_mecano || "—"}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...statusBadgeStyle(item.status),
                          }}
                        >
                          {statusLabel(item.status, item.daysRemaining)}
                        </span>
                      </td>
                      <td style={styles.tdRight}>
                        <ActionMenu
                          item={item}
                          open={openMenuId === item.unite_id}
                          onToggle={() =>
                            setOpenMenuId((prev) => (prev === item.unite_id ? null : item.unite_id))
                          }
                          onClose={() => setOpenMenuId(null)}
                          onView={() =>
                            openViewer(`PEP unité ${item.no_unite}`, item.html_complet || "")
                          }
                          onPrint={() => {
                            if (!item.html_complet) return;
                            printHtmlDocument(item.html_complet);
                          }}
                          onHistory={() => openHistory(item)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {viewerOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.viewerModalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{viewerTitle}</div>

              <div style={styles.modalHeaderActions}>
                <button
                  type="button"
                  style={styles.btnSecondary}
                  onClick={() => printHtmlDocument(viewerHtml)}
                >
                  Imprimer
                </button>

                <button
                  type="button"
                  style={styles.btnSecondary}
                  onClick={() => setViewerOpen(false)}
                >
                  Fermer
                </button>
              </div>
            </div>

            <div style={styles.viewerModalBody}>
              <iframe title={viewerTitle} srcDoc={viewerHtml} style={styles.viewerFrame} />
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.historyModalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Historique complet • unité {historyUnitNo}</div>

              <div style={styles.modalHeaderActions}>
                <button
                  type="button"
                  style={styles.btnSecondary}
                  onClick={() => setHistoryOpen(false)}
                >
                  Fermer
                </button>
              </div>
            </div>

            <div style={styles.historyLayout}>
              <div style={styles.historySidebar}>
                {historyArchives.length === 0 ? (
                  <div style={styles.alertInfo}>Aucune fiche archivée.</div>
                ) : (
                  historyArchives.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      style={{
                        ...styles.historyItem,
                        ...(selectedHistoryArchiveId === row.id
                          ? styles.historyItemActive
                          : {}),
                      }}
                      onClick={() => setSelectedHistoryArchiveId(row.id)}
                    >
                      <div style={styles.historyItemTitle}>
                        PEP du {formatDate(row.date_pep)}
                      </div>
                      <div style={styles.historyItemSub}>
                        Prochaine: {formatDate(row.date_prochain)}
                      </div>
                      <div style={styles.historyItemSub}>
                        Mécano: {row.num_mecano || "—"}
                      </div>
                      <div style={styles.historyItemSub}>
                        Archivé: {formatDateTime(row.created_at)}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div style={styles.historyMain}>
                {!selectedHistoryArchive ? (
                  <div style={styles.alertInfo}>Sélectionne une fiche.</div>
                ) : (
                  <>
                    <div style={styles.historyActions}>
                      <button
                        type="button"
                        style={styles.btnSecondary}
                        onClick={() =>
                          openViewer(
                            `PEP unité ${historyUnitNo} • ${formatDate(selectedHistoryArchive.date_pep)}`,
                            selectedHistoryArchive.html_complet || ""
                          )
                        }
                      >
                        Voir
                      </button>

                      <button
                        type="button"
                        style={styles.btnSecondary}
                        onClick={() =>
                          printHtmlDocument(selectedHistoryArchive.html_complet || "")
                        }
                      >
                        Imprimer
                      </button>
                    </div>

                    <iframe
                      title={`Historique PEP ${historyUnitNo}`}
                      srcDoc={selectedHistoryArchive.html_complet || ""}
                      style={styles.historyPreviewFrame}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 16,
    display: "grid",
    gap: 16,
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6b7280",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
  },
  cardHeader: {
    padding: "12px 14px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 800,
    color: "#111827",
  },
  cardHeaderRow: {
    padding: "12px 14px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 800,
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  cardBody: {
    padding: 14,
    display: "grid",
    gap: 14,
  },
  segmentWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  segmentBtn: {
    minHeight: 38,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#374151",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
  },
  segmentBtnActive: {
    border: "1px solid #1d4ed8",
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  kpiCard: {
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    borderRadius: 12,
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
  },
  kpiCardActive: {
    outline: "2px solid #1d4ed8",
    outlineOffset: 0,
  },
  kpiTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1e3a8a",
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 800,
    color: "#111827",
    lineHeight: 1,
  },
  searchWrap: {
    width: 320,
    maxWidth: "100%",
  },
  input: {
    width: "100%",
    minHeight: 42,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    padding: "0 12px",
    fontSize: 14,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1080,
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 12,
    color: "#6b7280",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    padding: "10px 12px",
    fontSize: 12,
    color: "#6b7280",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: 14,
    color: "#111827",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "10px 12px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: 14,
    color: "#111827",
    fontWeight: 800,
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "10px 12px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: 14,
    color: "#111827",
    verticalAlign: "middle",
    textAlign: "right",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  alertError: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  alertInfo: {
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1e3a8a",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  actionWrap: {
    position: "relative",
    display: "inline-block",
  },
  actionBtn: {
    width: 42,
    height: 38,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 18,
  },
  actionMenu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    minWidth: 180,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 18px 45px rgba(0,0,0,0.16)",
    padding: 6,
    zIndex: 1000,
    display: "grid",
    gap: 4,
  },
  actionMenuItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 600,
  },
  actionMenuItemDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10000,
  },
  viewerModalCard: {
    width: "100%",
    maxWidth: 1200,
    height: "90vh",
    background: "#fff",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,.08)",
    boxShadow: "0 24px 60px rgba(0,0,0,.18)",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "auto 1fr",
  },
  historyModalCard: {
    width: "100%",
    maxWidth: 1380,
    height: "90vh",
    background: "#fff",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,.08)",
    boxShadow: "0 24px 60px rgba(0,0,0,.18)",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "auto 1fr",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 16px",
    borderBottom: "1px solid rgba(0,0,0,.08)",
    background: "#f8fafc",
  },
  modalTitle: {
    fontWeight: 800,
    color: "#111827",
    fontSize: 18,
  },
  modalHeaderActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  viewerModalBody: {
    padding: 0,
    overflow: "hidden",
  },
  viewerFrame: {
    width: "100%",
    height: "100%",
    border: "none",
    background: "#fff",
    display: "block",
  },
  historyLayout: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    minHeight: 0,
    height: "100%",
  },
  historySidebar: {
    borderRight: "1px solid #e5e7eb",
    padding: 12,
    overflowY: "auto",
    display: "grid",
    gap: 10,
    alignContent: "start",
    background: "#fafafa",
  },
  historyMain: {
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: 12,
    padding: 12,
  },
  historyItem: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 12,
    padding: 12,
    cursor: "pointer",
    display: "grid",
    gap: 4,
  },
  historyItemActive: {
    border: "1px solid #1d4ed8",
    background: "#eff6ff",
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
  },
  historyItemSub: {
    fontSize: 12,
    color: "#6b7280",
  },
  historyActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  historyPreviewFrame: {
    width: "100%",
    height: "100%",
    minHeight: 400,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
  },
  btnSecondary: {
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
};