import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Minus, PackageSearch, RotateCcw, Search, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/**
 * ScannerPiecesPage
 *
 * Page fantôme conçue pour un terminal Android 5,5" (SVANTTO ou similaire).
 *
 * Flux:
 * 1) Choisir un BT actif (recherche par no BT ou unité)
 * 2) Scanner les pièces. Le scanner écrit le code-barres + ENTER.
 * 3) Les scans identiques sont regroupés sur une seule ligne et la quantité augmente.
 * 4) "Annuler" vide la session sans rien enregistrer.
 * 5) "Terminer" enregistre les pièces au BT puis revient à la sélection.
 *
 * La logique inventaire / scan / ajout au BT reprend BtPiecesCard.
 * Les champs BT/unité sont alignés sur BonTravailPage et BonTravailMecanoPage.
 * Un code inconnu devient une ligne manuelle: SKU scanné + description à saisir.
 */

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
  cost: number;
  sansMarge: boolean;
  suiviActif: boolean;
  suiviType: string | null;
};

type ScannedPart = InventoryPart & {
  key: string;
  quantity: number;
  isManual: boolean;
};

type Notice =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | { type: "warning"; message: string }
  | null;

/* -------------------------------------------------------------------------- */
/*                         ACCÈS AUX DONNÉES ATELIER                          */
/* -------------------------------------------------------------------------- */

async function fetchOpenWorkOrders(): Promise<WorkOrder[]> {
  // Schéma confirmé par BonTravailPage / BonTravailMecanoPage:
  // bons_travail.numero, bons_travail.unite_id, bons_travail.date_ouverture
  // unites.no_unite
  const { data, error } = await supabase
    .from("bons_travail")
    .select("id, numero, date_ouverture, statut, unite_id")
    .in("statut", ["ouvert", "a_faire", "en_cours"])
    .not("unite_id", "is", null)
    .order("date_ouverture", { ascending: false })
    .limit(200);

  if (error) throw error;

  const rows = (data ?? []) as any[];
  const uniteIds = Array.from(
    new Set(rows.map((row) => String(row.unite_id || "")).filter(Boolean)),
  );

  let uniteById = new Map<string, string>();

  if (uniteIds.length) {
    const { data: uniteData, error: uniteError } = await supabase
      .from("unites")
      .select("id, no_unite")
      .in("id", uniteIds);

    if (uniteError) throw uniteError;

    uniteById = new Map(
      ((uniteData ?? []) as any[]).map((row) => [
        String(row.id),
        String(row.no_unite ?? ""),
      ]),
    );
  }

  return rows
    .map((row) => ({
      id: String(row.id),
      numero: String(row.numero ?? row.id),
      unite: uniteById.get(String(row.unite_id || "")) || "",
      openedAt: row.date_ouverture ?? null,
    }))
    .filter((bt) => bt.unite);
}

async function lookupPartByBarcode(barcode: string): Promise<InventoryPart | null> {
  const clean = barcode.trim();
  if (!clean) return null;

  // Même RPC que BtPiecesCard: gère SKU + supersed.
  const { data, error } = await supabase.rpc("inventaire_trouver_par_code", {
    p_code: clean,
  });

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    item_id: string;
    sku: string | null;
    nom: string | null;
    matched_by: string;
  }>;

  if (!rows.length) return null;

  const match = rows[0];

  const { data: itemData, error: itemError } = await supabase
    .from("inventaire_items")
    .select(`
      id,
      sku,
      nom,
      unite,
      cout_unitaire,
      sans_marge,
      actif,
      suivi_actif,
      suivi_type
    `)
    .eq("id", match.item_id)
    .eq("actif", true)
    .single();

  if (itemError) throw itemError;
  if (!itemData) return null;

  const item = itemData as any;

  return {
    id: String(item.id),
    barcode: clean,
    description: String(item.nom || "Pièce sans description"),
    partNumber: item.sku ? String(item.sku) : null,
    unite: item.unite ? String(item.unite) : null,
    cost: Number(item.cout_unitaire || 0),
    sansMarge: Boolean(item.sans_marge),
    suiviActif: Boolean(item.suivi_actif),
    suiviType: item.suivi_type ? String(item.suivi_type) : null,
  };
}

async function getBtMarginPct(btId: string): Promise<number> {
  // Reprend la configuration client utilisée par l'atelier.
  const { data: btData, error: btError } = await supabase
    .from("bons_travail")
    .select("client_id")
    .eq("id", btId)
    .single();

  if (btError) throw btError;

  const clientId = String((btData as any)?.client_id || "");
  if (!clientId) return 0;

  const { data: configData, error: configError } = await supabase
    .from("client_configuration")
    .select("marge_pieces")
    .eq("client_id", clientId)
    .eq("actif", true)
    .maybeSingle();

  if (configError) throw configError;

  const pct = Number((configData as any)?.marge_pieces ?? 0);
  return Number.isFinite(pct) ? pct : 0;
}

