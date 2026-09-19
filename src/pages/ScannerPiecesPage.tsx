import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";

type WorkOrder = {
  id: string;
  numero: string;
  unite: string;
  openedAt: string | null;
};

type InventoryPart = {
  id: string;
  barcode: string;
  description: string;
  partNumber: string | null;
  unite: string | null;
  suiviActif: boolean;
};

type ScannedPart = InventoryPart & {
  key: string;
  quantity: number;
  isManual: boolean;
};

type Notice =
  | { type: "success" | "error" | "warning"; message: string }
  | null;

type ApiResponse<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
};

async function scannerApi<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("scanner-pieces-api", {
    body: { action, ...payload },
  });

  if (error) throw error;

  const res = (data || {}) as ApiResponse<T>;
  if (res.ok === false) throw new Error(res.error || "Erreur scanner.");
  return res.data as T;
}

function formatOpenedDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default function ScannerPiecesPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingBts, setLoadingBts] = useState(true);
  const [btError, setBtError] = useState("");
  const [search, setSearch] = useState("");

  const [selectedBt, setSelectedBt] = useState<WorkOrder | null>(null);
  const [scanValue, setScanValue] = useState("");
  const [parts, setParts] = useState<ScannedPart[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingBarcodeRef = useRef<string>("");

  useEffect(() => {
    void loadBts();

    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedBt) return;
    const timer = window.setTimeout(() => scanInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [selectedBt]);

  async function loadBts() {
    setLoadingBts(true);
    setBtError("");

    try {
      const rows = await scannerApi<WorkOrder[]>("list_open_bts");
      setWorkOrders(rows || []);
    } catch (e: any) {
      console.error(e);
      setBtError(e?.message || "Impossible de charger les BT.");
      setWorkOrders([]);
    } finally {
      setLoadingBts(false);
    }
  }

  function showNotice(next: Notice, ms = 2200) {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(next);

    if (next) {
      noticeTimerRef.current = setTimeout(() => setNotice(null), ms);
    }
  }

  const filteredBts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = q
      ? workOrders.filter(
          (bt) =>
            bt.numero.toLowerCase().includes(q) ||
            bt.unite.toLowerCase().includes(q),
        )
      : workOrders;

    return source.slice(0, 50);
  }, [workOrders, search]);

  const totalArticles = useMemo(
    () => parts.reduce((sum, row) => sum + row.quantity, 0),
    [parts],
  );

  const hasIncompleteManual = useMemo(
    () => parts.some((p) => p.isManual && !p.description.trim()),
    [parts],
  );

  function chooseBt(bt: WorkOrder) {
    setSelectedBt(bt);
    setParts([]);
    setScanValue("");
    setNotice(null);
  }

  async function processBarcode(rawCode: string) {
    const barcode = rawCode.trim();

    if (!barcode || scanBusy || saving) return;
    if (processingBarcodeRef.current === barcode) return;

    processingBarcodeRef.current = barcode;
    setScanValue("");
    setScanBusy(true);

    try {
      const part = await scannerApi<InventoryPart | null>("lookup_part", {
        barcode,
      });

      if (!part) {
        const key = `manual:${barcode.toLowerCase()}`;

        setParts((current) => {
          const found = current.find((row) => row.key === key);

          if (found) {
            return current.map((row) =>
              row.key === key ? { ...row, quantity: row.quantity + 1 } : row,
            );
          }

          return [
            {
              key,
              id: "",
              barcode,
              description: "",
              partNumber: barcode,
              unite: null,
              suiviActif: false,
              quantity: 1,
              isManual: true,
            },
            ...current,
          ];
        });

        showNotice(
          {
            type: "warning",
            message: `${barcode} non inventorié — entre une description.`,
          },
          3200,
        );

        navigator.vibrate?.([80, 40, 80]);
        return;
      }

      if (part.suiviActif) {
        showNotice(
          {
            type: "warning",
            message: `${part.partNumber || barcode} est une pièce suivie. Ajoute-la depuis le BT.`,
          },
          4000,
        );
        navigator.vibrate?.([120, 60, 120]);
        return;
      }

      const key = `inventory:${part.id}`;

      setParts((current) => {
        const found = current.find((row) => row.key === key);

        if (found) {
          return current.map((row) =>
            row.key === key ? { ...row, quantity: row.quantity + 1 } : row,
          );
        }

        return [{ ...part, key, quantity: 1, isManual: false }, ...current];
      });

      showNotice({
        type: "success",
        message: `${part.description} ajouté`,
      });
      navigator.vibrate?.(70);
    } catch (err: any) {
      showNotice(
        { type: "error", message: err?.message || "Erreur pendant le scan." },
        3500,
      );
      navigator.vibrate?.([150, 70, 150]);
    } finally {
      setScanBusy(false);
      processingBarcodeRef.current = "";
      window.setTimeout(() => scanInputRef.current?.focus(), 20);
    }
  }

  async function handleScan(e: FormEvent) {
    e.preventDefault();

    if (scanDebounceRef.current) {
      clearTimeout(scanDebounceRef.current);
      scanDebounceRef.current = null;
    }

    await processBarcode(scanValue);
  }

  function handleScanValueChange(value: string) {
    setScanValue(value);

    if (scanDebounceRef.current) {
      clearTimeout(scanDebounceRef.current);
    }

    const clean = value.trim();
    if (!clean) return;

    // Plusieurs scanners Android injectent le code comme clavier mais
    // n'envoient pas toujours ENTER. Après une courte pause, on considère
    // que le scan est terminé et on le traite automatiquement.
    scanDebounceRef.current = setTimeout(() => {
      void processBarcode(clean);
    }, 180);
  }

  function decrementPart(key: string) {
    setParts((current) =>
      current
        .map((row) =>
          row.key === key ? { ...row, quantity: row.quantity - 1 } : row,
        )
        .filter((row) => row.quantity > 0),
    );
    window.setTimeout(() => scanInputRef.current?.focus(), 20);
  }

  function updateManualDescription(key: string, value: string) {
    setParts((current) =>
      current.map((row) =>
        row.key === key ? { ...row, description: value } : row,
      ),
    );
  }

  function cancelSession() {
    if (parts.length && !window.confirm("Annuler tous les scans courants ?")) {
      return;
    }

    setSelectedBt(null);
    setParts([]);
    setScanValue("");
    setNotice(null);
  }

  async function finishSession() {
    if (!selectedBt || !parts.length || saving || hasIncompleteManual) return;

    setSaving(true);

    try {
      await scannerApi("commit_parts", {
        btId: selectedBt.id,
        parts: parts.map((part) => ({
          inventoryItemId: part.isManual ? null : part.id,
          sku: part.partNumber || part.barcode,
          description: part.description.trim(),
          quantity: part.quantity,
          isManual: part.isManual,
        })),
      });

      navigator.vibrate?.([60, 40, 60]);
      setParts([]);
      setSelectedBt(null);
      setScanValue("");
      setNotice(null);
      await loadBts();
    } catch (e: any) {
      showNotice(
        { type: "error", message: e?.message || "Erreur enregistrement." },
        4500,
      );
    } finally {
      setSaving(false);
    }
  }

  const s: Record<string, CSSProperties> = {
    page: {
      minHeight: "100dvh",
      background: "#f4f6f8",
      color: "#111827",
      fontFamily:
        'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: "flex",
      justifyContent: "center",
    },
    shell: {
      width: "100%",
      maxWidth: 560,
      minHeight: "100dvh",
      background: "#f4f6f8",
      padding: 14,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
    },
    headerCard: {
      background: "#fff",
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 8px 24px rgba(15,23,42,.06)",
    },
    title: {
      margin: 0,
      fontSize: 28,
      lineHeight: 1.1,
      fontWeight: 950,
      letterSpacing: "-.02em",
    },
    subtitle: {
      marginTop: 5,
      fontSize: 14,
      color: "#64748b",
      fontWeight: 650,
    },
    input: {
      width: "100%",
      height: 52,
      borderRadius: 12,
      border: "1px solid #cbd5e1",
      background: "#fff",
      padding: "0 14px",
      boxSizing: "border-box",
      fontSize: 17,
      outline: "none",
      color: "#0f172a",
    },
    searchWrap: {
      marginTop: 14,
      position: "relative",
    },
    list: {
      marginTop: 12,
      display: "grid",
      gap: 10,
      overflowY: "auto",
      paddingBottom: 16,
    },
    btCard: {
      width: "100%",
      border: "1px solid rgba(15,23,42,.09)",
      background: "#fff",
      borderRadius: 14,
      padding: "14px 15px",
      boxSizing: "border-box",
      textAlign: "left",
      cursor: "pointer",
      boxShadow: "0 5px 16px rgba(15,23,42,.04)",
    },
    btTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    btNo: { fontSize: 22, fontWeight: 950 },
    unitNo: { fontSize: 22, fontWeight: 950 },
    date: { marginTop: 5, fontSize: 13, color: "#64748b", fontWeight: 650 },

    scanHeader: {
      display: "grid",
      gridTemplateColumns: "46px 1fr auto",
      gap: 10,
      alignItems: "center",
    },
    backBtn: {
      width: 46,
      height: 46,
      borderRadius: 12,
      border: "1px solid rgba(15,23,42,.10)",
      background: "#f8fafc",
      fontSize: 25,
      fontWeight: 800,
      cursor: "pointer",
    },
    btHeaderNo: {
      fontSize: 24,
      fontWeight: 950,
      lineHeight: 1.05,
    },
    btHeaderUnit: {
      fontSize: 24,
      fontWeight: 950,
      lineHeight: 1.05,
      textAlign: "right",
    },
    scanSection: {
      marginTop: 12,
      background: "#fff",
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 16,
      padding: 14,
      boxShadow: "0 8px 24px rgba(15,23,42,.05)",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 900,
      marginBottom: 9,
    },
    scanInput: {
      width: "100%",
      height: 54,
      borderRadius: 12,
      border: "2px solid #2563eb",
      background: "#fff",
      padding: "0 14px",
      boxSizing: "border-box",
      fontSize: 18,
      outline: "none",
      color: "#111827",
      fontWeight: 700,
    },
    noticeBase: {
      marginTop: 10,
      borderRadius: 11,
      padding: "10px 12px",
      fontSize: 13,
      fontWeight: 800,
    },
    scansCard: {
      minHeight: 0,
      flex: 1,
      marginTop: 12,
      background: "#fff",
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 16,
      boxShadow: "0 8px 24px rgba(15,23,42,.05)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    },
    scansHead: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 13px 9px",
    },
    badge: {
      borderRadius: 999,
      background: "#eef2f7",
      color: "#334155",
      padding: "5px 9px",
      fontSize: 12,
      fontWeight: 900,
    },
    tableHeader: {
      display: "grid",
      gridTemplateColumns: "94px minmax(0,1fr) 78px",
      gap: 8,
      padding: "8px 10px",
      background: "#f1f5f9",
      borderTop: "1px solid #e2e8f0",
      borderBottom: "1px solid #e2e8f0",
      fontSize: 11,
      fontWeight: 950,
      color: "#475569",
      textTransform: "uppercase",
      letterSpacing: ".04em",
    },
    tableBody: {
      minHeight: 0,
      overflowY: "auto",
      flex: 1,
    },
    tableRow: {
      display: "grid",
      gridTemplateColumns: "94px minmax(0,1fr) 78px",
      gap: 8,
      alignItems: "center",
      minHeight: 62,
      padding: "8px 10px",
      borderBottom: "1px solid #eef2f7",
      boxSizing: "border-box",
    },
    sku: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: 12,
      fontWeight: 900,
      color: "#334155",
    },
    name: {
      fontSize: 13,
      lineHeight: 1.25,
      fontWeight: 800,
      overflow: "hidden",
    },
    manualInput: {
      width: "100%",
      height: 38,
      borderRadius: 9,
      border: "1px solid #f59e0b",
      background: "#fffbeb",
      padding: "0 9px",
      boxSizing: "border-box",
      outline: "none",
      fontSize: 13,
      fontWeight: 750,
    },
    qtyWrap: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 5,
    },
    minus: {
      width: 34,
      height: 34,
      borderRadius: 9,
      border: "1px solid #cbd5e1",
      background: "#fff",
      fontSize: 20,
      fontWeight: 900,
      cursor: "pointer",
    },
    qty: {
      minWidth: 34,
      height: 34,
      borderRadius: 9,
      background: "#f1f5f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 17,
      fontWeight: 950,
    },
    empty: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 180,
      padding: 20,
      color: "#94a3b8",
      fontWeight: 750,
      textAlign: "center",
    },
    footer: {
      flexShrink: 0,
      display: "grid",
      gridTemplateColumns: "1fr 1.12fr",
      gap: 10,
      paddingTop: 12,
    },
    cancelBtn: {
      minHeight: 54,
      borderRadius: 12,
      border: "1px solid #cbd5e1",
      background: "#fff",
      fontSize: 16,
      fontWeight: 900,
      cursor: "pointer",
    },
    finishBtn: {
      minHeight: 54,
      borderRadius: 12,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontSize: 16,
      fontWeight: 950,
      cursor: "pointer",
    },
    retryBtn: {
      marginTop: 10,
      borderRadius: 10,
      border: "1px solid #cbd5e1",
      background: "#fff",
      padding: "9px 12px",
      fontWeight: 850,
      cursor: "pointer",
    },
  };

  if (!selectedBt) {
    return (
      <div style={s.page}>
        <div style={s.shell}>
          <div style={s.headerCard}>
            <h1 style={s.title}>Choisir un BT</h1>
            <div style={s.subtitle}>Recherche par BT ou unité</div>

            <div style={s.searchWrap}>
              <input
                style={s.input}
                placeholder="BT ou unité..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          {btError ? (
            <div
              style={{
                ...s.headerCard,
                marginTop: 12,
                borderColor: "rgba(220,38,38,.25)",
              }}
            >
              <div style={{ fontWeight: 900, color: "#b91c1c" }}>
                Impossible de charger les BT
              </div>
              <div style={{ marginTop: 5, fontSize: 13, color: "#64748b" }}>
                {btError}
              </div>
              <button style={s.retryBtn} onClick={() => void loadBts()}>
                Réessayer
              </button>
            </div>
          ) : null}

          <div style={s.list}>
            {loadingBts ? (
              <div style={s.empty}>Chargement des BT…</div>
            ) : filteredBts.length === 0 ? (
              <div style={s.empty}>
                {search.trim() ? "Aucun BT trouvé." : "Aucun BT ouvert."}
              </div>
            ) : (
              filteredBts.map((bt) => (
                <button
                  key={bt.id}
                  type="button"
                  style={s.btCard}
                  onClick={() => chooseBt(bt)}
                >
                  <div style={s.btTop}>
                    <div style={s.btNo}>BT #{bt.numero}</div>
                    <div style={s.unitNo}>{bt.unite}</div>
                  </div>
                  <div style={s.date}>
                    Ouvert le {formatOpenedDate(bt.openedAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const noticeStyle: CSSProperties | undefined = notice
    ? {
        ...s.noticeBase,
        ...(notice.type === "success"
          ? {
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
            }
          : notice.type === "warning"
            ? {
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
              }
            : {
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
              }),
      }
    : undefined;

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <div style={s.headerCard}>
          <div style={s.scanHeader}>
            <button type="button" style={s.backBtn} onClick={cancelSession}>
              ←
            </button>

            <div>
              <div style={s.btHeaderNo}>BT #{selectedBt.numero}</div>
              <div style={s.date}>
                Ouvert le {formatOpenedDate(selectedBt.openedAt)}
              </div>
            </div>

            <div style={s.btHeaderUnit}>{selectedBt.unite}</div>
          </div>
        </div>

        <div style={s.scanSection}>
          <div style={s.sectionTitle}>Scanner une pièce</div>

          <form onSubmit={handleScan}>
            <input
              ref={scanInputRef}
              style={s.scanInput}
              value={scanValue}
              onChange={(e) => handleScanValueChange(e.target.value)}
              placeholder={scanBusy ? "Recherche…" : "Prêt à scanner"}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              disabled={scanBusy || saving}
            />
          </form>

          {notice && noticeStyle ? (
            <div style={noticeStyle}>{notice.message}</div>
          ) : null}
        </div>

        <div style={s.scansCard}>
          <div style={s.scansHead}>
            <div style={{ fontSize: 17, fontWeight: 950 }}>Scans courants</div>
            <div style={s.badge}>{totalArticles} article(s)</div>
          </div>

          <div style={s.tableHeader}>
            <div>SKU</div>
            <div>Nom</div>
            <div style={{ textAlign: "center" }}>Qté</div>
          </div>

          <div style={s.tableBody}>
            {!parts.length ? (
              <div style={s.empty}>Scanne une pièce pour commencer.</div>
            ) : (
              parts.map((part) => (
                <div key={part.key} style={s.tableRow}>
                  <div style={s.sku}>{part.partNumber || part.barcode}</div>

                  <div style={s.name}>
                    {part.isManual ? (
                      <input
                        style={s.manualInput}
                        placeholder="Description..."
                        value={part.description}
                        onChange={(e) =>
                          updateManualDescription(part.key, e.target.value)
                        }
                        autoComplete="off"
                      />
                    ) : (
                      part.description
                    )}
                  </div>

                  <div style={s.qtyWrap}>
                    <button
                      type="button"
                      style={s.minus}
                      onClick={() => decrementPart(part.key)}
                    >
                      −
                    </button>
                    <div style={s.qty}>{part.quantity}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={s.footer}>
          <button
            type="button"
            style={s.cancelBtn}
            onClick={cancelSession}
            disabled={saving}
          >
            Annuler
          </button>

          <button
            type="button"
            style={{
              ...s.finishBtn,
              ...(parts.length === 0 || hasIncompleteManual || saving
                ? { opacity: 0.45, cursor: "not-allowed" }
                : {}),
            }}
            onClick={() => void finishSession()}
            disabled={
              parts.length === 0 || hasIncompleteManual || saving || scanBusy
            }
          >
            {saving ? "Enregistrement…" : "Terminer"}
          </button>
        </div>
      </div>
    </div>
  );
}
