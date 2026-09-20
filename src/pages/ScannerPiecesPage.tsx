import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  coutUnitaire: number;
};

type ScannedPart = InventoryPart & {
  key: string;
  quantity: number;
  isManual: boolean;
};

type ExistingBtPart = {
  id: string;
  inventoryItemId: string | null;
  sku: string | null;
  description: string;
  quantity: number;
  suiviActif: boolean;
};

type Notice =
  | { type: "success" | "error" | "warning"; message: string }
  | null;

type ApiResponse<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
};

const GB_SUITE_LOGO_SRC = 'data:image/svg+xml;utf8,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%0A%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22700%22%20height%3D%22300%22%20viewBox%3D%22140%2010%20620%20340%22%20fill%3D%22none%22%3E%0A%20%20%20%20%3Cg%20transform%3D%22translate%28240%2035%29%22%3E%0A%20%20%20%20%3Ctext%20x%3D%22210%22%20y%3D%22105%22%20text-anchor%3D%22middle%22%0A%20%20%20%20%20%20font-family%3D%22Arial%20Black%2C%20Arial%2C%20Helvetica%2C%20sans-serif%22%0A%20%20%20%20%20%20font-size%3D%22118%22%20font-weight%3D%22900%22%20letter-spacing%3D%22-8%22%3E%0A%20%20%20%20%20%20%3Ctspan%20fill%3D%22%2307183A%22%3EG%3C/tspan%3E%3Ctspan%20fill%3D%22%232563EB%22%3EB%3C/tspan%3E%0A%20%20%20%20%3C/text%3E%0A%0A%20%20%20%20%3Cpath%20d%3D%22M93%20119%20H327%22%20stroke%3D%22%232563EB%22%20stroke-width%3D%228%22%20stroke-linecap%3D%22round%22%20opacity%3D%220.95%22%20/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M118%20135%20C160%20158%2C%20260%20158%2C%20302%20135%22%20stroke%3D%22%2307183A%22%20stroke-width%3D%225%22%20stroke-linecap%3D%22round%22%20opacity%3D%220.9%22%20/%3E%0A%20%20%3C/g%3E%0A%0A%20%20%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20text-anchor%3D%22middle%22%0A%20%20%20%20font-family%3D%22Arial%2C%20Helvetica%2C%20sans-serif%22%0A%20%20%20%20font-size%3D%2236%22%20font-weight%3D%22800%22%0A%20%20%20%20letter-spacing%3D%2215%22%20fill%3D%22%2307183A%22%3E%0A%20%20%20%20GROUPE%20BRETON%0A%20%20%3C/text%3E%0A%0A%20%20%3C%21--%20Lignes%20SUITE%20corrig%C3%A9es%20et%20%C3%A9quilibr%C3%A9es%20--%3E%0A%20%20%3Cline%20x1%3D%22250%22%20y1%3D%22310%22%20x2%3D%22330%22%20y2%3D%22310%22%20stroke%3D%22%232563EB%22%20stroke-width%3D%224%22%20stroke-linecap%3D%22round%22%20/%3E%0A%0A%20%20%3Ctext%20x%3D%22450%22%20y%3D%22324%22%20text-anchor%3D%22middle%22%0A%20%20%20%20font-family%3D%22Arial%2C%20Helvetica%2C%20sans-serif%22%0A%20%20%20%20font-size%3D%2238%22%20font-weight%3D%22800%22%0A%20%20%20%20letter-spacing%3D%2218%22%20fill%3D%22%232563EB%22%3E%0A%20%20%20%20SUITE%0A%20%20%3C/text%3E%0A%0A%20%20%3Cline%20x1%3D%22570%22%20y1%3D%22310%22%20x2%3D%22650%22%20y2%3D%22310%22%20stroke%3D%22%232563EB%22%20stroke-width%3D%224%22%20stroke-linecap%3D%22round%22%20/%3E%0A%3C/svg%3E';

type LabelFormatKey = "29x90" | "62x20";

const LABEL_FORMAT_LABELS: Record<LabelFormatKey, string> = {
  "29x90": "29 × 90 mm",
  "62x20": "62 × 20 mm",
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

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));
}


const CODE128_PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];

function code128Values(text: string) {
  const chars = Array.from(text);
  const values = chars.map((ch) => {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) {
      throw new Error("Le SKU contient un caractère non supporté par le code-barres.");
    }
    return code - 32;
  });

  let checksum = 104;
  values.forEach((value, index) => {
    checksum += value * (index + 1);
  });

  checksum %= 103;
  return [104, ...values, checksum, 106];
}

function drawCode128(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const values = code128Values(text);
  const quietModules = 12;
  const totalModules =
    quietModules * 2 +
    values.reduce(
      (sum, value) =>
        sum +
        CODE128_PATTERNS[value]
          .split("")
          .reduce((a, n) => a + Number(n), 0),
      0,
    );

  const moduleWidth = Math.max(1, Math.floor(width / totalModules));
  const barcodeWidth = totalModules * moduleWidth;
  let cursor = x + Math.floor((width - barcodeWidth) / 2) + quietModules * moduleWidth;

  ctx.fillStyle = "#000";

  for (const value of values) {
    const pattern = CODE128_PATTERNS[value];
    let bar = true;

    for (const char of pattern) {
      const run = Number(char) * moduleWidth;
      if (bar) ctx.fillRect(cursor, y, run, height);
      cursor += run;
      bar = !bar;
    }
  }
}

function createBrotherLabelPng(
  sku: string,
  description: string,
  format: LabelFormatKey,
) {
  const cleanSku = (sku || "").trim() || "SANS-SKU";
  const name = (description || "").trim() || "Pièce";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Impossible de préparer l’étiquette.");
  }

  if (format === "62x20") {
    // Brother 62 mm continu coupé à 20 mm.
    // Raster natif = 236 points dans le sens d'avance x 696 points sur la largeur.
    const landscape = document.createElement("canvas");
    landscape.width = 696;
    landscape.height = 236;

    const lctx = landscape.getContext("2d");
    if (!lctx) throw new Error("Impossible de préparer l’étiquette 62 × 20.");

    lctx.fillStyle = "#fff";
    lctx.fillRect(0, 0, landscape.width, landscape.height);
    lctx.fillStyle = "#000";
    lctx.textAlign = "center";
    lctx.textBaseline = "middle";

    let fontSize = 27;
    lctx.font = `700 ${fontSize}px Arial, sans-serif`;

    while (fontSize > 15 && lctx.measureText(name).width > 650) {
      fontSize -= 1;
      lctx.font = `700 ${fontSize}px Arial, sans-serif`;
    }

    const visibleName =
      lctx.measureText(name).width <= 650
        ? name
        : `${name.slice(0, Math.max(8, Math.floor(name.length * 0.72)))}…`;

    lctx.fillText(visibleName, landscape.width / 2, 28);
    drawCode128(lctx, cleanSku, 18, 57, 660, 112);

    lctx.font = "700 27px Arial, sans-serif";
    lctx.fillText(cleanSku, landscape.width / 2, 199);

    canvas.width = 236;
    canvas.height = 696;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(landscape, 0, 0);
    ctx.restore();

    return canvas.toDataURL("image/png").split(",")[1] || "";
  }

  canvas.width = 1063;
  canvas.height = 343;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = 42;
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;

  while (fontSize > 18 && ctx.measureText(name).width > 930) {
    fontSize -= 2;
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  }

  const visibleName =
    ctx.measureText(name).width <= 930
      ? name
      : `${name.slice(0, Math.max(8, Math.floor(name.length * 0.75)))}…`;

  ctx.fillText(visibleName, canvas.width / 2, 47);
  drawCode128(ctx, cleanSku, 24, 91, 943, 132);

  ctx.font = "700 37px Arial, sans-serif";
  ctx.fillText(cleanSku, canvas.width / 2, 267);

  return canvas.toDataURL("image/png").split(",")[1] || "";
}


