import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { supabase } from "../../lib/supabaseClient";

export type Piece = {
  id: string;
  bt_id: string;
  inventaire_item_id?: string | null;
  sku?: string | null;
  unite?: string | null;
  description: string;
  quantite: number | string;
  prix_unitaire: number | string;
  marge_pct_snapshot?: number | null;
  prix_facture_unitaire_snapshot?: number | null;
  total_facture_snapshot?: number | null;
};

type InventaireItem = {
  id: string;

  sku: string | null;
  nom: string;

  unite: string | null;
  cout_unitaire: number | null;
  quantite: number | null;

  actif?: boolean | null;

  suivi_actif?: boolean | null;
  suivi_type?: string | null;
  categorie_piece_id?: string | null;
  sous_categorie_piece_id?: string | null;

  matched_by?: "sku" | "supersed" | null;
  supersed_code?: string | null;
};

type PieceCategorie = {
  id: string;
  nom: string;
};

type ScanLookupRow = {
  item_id: string;
  sku: string | null;
  nom: string | null;
  matched_by: string;
};

type PendingPiece = {
  key: string;
  inventaire_item_id: string | null;
  sku: string;
  description: string;
  unite: string;
  quantite: string;
  prix_unitaire: string;
  is_manual?: boolean;
  matched_by?: "sku" | "supersed" | null;
  suivi_actif?: boolean | null;
  suivi_type?: string | null;
  categorie_piece_id?: string | null;
  sous_categorie_piece_id?: string | null;
  suivi_action?: "installation" | "remplacement" | "retrait" | "ignorer";
  suivi_localisation?: string;
  suivi_remplace_evenement_id?: string | null;
};

type PieceSuiviEvenement = {
  id: string;
  created_at?: string | null;
  unite_id: string;
  bt_id?: string | null;
  inventaire_item_id?: string | null;
  suivi_type: string;
  categorie_piece_id?: string | null;
  sous_categorie_piece_id?: string | null;
  localisation: string;
  action: string;
  date_evenement?: string | null;
  km?: number | null;
  actif: boolean;
  remplace_evenement_id?: string | null;
  piece_sku?: string | null;
  piece_nom?: string | null;
  note?: string | null;
};

type QuickCreateForm = {
  sku: string;
  nom: string;
  categorie: string;
  quantite: string;
  unite: string;
  cout_unitaire: string;
  seuil_alerte: string;
  emplacement: string;
  note: string;
};

type BtPiecesCardProps = {
  btId: string;
  uniteId?: string | null;
  btKm?: number | string | null;
  pieces: Piece[];
  setPieces: React.Dispatch<React.SetStateAction<Piece[]>>;
  isReadOnly: boolean;
  piecesTableAvailable: boolean;
  isBtOpenPricing: boolean;
  effectiveMargePiecesPct: number;
  onReload: (btId: string) => Promise<void>;
};

function money(v: number) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(v || 0);
}

function pct(v: number) {
  return `${Number(v || 0)} %`;
}