async function adjustInventoryStock(itemId: string, delta: number) {
  if (!itemId || !Number.isFinite(delta) || delta === 0) return;

  const { data, error } = await supabase
    .from("inventaire_items")
    .select("quantite")
    .eq("id", itemId)
    .single();

  if (error) throw error;

  const currentQty = Number((data as any)?.quantite || 0);
  const nextQty = Math.max(0, currentQty + delta);

  const { error: updateError } = await supabase
    .from("inventaire_items")
    .update({ quantite: nextQty })
    .eq("id", itemId);

  if (updateError) throw updateError;
}

async function commitScannedParts(btId: string, parts: ScannedPart[]): Promise<void> {
  const effectiveMargePiecesPct = await getBtMarginPct(btId);

  const payload = parts.map((part) => {
    const qty = Number(part.quantity || 0);
    const unitCost = Number(part.cost || 0);
    const marginPct = part.sansMarge ? 0 : effectiveMargePiecesPct;
    const invoicedUnitPrice = unitCost * (1 + marginPct / 100);

    return {
      bt_id: btId,
      inventaire_item_id: part.isManual ? null : part.id,
      sku: part.partNumber || null,
      unite: part.unite || null,
      description: part.description.trim(),
      quantite: qty,
      prix_unitaire: unitCost,
      sans_marge_snapshot: part.sansMarge,
      marge_pct_snapshot: marginPct,
      prix_facture_unitaire_snapshot: invoicedUnitPrice,
      total_facture_snapshot: qty * invoicedUnitPrice,
    };
  });

  const { error } = await supabase.from("bt_pieces").insert(payload);
  if (error) throw error;

  // Même logique que BtPiecesCard: seules les vraies pièces d'inventaire
  // diminuent le stock. Une ligne manuelle n'est liée à aucun inventaire_item_id.
  for (const part of parts) {
    if (!part.isManual && part.id) {
      await adjustInventoryStock(part.id, -Number(part.quantity || 0));
    }
  }
}

/* -------------------------------------------------------------------------- */

function formatOpenedDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ScannerPiecesPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingBts, setLoadingBts] = useState(true);
  const [selectedBt, setSelectedBt] = useState<WorkOrder | null>(null);

  const [search, setSearch] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [parts, setParts] = useState<ScannedPart[]>([]);
  const [notice, setNotice] = useState<Notice>(null);

  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoadingBts(true);
        const rows = await fetchOpenWorkOrders();
        if (mounted) setWorkOrders(rows);
      } catch (error) {
        console.error("Erreur chargement BT:", error);
        if (mounted) {
          setNotice({
            type: "error",
            message: "Impossible de charger les BT actifs.",
          });
        }
      } finally {
        if (mounted) setLoadingBts(false);
      }
    })();

    return () => {
      mounted = false;
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedBt) return;

    const timer = window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [selectedBt, parts.length, lookingUp]);

  const filteredBts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workOrders.slice(0, 40);

    return workOrders
      .filter(
        (bt) =>
          bt.numero.toLowerCase().includes(q) ||
          bt.unite.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [search, workOrders]);

  const totalItems = useMemo(
    () => parts.reduce((sum, part) => sum + part.quantity, 0),
    [parts]
  );

  function showNotice(next: Notice, timeout = 1800) {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    setNotice(next);

    if (next && timeout > 0) {
      noticeTimerRef.current = window.setTimeout(() => {
        setNotice(null);
      }, timeout);
    }
  }

  function selectBt(bt: WorkOrder) {
    setSelectedBt(bt);
    setParts([]);
    setScanValue("");
    setSearch("");
    setNotice(null);
  }

  function backToBtSelection() {
    setSelectedBt(null);
    setParts([]);
    setScanValue("");
    setNotice(null);
    window.setTimeout(() => {
      document.getElementById("bt-search")?.focus();
    }, 50);
  }

  async function handleScanSubmit(event: FormEvent) {
    event.preventDefault();

    const barcode = scanValue.trim();
    setScanValue("");

    if (!selectedBt || !barcode || lookingUp || saving) {
      scanInputRef.current?.focus();
      return;
    }

    setLookingUp(true);

    try {
      const part = await lookupPartByBarcode(barcode);

      if (!part) {
        const manualKey = `manual:${barcode.toLowerCase()}`;

        setParts((current) => {
          const existing = current.find((item) => item.key === manualKey);

          if (existing) {
            return current.map((item) =>
              item.key === manualKey
                ? { ...item, quantity: item.quantity + 1 }
                : item,
            );
          }

          return [
            {
              key: manualKey,
              id: "",
              barcode,
              description: "",
              partNumber: barcode,
              unite: null,
              cost: 0,
              sansMarge: false,
              suiviActif: false,
              suiviType: null,
              quantity: 1,
              isManual: true,
            },
            ...current,
          ];
        });

        showNotice(
          {
            type: "warning",
            message: `SKU ${barcode} non inventorié — ajoute une description`,
          },
          3000,
        );

        if ("vibrate" in navigator) navigator.vibrate?.([90, 50, 90]);
        return;
      }

      if (part.suiviActif) {
        showNotice(
          {
            type: "warning",
            message: `${part.description} est une pièce suivie. Ajoute-la directement dans le BT pour choisir la position.`,
          },
          4200,
        );
        if ("vibrate" in navigator) navigator.vibrate?.([100, 60, 100]);
        return;
      }

      setParts((current) => {
        const inventoryKey = `inventory:${part.id}`;
        const existing = current.find((item) => item.key === inventoryKey);

        if (existing) {
          return current.map((item) =>
            item.key === inventoryKey
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }

        return [
          {
            ...part,
            key: inventoryKey,
            quantity: 1,
            isManual: false,
          },
          ...current,
        ];
      });

      showNotice({
        type: "success",
        message: `${part.description} ajouté`,
      });

      if ("vibrate" in navigator) navigator.vibrate?.(45);
    } catch (error) {
      console.error("Erreur scan:", error);
      showNotice(
        {
          type: "error",
          message: "Erreur lors de la recherche de la pièce.",
        },
        2600
      );
    } finally {
      setLookingUp(false);
      window.setTimeout(() => scanInputRef.current?.focus(), 0);
    }
  }

  function decrementPart(partKey: string) {
    setParts((current) =>
      current
        .map((part) =>
          part.key === partKey
            ? { ...part, quantity: part.quantity - 1 }
            : part,
        )
        .filter((part) => part.quantity > 0),
    );

    window.setTimeout(() => scanInputRef.current?.focus(), 0);
  }

  function updateManualDescription(partKey: string, description: string) {
    setParts((current) =>
      current.map((part) =>
        part.key === partKey ? { ...part, description } : part,
      ),
    );
  }

  function cancelSession() {
    if (parts.length === 0) {
      backToBtSelection();
      return;
    }

    const confirmed = window.confirm(
      "Annuler tous les scans de cette session?"
    );

    if (!confirmed) {
      scanInputRef.current?.focus();
      return;
    }

    backToBtSelection();
  }

  async function finishSession() {
    if (!selectedBt || parts.length === 0 || saving) return;

    const incompleteManual = parts.find(
      (part) => part.isManual && !part.description.trim(),
    );

    if (incompleteManual) {
      showNotice(
        {
          type: "warning",
          message: `Description requise pour le SKU ${incompleteManual.partNumber || incompleteManual.barcode}`,
        },
        3200,
      );
      return;
    }

    try {
      setSaving(true);
      setNotice(null);

      await commitScannedParts(selectedBt.id, parts);

      const completedBt = selectedBt.numero;
      backToBtSelection();

      showNotice(
        {
          type: "success",
          message: `Pièces ajoutées au BT ${completedBt}`,
        },
        2200
      );
    } catch (error) {
      console.error("Erreur enregistrement pièces:", error);
      showNotice(
        {
          type: "error",
          message: "Impossible d'enregistrer les pièces. Aucun scan n'a été effacé.",
        },
        0
      );
    } finally {
      setSaving(false);
      window.setTimeout(() => scanInputRef.current?.focus(), 0);
    }
  }

  if (!selectedBt) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-3 py-3">
          <header className="mb-3">
            <h1 className="text-2xl font-bold tracking-tight">Choisir un BT</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Recherche par BT ou unité
            </p>
          </header>

          <div className="relative mb-3">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="bt-search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="BT ou unité..."
              className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {notice && (
            <div
              className={`mb-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                notice.type === "error"
                  ? "bg-red-50 text-red-700"
                  : notice.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800"
              }`}
              role="status"
            >
              {notice.message}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            {loadingBts ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-500">
                Chargement des BT...
              </div>
            ) : filteredBts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-500">
                Aucun BT actif trouvé.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredBts.map((bt) => (
                  <button
                    key={bt.id}
                    type="button"
                    onClick={() => selectBt(bt)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left active:bg-slate-100"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xl font-extrabold">
                        BT #{bt.numero}
                      </span>
                      <span className="text-xl font-bold text-emerald-700">
                        {bt.unite}
                      </span>
                    </div>

                    {bt.openedAt && (
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        Ouvert le {formatOpenedDate(bt.openedAt)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="border-b border-slate-200 bg-white px-3 pb-3 pt-3">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={cancelSession}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white active:bg-slate-100"
              aria-label="Retour"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <h1 className="truncate text-xl font-extrabold">
                  BT #{selectedBt.numero}
                </h1>
                <div className="shrink-0 text-xl font-extrabold text-emerald-700">
                  {selectedBt.unite}
                </div>
              </div>

              {selectedBt.openedAt && (
                <div className="mt-0.5 text-xs font-medium text-slate-500">
                  Ouvert le {formatOpenedDate(selectedBt.openedAt)}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleScanSubmit} className="mt-3">
            <label
              htmlFor="scanner-input"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Scanner une pièce
            </label>

            <div className="relative">
              <PackageSearch
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                ref={scanInputRef}
                id="scanner-input"
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="none"
                disabled={lookingUp || saving}
                placeholder={lookingUp ? "Recherche..." : "Prêt à scanner"}
                className="h-14 w-full rounded-xl border-2 border-emerald-600 bg-white pl-11 pr-3 text-lg font-semibold outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
              />
            </div>
          </form>

          {notice && (
            <div
              className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                notice.type === "error"
                  ? "bg-red-50 text-red-700"
                  : notice.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800"
              }`}
              role="status"
              aria-live="polite"
            >
              {notice.type === "success" ? (
                <Check className="h-5 w-5 shrink-0" />
              ) : notice.type === "error" ? (
                <X className="h-5 w-5 shrink-0" />
              ) : null}
              <span className="min-w-0 truncate">{notice.message}</span>
            </div>
          )}
        </header>

        <section className="flex min-h-0 flex-1 flex-col px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-700">
              Scans courants
            </div>
            <div className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
              {totalItems} article{totalItems === 1 ? "" : "s"}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {parts.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center text-slate-400">
                <PackageSearch className="mb-3 h-10 w-10" />
                <div className="text-base font-semibold text-slate-500">
                  Aucun scan
                </div>
                <div className="mt-1 text-sm">
                  Scanne une pièce pour commencer.
                </div>
              </div>
            ) : (
              <div>
                <div className="sticky top-0 z-10 grid grid-cols-[92px_1fr_74px] items-center gap-2 border-b border-slate-200 bg-slate-100 px-2 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                  <div>SKU</div>
                  <div>Nom</div>
                  <div className="text-center">Qté</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {parts.map((part) => (
                    <div
                      key={part.key}
                      className="grid min-h-[62px] grid-cols-[92px_1fr_74px] items-center gap-2 px-2 py-2"
                    >
                      <div className="min-w-0 truncate text-xs font-bold text-slate-700">
                        {part.partNumber || part.barcode}
                      </div>

                      <div className="min-w-0">
                        {part.isManual ? (
                          <input
                            value={part.description}
                            onChange={(e) =>
                              updateManualDescription(part.key, e.target.value)
                            }
                            onFocus={(e) => e.currentTarget.select()}
                            placeholder="Description..."
                            className="h-10 w-full min-w-0 rounded-lg border border-amber-300 bg-amber-50 px-2 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                            autoComplete="off"
                          />
                        ) : (
                          <div className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">
                            {part.description}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => decrementPart(part.key)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white active:bg-slate-100"
                          aria-label={`Retirer une unité de ${part.description || part.partNumber || "la pièce"}`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <div className="flex h-9 min-w-8 items-center justify-center rounded-lg bg-slate-100 px-2 text-lg font-extrabold tabular-nums">
                          {part.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-white p-3">
          <button
            type="button"
            onClick={cancelSession}
            disabled={saving}
            className="flex h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-base font-bold text-slate-800 active:bg-slate-100 disabled:opacity-50"
          >
            <RotateCcw className="h-5 w-5" />
            Annuler
          </button>

          <button
            type="button"
            onClick={finishSession}
            disabled={
              parts.length === 0 ||
              saving ||
              parts.some((part) => part.isManual && !part.description.trim())
            }
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-extrabold text-white active:bg-emerald-700 disabled:bg-slate-300"
          >
            <Check className="h-5 w-5" />
            {saving ? "Enregistrement..." : "Terminer"}
          </button>
        </footer>
      </div>
    </main>
  );
}