function printBrotherLabel(
  item: { sku: string | null; nom: string },
  copies = 1,
  format: LabelFormatKey = "29x90",
) {
  const bridge = (window as any).GBScanner;

  if (!bridge || typeof bridge.printLabelPng !== "function") {
    throw new Error("Impression directe disponible seulement dans l’app GB Scanner mise à jour.");
  }

  const host =
    typeof bridge.getPrinterHost === "function"
      ? String(bridge.getPrinterHost() || "").trim()
      : "";

  if (!host) {
    if (typeof bridge.configurePrinter === "function") {
      bridge.configurePrinter();
    }
    throw new Error("Configure d’abord l’adresse IP de la Brother.");
  }

  const png = createBrotherLabelPng(item.sku || "", item.nom || "", format);
  bridge.printLabelPng(png, Math.max(1, Math.min(50, Number(copies) || 1)), format);
}

function BtScannerMode({ onExit }: { onExit: () => void }) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingBts, setLoadingBts] = useState(true);
  const [btError, setBtError] = useState("");
  const [search, setSearch] = useState("");

  const [selectedBt, setSelectedBt] = useState<WorkOrder | null>(null);
  const [parts, setParts] = useState<ScannedPart[]>([]);
  const [existingParts, setExistingParts] = useState<ExistingBtPart[]>([]);
  const [existingPartsLoading, setExistingPartsLoading] = useState(false);
  const [existingPartBusyId, setExistingPartBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingBarcodeRef = useRef<string>("");
  const hardwareBufferRef = useRef<string>("");
  const hardwareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHardwareKeyAtRef = useRef<number>(0);

  useEffect(() => {
    void loadBts();

    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (hardwareTimerRef.current) clearTimeout(hardwareTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleAndroidScan = (event: Event) => {
      const customEvent = event as CustomEvent<{
        barcode?: string;
        source?: string;
      }>;

      const barcode = String(customEvent.detail?.barcode || "").trim();
      if (!barcode) return;

      void processBarcode(barcode);
    };

    window.addEventListener("gb-barcode-scan", handleAndroidScan as EventListener);

    return () => {
      window.removeEventListener(
        "gb-barcode-scan",
        handleAndroidScan as EventListener,
      );
    };
  }, [selectedBt, scanBusy, saving]);


  useEffect(() => {
    if (!selectedBt) return;

    const flushHardwareBuffer = () => {
      const code = hardwareBufferRef.current.trim();
      hardwareBufferRef.current = "";

      if (hardwareTimerRef.current) {
        clearTimeout(hardwareTimerRef.current);
        hardwareTimerRef.current = null;
      }

      if (code.length >= 2) {
        void processBarcode(code);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (scanBusy || saving) return;

      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.isContentEditable);

      // Si l'utilisateur est en train d'écrire une description manuelle,
      // on ne détourne pas ses touches.
      if (
        isEditable &&
        target instanceof HTMLInputElement &&
        target.getAttribute("data-manual-description") === "true"
      ) {
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        if (hardwareBufferRef.current.trim()) {
          event.preventDefault();
          flushHardwareBuffer();
        }
        return;
      }

      if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      const now = performance.now();
      const gap = now - lastHardwareKeyAtRef.current;
      lastHardwareKeyAtRef.current = now;

      // Un scanner envoie généralement les caractères très rapidement.
      // Si la pause est longue, on repart un nouveau buffer.
      if (gap > 250) {
        hardwareBufferRef.current = "";
      }

      hardwareBufferRef.current += event.key;

      if (hardwareTimerRef.current) {
        clearTimeout(hardwareTimerRef.current);
      }

      hardwareTimerRef.current = setTimeout(() => {
        flushHardwareBuffer();
      }, 160);
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (hardwareTimerRef.current) {
        clearTimeout(hardwareTimerRef.current);
        hardwareTimerRef.current = null;
      }
      hardwareBufferRef.current = "";
    };
  }, [selectedBt, scanBusy, saving]);


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

  async function loadExistingParts(btId: string) {
    setExistingPartsLoading(true);

    try {
      const rows = await scannerApi<ExistingBtPart[]>("get_bt_parts", { btId });
      setExistingParts(rows || []);
    } catch (e: any) {
      console.error(e);
      setExistingParts([]);
      showNotice(
        {
          type: "error",
          message: e?.message || "Impossible de charger les pièces du BT.",
        },
        4000,
      );
    } finally {
      setExistingPartsLoading(false);
    }
  }

  async function decrementExistingPart(part: ExistingBtPart) {
    if (!selectedBt || existingPartBusyId) return;

    if (part.suiviActif) {
      showNotice(
        {
          type: "warning",
          message: `${part.sku || part.description} est une pièce suivie. Retire-la depuis le BT.`,
        },
        4000,
      );
      return;
    }

    setExistingPartBusyId(part.id);

    try {
      await scannerApi("decrement_bt_part", {
        btId: selectedBt.id,
        btPartId: part.id,
      });

      setExistingParts((current) =>
        current
          .map((row) =>
            row.id === part.id
              ? { ...row, quantity: row.quantity - 1 }
              : row,
          )
          .filter((row) => row.quantity > 0),
      );

      showNotice({
        type: "success",
        message:
          part.quantity <= 1
            ? `${part.description} retiré du BT`
            : `${part.description} : quantité réduite`,
      });

      navigator.vibrate?.(60);
    } catch (e: any) {
      showNotice(
        {
          type: "error",
          message: e?.message || "Impossible de modifier cette pièce.",
        },
        4000,
      );
    } finally {
      setExistingPartBusyId(null);
    }
  }

  function chooseBt(bt: WorkOrder) {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }

    setSelectedBt(bt);
    setParts([]);
    setExistingParts([]);
    setNotice(null);
    void loadExistingParts(bt.id);
  }

  async function processBarcode(rawCode: string) {
    const barcode = rawCode.trim();

    if (!barcode || scanBusy || saving) return;
    if (processingBarcodeRef.current === barcode) return;

    processingBarcodeRef.current = barcode;
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
              coutUnitaire: 0,
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
    }
  }



  function decrementPart(key: string) {
    setParts((current) =>
      current
        .map((row) =>
          row.key === key ? { ...row, quantity: row.quantity - 1 } : row,
        )
        .filter((row) => row.quantity > 0),
    );
    // Aucun refocus automatique : évite l'ouverture du clavier Android.
  }

  function setPartQuantity(key: string, value: string) {
    const normalized = value.replace(",", ".");
    if (normalized !== "" && !/^\d*(\.\d{0,3})?$/.test(normalized)) return;

    setParts((current) =>
      current.map((row) =>
        row.key === key
          ? {
              ...row,
              quantity:
                normalized === "" ? 0 : Math.max(0, Number(normalized)),
            }
          : row,
      ),
    );
  }

  function updateManualDescription(key: string, value: string) {
    setParts((current) =>
      current.map((row) =>
        row.key === key ? { ...row, description: value } : row,
      ),
    );
  }

  function updatePartCost(key: string, value: string) {
    const normalized = value.replace(",", ".");
    if (normalized !== "" && !/^\d*(\.\d{0,4})?$/.test(normalized)) return;

    setParts((current) =>
      current.map((row) =>
        row.key === key
          ? { ...row, coutUnitaire: normalized === "" ? 0 : Number(normalized) }
          : row,
      ),
    );
  }

  function cancelSession() {
    if (parts.length && !window.confirm("Annuler tous les scans courants ?")) {
      return;
    }

    setSelectedBt(null);
    setParts([]);
    setExistingParts([]);
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
          cost: part.coutUnitaire,
          isManual: part.isManual,
        })),
      });

      navigator.vibrate?.([60, 40, 60]);
      setParts([]);
      setSelectedBt(null);
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
    noticeBase: {
      marginTop: 10,
      borderRadius: 11,
      padding: "10px 12px",
      fontSize: 13,
      fontWeight: 800,
    },
    existingCard: {
      marginTop: 12,
      background: "#fff",
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 16,
      boxShadow: "0 8px 24px rgba(15,23,42,.05)",
      overflow: "hidden",
      flexShrink: 0,
    },
    existingBody: {
      maxHeight: 210,
      overflowY: "auto",
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
            <button
              type="button"
              onClick={onExit}
              style={{
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                borderRadius: 10,
                padding: "7px 11px",
                fontWeight: 850,
                fontSize: 13,
                marginBottom: 12,
                cursor: "pointer",
              }}
            >
              ← Modes
            </button>
            <h1 style={s.title}>Choisir un bon de travail</h1>
            <div style={s.subtitle}>Recherche par numéro de BT ou unité</div>

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
      <style>{`
        @keyframes gb-scan-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.45; }
          40% { transform: scale(1); opacity: 1; }
        }

        @keyframes gb-scan-pulse {
          0% { box-shadow: 0 0 0 0 rgba(22,163,74,.45); }
          70% { box-shadow: 0 0 0 8px rgba(22,163,74,0); }
          100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); }
        }
      `}</style>
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

          <div
            style={{
              minHeight: 58,
              borderRadius: 12,
              border: "1px solid #86efac",
              background: "#ecfdf5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "0 14px",
              boxSizing: "border-box",
              fontSize: 16,
              fontWeight: 950,
              color: "#166534",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                background: "#16a34a",
                display: "inline-block",
                animation: "gb-scan-pulse 1.6s infinite",
                flexShrink: 0,
              }}
            />

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                whiteSpace: "nowrap",
              }}
            >
              Prêt à scanner
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "#16a34a",
                    display: "inline-block",
                    animation: "gb-scan-bounce 1s infinite ease-in-out",
                  }}
                />
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "#16a34a",
                    display: "inline-block",
                    animation: "gb-scan-bounce 1s infinite ease-in-out",
                    animationDelay: "0.15s",
                  }}
                />
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "#16a34a",
                    display: "inline-block",
                    animation: "gb-scan-bounce 1s infinite ease-in-out",
                    animationDelay: "0.3s",
                  }}
                />
              </span>
            </span>
          </div>

          {notice && noticeStyle ? (
            <div style={noticeStyle}>{notice.message}</div>
          ) : null}
        </div>

        <div style={s.existingCard}>
          <div style={s.scansHead}>
            <div style={{ fontSize: 17, fontWeight: 950 }}>Déjà sur le BT</div>
            <div style={s.badge}>
              {existingParts.reduce((sum, row) => sum + row.quantity, 0)} article(s)
            </div>
          </div>

          <div
            style={{
              ...s.tableHeader,
              gridTemplateColumns: "82px minmax(0,1fr) 84px 88px",
            }}
          >
            <div>SKU</div>
            <div>Nom</div>
            <div style={{ textAlign: "right" }}>Coût</div>
            <div style={{ textAlign: "center" }}>Qté</div>
          </div>

          <div style={s.existingBody}>
            {existingPartsLoading ? (
              <div style={{ ...s.empty, minHeight: 90 }}>Chargement…</div>
            ) : existingParts.length === 0 ? (
              <div style={{ ...s.empty, minHeight: 90 }}>
                Aucune pièce déjà inscrite.
              </div>
            ) : (
              existingParts.map((part) => (
                <div key={part.id} style={s.tableRow}>
                  <div style={s.sku}>{part.sku || "—"}</div>

                  <div style={s.name}>
                    {part.description}
                    {part.suiviActif ? (
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 10,
                          color: "#92400e",
                          fontWeight: 850,
                        }}
                      >
                        Pièce suivie
                      </div>
                    ) : null}
                  </div>

                  <div style={s.qtyWrap}>
                    <button
                      type="button"
                      style={{
                        ...s.minus,
                        ...(part.suiviActif || existingPartBusyId === part.id
                          ? { opacity: 0.4, cursor: "not-allowed" }
                          : {}),
                      }}
                      onClick={() => void decrementExistingPart(part)}
                      disabled={
                        part.suiviActif || existingPartBusyId === part.id
                      }
                      title={
                        part.suiviActif
                          ? "Retirer cette pièce depuis le BT normal"
                          : "Retirer 1"
                      }
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
                <div
                  key={part.key}
                  style={{
                    ...s.tableRow,
                    gridTemplateColumns: "82px minmax(0,1fr) 84px 88px",
                  }}
                >
                  <div style={s.sku}>{part.partNumber || part.barcode}</div>

                  <div style={s.name}>
                    {part.isManual ? (
                      <input
                        style={s.manualInput}
                        data-manual-description="true"
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

                  <input
                    aria-label="Coût"
                    inputMode="decimal"
                    value={String(part.coutUnitaire ?? 0)}
                    onChange={(e) => updatePartCost(part.key, e.target.value)}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      height: 34,
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: "0 7px",
                      boxSizing: "border-box",
                      textAlign: "right",
                      fontWeight: 850,
                      fontSize: 12,
                      background: "#fff",
                    }}
                  />

                  <div style={s.qtyWrap}>
                    <button
                      type="button"
                      style={s.minus}
                      onClick={() => decrementPart(part.key)}
                    >
                      −
                    </button>
                    <input
                      aria-label="Quantité"
                      inputMode="decimal"
                      value={String(part.quantity)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        setPartQuantity(part.key, e.target.value)
                      }
                      style={{
                        width: 46,
                        height: 34,
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        textAlign: "center",
                        fontSize: 15,
                        fontWeight: 950,
                        boxSizing: "border-box",
                      }}
                    />
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


type ScannerMode = "home" | "bt" | "reception" | "inventory" | "configuration";

type StockItem = {
  id: string;
  sku: string | null;
  nom: string;
  unite: string | null;
  quantite: number;
  coutUnitaire?: number | null;
  emplacement?: string | null;
  matchedBy?: string | null;
};

type ReceptionRow = StockItem & {
  receiveQty: number;
};

function AnimatedReady() {
  return (
    <>
      <style>{`
        @keyframes gb-ready-dot {
          0%, 80%, 100% { transform: scale(.7); opacity: .35; }
          40% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes gb-ready-pulse {
          0% { box-shadow: 0 0 0 0 rgba(22,163,74,.4); }
          70% { box-shadow: 0 0 0 8px rgba(22,163,74,0); }
          100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); }
        }
      `}</style>

      <div
        style={{
          minHeight: 58,
          borderRadius: 12,
          border: "1px solid #86efac",
          background: "#ecfdf5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "0 14px",
          boxSizing: "border-box",
          color: "#166534",
          fontWeight: 950,
          fontSize: 16,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 11,
            height: 11,
            borderRadius: 999,
            background: "#16a34a",
            animation: "gb-ready-pulse 1.6s infinite",
            flexShrink: 0,
          }}
        />
        <span>Prêt à scanner</span>
        <span
          aria-hidden="true"
          style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
        >
          {[0, 0.15, 0.3].map((delay, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "#16a34a",
                display: "inline-block",
                animation: "gb-ready-dot 1s infinite ease-in-out",
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </span>
      </div>
    </>
  );
}

const modeStyles: Record<string, CSSProperties> = {
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
    padding: 14,
    boxSizing: "border-box",
  },
  card: {
    background: "#fff",
    border: "1px solid rgba(15,23,42,.08)",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15,23,42,.06)",
  },
  title: {
    fontSize: 28,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-.02em",
    margin: 0,
  },
  subtitle: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 14,
    fontWeight: 650,
  },
  back: {
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    borderRadius: 10,
    padding: "8px 11px",
    fontWeight: 850,
    fontSize: 13,
    cursor: "pointer",
  },
  action: {
    width: "100%",
    background: "#fff",
    border: "1px solid rgba(15,23,42,.09)",
    borderRadius: 16,
    padding: 18,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(15,23,42,.05)",
  },
  greenButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: 12,
    border: "1px solid #16a34a",
    background: "#16a34a",
    color: "#fff",
    fontSize: 16,
    fontWeight: 950,
    cursor: "pointer",
  },
  blueButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: 12,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    fontSize: 16,
    fontWeight: 950,
    cursor: "pointer",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "88px minmax(0,1fr) 92px",
    gap: 8,
    alignItems: "center",
    minHeight: 62,
    padding: "8px 10px",
    borderBottom: "1px solid #eef2f7",
    boxSizing: "border-box",
  },
  headerRow: {
    display: "grid",
    gridTemplateColumns: "88px minmax(0,1fr) 92px",
    gap: 8,
    padding: "8px 10px",
    background: "#f1f5f9",
    fontSize: 11,
    fontWeight: 950,
    color: "#475569",
    textTransform: "uppercase",
  },
  qtyBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
  },
  minus: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 19,
    fontWeight: 900,
    cursor: "pointer",
  },
  qty: {
    minWidth: 34,
    height: 32,
    borderRadius: 8,
    background: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 950,
  },
};