function toNum(value: unknown) {
  const n = Number(
    String(value ?? "")
      .trim()
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
}

function isDecimalInput(value: string) {
  return /^\d*([,.]\d*)?$/.test(value);
}

function toNullableText(value: string) {
  const cleaned = String(value ?? "").trim();
  return cleaned ? cleaned : null;
}

function toNumberOrZero(value: unknown) {
  const n = Number(
    String(value ?? "")
      .trim()
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(value: unknown) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function makePendingKey(prefix = "piece") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeQuickCreateForm(searchTerm = ""): QuickCreateForm {
  const text = searchTerm.trim();

  return {
    sku: text && !text.includes(" ") ? text : "",
    nom: text,
    categorie: "",
    quantite: "0",
    unite: "",
    cout_unitaire: "0",
    seuil_alerte: "0",
    emplacement: "",
    note: "Créée rapidement depuis un bon de travail.",
  };
}

const LOCALISATIONS_SUIVI = [
  { value: "ignore", label: "Ignoré" },
  { value: "avant", label: "Avant" },
  { value: "arriere", label: "Arrière" },
  { value: "avant_gauche", label: "Avant gauche" },
  { value: "avant_droite", label: "Avant droite" },
  { value: "arriere_gauche", label: "Arrière gauche" },
  { value: "arriere_droite", label: "Arrière droite" },
  { value: "tous", label: "Tous" },
];

function localisationLabel(value: string | null | undefined) {
  return (
    LOCALISATIONS_SUIVI.find((x) => x.value === value)?.label || value || "—"
  );
}

function formatKm(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(n)} km`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

export default function BtPiecesCard({
  btId,
  uniteId,
  btKm,
  pieces,
  setPieces,
  isReadOnly,
  piecesTableAvailable,
  isBtOpenPricing,
  effectiveMargePiecesPct,
  onReload,
}: BtPiecesCardProps) {
  const [pieceModalOpen, setPieceModalOpen] = useState(false);

  const [suiviModalOpen, setSuiviModalOpen] = useState(false);
  const [suiviItem, setSuiviItem] = useState<InventaireItem | null>(null);
  const [suiviAction, setSuiviAction] = useState<
    "installation" | "remplacement" | "retrait" | "ignorer"
  >("installation");
  const [suiviLocalisation, setSuiviLocalisation] = useState("ignore");
  const [suiviPendingKey, setSuiviPendingKey] = useState<string | null>(null);
  const [suiviActifs, setSuiviActifs] = useState<PieceSuiviEvenement[]>([]);
  const [suiviLoading, setSuiviLoading] = useState(false);
  const [suiviError, setSuiviError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [inventoryResults, setInventoryResults] = useState<InventaireItem[]>(
    [],
  );
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [pendingPieces, setPendingPieces] = useState<PendingPiece[]>([]);
  const [scanHint, setScanHint] = useState<string>("");

  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateSaving, setQuickCreateSaving] = useState(false);
  const [quickCreateForm, setQuickCreateForm] = useState<QuickCreateForm>(() =>
    makeQuickCreateForm(),
  );
  const [categories, setCategories] = useState<PieceCategorie[]>([]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickNameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!pieceModalOpen) return;
    const t = setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }, [pieceModalOpen]);

  useEffect(() => {
    if (!quickCreateOpen) return;
    const t = setTimeout(() => {
      quickNameInputRef.current?.focus();
      quickNameInputRef.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }, [quickCreateOpen]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const { data, error } = await supabase
          .from("pieces_categories")
          .select("id, nom")
          .order("nom", { ascending: true });

        if (error) throw error;
        setCategories((data || []) as PieceCategorie[]);
      } catch (e) {
        console.warn("Catégories de pièces non disponibles:", e);
        setCategories([]);
      }
    }

    void loadCategories();
  }, []);

  useEffect(() => {
    if (!suiviModalOpen || !suiviItem) return;

    const existing = activeEventForLocalisation(suiviLocalisation);

    if (suiviLocalisation !== "ignore" && existing) {
      setSuiviAction("remplacement");
    } else if (suiviAction === "remplacement") {
      setSuiviAction("installation");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suiviLocalisation, suiviActifs, suiviModalOpen, suiviItem]);

  function getPieceFactureU(p: Piece) {
    if (isBtOpenPricing) {
      const coutU = toNum(p.prix_unitaire);
      return coutU * (1 + effectiveMargePiecesPct / 100);
    }

    if (p.prix_facture_unitaire_snapshot != null) {
      return Number(p.prix_facture_unitaire_snapshot || 0);
    }

    const coutU = toNum(p.prix_unitaire);
    const margePct =
      p.marge_pct_snapshot != null
        ? Number(p.marge_pct_snapshot || 0)
        : effectiveMargePiecesPct;

    return coutU * (1 + margePct / 100);
  }

  function getPieceMargePct(p: Piece) {
    if (isBtOpenPricing) return effectiveMargePiecesPct;
    if (p.marge_pct_snapshot != null) return Number(p.marge_pct_snapshot || 0);
    return effectiveMargePiecesPct;
  }

  function getPieceTotalFacture(p: Piece) {
    if (isBtOpenPricing) {
      return toNum(p.quantite) * getPieceFactureU(p);
    }

    if (p.total_facture_snapshot != null) {
      return Number(p.total_facture_snapshot || 0);
    }

    return toNum(p.quantite) * getPieceFactureU(p);
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
    let nextQty = currentQty + delta;

    // Empêche juste de descendre sous 0 sans bloquer l'ajout au BT.
    if (nextQty < 0) nextQty = 0;

    const { error: updateError } = await supabase
      .from("inventaire_items")
      .update({ quantite: nextQty })
      .eq("id", itemId);

    if (updateError) throw updateError;
  }

  async function searchInventory(term: string) {
    const q = term.trim();
    setSearchTerm(term);
    setScanHint("");

    if (q.length < 2) {
      setInventoryResults([]);
      return;
    }

    setInventoryLoading(true);

    try {
      const { data: directData, error: directError } = await supabase
        .from("inventaire_items")
        .select(
          `
          id,
          sku,
          nom,
          unite,
          cout_unitaire,
          quantite,
          actif,
          suivi_actif,
          suivi_type,
          categorie_piece_id,
          sous_categorie_piece_id
        `,
        )
        .eq("actif", true)
        .or(`nom.ilike.%${q}%,sku.ilike.%${q}%`)
        .order("nom", { ascending: true })
        .limit(12);

      if (directError) throw directError;

      const directRows: InventaireItem[] = (
        (directData || []) as InventaireItem[]
      ).map((row) => ({
        ...row,
        matched_by: "sku",
        supersed_code: null,
      }));

      const { data: supersedData, error: supersedError } = await supabase
        .from("inventaire_supersedes")
        .select("item_id, sku_remplacement, nom_remplacement, note, actif")
        .eq("actif", true)
        .or(
          `sku_remplacement.ilike.%${q}%,nom_remplacement.ilike.%${q}%,note.ilike.%${q}%`,
        )
        .limit(12);

      if (supersedError) throw supersedError;

      const supersedRows = (supersedData || []) as Array<{
        item_id: string;
        sku_remplacement: string | null;
        nom_remplacement: string | null;
        note: string | null;
        actif: boolean | null;
      }>;

      let supersedItems: InventaireItem[] = [];

      if (supersedRows.length > 0) {
        const itemIds = Array.from(
          new Set(supersedRows.map((row) => row.item_id).filter(Boolean)),
        );

        const { data: itemData, error: itemError } = await supabase
          .from("inventaire_items")
          .select(
            `
          id,
          sku,
          nom,
          unite,
          cout_unitaire,
          quantite,
          actif,
          suivi_actif,
          suivi_type,
          categorie_piece_id,
          sous_categorie_piece_id
        `,
          )
          .eq("actif", true)
          .in("id", itemIds);

        if (itemError) throw itemError;

        const supersedByItemId = new Map(
          supersedRows.map((row) => [
            row.item_id,
            row.sku_remplacement ||
              row.nom_remplacement ||
              row.note ||
              "supersed",
          ]),
        );

        supersedItems = ((itemData || []) as InventaireItem[]).map((row) => ({
          ...row,
          matched_by: "supersed" as const,
          supersed_code: supersedByItemId.get(row.id) || null,
        }));
      }

      const merged: InventaireItem[] = [...directRows];

      for (const item of supersedItems) {
        const existingIndex = merged.findIndex((row) => row.id === item.id);

        if (existingIndex >= 0) {
          if (merged[existingIndex].matched_by !== "supersed") {
            merged[existingIndex] = {
              ...merged[existingIndex],
              matched_by: "supersed",
              supersed_code: item.supersed_code ?? null,
            };
          }

          continue;
        }

        merged.push(item);
      }

      setInventoryResults(merged.slice(0, 12));

      if (supersedItems.length > 0) {
        setScanHint(
          "Supersed détecté — la pièce courante est affichée dans les résultats.",
        );
      }
    } catch (e: any) {
      console.error("Erreur recherche inventaire:", e);
      alert(e?.message || "Erreur recherche inventaire");
      setInventoryResults([]);
    } finally {
      setInventoryLoading(false);
    }
  }

  async function loadSuivisActifsForItem(item: InventaireItem) {
    setSuiviActifs([]);
    setSuiviError(null);

    if (!uniteId) {
      setSuiviError(
        "Unité introuvable : impossible de vérifier les positions suivies.",
      );
      return;
    }

    setSuiviLoading(true);

    try {
      let query = supabase
        .from("pieces_suivi_evenements")
        .select("*")
        .eq("unite_id", uniteId)
        .eq("actif", true)
        .order("date_evenement", { ascending: false })
        .order("created_at", { ascending: false });

      if (item.categorie_piece_id) {
        query = query.eq("categorie_piece_id", item.categorie_piece_id);
      }

      if (item.sous_categorie_piece_id) {
        query = query.eq(
          "sous_categorie_piece_id",
          item.sous_categorie_piece_id,
        );
      }

      if (
        !item.categorie_piece_id &&
        !item.sous_categorie_piece_id &&
        item.suivi_type
      ) {
        query = query.eq("suivi_type", item.suivi_type);
      }

      const { data, error } = await query;
      if (error) throw error;

      setSuiviActifs((data || []) as PieceSuiviEvenement[]);
    } catch (e: any) {
      console.error("Erreur chargement suivi actif:", e);
      setSuiviError(
        e?.message || "Impossible de charger les positions déjà suivies.",
      );
      setSuiviActifs([]);
    } finally {
      setSuiviLoading(false);
    }
  }

  function activeEventForLocalisation(localisation: string) {
    return suiviActifs.find((ev) => ev.localisation === localisation) || null;
  }

  function openSuiviForPendingPiece(item: InventaireItem, pendingKey: string) {
    setSuiviItem(item);
    setSuiviPendingKey(pendingKey);
    setSuiviAction("installation");
    setSuiviLocalisation("ignore");
    setSuiviModalOpen(true);
    void loadSuivisActifsForItem(item);
  }

  function chooseInventoryItem(
    item: InventaireItem,
    matchedBy: "sku" | "supersed" | null = null,
  ) {
    const pendingKey = makePendingKey("inv");

    setPendingPieces((rows) => [
      ...rows,
      {
        key: pendingKey,
        inventaire_item_id: item.id,
        sku: item.sku || "",
        description: item.nom || "",
        unite: item.unite || "",
        quantite: "1",
        prix_unitaire: String(Number(item.cout_unitaire || 0)),
        is_manual: false,
        matched_by: matchedBy,
        suivi_actif: Boolean(item.suivi_actif),
        suivi_type: item.suivi_type ?? null,
        categorie_piece_id: item.categorie_piece_id ?? null,
        sous_categorie_piece_id: item.sous_categorie_piece_id ?? null,
        suivi_action: item.suivi_actif ? "installation" : undefined,
        suivi_localisation: item.suivi_actif ? "ignore" : undefined,
        suivi_remplace_evenement_id: null,
      },
    ]);

    if (item.suivi_actif) {
      openSuiviForPendingPiece(item, pendingKey);
    }

    if (matchedBy === "supersed") {
      setScanHint("Code remplacé détecté — pièce courante sélectionnée.");
    } else if (matchedBy === "sku") {
      setScanHint("Pièce trouvée par scan.");
    } else {
      setScanHint("");
    }

    setSearchTerm("");
    setInventoryResults([]);
    setQuickCreateOpen(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }

  async function handleScanEnter() {
    const code = searchTerm.trim();
    if (!code) return;

    setScanHint("");

    try {
      const { data, error } = await supabase.rpc(
        "inventaire_trouver_par_code",
        {
          p_code: code,
        },
      );

      if (error) throw error;

      const rows = (data || []) as ScanLookupRow[];

      if (rows.length > 0) {
        const match = rows[0];

        const { data: itemData, error: itemError } = await supabase
          .from("inventaire_items")
          .select(
            `
          id,
          sku,
          nom,
          unite,
          cout_unitaire,
          quantite,
          actif,
          suivi_actif,
          suivi_type,
          categorie_piece_id,
          sous_categorie_piece_id
        `,
          )
          .eq("id", match.item_id)
          .single();

        if (itemError) throw itemError;
        if (!itemData) throw new Error("Pièce inventaire introuvable.");

        chooseInventoryItem(
          itemData as InventaireItem,
          match.matched_by === "supersed" ? "supersed" : "sku",
        );
        return;
      }

      await searchInventory(code);
      setScanHint(
        "Aucune correspondance exacte au scan — résultats de recherche affichés.",
      );
    } catch (e: any) {
      console.error("Erreur scan inventaire:", e);
      alert(e?.message || "Erreur scan inventaire");
    }
  }

  function addManualPendingPiece() {
    setPendingPieces((rows) => [
      ...rows,
      {
        key: makePendingKey("manual"),
        inventaire_item_id: null,
        sku: "",
        description: "",
        unite: "",
        quantite: "1",
        prix_unitaire: "",
        is_manual: true,
        matched_by: null,
      },
    ]);
  }

  function openQuickCreate() {
    setQuickCreateForm(makeQuickCreateForm(searchTerm));
    setQuickCreateOpen(true);
    setScanHint("");
  }

  function cancelQuickCreate() {
    if (quickCreateSaving) return;
    setQuickCreateOpen(false);
    setQuickCreateForm(makeQuickCreateForm());
  }

  async function createInventoryItemAndAddToBt() {
    if (isReadOnly || !piecesTableAvailable || quickCreateSaving) return;

    const nom = quickCreateForm.nom.trim();
    if (!nom) {
      alert("Le nom de la pièce est obligatoire.");
      return;
    }

    const payload = {
      sku: toNullableText(quickCreateForm.sku),
      nom,
      categorie: toNullableText(quickCreateForm.categorie),
      quantite: toNumberOrZero(quickCreateForm.quantite),
      unite: toNullableText(quickCreateForm.unite),
      cout_unitaire: toNullableNumber(quickCreateForm.cout_unitaire),
      seuil_alerte: toNumberOrZero(quickCreateForm.seuil_alerte),
      emplacement: toNullableText(quickCreateForm.emplacement),
      actif: true,
      note: toNullableText(quickCreateForm.note),
    };

    setQuickCreateSaving(true);

    try {
      const { data, error } = await supabase
        .from("inventaire_items")
        .insert(payload)
        .select(
          `
          id,
          sku,
          nom,
          unite,
          cout_unitaire,
          quantite,
          actif,
          suivi_actif,
          suivi_type,
          categorie_piece_id,
          sous_categorie_piece_id
        `,
        )
        .single();

      if (error) throw error;
      if (!data)
        throw new Error("La pièce a été créée, mais elle est introuvable.");

      chooseInventoryItem(data as InventaireItem, null);
      setQuickCreateForm(makeQuickCreateForm());
      setQuickCreateOpen(false);
      setScanHint(
        "Nouvelle pièce créée dans l’inventaire et ajoutée à la liste du BT.",
      );
    } catch (e: any) {
      console.error("Erreur création rapide inventaire:", e);
      alert(e?.message || "Erreur lors de la création de la pièce.");
    } finally {
      setQuickCreateSaving(false);
    }
  }

  function openSelectionModal() {
    setPieceModalOpen(true);
  }

  function clearPendingPieces() {
    setPendingPieces([]);
    setSearchTerm("");
    setInventoryResults([]);
    setScanHint("");
    setQuickCreateOpen(false);
    setQuickCreateForm(makeQuickCreateForm());
  }

  function closePieceModal() {
    setPieceModalOpen(false);
    setSuiviModalOpen(false);
    setSuiviItem(null);
    clearPendingPieces();
  }

  function closeSuiviModal() {
    setSuiviModalOpen(false);
    setSuiviItem(null);
    setSuiviAction("installation");
    setSuiviLocalisation("ignore");
    setSuiviPendingKey(null);
    setSuiviActifs([]);
    setSuiviError(null);
  }

  function confirmSuiviModal() {
    if (!suiviPendingKey || !suiviItem) {
      closeSuiviModal();
      return;
    }

    const existing = activeEventForLocalisation(suiviLocalisation);
    const resolvedAction =
      suiviAction === "installation" &&
      suiviLocalisation !== "ignore" &&
      existing
        ? "remplacement"
        : suiviAction;

    updatePendingPiece(suiviPendingKey, {
      suivi_action: resolvedAction,
      suivi_localisation: suiviLocalisation,
      suivi_remplace_evenement_id:
        resolvedAction === "remplacement" || resolvedAction === "retrait"
          ? existing?.id || null
          : null,
    });

    closeSuiviModal();
  }

  function updatePendingPiece(key: string, patch: Partial<PendingPiece>) {
    setPendingPieces((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function removePendingPiece(key: string) {
    setPendingPieces((rows) => rows.filter((r) => r.key !== key));
  }

  async function saveSuiviForPendingPieces(rows: PendingPiece[]) {
    if (!rows.some((row) => row.suivi_actif && row.suivi_action !== "ignorer"))
      return;

    if (!uniteId) {
      console.warn("Suivi pièces ignoré: uniteId manquant.");
      return;
    }

    const kmValue = toNullableNumber(btKm ?? null);

    if (kmValue == null || kmValue <= 0) {
      throw new Error(
        "Impossible d’ajouter une pièce suivie sans KM au BT.",
      );
    }

    for (const row of rows) {
      if (!row.suivi_actif || row.suivi_action === "ignorer") continue;

      const action = row.suivi_action || "installation";
      const localisation = row.suivi_localisation || "ignore";
      let remplaceId = row.suivi_remplace_evenement_id || null;

      if (
        (action === "remplacement" || action === "retrait") &&
        !remplaceId &&
        localisation !== "ignore"
      ) {
        let query = supabase
          .from("pieces_suivi_evenements")
          .select("id")
          .eq("unite_id", uniteId)
          .eq("localisation", localisation)
          .eq("actif", true)
          .limit(1);

        if (row.categorie_piece_id)
          query = query.eq("categorie_piece_id", row.categorie_piece_id);
        if (row.sous_categorie_piece_id)
          query = query.eq(
            "sous_categorie_piece_id",
            row.sous_categorie_piece_id,
          );
        if (
          !row.categorie_piece_id &&
          !row.sous_categorie_piece_id &&
          row.suivi_type
        ) {
          query = query.eq("suivi_type", row.suivi_type);
        }

        const { data } = await query;
        remplaceId = String((data || [])[0]?.id || "") || null;
      }

      if (remplaceId) {
        const { error: deactivateError } = await supabase
          .from("pieces_suivi_evenements")
          .update({ actif: false })
          .eq("id", remplaceId);

        if (deactivateError) throw deactivateError;
      }

      const payload = {
        unite_id: uniteId,
        bt_id: btId,
        inventaire_item_id: row.inventaire_item_id,
        suivi_type: row.suivi_type || "piece",
        categorie_piece_id: row.categorie_piece_id || null,
        sous_categorie_piece_id: row.sous_categorie_piece_id || null,
        localisation,
        action,
        date_evenement: new Date().toISOString(),
        km: kmValue,
        actif: action !== "retrait",
        remplace_evenement_id: remplaceId,
        piece_sku: row.sku || null,
        piece_nom: row.description || null,
      };

      const { error: insertError } = await supabase
        .from("pieces_suivi_evenements")
        .insert(payload);

      if (insertError) throw insertError;
    }
  }

  async function addPieces() {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }

    if (!piecesTableAvailable) {
      alert("La table bt_pieces n'existe pas encore dans la DB.");
      return;
    }

    if (!pendingPieces.length) {
      alert("Aucune pièce sélectionnée.");
      return;
    }

    const payload = pendingPieces.map((row) => {
      const description = String(row.description || "").trim();
      const quantite = toNum(row.quantite);
      const prix_unitaire = toNum(row.prix_unitaire);

      if (!description) {
        throw new Error(
          `Description requise pour ${row.sku || "la pièce manuelle"}.`,
        );
      }

      if (!Number.isFinite(quantite) || quantite <= 0) {
        throw new Error(`Quantité invalide pour ${row.sku || description}.`);
      }

      if (!Number.isFinite(prix_unitaire) || prix_unitaire < 0) {
        throw new Error(
          `Coût unitaire invalide pour ${row.sku || description}.`,
        );
      }

      const margePct = effectiveMargePiecesPct;
      const prixFactureUnitaire = prix_unitaire * (1 + margePct / 100);
      const totalFacture = quantite * prixFactureUnitaire;

      return {
        bt_id: btId,
        inventaire_item_id: row.inventaire_item_id,
        sku: row.sku || null,
        unite: row.unite || null,
        description,
        quantite,
        prix_unitaire,
        marge_pct_snapshot: margePct,
        prix_facture_unitaire_snapshot: prixFactureUnitaire,
        total_facture_snapshot: totalFacture,
      };
    });

    try {
      const { error } = await supabase.from("bt_pieces").insert(payload);
      if (error) throw error;

      for (const row of pendingPieces) {
        const quantite = toNum(row.quantite);
        if (
          row.inventaire_item_id &&
          Number.isFinite(quantite) &&
          quantite > 0
        ) {
          await adjustInventoryStock(row.inventaire_item_id, -quantite);
        }
      }

      await saveSuiviForPendingPieces(pendingPieces);

      closePieceModal();
      await onReload(btId);
    } catch (e: any) {
      alert(e?.message || "Erreur ajout pièce");
    }
  }

  async function autoSavePieceRow(pieceId: string) {
    if (isReadOnly || !piecesTableAvailable) return;

    const row = pieces.find((p) => p.id === pieceId);
    if (!row) return;

    const description = String(row.description || "").trim();
    const quantite = toNum(row.quantite);
    const prix_unitaire = toNum(row.prix_unitaire);

    if (!description) return;
    if (!Number.isFinite(quantite) || quantite <= 0) return;
    if (!Number.isFinite(prix_unitaire) || prix_unitaire < 0) return;

    const margePct = isBtOpenPricing
      ? effectiveMargePiecesPct
      : row.marge_pct_snapshot != null
        ? Number(row.marge_pct_snapshot || 0)
        : effectiveMargePiecesPct;

    const prixFactureUnitaire = prix_unitaire * (1 + margePct / 100);
    const totalFacture = quantite * prixFactureUnitaire;

    try {
      const { data: dbRow, error: readError } = await supabase
        .from("bt_pieces")
        .select("id, quantite, inventaire_item_id")
        .eq("id", pieceId)
        .single();

      if (readError) throw readError;
      if (!dbRow) throw new Error("Ligne de pièce introuvable.");

      const originalQty = Number((dbRow as any).quantite || 0);
      const newQty = toNum(row.quantite);
      const originalItemId =
        ((dbRow as any).inventaire_item_id as string | null) ?? null;
      const currentItemId = row.inventaire_item_id ?? null;

      if (originalItemId !== currentItemId) {
        throw new Error(
          "Le lien inventaire de cette pièce a changé. Recharge le BT avant de continuer.",
        );
      }

      const deltaStock = originalQty - newQty;

      const { error } = await supabase
        .from("bt_pieces")
        .update({
          sku: row.sku || null,
          unite: row.unite || null,
          description,
          quantite: newQty,
          prix_unitaire,
          marge_pct_snapshot: margePct,
          prix_facture_unitaire_snapshot: prixFactureUnitaire,
          total_facture_snapshot: totalFacture,
        })
        .eq("id", pieceId);

      if (error) throw error;

      if (currentItemId && deltaStock !== 0) {
        await adjustInventoryStock(currentItemId, deltaStock);
      }

      await onReload(btId);
    } catch (e: any) {
      alert(e?.message || "Erreur mise à jour pièce");
      await onReload(btId);
    }
  }

  async function deletePiece(pieceId: string) {
    if (isReadOnly) {
      alert("BT fermé / verrouillé / facturé : impossible de modifier.");
      return;
    }

    if (!piecesTableAvailable) return;
    if (!confirm("Supprimer cette pièce ?")) return;

    const row = pieces.find((p) => p.id === pieceId);
    if (!row) return;

    try {
      const { error } = await supabase
        .from("bt_pieces")
        .delete()
        .eq("id", pieceId);
      if (error) throw error;

      if (row.inventaire_item_id) {
        await adjustInventoryStock(row.inventaire_item_id, toNum(row.quantite));
      }

      await onReload(btId);
    } catch (e: any) {
      alert(e?.message || "Erreur suppression pièce");
    }
  }

  function updatePieceLocal(pieceId: string, patch: Partial<Piece>) {
    setPieces((rows) =>
      rows.map((r) => (r.id === pieceId ? { ...r, ...patch } : r)),
    );
  }

  const modalLineTotal = useMemo(() => {
    return pendingPieces.reduce((sum, row) => {
      const qty = toNum(row.quantite);
      const cost = toNum(row.prix_unitaire);
      if (!Number.isFinite(qty) || !Number.isFinite(cost)) return sum;
      const factureU = cost * (1 + effectiveMargePiecesPct / 100);
      return sum + qty * factureU;
    }, 0);
  }, [pendingPieces, effectiveMargePiecesPct]);

  const canQuickCreate =
    searchTerm.trim().length >= 2 &&
    !inventoryLoading &&
    !quickCreateOpen &&
    inventoryResults.length === 0;

  const styles: Record<string, CSSProperties> = {
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
      marginBottom: 12,
    },
    row: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      minWidth: 220,
      background: "#fff",
    },
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
    btnDanger: {
      padding: "9px 12px",
      borderRadius: 10,
      border: "1px solid #dc2626",
      background: "#dc2626",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    },
    btnPlus: {
      width: 40,
      height: 40,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.14)",
      background: "#fff",
      color: "#111827",
      fontSize: 22,
      fontWeight: 900,
      lineHeight: 1,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto",
    },
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: {
      textAlign: "left" as const,
      fontSize: 12,
      color: "rgba(0,0,0,.55)",
      padding: "8px 6px",
    },
    td: {
      padding: "10px 6px",
      borderTop: "1px solid rgba(0,0,0,.08)",
      verticalAlign: "top" as const,
    },
    muted: { color: "rgba(0,0,0,.6)" },
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
    info: {
      background: "rgba(37,99,235,.08)",
      border: "1px solid rgba(37,99,235,.18)",
      borderRadius: 12,
      padding: 10,
      color: "#1d4ed8",
      fontWeight: 700,
      fontSize: 13,
      marginTop: 10,
    },
    resultBtn: {
      width: "100%",
      textAlign: "left" as const,
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,.10)",
      background: "#fff",
      cursor: "pointer",
      fontWeight: 700,
    },
    tiny: {
      fontSize: 12,
      color: "rgba(0,0,0,.6)",
    },
    dashBox: {
      minHeight: 44,
      display: "flex",
      alignItems: "center",
      color: "rgba(0,0,0,.55)",
      fontWeight: 700,
      padding: "0 8px",
    },

    modalBackdrop: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(15,23,42,.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 1000,
    },
    modalCard: {
      width: "100%",
      maxWidth: 1100,
      maxHeight: "88vh",
      background: "#fff",
      borderRadius: 16,
      border: "1px solid rgba(0,0,0,.08)",
      boxShadow: "0 24px 60px rgba(0,0,0,.18)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column" as const,
    },
    modalHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      borderBottom: "1px solid rgba(0,0,0,.08)",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 900,
      margin: 0,
    },
    iconCloseBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,.12)",
      background: "#fff",
      fontSize: 26,
      fontWeight: 900,
      lineHeight: 1,
      cursor: "pointer",
    },
    modalBody: {
      padding: 16,
      overflowY: "auto" as const,
      display: "grid",
      gap: 14,
    },
    modalSection: {
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 14,
      background: "#fafafa",
    },
    modalSectionTitle: {
      fontSize: 14,
      fontWeight: 900,
      marginBottom: 10,
    },
    searchRow: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
    },
    resultsWrap: {
      display: "grid",
      gap: 8,
      maxHeight: 260,
      overflowY: "auto" as const,
    },
    modalFooter: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      padding: 16,
      borderTop: "1px solid rgba(0,0,0,.08)",
      background: "#fff",
    },
    selectedList: {
      display: "grid",
      gap: 10,
      marginTop: 12,
    },
    selectedItem: {
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 12,
      background: "#fff",
      padding: 12,
    },
    selectedLine: {
      display: "grid",
      gridTemplateColumns:
        "minmax(110px, 150px) minmax(240px, 1fr) 130px 150px 34px",
      gap: 12,
      alignItems: "center",
    },
    removeMiniBtn: {
      width: 32,
      height: 32,
      borderRadius: 999,
      border: "1px solid rgba(220,38,38,.25)",
      background: "#fff",
      color: "#dc2626",
      fontWeight: 900,
      cursor: "pointer",
      lineHeight: 1,
      justifySelf: "end",
    },
    inlineFieldWrap: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      width: "100%",
    },
    inlineSuffix: {
      position: "absolute",
      right: 12,
      top: "50%",
      transform: "translateY(-50%)",
      fontSize: 12,
      fontWeight: 900,
      color: "rgba(0,0,0,.55)",
      pointerEvents: "none",
    },
    inputWithSuffix: {
      paddingRight: 42,
      width: "100%",
      minWidth: 0,
    },
    badgeSupersed: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 8px",
      borderRadius: 999,
      background: "#eff6ff",
      color: "#1d4ed8",
      fontSize: 12,
      fontWeight: 900,
      marginTop: 8,
    },
    quickCreateBox: {
      marginTop: 12,
      border: "1px solid rgba(37,99,235,.20)",
      borderRadius: 12,
      background: "#fff",
      padding: 12,
    },
    quickCreateGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    },
    quickCreateFull: {
      gridColumn: "1 / -1",
    },
    fieldLabel: {
      display: "block",
      fontSize: 12,
      fontWeight: 900,
      color: "rgba(0,0,0,.65)",
      marginBottom: 5,
    },
    quickActions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 12,
      flexWrap: "wrap",
    },
    suiviBackdrop: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(15,23,42,.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 1200,
    },
    suiviCard: {
      width: "100%",
      maxWidth: 520,
      background: "#fff",
      borderRadius: 16,
      border: "1px solid rgba(0,0,0,.08)",
      boxShadow: "0 24px 60px rgba(0,0,0,.22)",
      overflow: "hidden",
    },
    suiviHeader: {
      padding: "14px 16px",
      borderBottom: "1px solid rgba(0,0,0,.08)",
    },
    suiviBody: {
      padding: 16,
      display: "grid",
      gap: 12,
    },
    suiviInfoBox: {
      border: "1px solid rgba(37,99,235,.18)",
      background: "rgba(37,99,235,.06)",
      borderRadius: 12,
      padding: 12,
      color: "#1e3a8a",
      fontWeight: 750,
      fontSize: 13,
    },
    suiviExistingBox: {
      border: "1px solid rgba(0,0,0,.08)",
      background: "#f8fafc",
      borderRadius: 12,
      padding: 12,
      display: "grid",
      gap: 8,
    },
    suiviExistingItem: {
      border: "1px solid rgba(0,0,0,.08)",
      background: "#fff",
      borderRadius: 10,
      padding: 10,
    },
  };

  return (
    <>
      <div style={styles.card}>
        <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 10 }}>
          Pièces
        </div>

        <div style={{ ...styles.row, marginBottom: 10 }}>
          <button
            style={styles.btnPrimary}
            onClick={openSelectionModal}
            disabled={isReadOnly || !piecesTableAvailable}
          >
            Ajouter une pièce
          </button>
        </div>

        {!piecesTableAvailable && (
          <div style={styles.warn}>
            ⚠️ La table <b>bt_pieces</b> n’existe pas encore. Ajoute-la pour
            activer cette section.
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 130 }}>SKU</th>
                <th style={styles.th}>Description</th>
                <th style={{ ...styles.th, width: 90 }}>Unité</th>
                <th style={{ ...styles.th, width: 90 }}>Qté</th>
                <th style={{ ...styles.th, width: 130 }}>Coût unitaire</th>
                <th style={{ ...styles.th, width: 110 }}>Marge</th>
                <th style={{ ...styles.th, width: 150 }}>
                  Prix facturé unitaire
                </th>
                <th style={{ ...styles.th, width: 130 }}>Total facturé</th>
                <th style={{ ...styles.th, width: 120 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pieces.length === 0 ? (
                <tr>
                  <td style={styles.td} colSpan={9}>
                    <span style={styles.muted}>Aucune pièce.</span>
                  </td>
                </tr>
              ) : (
                pieces.map((p) => {
                  const margePct = getPieceMargePct(p);
                  const factureU = getPieceFactureU(p);
                  const lineTotal = getPieceTotalFacture(p);
                  const uniteVide = !String(p.unite ?? "").trim();

                  return (
                    <tr key={p.id}>
                      <td style={styles.td}>
                        <input
                          style={{
                            ...styles.input,
                            minWidth: 100,
                            width: "100%",
                          }}
                          value={p.sku ?? ""}
                          onChange={(e) =>
                            updatePieceLocal(p.id, { sku: e.target.value })
                          }
                          onBlur={() => autoSavePieceRow(p.id)}
                          disabled={isReadOnly || !piecesTableAvailable}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          style={{
                            ...styles.input,
                            minWidth: 180,
                            width: "100%",
                          }}
                          value={p.description ?? ""}
                          onChange={(e) =>
                            updatePieceLocal(p.id, {
                              description: e.target.value,
                            })
                          }
                          onBlur={() => autoSavePieceRow(p.id)}
                          disabled={isReadOnly || !piecesTableAvailable}
                        />
                      </td>
                      <td style={styles.td}>
                        {uniteVide ? (
                          <div style={styles.dashBox}>—</div>
                        ) : (
                          <input
                            style={{
                              ...styles.input,
                              minWidth: 80,
                              width: "100%",
                            }}
                            value={p.unite ?? ""}
                            onChange={(e) =>
                              updatePieceLocal(p.id, { unite: e.target.value })
                            }
                            onBlur={() => autoSavePieceRow(p.id)}
                            disabled={isReadOnly || !piecesTableAvailable}
                          />
                        )}
                      </td>
                      <td style={styles.td}>
                        <input
                          style={{
                            ...styles.input,
                            minWidth: 70,
                            width: "100%",
                          }}
                          inputMode="numeric"
                          value={String(p.quantite ?? 0)}
                          onChange={(e) =>
                            updatePieceLocal(p.id, {
                              quantite: toNum(e.target.value),
                            })
                          }
                          onBlur={() => autoSavePieceRow(p.id)}
                          disabled={isReadOnly || !piecesTableAvailable}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          style={{
                            ...styles.input,
                            minWidth: 110,
                            width: "100%",
                          }}
                          inputMode="decimal"
                          value={String(p.prix_unitaire ?? "")}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (isDecimalInput(value)) {
                              updatePieceLocal(p.id, { prix_unitaire: value });
                            }
                          }}
                          onBlur={() => {
                            updatePieceLocal(p.id, {
                              prix_unitaire: toNum(p.prix_unitaire),
                            });
                            void autoSavePieceRow(p.id);
                          }}
                          disabled={isReadOnly || !piecesTableAvailable}
                        />
                      </td>
                      <td style={styles.td}>{pct(margePct)}</td>
                      <td style={styles.td}>{money(factureU)}</td>
                      <td style={styles.td}>{money(lineTotal)}</td>
                      <td style={styles.td}>
                        <button
                          style={styles.btn}
                          disabled={isReadOnly || !piecesTableAvailable}
                          onClick={() => deletePiece(p.id)}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pieceModalOpen && (
        <div style={styles.modalBackdrop} onClick={closePieceModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Ajouter une pièce</h3>
              <button
                type="button"
                style={styles.iconCloseBtn}
                onClick={closePieceModal}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.modalSection}>
                <div style={styles.modalSectionTitle}>Recherche inventaire</div>

                <div style={styles.searchRow}>
                  <input
                    ref={searchInputRef}
                    style={{ ...styles.input, flex: 1, minWidth: 320 }}
                    placeholder="Scanner ou rechercher par SKU / nom"
                    value={searchTerm}
                    onChange={(e) => searchInventory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleScanEnter();
                      }
                    }}
                    disabled={isReadOnly || !piecesTableAvailable}
                    autoComplete="off"
                    spellCheck={false}
                  />

                  <button
                    type="button"
                    style={styles.btnPlus}
                    onClick={addManualPendingPiece}
                    disabled={isReadOnly || !piecesTableAvailable}
                    title="Ajouter une pièce manuellement au BT sans créer dans l'inventaire"
                  >
                    +
                  </button>

                  <button
                    type="button"
                    style={styles.btn}
                    onClick={clearPendingPieces}
                    disabled={isReadOnly || !piecesTableAvailable}
                  >
                    Vider
                  </button>
                </div>

                <div style={{ marginTop: 8, ...styles.tiny }}>
                  {inventoryLoading
                    ? "Recherche..."
                    : pendingPieces.length
                      ? `${pendingPieces.length} pièce(s) sélectionnée(s)`
                      : "Aucune pièce sélectionnée"}
                </div>

                <div style={{ marginTop: 8, ...styles.tiny }}>
                  Compatible scan clavier : clique dans le champ, scanne, puis
                  Entrée.
                </div>

                {scanHint ? <div style={styles.info}>{scanHint}</div> : null}

                {canQuickCreate && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      style={styles.btnPrimary}
                      onClick={openQuickCreate}
                      disabled={isReadOnly || !piecesTableAvailable}
                    >
                      + Créer “{searchTerm.trim()}” dans l’inventaire
                    </button>
                  </div>
                )}

                {quickCreateOpen && (
                  <div style={styles.quickCreateBox}>
                    <div style={styles.modalSectionTitle}>
                      Création rapide inventaire
                    </div>

                    <div style={styles.quickCreateGrid}>
                      <div>
                        <label style={styles.fieldLabel}>SKU / code</label>
                        <input
                          style={{
                            ...styles.input,
                            width: "100%",
                            minWidth: 0,
                          }}
                          value={quickCreateForm.sku}
                          onChange={(e) =>
                            setQuickCreateForm((p) => ({
                              ...p,
                              sku: e.target.value,
                            }))
                          }
                          disabled={quickCreateSaving}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>

                      <div>
                        <label style={styles.fieldLabel}>Nom *</label>
                        <input
                          ref={quickNameInputRef}
                          style={{
                            ...styles.input,
                            width: "100%",
                            minWidth: 0,
                          }}
                          value={quickCreateForm.nom}
                          onChange={(e) =>
                            setQuickCreateForm((p) => ({
                              ...p,
                              nom: e.target.value,
                            }))
                          }
                          disabled={quickCreateSaving}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>

                      <div>
                        <label style={styles.fieldLabel}>Catégorie</label>
                        <select
                          style={{
                            ...styles.input,
                            width: "100%",
                            minWidth: 0,
                          }}
                          value={quickCreateForm.categorie}
                          onChange={(e) =>
                            setQuickCreateForm((p) => ({
                              ...p,
                              categorie: e.target.value,
                            }))
                          }
                          disabled={quickCreateSaving}
                        >
                          <option value="">Sélectionner</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.nom}>
                              {cat.nom}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={styles.fieldLabel}>Unité</label>
                        <input
                          style={{
                            ...styles.input,
                            width: "100%",
                            minWidth: 0,
                          }}
                          value={quickCreateForm.unite}
                          onChange={(e) =>
                            setQuickCreateForm((p) => ({
                              ...p,
                              unite: e.target.value,
                            }))
                          }
                          disabled={quickCreateSaving}
                          placeholder="UN, L, boîte..."
                        />
                      </div>

                      <div>
                        <label style={styles.fieldLabel}>
                          Quantité initiale
                        </label>
                        <input
                          style={{
                            ...styles.input,
                            width: "100%",
                            minWidth: 0,
                          }}
                          value={quickCreateForm.quantite}
                          onChange={(e) =>
                            setQuickCreateForm((p) => ({
                              ...p,
                              quantite: e.target.value,
                            }))
                          }
                          disabled={quickCreateSaving}
                          inputMode="decimal"
                        />
                      </div>

                      <div>
                        <label style={styles.fieldLabel}>Coût unitaire</label>
                        <input
                          style={{
                            ...styles.input,
                            width: "100%",
                            minWidth: 0,
                          }}
                          value={quickCreateForm.cout_unitaire}
                          onChange={(e) =>
                            setQuickCreateForm((p) => ({
                              ...p,
                              cout_unitaire: e.target.value,
                            }))
                          }
                          disabled={quickCreateSaving}
                          inputMode="decimal"
                        />
                      </div>

                      <div>
                        <label style={styles.fieldLabel}>Seuil alerte</label>
                        <input
                          style={{
                            ...styles.input,
                            width: "100%",
                            minWidth: 0,
                          }}
                          value={quickCreateForm.seuil_alerte}
                          onChange={(e) =>
                            setQuickCreateForm((p) => ({
                              ...p,
                              seuil_alerte: e.target.value,
                            }))
                          }
                          disabled={quickCreateSaving}
                          inputMode="decimal"
                        />
                      </div>

                      <div>
                        <label style={styles.fieldLabel}>Emplacement</label>
                        <input
                          style={{
                            ...styles.input,
                            width: "100%",
                            minWidth: 0,
                          }}
                          value={quickCreateForm.emplacement}
                          onChange={(e) =>
                            setQuickCreateForm((p) => ({
                              ...p,
                              emplacement: e.target.value,
                            }))
                          }
                          disabled={quickCreateSaving}
                        />
                      </div>

                      <div style={styles.quickCreateFull}>
                        <label style={styles.fieldLabel}>Note</label>
                        <textarea
                          style={{
                            ...styles.input,
                            width: "100%",
                            minWidth: 0,
                            minHeight: 70,
                          }}
                          value={quickCreateForm.note}
                          onChange={(e) =>
                            setQuickCreateForm((p) => ({
                              ...p,
                              note: e.target.value,
                            }))
                          }
                          disabled={quickCreateSaving}
                        />
                      </div>
                    </div>

                    <div style={styles.quickActions}>
                      <button
                        type="button"
                        style={styles.btn}
                        onClick={cancelQuickCreate}
                        disabled={quickCreateSaving}
                      >
                        Annuler création
                      </button>

                      <button
                        type="button"
                        style={styles.btnPrimary}
                        onClick={createInventoryItemAndAddToBt}
                        disabled={quickCreateSaving}
                      >
                        {quickCreateSaving
                          ? "Création..."
                          : "Créer et ajouter au BT"}
                      </button>
                    </div>
                  </div>
                )}

                {inventoryResults.length > 0 && (
                  <div style={{ ...styles.resultsWrap, marginTop: 10 }}>
                    {inventoryResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        style={styles.resultBtn}
                        onClick={() =>
                          chooseInventoryItem(
                            item,
                            item.matched_by === "supersed" ? "supersed" : null,
                          )
                        }
                        disabled={isReadOnly || !piecesTableAvailable}
                      >
                        <div>
                          {item.sku || "—"} — {item.nom}
                        </div>
                        <div style={styles.tiny}>
                          Coût: {money(Number(item.cout_unitaire || 0))} •
                          Stock: {Number(item.quantite || 0)}
                        </div>

                        {item.matched_by === "supersed" && (
                          <div style={styles.badgeSupersed}>
                            Supersed détecté
                            {item.supersed_code
                              ? ` : ${item.supersed_code}`
                              : ""}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.modalSection}>
                <div style={styles.modalSectionTitle}>
                  Ajout au bon de travail
                </div>

                {!pendingPieces.length ? (
                  <div style={styles.tiny}>
                    Sélectionne une ou plusieurs pièces, crée une pièce
                    inventaire si elle n’existe pas, ou clique sur + pour
                    ajouter une ligne manuelle sans inventaire.
                  </div>
                ) : (
                  <div style={styles.selectedList}>
                    {pendingPieces.map((row) => (
                      <div key={row.key} style={styles.selectedItem}>
                        <div style={styles.selectedLine}>
                          <input
                            style={{
                              ...styles.input,
                              minWidth: 0,
                              width: "100%",
                            }}
                            placeholder="SKU"
                            value={row.sku}
                            onChange={(e) =>
                              updatePendingPiece(row.key, {
                                sku: e.target.value,
                              })
                            }
                            disabled={isReadOnly || !piecesTableAvailable}
                          />

                          <input
                            style={{
                              ...styles.input,
                              minWidth: 0,
                              width: "100%",
                            }}
                            placeholder="Description"
                            value={row.description}
                            onChange={(e) =>
                              updatePendingPiece(row.key, {
                                description: e.target.value,
                              })
                            }
                            disabled={isReadOnly || !piecesTableAvailable}
                          />

                          <div style={styles.inlineFieldWrap}>
                            <input
                              style={{
                                ...styles.input,
                                ...styles.inputWithSuffix,
                              }}
                              inputMode="numeric"
                              placeholder="Qté"
                              value={row.quantite}
                              onChange={(e) =>
                                updatePendingPiece(row.key, {
                                  quantite: e.target.value,
                                })
                              }
                              disabled={isReadOnly || !piecesTableAvailable}
                            />
                            <span style={styles.inlineSuffix}>QT</span>
                          </div>

                          <div style={styles.inlineFieldWrap}>
                            <input
                              style={{
                                ...styles.input,
                                ...styles.inputWithSuffix,
                              }}
                              inputMode="decimal"
                              placeholder="Coût"
                              value={row.prix_unitaire}
                              onChange={(e) =>
                                updatePendingPiece(row.key, {
                                  prix_unitaire: e.target.value,
                                })
                              }
                              disabled={isReadOnly || !piecesTableAvailable}
                            />
                            <span style={styles.inlineSuffix}>$</span>
                          </div>

                          <button
                            type="button"
                            style={styles.removeMiniBtn}
                            onClick={() => removePendingPiece(row.key)}
                            disabled={isReadOnly || !piecesTableAvailable}
                            title="Retirer cette pièce"
                          >
                            ×
                          </button>
                        </div>

                        {row.matched_by === "supersed" && (
                          <div style={styles.badgeSupersed}>
                            Supersed détecté
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12, ...styles.tiny }}>
                  Total facturé estimé: <b>{money(modalLineTotal)}</b>
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btnDanger}
                onClick={closePieceModal}
              >
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={addPieces}
                disabled={
                  isReadOnly ||
                  !piecesTableAvailable ||
                  pendingPieces.length === 0
                }
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {suiviModalOpen && suiviItem && (
        <div style={styles.suiviBackdrop} onClick={closeSuiviModal}>
          <div style={styles.suiviCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.suiviHeader}>
              <div style={{ fontSize: 18, fontWeight: 950 }}>
                Pièce suivie détectée
              </div>
              <div style={{ ...styles.tiny, marginTop: 4 }}>
                Choisis la position. Si une pièce est déjà active à cette
                position, le remplacement sera proposé automatiquement.
              </div>
            </div>

            <div style={styles.suiviBody}>
              <div style={styles.suiviInfoBox}>
                <div>
                  {suiviItem.sku || "—"} — {suiviItem.nom}
                </div>
                <div style={{ marginTop: 4 }}>
                  Type : {suiviItem.suivi_type || "—"}
                </div>
                <div style={{ marginTop: 4 }}>KM BT : {formatKm(btKm)}</div>
              </div>

              <div style={styles.suiviExistingBox}>
                <div style={{ fontWeight: 950 }}>
                  Positions actuellement suivies
                </div>

                {suiviLoading ? (
                  <div style={styles.tiny}>Chargement...</div>
                ) : suiviError ? (
                  <div
                    style={{
                      ...styles.tiny,
                      color: "#dc2626",
                      fontWeight: 800,
                    }}
                  >
                    {suiviError}
                  </div>
                ) : suiviActifs.length === 0 ? (
                  <div style={styles.tiny}>
                    Aucune position active trouvée pour cette catégorie.
                  </div>
                ) : (
                  suiviActifs.map((ev) => (
                    <div key={ev.id} style={styles.suiviExistingItem}>
                      <div style={{ fontWeight: 950 }}>
                        {localisationLabel(ev.localisation)}
                      </div>
                      <div style={styles.tiny}>
                        Pièce : {ev.piece_sku || ev.piece_nom || "—"}
                      </div>
                      <div style={styles.tiny}>
                        Installée le{" "}
                        {formatDate(ev.date_evenement || ev.created_at)} •{" "}
                        {formatKm(ev.km)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {suiviLocalisation !== "ignore" &&
              activeEventForLocalisation(suiviLocalisation) ? (
                <div style={styles.warn}>
                  Une pièce est déjà suivie à cette position. L’action sera
                  traitée comme un remplacement.
                </div>
              ) : null}

              <div>
                <label style={styles.fieldLabel}>Action</label>
                <select
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={suiviAction}
                  onChange={(e) =>
                    setSuiviAction(e.target.value as typeof suiviAction)
                  }
                >
                  <option value="installation">Nouvelle installation</option>
                  <option value="remplacement">Remplacement</option>
                  <option value="retrait">Retrait</option>
                  <option value="ignorer">Ignorer le suivi cette fois</option>
                </select>
              </div>

              <div>
                <label style={styles.fieldLabel}>Localisation</label>
                <select
                  style={{ ...styles.input, width: "100%", minWidth: 0 }}
                  value={suiviLocalisation}
                  onChange={(e) => setSuiviLocalisation(e.target.value)}
                >
                  {LOCALISATIONS_SUIVI.map((loc) => (
                    <option key={loc.value} value={loc.value}>
                      {loc.label}
                      {activeEventForLocalisation(loc.value)
                        ? " — déjà suivie"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btn}
                onClick={confirmSuiviModal}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
