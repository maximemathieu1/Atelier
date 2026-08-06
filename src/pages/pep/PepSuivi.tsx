import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type UniteRow = {
  id: string;
  no_unite: string;
  actif: boolean;
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

type EntretienHistoriqueRow = {
  id: string;
  unite_id: string;
  template_item_id: string | null;
  bt_id: string | null;
  nom_snapshot: string | null;
  date_effectuee: string | null;
  km_effectue: number | null;
  note: string | null;
  created_at?: string | null;
};

type PepStatus = "overdue" | "soon" | "ok" | "missing";
type ParcFilter = "internes" | "externes" | "tous";
type PepSource = "archive" | "historique" | "none";

type PepLatest = {
  source: PepSource;
  source_id: string | null;
  date_pep: string | null;
  date_prochain: string | null;
  num_mecano: string | null;
  odometre: string | null;
  html_complet: string | null;
  created_at: string | null;
};

type PepSuiviItem = {
  unite_id: string;
  no_unite: string;
  description: string;
  statut_unite: string | null;
  mode_comptable: string | null;
  is_externe: boolean;
  source: PepSource;
  date_pep: string | null;
  date_prochain: string | null;
  num_mecano: string | null;
  odometre: string | null;
  html_complet: string | null;
  archive_id: string | null;
  status: PepStatus;
  daysRemaining: number | null;
};

type HistoryEntry = {
  id: string;
  source: PepSource;
  date_pep: string | null;
  date_prochain: string | null;
  num_mecano: string | null;
  odometre: string | null;
  html_complet: string | null;
  created_at: string | null;
  label: string;
};

const SOON_DAYS = 15;
const PEP_TEMPLATE_ID = "d71006cc-cfd7-4e49-83dd-918ee4201b89";

function todayLocalIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const clean = String(dateStr).slice(0, 10);
  const d = new Date(`${clean}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function addDaysIso(dateStr: string | null | undefined, days: number): string | null {
  const d = parseIsoDate(dateStr);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function compareDateDesc(a: string | null | undefined, b: string | null | undefined): number {
  const da = parseIsoDate(a)?.getTime() ?? 0;
  const db = parseIsoDate(b)?.getTime() ?? 0;
  return db - da;
}

function isUniteExterne(modeComptable: string | null | undefined): boolean {
  return normalize(modeComptable) === "externe";
}

function isUniteInterne(modeComptable: string | null | undefined): boolean {
  const s = normalize(modeComptable);
  return s === "interne" || s === "interne_ta";
}

function getStatus(
  dateProchain: string | null,
  hasPep: boolean
): { status: PepStatus; daysRemaining: number | null } {
  if (!hasPep) {
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

function sourceLabel(source: PepSource): string {
  if (source === "archive") return "PEP archivé";
  if (source === "historique") return "Historique manuel";
  return "—";
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
  const [historiques, setHistoriques] = useState<EntretienHistoriqueRow[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Exclude<PepStatus, "missing">>("soon");
  const [parcFilter, setParcFilter] = useState<ParcFilter>("internes");
  const [showMissing, setShowMissing] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerHtml, setViewerHtml] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyUnitId, setHistoryUnitId] = useState<string | null>(null);
  const [historyUnitNo, setHistoryUnitNo] = useState("");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [unitesRes, archivesRes, historiquesRes] = await Promise.all([
          supabase
            .from("unites")
            .select("id, no_unite, actif, marque, modele, annee, statut, mode_comptable")
            .eq("actif", true)
            .order("no_unite", { ascending: true }),
          supabase
            .from("pep_archives")
            .select(
              "id, unite_id, unite, date_pep, date_prochain, num_mecano, odometre, payload_json, signature_data_url, html_complet, pages_html, created_at"
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("unite_entretien_historique")
            .select("id, unite_id, template_item_id, bt_id, nom_snapshot, date_effectuee, km_effectue, note, created_at")
            .eq("template_item_id", PEP_TEMPLATE_ID)
            .order("date_effectuee", { ascending: false }),
        ]);

        if (!alive) return;

        if (unitesRes.error) throw unitesRes.error;
        if (archivesRes.error) throw archivesRes.error;
        if (historiquesRes.error) throw historiquesRes.error;

        setUnites((unitesRes.data ?? []) as UniteRow[]);
        setArchives((archivesRes.data ?? []) as PepArchiveRow[]);
        setHistoriques((historiquesRes.data ?? []) as EntretienHistoriqueRow[]);
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
      const current = map.get(row.unite_id);
      if (!current || compareDateDesc(row.date_pep || row.created_at, current.date_pep || current.created_at) < 0) {
        map.set(row.unite_id, row);
      }
    }

    return map;
  }, [archives]);

  const latestHistoriqueByUnit = useMemo(() => {
    const map = new Map<string, EntretienHistoriqueRow>();

    for (const row of historiques) {
      if (!row.unite_id) continue;
      const current = map.get(row.unite_id);
      if (!current || compareDateDesc(row.date_effectuee, current.date_effectuee) < 0) {
        map.set(row.unite_id, row);
      }
    }

    return map;
  }, [historiques]);

  const latestPepByUnit = useMemo(() => {
    const map = new Map<string, PepLatest>();

    for (const u of unites) {
      const archive = latestArchiveByUnit.get(u.id) ?? null;
      const hist = latestHistoriqueByUnit.get(u.id) ?? null;

      const archiveDate = dateOnly(archive?.date_pep || archive?.created_at);
      const histDate = dateOnly(hist?.date_effectuee);

      if (archive && (!histDate || (archiveDate && compareDateDesc(archiveDate, histDate) <= 0))) {
        map.set(u.id, {
          source: "archive",
          source_id: archive.id,
          date_pep: archiveDate,
          date_prochain: dateOnly(archive.date_prochain) || addDaysIso(archiveDate, 90),
          num_mecano: archive.num_mecano ?? null,
          odometre: archive.odometre ?? null,
          html_complet: archive.html_complet ?? null,
          created_at: archive.created_at ?? null,
        });
        continue;
      }

      if (hist) {
        map.set(u.id, {
          source: "historique",
          source_id: hist.id,
          date_pep: histDate,
          date_prochain: addDaysIso(histDate, 90),
          num_mecano: null,
          odometre: hist.km_effectue != null ? String(hist.km_effectue) : null,
          html_complet: null,
          created_at: hist.created_at ?? null,
        });
        continue;
      }

      map.set(u.id, {
        source: "none",
        source_id: null,
        date_pep: null,
        date_prochain: null,
        num_mecano: null,
        odometre: null,
        html_complet: null,
        created_at: null,
      });
    }

    return map;
  }, [unites, latestArchiveByUnit, latestHistoriqueByUnit]);

  const historyEntriesByUnit = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();

    for (const row of archives) {
      if (!row.unite_id) continue;
      const entry: HistoryEntry = {
        id: `archive-${row.id}`,
        source: "archive",
        date_pep: dateOnly(row.date_pep || row.created_at),
        date_prochain: dateOnly(row.date_prochain) || addDaysIso(row.date_pep, 90),
        num_mecano: row.num_mecano ?? null,
        odometre: row.odometre ?? null,
        html_complet: row.html_complet ?? null,
        created_at: row.created_at ?? null,
        label: "PEP archivé",
      };
      if (!map.has(row.unite_id)) map.set(row.unite_id, []);
      map.get(row.unite_id)!.push(entry);
    }

    for (const row of historiques) {
      if (!row.unite_id) continue;
      const doneDate = dateOnly(row.date_effectuee);
      const entry: HistoryEntry = {
        id: `historique-${row.id}`,
        source: "historique",
        date_pep: doneDate,
        date_prochain: addDaysIso(doneDate, 90),
        num_mecano: null,
        odometre: row.km_effectue != null ? String(row.km_effectue) : null,
        html_complet: null,
        created_at: row.created_at ?? null,
        label: row.note || row.nom_snapshot || "Historique manuel",
      };
      if (!map.has(row.unite_id)) map.set(row.unite_id, []);
      map.get(row.unite_id)!.push(entry);
    }

    for (const [unitId, rows] of map.entries()) {
      const unique = Array.from(
        new Map(rows.map((r) => [`${r.source}-${r.date_pep}-${r.odometre}-${r.num_mecano}`, r])).values()
      );
      unique.sort((a, b) => compareDateDesc(a.date_pep, b.date_pep));
      map.set(unitId, unique);
    }

    return map;
  }, [archives, historiques]);

  const suiviItems = useMemo<PepSuiviItem[]>(() => {
    return unites.map((u) => {
      const latest = latestPepByUnit.get(u.id) ?? null;
      const externe = isUniteExterne(u.mode_comptable);
      const hasPep = Boolean(latest && latest.source !== "none" && latest.date_pep);
      const { status, daysRemaining } = getStatus(latest?.date_prochain ?? null, hasPep);

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
        source: latest?.source ?? "none",
        date_pep: latest?.date_pep ?? null,
        date_prochain: latest?.date_prochain ?? null,
        num_mecano: latest?.num_mecano ?? null,
        odometre: latest?.odometre ?? null,
        html_complet: latest?.html_complet ?? null,
        archive_id: latest?.source === "archive" ? latest.source_id : null,
        status,
        daysRemaining,
      };
    });
  }, [unites, latestPepByUnit]);

  const parcFilteredItems = useMemo(() => {
    if (parcFilter === "tous") return suiviItems;
    if (parcFilter === "externes") {
      return suiviItems.filter((x) => isUniteExterne(x.mode_comptable));
    }
    return suiviItems.filter((x) => isUniteInterne(x.mode_comptable));
  }, [suiviItems, parcFilter]);

  const counters = useMemo(() => {
    return {
      overdue: parcFilteredItems.filter((x) => x.status === "overdue").length,
      soon: parcFilteredItems.filter((x) => x.status === "soon").length,
      ok: parcFilteredItems.filter((x) => x.status === "ok").length,
      missing: parcFilteredItems.filter((x) => x.status === "missing").length,
    };
  }, [parcFilteredItems]);

  const visibleMainItems = useMemo(() => {
    const q = normalize(search);

    let rows = parcFilteredItems.filter((item) => item.status === activeTab);

    if (q) {
      rows = rows.filter((item) => {
        return (
          normalize(item.no_unite).includes(q) ||
          normalize(item.description).includes(q) ||
          normalize(item.num_mecano).includes(q) ||
          normalize(item.statut_unite).includes(q) ||
          normalize(item.mode_comptable).includes(q) ||
          normalize(sourceLabel(item.source)).includes(q)
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

      if (a.status === "ok" && b.status === "ok") {
        return compareDateDesc(a.date_prochain, b.date_prochain);
      }

      return a.no_unite.localeCompare(b.no_unite, "fr", { sensitivity: "base" });
    });

    return rows;
  }, [parcFilteredItems, activeTab, search]);

  const missingItems = useMemo(() => {
    const q = normalize(search);

    let rows = parcFilteredItems.filter((item) => item.status === "missing");

    if (q) {
      rows = rows.filter((item) => {
        return normalize(item.no_unite).includes(q) || normalize(item.description).includes(q);
      });
    }

    rows.sort((a, b) => a.no_unite.localeCompare(b.no_unite, "fr", { sensitivity: "base" }));
    return rows;
  }, [parcFilteredItems, search]);

  const historyEntries = useMemo(() => {
    if (!historyUnitId) return [];
    return historyEntriesByUnit.get(historyUnitId) ?? [];
  }, [historyEntriesByUnit, historyUnitId]);

  const selectedHistoryEntry = useMemo(() => {
    if (!selectedHistoryId) return null;
    return historyEntries.find((x) => x.id === selectedHistoryId) ?? null;
  }, [historyEntries, selectedHistoryId]);

  function openViewer(title: string, html: string) {
    if (!html) return;
    setViewerTitle(title);
    setViewerHtml(html);
    setViewerOpen(true);
  }

  function openHistory(item: PepSuiviItem) {
    setHistoryUnitId(item.unite_id);
    setHistoryUnitNo(item.no_unite);

    const rows = historyEntriesByUnit.get(item.unite_id) ?? [];
    setSelectedHistoryId(rows[0]?.id ?? null);
    setHistoryOpen(true);
  }

  function renderPepTable(items: PepSuiviItem[]) {
    return (
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Unité</th>
              <th style={styles.th}>Description</th>
              <th style={styles.th}>Dernier PEP</th>
              <th style={styles.th}>Prochaine inspection</th>
              <th style={styles.th}>No mécano</th>
              <th style={styles.th}>Jours restants</th>
              <th style={styles.thRight}>Action</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.unite_id} style={styles.tr}>
                <td style={styles.tdStrong}>{item.no_unite}</td>
                <td style={styles.td}>{item.description}</td>
                <td style={styles.td}>{formatDate(item.date_pep)}</td>
                <td style={styles.td}>{formatDate(item.date_prochain)}</td>
                <td style={styles.td}>{item.num_mecano || "—"}</td>
                <td
  style={{
    ...styles.td,
    fontWeight: 800,
    color: "#111827",
  }}
>
  {item.daysRemaining == null
    ? "—"
    : `${item.daysRemaining} j`}
</td>
                <td style={styles.tdRight}>
                  <ActionMenu
                    item={item}
                    open={openMenuId === item.unite_id}
                    onToggle={() =>
                      setOpenMenuId((prev) =>
                        prev === item.unite_id ? null : item.unite_id
                      )
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
    );
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

        <div style={styles.softFilters}>
          <button
            type="button"
            style={{
              ...styles.softFilterBtn,
              ...(parcFilter === "internes" ? styles.softFilterBtnActive : {}),
            }}
            onClick={() => setParcFilter("internes")}
          >
            Internes
          </button>
          <span style={styles.filterDot}>•</span>
          <button
            type="button"
            style={{
              ...styles.softFilterBtn,
              ...(parcFilter === "externes" ? styles.softFilterBtnActive : {}),
            }}
            onClick={() => setParcFilter("externes")}
          >
            Externes
          </button>
          <span style={styles.filterDot}>•</span>
          <button
            type="button"
            style={{
              ...styles.softFilterBtn,
              ...(parcFilter === "tous" ? styles.softFilterBtnActive : {}),
            }}
            onClick={() => setParcFilter("tous")}
          >
            Tous
          </button>
        </div>
      </div>

      {error ? <div style={styles.alertError}>{error}</div> : null}

      <div style={styles.kpiGrid}>
        <button
          type="button"
          style={{
            ...styles.kpiCard,
            ...(activeTab === "overdue" ? styles.kpiCardActive : {}),
          }}
          onClick={() => setActiveTab("overdue")}
        >
          <div style={{ ...styles.kpiAccent, background: "#ef4444" }} />
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
          <div style={{ ...styles.kpiAccent, background: "#f59e0b" }} />
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
          <div style={{ ...styles.kpiAccent, background: "#10b981" }} />
          <div style={styles.kpiTitle}>Conformes</div>
          <div style={styles.kpiValue}>{counters.ok}</div>
        </button>
      </div>

      <div style={styles.utilityRow}>
        <button
          type="button"
          style={styles.missingToggle}
          onClick={() => setShowMissing((v) => !v)}
        >
          {showMissing ? "Masquer les unités sans PEP" : `Afficher les unités sans PEP (${counters.missing})`}
        </button>

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

      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>
              {activeTab === "overdue" && "PEP passés dus"}
              {activeTab === "soon" && `PEP à venir dans ${SOON_DAYS} jours`}
              {activeTab === "ok" && "PEP conformes"}
            </div>
            <div style={styles.sectionSub}>Suivi opérationnel du parc sélectionné.</div>
          </div>
        </div>

        {loading ? (
          <div style={styles.alertInfo}>Chargement du suivi PEP…</div>
        ) : visibleMainItems.length === 0 ? (
          <div style={styles.alertInfo}>Aucun résultat.</div>
        ) : (
          renderPepTable(visibleMainItems)
        )}
      </div>

      {showMissing && (
        <div style={styles.sectionCardMuted}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionTitle}>Unités sans PEP</div>
              <div style={styles.sectionSub}>Liste occasionnelle pour nettoyage ou configuration.</div>
            </div>
          </div>

          {missingItems.length === 0 ? (
            <div style={styles.alertInfo}>Aucune unité sans PEP.</div>
          ) : (
            renderPepTable(missingItems)
          )}
        </div>
      )}

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
                {historyEntries.length === 0 ? (
                  <div style={styles.alertInfo}>Aucun historique.</div>
                ) : (
                  historyEntries.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      style={{
                        ...styles.historyItem,
                        ...(selectedHistoryId === row.id ? styles.historyItemActive : {}),
                      }}
                      onClick={() => setSelectedHistoryId(row.id)}
                    >
                      <div style={styles.historyItemTitle}>
                        PEP du {formatDate(row.date_pep)}
                      </div>
                      <div style={styles.historyItemSub}>Source: {sourceLabel(row.source)}</div>
                      <div style={styles.historyItemSub}>
                        Prochaine: {formatDate(row.date_prochain)}
                      </div>
                      <div style={styles.historyItemSub}>Mécano: {row.num_mecano || "—"}</div>
                      <div style={styles.historyItemSub}>KM: {row.odometre || "—"}</div>
                      <div style={styles.historyItemSub}>Ajouté: {formatDateTime(row.created_at)}</div>
                    </button>
                  ))
                )}
              </div>

              <div style={styles.historyMain}>
                {!selectedHistoryEntry ? (
                  <div style={styles.alertInfo}>Sélectionne une fiche.</div>
                ) : selectedHistoryEntry.html_complet ? (
                  <>
                    <div style={styles.historyActions}>
                      <button
                        type="button"
                        style={styles.btnSecondary}
                        onClick={() =>
                          openViewer(
                            `PEP unité ${historyUnitNo} • ${formatDate(selectedHistoryEntry.date_pep)}`,
                            selectedHistoryEntry.html_complet || ""
                          )
                        }
                      >
                        Voir
                      </button>

                      <button
                        type="button"
                        style={styles.btnSecondary}
                        onClick={() => printHtmlDocument(selectedHistoryEntry.html_complet || "")}
                      >
                        Imprimer
                      </button>
                    </div>

                    <iframe
                      title={`Historique PEP ${historyUnitNo}`}
                      srcDoc={selectedHistoryEntry.html_complet || ""}
                      style={styles.historyPreviewFrame}
                    />
                  </>
                ) : (
                  <div style={styles.manualHistoryBox}>
                    <div style={styles.manualHistoryTitle}>Entrée d’historique manuel</div>
                    <div style={styles.manualHistoryLine}>Date PEP : {formatDate(selectedHistoryEntry.date_pep)}</div>
                    <div style={styles.manualHistoryLine}>Prochaine inspection : {formatDate(selectedHistoryEntry.date_prochain)}</div>
                    <div style={styles.manualHistoryLine}>KM : {selectedHistoryEntry.odometre || "—"}</div>
                    <div style={styles.manualHistoryNote}>
                      Cette entrée est considérée dans le suivi PEP, mais elle ne contient pas de PDF généré par le module PEP.
                    </div>
                  </div>
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
  softFilters: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
  },
  softFilterBtn: {
    border: "none",
    background: "transparent",
    color: "#6b7280",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    padding: "4px 6px",
    borderRadius: 999,
  },
  softFilterBtnActive: {
    color: "#1d4ed8",
    background: "#eff6ff",
  },
  filterDot: {
    color: "#cbd5e1",
    fontWeight: 900,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  kpiCard: {
    position: "relative",
    overflow: "hidden",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 14,
    padding: "20px 18px 16px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  kpiCardActive: {
    outline: "2px solid #2563eb",
    outlineOffset: 0,
  },
  kpiAccent: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 12,
    height: 5,
    borderRadius: 999,
  },
  kpiTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
    marginTop: 10,
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: 900,
    color: "#111827",
    lineHeight: 1,
  },
  utilityRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  missingToggle: {
    border: "none",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    padding: 0,
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
  sectionCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 14,
  },
  sectionCardMuted: {
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 14,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#111827",
  },
  sectionSub: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },

  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#ffffff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#ffffff",
    minWidth: 900,
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: 13,
    fontWeight: 800,
    color: "#64748b",
    borderBottom: "1px solid #e5e7eb",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    padding: "14px 16px",
    fontSize: 13,
    fontWeight: 800,
    color: "#64748b",
    borderBottom: "1px solid #e5e7eb",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #f1f5f9",
  },
  td: {
    padding: "14px 16px",
    fontSize: 14,
    color: "#111827",
    fontWeight: 600,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  tdStrong: {
    padding: "14px 16px",
    fontSize: 16,
    color: "#111827",
    fontWeight: 900,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  tdRight: {
    padding: "10px 16px",
    textAlign: "right",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
    gap: 12,
  },
  pepCard: {
    position: "relative",
    overflow: "visible",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "16px 14px 14px",
    display: "grid",
    gap: 14,
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  pepCardAccent: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 10,
    height: 4,
    borderRadius: 999,
  },
  pepCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 6,
  },
  unitNo: {
    fontSize: 17,
    fontWeight: 900,
    color: "#111827",
  },
  unitDesc: {
    marginTop: 2,
    fontSize: 13,
    color: "#475569",
    fontWeight: 600,
  },
  cardMetaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  metaLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  metaValue: {
    marginTop: 3,
    fontSize: 14,
    color: "#111827",
    fontWeight: 800,
  },
  pepCardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  sourceTag: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
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
    fontWeight: 900,
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
    fontWeight: 700,
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
    fontWeight: 900,
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
    fontWeight: 900,
    color: "#111827",
  },
  historyItemSub: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 600,
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
  manualHistoryBox: {
    alignSelf: "start",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 14,
    padding: 16,
    display: "grid",
    gap: 8,
  },
  manualHistoryTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#111827",
  },
  manualHistoryLine: {
    fontSize: 14,
    color: "#334155",
    fontWeight: 700,
  },
  manualHistoryNote: {
    marginTop: 8,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1e3a8a",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: 700,
  },
  btnSecondary: {
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
};