function ModeHome({ onMode }: { onMode: (mode: ScannerMode) => void }) {
  const modes = [
    {
      mode: "bt" as const,
      icon: "🔧",
      title: "Bon de travail",
      text: "Scanner les pièces utilisées sur un bon de travail",
    },
    {
      mode: "reception" as const,
      icon: "📦",
      title: "Réception",
      text: "Scanner les pièces reçues et les ajouter au stock",
    },
    {
      mode: "inventory" as const,
      icon: "▦",
      title: "Inventaire",
      text: "Compter, ajuster le stock et gérer les supersedes",
    },
    {
      mode: "configuration" as const,
      icon: "⚙️",
      title: "Configuration",
      text: "Configurer l’imprimante Brother et les paramètres du terminal",
    },
  ];

  return (
    <div style={modeStyles.page}>
      <div style={modeStyles.shell}>
        <div style={modeStyles.card}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img
              src={GB_SUITE_LOGO_SRC}
              alt="GB Suite"
              style={{
                width: "100%",
                maxWidth: 220,
                height: "auto",
                display: "block",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 26,
              fontWeight: 950,
              textAlign: "center",
              color: "#0f172a",
            }}
          >
            GB Suite
          </div>
          <div style={{ ...modeStyles.subtitle, textAlign: "center", marginTop: 4 }}>
            Que voulez-vous faire ?
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {modes.map((item) => (
            <button
              key={item.mode}
              type="button"
              style={modeStyles.action}
              onClick={() => onMode(item.mode)}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 13,
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 950 }}>{item.title}</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#64748b",
                      fontWeight: 650,
                      marginTop: 3,
                    }}
                  >
                    {item.text}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReceptionMode({ onExit }: { onExit: () => void }) {
  const [rows, setRows] = useState<ReceptionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [numeroFacture, setNumeroFacture] = useState("");
  const [missingCode, setMissingCode] = useState("");
  const [createForm, setCreateForm] = useState({
    nom: "",
    unite: "un",
    coutUnitaire: "",
    emplacement: "",
  });

  useEffect(() => {
    const onScan = (event: Event) => {
      const barcode = String(
        (event as CustomEvent<{ barcode?: string }>).detail?.barcode || "",
      ).trim();
      if (!barcode || busy) return;
      void handleBarcode(barcode);
    };

    window.addEventListener("gb-barcode-scan", onScan as EventListener);
    return () =>
      window.removeEventListener("gb-barcode-scan", onScan as EventListener);
  }, [busy]);

  async function handleBarcode(barcode: string) {
    setBusy(true);
    setMessage("");
    try {
      const item = await scannerApi<StockItem | null>("inventory_lookup", {
        barcode,
      });

      if (!item) {
        setMissingCode(barcode);
        setCreateForm({
          nom: "",
          unite: "un",
          coutUnitaire: "",
          emplacement: "",
        });
        setMessage("Pièce introuvable. Tu peux la créer avant de la recevoir.");
        navigator.vibrate?.([120, 50, 120]);
        return;
      }

      setMissingCode("");

      setRows((current) => {
        const existing = current.find((r) => r.id === item.id);
        if (existing) {
          return current.map((r) =>
            r.id === item.id
              ? { ...r, receiveQty: r.receiveQty + 1 }
              : r,
          );
        }
        return [{ ...item, receiveQty: 1 }, ...current];
      });
      navigator.vibrate?.(60);
    } catch (e: any) {
      setMessage(e?.message || "Erreur de scan.");
    } finally {
      setBusy(false);
    }
  }

  async function createMissingItem() {
    if (!missingCode || busy) return;
    const nom = createForm.nom.trim();
    if (!nom) {
      setMessage("Description requise.");
      return;
    }

    const cost = createForm.coutUnitaire.trim()
      ? Number(createForm.coutUnitaire.replace(",", "."))
      : null;

    if (cost != null && (!Number.isFinite(cost) || cost < 0)) {
      setMessage("Coût unitaire invalide.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const created = await scannerApi<StockItem>("create_inventory_item", {
        sku: missingCode,
        nom,
        unite: createForm.unite.trim() || null,
        coutUnitaire: cost,
        emplacement: createForm.emplacement.trim() || null,
        quantite: 0,
      });

      setRows((current) => [
        { ...created, receiveQty: 1 },
        ...current.filter((r) => r.id !== created.id),
      ]);
      setMissingCode("");
      setMessage("Pièce créée et ajoutée à la réception.");
      navigator.vibrate?.([60, 40, 60]);
    } catch (e: any) {
      setMessage(e?.message || "Erreur création pièce.");
    } finally {
      setBusy(false);
    }
  }

  function updateReceptionCost(id: string, value: string) {
    const normalized = value.replace(",", ".");
    if (normalized !== "" && !/^\d*(\.\d{0,4})?$/.test(normalized)) return;

    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              coutUnitaire:
                normalized === "" ? 0 : Number(normalized),
            }
          : row,
      ),
    );
  }

  function decrement(id: string) {
    setRows((current) =>
      current
        .map((r) =>
          r.id === id ? { ...r, receiveQty: r.receiveQty - 1 } : r,
        )
        .filter((r) => r.receiveQty > 0),
    );
  }

  function setReceptionQuantity(id: string, value: string) {
    const normalized = value.replace(",", ".");
    if (normalized !== "" && !/^\d*(\.\d{0,3})?$/.test(normalized)) return;

    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              receiveQty:
                normalized === "" ? 0 : Math.max(0, Number(normalized)),
            }
          : row,
      ),
    );
  }

  function printReceptionLabel(row: ReceptionRow) {
    try {
      printBrotherLabel({ sku: row.sku, nom: row.nom }, 1);
      setMessage("Envoi de l’étiquette à la Brother…");
    } catch (e: any) {
      setMessage(e?.message || "Erreur impression étiquette.");
    }
  }

  async function finish() {
    if (!rows.length || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await scannerApi("receive_inventory", {
        fournisseur: fournisseur.trim() || null,
        numeroFacture: numeroFacture.trim() || null,
        items: rows.map((r) => ({
          itemId: r.id,
          quantity: r.receiveQty,
          cost: Number(r.coutUnitaire || 0),
        })),
      });
      setRows([]);
      setFournisseur("");
      setNumeroFacture("");
      setMessage("Réception enregistrée au stock.");
      navigator.vibrate?.([60, 40, 60]);
    } catch (e: any) {
      setMessage(e?.message || "Erreur réception.");
    } finally {
      setBusy(false);
    }
  }

  const total = rows.reduce((s, r) => s + r.receiveQty, 0);

  return (
    <div style={modeStyles.page}>
      <div
        style={{
          ...modeStyles.shell,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={modeStyles.card}>
          <button style={modeStyles.back} onClick={onExit}>
            ← Modes
          </button>
          <h1 style={{ ...modeStyles.title, marginTop: 12 }}>Réception</h1>
          <div style={modeStyles.subtitle}>
            Chaque scan ajoute 1 — touche la quantité pour l’entrer rapidement
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 12,
            }}
          >
            <input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Fournisseur (optionnel)"
              style={{
                minHeight: 42,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "0 10px",
                minWidth: 0,
                boxSizing: "border-box",
              }}
            />
            <input
              value={numeroFacture}
              onChange={(e) => setNumeroFacture(e.target.value)}
              placeholder="No facture (optionnel)"
              style={{
                minHeight: 42,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "0 10px",
                minWidth: 0,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <AnimatedReady />
        </div>

        {message ? (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: message.includes("enregistrée") ? "#ecfdf5" : "#fff7ed",
              color: message.includes("enregistrée") ? "#166534" : "#9a3412",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {message}
          </div>
        ) : null}

        {missingCode ? (
          <div style={{ ...modeStyles.card, marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
              NOUVELLE PIÈCE — {missingCode}
            </div>

            <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
              <input
                value={createForm.nom}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, nom: e.target.value }))
                }
                placeholder="Description / nom"
                style={{
                  minHeight: 46,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 12px",
                  fontSize: 15,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  value={createForm.unite}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, unite: e.target.value }))
                  }
                  placeholder="Unité"
                  style={{
                    minHeight: 44,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "0 12px",
                  }}
                />
                <input
                  value={createForm.coutUnitaire}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, coutUnitaire: e.target.value }))
                  }
                  inputMode="decimal"
                  placeholder="Coût unitaire"
                  style={{
                    minHeight: 44,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "0 12px",
                  }}
                />
              </div>
              <input
                value={createForm.emplacement}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, emplacement: e.target.value }))
                }
                placeholder="Emplacement"
                style={{
                  minHeight: 44,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 12px",
                }}
              />
            </div>

            <button
              type="button"
              style={{ ...modeStyles.greenButton, marginTop: 12 }}
              disabled={busy}
              onClick={() => void createMissingItem()}
            >
              Créer et recevoir 1
            </button>
          </div>
        ) : null}

        <div
          style={{
            ...modeStyles.card,
            padding: 0,
            marginTop: 12,
            overflow: "hidden",
            flex: 1,
          }}
        >
          <div
            style={{
              padding: "12px 13px",
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 950,
            }}
          >
            <span>Pièces reçues</span>
            <span>{total} article(s)</span>
          </div>
          <div
            style={{
              ...modeStyles.headerRow,
              gridTemplateColumns: "82px minmax(0,1fr) 84px 86px",
            }}
          >
            <div>SKU</div>
            <div>Nom</div>
            <div style={{ textAlign: "right" }}>Coût</div>
            <div style={{ textAlign: "center" }}>Qté</div>
          </div>
          {rows.length === 0 ? (
            <div
              style={{
                padding: 30,
                textAlign: "center",
                color: "#94a3b8",
                fontWeight: 750,
              }}
            >
              Scanne une pièce reçue.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                style={{
                  ...modeStyles.row,
                  gridTemplateColumns: "82px minmax(0,1fr) 84px 86px",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900 }}>
                  {row.sku || "—"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{row.nom}</div>
                  <button
                    type="button"
                    onClick={() => printReceptionLabel(row)}
                    style={{
                      border: 0,
                      padding: "3px 0 0",
                      background: "transparent",
                      color: "#2563eb",
                      fontSize: 11,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    🏷️ Étiquette
                  </button>
                </div>
                <input
                  aria-label={`Coût ${row.sku || row.nom}`}
                  inputMode="decimal"
                  value={String(row.coutUnitaire ?? 0)}
                  onChange={(e) =>
                    updateReceptionCost(row.id, e.target.value)
                  }
                  style={{
                    width: "100%",
                    minWidth: 0,
                    height: 34,
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "0 7px",
                    boxSizing: "border-box",
                    textAlign: "right",
                    fontWeight: 850,
                    fontSize: 12,
                  }}
                />
                <div style={modeStyles.qtyBox}>
                  <button
                    type="button"
                    style={modeStyles.minus}
                    onClick={() => decrement(row.id)}
                  >
                    −
                  </button>
                  <input
                    aria-label={`Quantité reçue ${row.sku || row.nom}`}
                    inputMode="decimal"
                    value={String(row.receiveQty)}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) =>
                      setReceptionQuantity(row.id, e.target.value)
                    }
                    style={{
                      width: 46,
                      height: 34,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      textAlign: "center",
                      fontSize: 15,
                      fontWeight: 950,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          style={{
            ...modeStyles.greenButton,
            marginTop: 12,
            opacity: !rows.length || busy ? 0.45 : 1,
          }}
          disabled={!rows.length || busy}
          onClick={() => void finish()}
        >
          {busy ? "Traitement…" : "Terminer la réception"}
        </button>
      </div>
    </div>
  );
}


function InventoryMode({ onExit }: { onExit: () => void }) {
  const [item, setItem] = useState<StockItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<"none" | "adjust" | "receive" | "supersede">("none");
  const [qtyValue, setQtyValue] = useState("");
  const [oldCode, setOldCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockItem[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [editingCost, setEditingCost] = useState(false);
  const [costValue, setCostValue] = useState("");
  const [labelQty, setLabelQty] = useState(1);
  const [labelFormat, setLabelFormat] = useState<LabelFormatKey>("62x20");
  const [labelPrinting, setLabelPrinting] = useState(false);

  const [missingCode, setMissingCode] = useState("");
  const [createForm, setCreateForm] = useState({
    nom: "",
    unite: "un",
    coutUnitaire: "",
    emplacement: "",
    quantite: "0",
  });

  useEffect(() => {
    const onScan = (event: Event) => {
      const barcode = String(
        (event as CustomEvent<{ barcode?: string }>).detail?.barcode || "",
      ).trim();
      if (!barcode || busy) return;

      if (item && action === "supersede") {
        setOldCode(barcode);
        setMessage("");
        navigator.vibrate?.(60);
        return;
      }

      void loadItem(barcode);
    };

    window.addEventListener("gb-barcode-scan", onScan as EventListener);
    return () =>
      window.removeEventListener("gb-barcode-scan", onScan as EventListener);
  }, [busy, item, action]);

  useEffect(() => {
    const onPrintResult = (event: Event) => {
      const detail = (event as CustomEvent<{ ok?: boolean; message?: string }>).detail;
      setLabelPrinting(false);
      setMessage(detail?.message || (detail?.ok ? "Étiquette imprimée." : "Erreur d’impression."));
    };

    window.addEventListener("gb-label-print-result", onPrintResult as EventListener);
    return () =>
      window.removeEventListener("gb-label-print-result", onPrintResult as EventListener);
  }, []);

  function printSelectedLabel() {
    if (!item || labelPrinting) return;

    try {
      setLabelPrinting(true);
      setMessage("Envoi de l’étiquette à la Brother…");
      printBrotherLabel({ sku: item.sku, nom: item.nom }, labelQty, labelFormat);
    } catch (e: any) {
      setLabelPrinting(false);
      setMessage(e?.message || "Erreur impression étiquette.");
    }
  }

  async function loadItem(barcode: string) {
    setBusy(true);
    setMessage("");
    try {
      const found = await scannerApi<StockItem | null>("inventory_lookup", {
        barcode,
      });

      if (!found) {
        setItem(null);
        setAction("none");
        setMissingCode(barcode);
        setCreateForm({
          nom: "",
          unite: "un",
          coutUnitaire: "",
          emplacement: "",
          quantite: "0",
        });
        setMessage("Pièce introuvable. Tu peux la créer directement.");
        navigator.vibrate?.([120, 50, 120]);
        return;
      }

      setItem(found);
      setMissingCode("");
      setLabelQty(1);
      setAction("none");
      setQtyValue(String(found.quantite));
      setCostValue(String(found.coutUnitaire ?? 0));
      setEditingCost(false);
      setSearchQuery("");
      setSearchResults([]);
      setOldCode("");
      navigator.vibrate?.(60);
    } catch (e: any) {
      setMessage(e?.message || "Erreur inventaire.");
    } finally {
      setBusy(false);
    }
  }

  async function searchInventory(query: string) {
    setSearchQuery(query);
    const q = query.trim();

    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchBusy(true);
    try {
      const results = await scannerApi<StockItem[]>("search_inventory", {
        query: q,
      });
      setSearchResults(results || []);
    } catch (e: any) {
      setMessage(e?.message || "Erreur recherche inventaire.");
      setSearchResults([]);
    } finally {
      setSearchBusy(false);
    }
  }

  function chooseSearchResult(found: StockItem) {
    setItem(found);
    setMissingCode("");
    setLabelQty(1);
    setAction("none");
    setQtyValue(String(found.quantite));
    setCostValue(String(found.coutUnitaire ?? 0));
    setEditingCost(false);
    setSearchQuery("");
    setSearchResults([]);
    setMessage("");
  }

  async function saveItemCost(source = "Modification scanner inventaire") {
    if (!item || busy) return;
    const cost = Number(costValue.replace(",", "."));

    if (!Number.isFinite(cost) || cost < 0) {
      setMessage("Coût invalide.");
      return;
    }

    setBusy(true);
    try {
      const updated = await scannerApi<StockItem>("update_inventory_cost", {
        itemId: item.id,
        cost,
        note: source,
      });
      setItem(updated);
      setCostValue(String(updated.coutUnitaire ?? 0));
      setEditingCost(false);
      setMessage("Coût mis à jour.");
    } catch (e: any) {
      setMessage(e?.message || "Erreur mise à jour du coût.");
    } finally {
      setBusy(false);
    }
  }

  async function createMissingItem() {
    if (!missingCode || busy) return;
    const nom = createForm.nom.trim();
    if (!nom) {
      setMessage("Description requise.");
      return;
    }

    const qty = Number(createForm.quantite.replace(",", "."));
    const cost = createForm.coutUnitaire.trim()
      ? Number(createForm.coutUnitaire.replace(",", "."))
      : null;

    if (!Number.isFinite(qty) || qty < 0) {
      setMessage("Quantité invalide.");
      return;
    }
    if (cost != null && (!Number.isFinite(cost) || cost < 0)) {
      setMessage("Coût unitaire invalide.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const created = await scannerApi<StockItem>("create_inventory_item", {
        sku: missingCode,
        nom,
        unite: createForm.unite.trim() || null,
        coutUnitaire: cost,
        emplacement: createForm.emplacement.trim() || null,
        quantite: qty,
      });

      setItem(created);
      setMissingCode("");
      setLabelQty(1);
      setQtyValue(String(created.quantite));
      setCostValue(String(created.coutUnitaire ?? 0));
      setAction("none");
      setMessage("Pièce créée dans l’inventaire.");
      navigator.vibrate?.([60, 40, 60]);
    } catch (e: any) {
      setMessage(e?.message || "Erreur création pièce.");
    } finally {
      setBusy(false);
    }
  }

  function openAdjust() {
    if (!item) return;
    setQtyValue(String(item.quantite));
    setAction("adjust");
    setMessage("");
  }

  function openReceive() {
    setQtyValue("1");
    setAction("receive");
    setMessage("");
  }

  function openSupersede() {
    setOldCode("");
    setAction("supersede");
    setMessage("");
  }

  async function saveAdjust() {
    if (!item || busy) return;
    const qty = Number(qtyValue.replace(",", "."));
    if (!Number.isFinite(qty) || qty < 0) {
      setMessage("Quantité invalide.");
      return;
    }

    setBusy(true);
    try {
      const updated = await scannerApi<StockItem>("set_inventory_quantity", {
        itemId: item.id,
        quantity: qty,
      });
      setItem(updated);
      setAction("none");
      setMessage("Quantité d’inventaire mise à jour.");
      navigator.vibrate?.([60, 40, 60]);
    } catch (e: any) {
      setMessage(e?.message || "Erreur mise à jour.");
    } finally {
      setBusy(false);
    }
  }

  async function saveReceive() {
    if (!item || busy) return;
    const qty = Number(qtyValue.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage("Quantité reçue invalide.");
      return;
    }

    setBusy(true);
    try {
      const rows = await scannerApi<StockItem[]>("receive_inventory", {
        items: [{ itemId: item.id, quantity: qty }],
      });
      const updated = rows?.[0];
      if (updated) setItem(updated);
      setAction("none");
      setMessage(`${qty} ajouté au stock.`);
      navigator.vibrate?.([60, 40, 60]);
    } catch (e: any) {
      setMessage(e?.message || "Erreur réception.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSupersede() {
    if (!item || !oldCode.trim() || busy) return;

    setBusy(true);
    try {
      await scannerApi("create_supersede", {
        oldCode: oldCode.trim(),
        newItemId: item.id,
      });
      setAction("none");
      setMessage(
        `${oldCode.trim()} pointera maintenant vers ${item.sku || item.nom}.`,
      );
      setOldCode("");
      navigator.vibrate?.([60, 40, 60]);
    } catch (e: any) {
      setMessage(e?.message || "Erreur supersede.");
    } finally {
      setBusy(false);
    }
  }

  function resetSelection() {
    setItem(null);
    setMissingCode("");
    setMessage("");
    setAction("none");
    setOldCode("");
    setSearchQuery("");
    setSearchResults([]);
    setEditingCost(false);
  }

  return (
    <div style={modeStyles.page}>
      <div style={modeStyles.shell}>
        <div style={modeStyles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <button style={modeStyles.back} onClick={item || missingCode ? resetSelection : onExit}>
              ← {item || missingCode ? "Inventaire" : "Modes"}
            </button>
          </div>

          <h1 style={{ ...modeStyles.title, marginTop: 12 }}>Inventaire</h1>
          <div style={modeStyles.subtitle}>
            {item
              ? "Fiche de la pièce sélectionnée"
              : "Scanne une pièce pour ouvrir sa fiche"}
          </div>
        </div>

        {!item && !missingCode ? (
          <>
            <div style={{ ...modeStyles.card, marginTop: 12, padding: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid #cbd5e1",
                  borderRadius: 12,
                  padding: "0 11px",
                  background: "#fff",
                }}
              >
                <span style={{ fontSize: 18 }} aria-hidden="true">🔍</span>
                <input
                  value={searchQuery}
                  onChange={(e) => void searchInventory(e.target.value)}
                  placeholder="Rechercher par SKU, description ou ancien SKU"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 48,
                    border: 0,
                    outline: "none",
                    fontSize: 15,
                    background: "transparent",
                  }}
                />
              </div>

              {searchBusy ? (
                <div style={{ padding: "10px 4px 2px", color: "#64748b", fontSize: 12 }}>
                  Recherche…
                </div>
              ) : searchResults.length > 0 ? (
                <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => chooseSearchResult(result)}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        background: "#f8fafc",
                        padding: "10px 11px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontWeight: 950 }}>{result.sku || "Sans SKU"}</span>
                        <span style={{ fontWeight: 850 }}>{formatMoney(result.coutUnitaire)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
                        {result.nom}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={{ marginTop: 12 }}>
              <AnimatedReady />
            </div>

            <div
              style={{
                ...modeStyles.card,
                marginTop: 12,
                textAlign: "center",
                padding: 32,
                color: "#94a3b8",
                fontWeight: 750,
              }}
            >
              Scanner une pièce existante.
              <div style={{ marginTop: 5, fontSize: 12 }}>
                Si elle n’existe pas, tu pourras la créer immédiatement.
              </div>
            </div>
          </>
        ) : null}

        {message ? (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background:
                message.includes("mise à jour") ||
                message.includes("ajouté") ||
                message.includes("créée") ||
                message.includes("pointera")
                  ? "#ecfdf5"
                  : "#fff7ed",
              color:
                message.includes("mise à jour") ||
                message.includes("ajouté") ||
                message.includes("créée") ||
                message.includes("pointera")
                  ? "#166534"
                  : "#9a3412",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {message}
          </div>
        ) : null}

        {missingCode ? (
          <div style={{ ...modeStyles.card, marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
              NOUVELLE PIÈCE
            </div>
            <div style={{ fontSize: 22, fontWeight: 950, marginTop: 4 }}>
              {missingCode}
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <input
                value={createForm.nom}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, nom: e.target.value }))
                }
                placeholder="Description / nom de la pièce"
                style={{
                  minHeight: 48,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 12px",
                  fontSize: 16,
                  boxSizing: "border-box",
                }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  value={createForm.unite}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, unite: e.target.value }))
                  }
                  placeholder="Unité"
                  style={{
                    minHeight: 46,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "0 12px",
                    fontSize: 15,
                  }}
                />
                <input
                  value={createForm.quantite}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, quantite: e.target.value }))
                  }
                  inputMode="decimal"
                  placeholder="Qté initiale"
                  style={{
                    minHeight: 46,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "0 12px",
                    fontSize: 15,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  value={createForm.coutUnitaire}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, coutUnitaire: e.target.value }))
                  }
                  inputMode="decimal"
                  placeholder="Coût unitaire"
                  style={{
                    minHeight: 46,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "0 12px",
                    fontSize: 15,
                  }}
                />
                <input
                  value={createForm.emplacement}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, emplacement: e.target.value }))
                  }
                  placeholder="Emplacement"
                  style={{
                    minHeight: 46,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "0 12px",
                    fontSize: 15,
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              style={{ ...modeStyles.greenButton, marginTop: 14 }}
              disabled={busy}
              onClick={() => void createMissingItem()}
            >
              Créer la pièce
            </button>
          </div>
        ) : null}

        {item ? (
          <>
            <div style={{ ...modeStyles.card, marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 950, color: "#64748b" }}>
                {item.sku || "SANS SKU"}
              </div>
              <div style={{ fontSize: 24, fontWeight: 950, marginTop: 3 }}>
                {item.nom}
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div style={{ background: "#f1f5f9", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>
                    EN STOCK
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 950 }}>
                    {item.quantite}
                  </div>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>
                    EMPLACEMENT
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, marginTop: 5 }}>
                    {item.emplacement || "—"}
                  </div>
                </div>

                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: "#ecfdf5",
                    border: "1px solid #bbf7d0",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#166534" }}>
                    COÛT UNITAIRE
                  </div>

                  {editingCost ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 7 }}>
                      <input
                        value={costValue}
                        onChange={(e) => setCostValue(e.target.value)}
                        inputMode="decimal"
                        autoFocus
                        style={{
                          minWidth: 0,
                          height: 42,
                          border: "1px solid #86efac",
                          borderRadius: 9,
                          padding: "0 10px",
                          fontSize: 20,
                          fontWeight: 950,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void saveItemCost()}
                        style={{
                          border: 0,
                          borderRadius: 9,
                          background: "#16a34a",
                          color: "#fff",
                          padding: "0 14px",
                          fontWeight: 950,
                        }}
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingCost(true)}
                      style={{
                        marginTop: 5,
                        border: 0,
                        padding: 0,
                        background: "transparent",
                        fontSize: 25,
                        fontWeight: 950,
                        color: "#166534",
                        cursor: "pointer",
                      }}
                    >
                      {formatMoney(item.coutUnitaire)} ✎
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                ...modeStyles.card,
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 17, fontWeight: 950 }}>Imprimer étiquette</div>
                <div style={{ ...modeStyles.subtitle, marginTop: 2 }}>
                  Brother QL-810Wc · 29 × 90 mm
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setLabelQty((q) => Math.max(1, q - 1))}
                    style={modeStyles.minus}
                  >
                    −
                  </button>
                  <input
                    value={String(labelQty)}
                    inputMode="numeric"
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const value = Number(e.target.value || 1);
                      if (Number.isFinite(value)) {
                        setLabelQty(Math.max(1, Math.min(50, Math.floor(value))));
                      }
                    }}
                    style={{
                      width: 48,
                      height: 34,
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      textAlign: "center",
                      fontWeight: 950,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setLabelQty((q) => Math.min(50, q + 1))}
                    style={modeStyles.minus}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={labelPrinting || !item.sku}
                onClick={printSelectedLabel}
                style={{
                  minWidth: 112,
                  minHeight: 58,
                  border: 0,
                  borderRadius: 12,
                  background: "#0f172a",
                  color: "#fff",
                  fontWeight: 950,
                  fontSize: 14,
                  cursor: "pointer",
                  opacity: labelPrinting || !item.sku ? 0.45 : 1,
                }}
              >
                {labelPrinting ? "Impression…" : "🏷️ Imprimer"}
              </button>
            </div>

            {action === "none" ? (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <button type="button" style={modeStyles.action} onClick={openAdjust}>
                  <div style={{ fontSize: 19, fontWeight: 950 }}>Ajuster quantité</div>
                  <div style={modeStyles.subtitle}>Corriger le stock physique</div>
                </button>

                <button type="button" style={modeStyles.action} onClick={openReceive}>
                  <div style={{ fontSize: 19, fontWeight: 950 }}>Réceptionner</div>
                  <div style={modeStyles.subtitle}>Ajouter une quantité au stock</div>
                </button>

                <button type="button" style={modeStyles.action} onClick={openSupersede}>
                  <div style={{ fontSize: 19, fontWeight: 950 }}>Ajouter un supersede</div>
                  <div style={modeStyles.subtitle}>
                    Associer un ancien SKU à cette pièce
                  </div>
                </button>
              </div>
            ) : null}

            {action === "adjust" || action === "receive" ? (
              <div style={{ ...modeStyles.card, marginTop: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>
                  {action === "adjust" ? "Ajuster quantité" : "Réceptionner"}
                </div>
                <div style={{ ...modeStyles.subtitle, marginBottom: 10 }}>
                  {action === "adjust"
                    ? `Stock actuel : ${item.quantite}`
                    : "Quantité à ajouter au stock"}
                </div>

                <input
                  value={qtyValue}
                  onChange={(e) => setQtyValue(e.target.value)}
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    minHeight: 58,
                    border: "2px solid #2563eb",
                    borderRadius: 12,
                    padding: "0 14px",
                    boxSizing: "border-box",
                    fontSize: 28,
                    fontWeight: 950,
                    textAlign: "center",
                  }}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1.25fr",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <button
                    type="button"
                    style={modeStyles.back}
                    onClick={() => setAction("none")}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    style={modeStyles.blueButton}
                    disabled={busy}
                    onClick={() =>
                      void (action === "adjust" ? saveAdjust() : saveReceive())
                    }
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            ) : null}

            {action === "supersede" ? (
              <div style={{ ...modeStyles.card, marginTop: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>
                  Ajouter un supersede
                </div>
                <div style={{ ...modeStyles.subtitle, marginBottom: 12 }}>
                  Scanne maintenant l’ancien SKU à associer à cette pièce.
                </div>

                <AnimatedReady />

                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    background: "#f1f5f9",
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>
                    ANCIEN SKU
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 950,
                      marginTop: 4,
                      color: oldCode ? "#111827" : "#94a3b8",
                    }}
                  >
                    {oldCode || "En attente du scan…"}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1.25fr",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <button
                    type="button"
                    style={modeStyles.back}
                    onClick={() => {
                      setAction("none");
                      setOldCode("");
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    style={{
                      ...modeStyles.greenButton,
                      opacity: !oldCode || busy ? 0.45 : 1,
                    }}
                    disabled={!oldCode || busy}
                    onClick={() => void saveSupersede()}
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}


function ConfigurationMode({ onExit }: { onExit: () => void }) {
  const bridge = (window as any).GBScanner;

  const [printerHost, setPrinterHost] = useState("");
  const [scannerUrl, setScannerUrl] = useState("");
  const [rotate180, setRotate180] = useState(false);

  function refreshConfiguration() {
    try {
      setPrinterHost(
        bridge && typeof bridge.getPrinterHost === "function"
          ? String(bridge.getPrinterHost() || "")
          : "",
      );

      setScannerUrl(
        bridge && typeof bridge.getScannerUrl === "function"
          ? String(bridge.getScannerUrl() || "")
          : window.location.href,
      );

      setRotate180(
        bridge && typeof bridge.getPrinterRotate180 === "function"
          ? Boolean(bridge.getPrinterRotate180())
          : false,
      );
    } catch {
      setPrinterHost("");
      setScannerUrl(window.location.href);
      setRotate180(false);
    }
  }

  useEffect(() => {
    refreshConfiguration();

    const onVisible = () => refreshConfiguration();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  function openNativeConfiguration() {
    if (!bridge || typeof bridge.configurePrinter !== "function") {
      alert(
        "La configuration de l’imprimante est disponible dans l’app GB Scanner Android.",
      );
      return;
    }

    bridge.configurePrinter();
  }

  return (
    <div style={modeStyles.page}>
      <div style={modeStyles.shell}>
        <div style={modeStyles.card}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "46px 1fr",
              gap: 10,
              alignItems: "center",
            }}
          >
            <button type="button" style={modeStyles.back} onClick={onExit}>
              ←
            </button>
            <div>
              <div style={modeStyles.title}>Configuration</div>
              <div style={modeStyles.subtitle}>
                Terminal scanner et imprimante d’étiquettes
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...modeStyles.card, marginTop: 12 }}>
          <div style={{ fontSize: 19, fontWeight: 950 }}>Imprimante Brother</div>
          <div style={{ ...modeStyles.subtitle, marginTop: 3 }}>
            Brother QL-810Wc
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 4 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "11px 0",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <span style={{ color: "#64748b", fontWeight: 800 }}>Adresse IP</span>
              <span style={{ fontWeight: 950 }}>
                {printerHost || "Non configurée"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "11px 0",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <span style={{ color: "#64748b", fontWeight: 800 }}>
                Format par défaut
              </span>
              <span style={{ fontWeight: 950 }}>62 × 20 mm</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "11px 0",
              }}
            >
              <span style={{ color: "#64748b", fontWeight: 800 }}>
                Rotation 180°
              </span>
              <span style={{ fontWeight: 950 }}>
                {rotate180 ? "Oui" : "Non"}
              </span>
            </div>
          </div>

          <button
            type="button"
            style={{
              ...modeStyles.greenButton,
              width: "100%",
              minHeight: 54,
              marginTop: 14,
            }}
            onClick={openNativeConfiguration}
          >
            ⚙️ Configurer l’imprimante
          </button>
        </div>

        <div style={{ ...modeStyles.card, marginTop: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 950 }}>Application</div>
          <div
            style={{
              ...modeStyles.subtitle,
              marginTop: 6,
              wordBreak: "break-all",
            }}
          >
            {scannerUrl || "Adresse non disponible"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScannerPiecesPage() {
  const [mode, setMode] = useState<ScannerMode>("home");

  if (mode === "bt") {
    return <BtScannerMode onExit={() => setMode("home")} />;
  }

  if (mode === "reception") {
    return <ReceptionMode onExit={() => setMode("home")} />;
  }

  if (mode === "inventory") {
    return <InventoryMode onExit={() => setMode("home")} />;
  }

  if (mode === "configuration") {
    return <ConfigurationMode onExit={() => setMode("home")} />;
  }

  return <ModeHome onMode={setMode} />;
}
