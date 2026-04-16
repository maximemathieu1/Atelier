import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabaseClient";

export type Piece = {
  id: string;
  bt_id: string;
  inventaire_item_id?: string | null;
  sku?: string | null;
  unite?: string | null;
  description: string;
  quantite: number;
  prix_unitaire: number;
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
};

type BtPiecesCardProps = {
  btId: string;
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

function toNum(value: string) {
  const n = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function makePendingKey(prefix = "piece") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function BtPiecesCard({
  btId,
  pieces,
  setPieces,
  isReadOnly,
  piecesTableAvailable,
  isBtOpenPricing,
  effectiveMargePiecesPct,
  onReload,
}: BtPiecesCardProps) {
  const [pieceModalOpen, setPieceModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [inventoryResults, setInventoryResults] = useState<InventaireItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [pendingPieces, setPendingPieces] = useState<PendingPiece[]>([]);
  const [scanHint, setScanHint] = useState<string>("");

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!pieceModalOpen) return;
    const t = setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }, [pieceModalOpen]);

  function getPieceFactureU(p: Piece) {
    if (isBtOpenPricing) {
      const coutU = Number(p.prix_unitaire || 0);
      return coutU * (1 + effectiveMargePiecesPct / 100);
    }

    if (p.prix_facture_unitaire_snapshot != null) {
      return Number(p.prix_facture_unitaire_snapshot || 0);
    }

    const coutU = Number(p.prix_unitaire || 0);
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
      return Number(p.quantite || 0) * getPieceFactureU(p);
    }

    if (p.total_facture_snapshot != null) {
      return Number(p.total_facture_snapshot || 0);
    }

    return Number(p.quantite || 0) * getPieceFactureU(p);
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
    const nextQty = currentQty + delta;

    if (nextQty < 0) {
      throw new Error("Stock insuffisant pour cette modification.");
    }

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
      const { data, error } = await supabase
        .from("inventaire_items")
        .select("id, sku, nom, unite, cout_unitaire, quantite, actif")
        .eq("actif", true)
        .or(`nom.ilike.%${q}%,sku.ilike.%${q}%`)
        .order("nom", { ascending: true })
        .limit(12);

      if (error) throw error;
      setInventoryResults((data || []) as InventaireItem[]);
    } catch (e: any) {
      console.error("Erreur recherche inventaire:", e);
      alert(e?.message || "Erreur recherche inventaire");
      setInventoryResults([]);
    } finally {
      setInventoryLoading(false);
    }
  }

  function chooseInventoryItem(
    item: InventaireItem,
    matchedBy: "sku" | "supersed" | null = null
  ) {
    setPendingPieces((rows) => [
      ...rows,
      {
        key: makePendingKey("inv"),
        inventaire_item_id: item.id,
        sku: item.sku || "",
        description: item.nom || "",
        unite: item.unite || "",
        quantite: "1",
        prix_unitaire: String(Number(item.cout_unitaire || 0)),
        is_manual: false,
        matched_by: matchedBy,
      },
    ]);

    if (matchedBy === "supersed") {
      setScanHint("Code remplacé détecté — pièce courante sélectionnée.");
    } else if (matchedBy === "sku") {
      setScanHint("Pièce trouvée par scan.");
    } else {
      setScanHint("");
    }

    setSearchTerm("");
    setInventoryResults([]);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }

  async function handleScanEnter() {
    const code = searchTerm.trim();
    if (!code) return;

    setScanHint("");

    try {
      const { data, error } = await supabase.rpc("inventaire_trouver_par_code", {
        p_code: code,
      });

      if (error) throw error;

      const rows = (data || []) as ScanLookupRow[];

      if (rows.length > 0) {
        const match = rows[0];

        const { data: itemData, error: itemError } = await supabase
          .from("inventaire_items")
          .select("id, sku, nom, unite, cout_unitaire, quantite, actif")
          .eq("id", match.item_id)
          .single();

        if (itemError) throw itemError;
        if (!itemData) throw new Error("Pièce inventaire introuvable.");

        chooseInventoryItem(
          itemData as InventaireItem,
          match.matched_by === "supersed" ? "supersed" : "sku"
        );
        return;
      }

      await searchInventory(code);
      setScanHint("Aucune correspondance exacte au scan — résultats de recherche affichés.");
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

  function openSelectionModal() {
    setPieceModalOpen(true);
  }

  function clearPendingPieces() {
    setPendingPieces([]);
    setSearchTerm("");
    setInventoryResults([]);
    setScanHint("");
  }

  function closePieceModal() {
    setPieceModalOpen(false);
    clearPendingPieces();
  }

  function updatePendingPiece(key: string, patch: Partial<PendingPiece>) {
    setPendingPieces((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removePendingPiece(key: string) {
    setPendingPieces((rows) => rows.filter((r) => r.key !== key));
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
      const quantite = Number(row.quantite || 0);
      const prix_unitaire = Number(row.prix_unitaire || 0);

      if (!description) {
        throw new Error(`Description requise pour ${row.sku || "la pièce manuelle"}.`);
      }

      if (!Number.isFinite(quantite) || quantite <= 0) {
        throw new Error(`Quantité invalide pour ${row.sku || description}.`);
      }

      if (!Number.isFinite(prix_unitaire) || prix_unitaire < 0) {
        throw new Error(`Coût unitaire invalide pour ${row.sku || description}.`);
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
        const quantite = Number(row.quantite || 0);
        if (row.inventaire_item_id && Number.isFinite(quantite) && quantite > 0) {
          await adjustInventoryStock(row.inventaire_item_id, -quantite);
        }
      }

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
    const quantite = Number(row.quantite || 0);
    const prix_unitaire = Number(row.prix_unitaire || 0);

    if (!description) return;
    if (!Number.isFinite(quantite) || quantite <= 0) return;
    if (!Number.isFinite(prix_unitaire) || prix_unitaire < 0) return;

    const margePct =
      isBtOpenPricing
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
      const newQty = Number(row.quantite || 0);
      const originalItemId = ((dbRow as any).inventaire_item_id as string | null) ?? null;
      const currentItemId = row.inventaire_item_id ?? null;

      if (originalItemId !== currentItemId) {
        throw new Error(
          "Le lien inventaire de cette pièce a changé. Recharge le BT avant de continuer."
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
      const { error } = await supabase.from("bt_pieces").delete().eq("id", pieceId);
      if (error) throw error;

      if (row.inventaire_item_id) {
        await adjustInventoryStock(row.inventaire_item_id, Number(row.quantite || 0));
      }

      await onReload(btId);
    } catch (e: any) {
      alert(e?.message || "Erreur suppression pièce");
    }
  }

  function updatePieceLocal(pieceId: string, patch: Partial<Piece>) {
    setPieces((rows) => rows.map((r) => (r.id === pieceId ? { ...r, ...patch } : r)));
  }

  const modalLineTotal = useMemo(() => {
    return pendingPieces.reduce((sum, row) => {
      const qty = Number(row.quantite || 0);
      const cost = Number(row.prix_unitaire || 0);
      if (!Number.isFinite(qty) || !Number.isFinite(cost)) return sum;
      const factureU = cost * (1 + effectiveMargePiecesPct / 100);
      return sum + qty * factureU;
    }, 0);
  }, [pendingPieces, effectiveMargePiecesPct]);

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
      gridTemplateColumns: "minmax(110px, 150px) minmax(240px, 1fr) 130px 150px 34px",
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
  };

  return (
    <>
      <div style={styles.card}>
        <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 10 }}>Pièces</div>

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
            ⚠️ La table <b>bt_pieces</b> n’existe pas encore. Ajoute-la pour activer cette section.
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
                <th style={{ ...styles.th, width: 150 }}>Prix facturé unitaire</th>
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
                          style={{ ...styles.input, minWidth: 100, width: "100%" }}
                          value={p.sku ?? ""}
                          onChange={(e) => updatePieceLocal(p.id, { sku: e.target.value })}
                          onBlur={() => autoSavePieceRow(p.id)}
                          disabled={isReadOnly || !piecesTableAvailable}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          style={{ ...styles.input, minWidth: 180, width: "100%" }}
                          value={p.description ?? ""}
                          onChange={(e) => updatePieceLocal(p.id, { description: e.target.value })}
                          onBlur={() => autoSavePieceRow(p.id)}
                          disabled={isReadOnly || !piecesTableAvailable}
                        />
                      </td>
                      <td style={styles.td}>
                        {uniteVide ? (
                          <div style={styles.dashBox}>—</div>
                        ) : (
                          <input
                            style={{ ...styles.input, minWidth: 80, width: "100%" }}
                            value={p.unite ?? ""}
                            onChange={(e) => updatePieceLocal(p.id, { unite: e.target.value })}
                            onBlur={() => autoSavePieceRow(p.id)}
                            disabled={isReadOnly || !piecesTableAvailable}
                          />
                        )}
                      </td>
                      <td style={styles.td}>
                        <input
                          style={{ ...styles.input, minWidth: 70, width: "100%" }}
                          inputMode="numeric"
                          value={String(p.quantite ?? 0)}
                          onChange={(e) => updatePieceLocal(p.id, { quantite: toNum(e.target.value) })}
                          onBlur={() => autoSavePieceRow(p.id)}
                          disabled={isReadOnly || !piecesTableAvailable}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          style={{ ...styles.input, minWidth: 110, width: "100%" }}
                          inputMode="decimal"
                          value={String(p.prix_unitaire ?? 0)}
                          onChange={(e) =>
                            updatePieceLocal(p.id, { prix_unitaire: toNum(e.target.value) })
                          }
                          onBlur={() => autoSavePieceRow(p.id)}
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
              <button type="button" style={styles.iconCloseBtn} onClick={closePieceModal}>
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
                    title="Ajouter une pièce manuellement"
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
                  Compatible scan clavier : clique dans le champ, scanne, puis Entrée.
                </div>

                {scanHint ? <div style={styles.info}>{scanHint}</div> : null}

                {inventoryResults.length > 0 && (
                  <div style={{ ...styles.resultsWrap, marginTop: 10 }}>
                    {inventoryResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        style={styles.resultBtn}
                        onClick={() => chooseInventoryItem(item)}
                        disabled={isReadOnly || !piecesTableAvailable}
                      >
                        <div>
                          {(item.sku || "—")} — {item.nom}
                        </div>
                        <div style={styles.tiny}>
                          Coût: {money(Number(item.cout_unitaire || 0))} • Stock:{" "}
                          {Number(item.quantite || 0)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.modalSection}>
                <div style={styles.modalSectionTitle}>Ajout au bon de travail</div>

                {!pendingPieces.length ? (
                  <div style={styles.tiny}>
                    Sélectionne une ou plusieurs pièces, ou clique sur + si elle n’existe pas dans
                    l’inventaire.
                  </div>
                ) : (
                  <div style={styles.selectedList}>
                    {pendingPieces.map((row) => (
                      <div key={row.key} style={styles.selectedItem}>
                        <div style={styles.selectedLine}>
                          <input
                            style={{ ...styles.input, minWidth: 0, width: "100%" }}
                            placeholder="SKU"
                            value={row.sku}
                            onChange={(e) => updatePendingPiece(row.key, { sku: e.target.value })}
                            disabled={isReadOnly || !piecesTableAvailable}
                          />

                          <input
                            style={{ ...styles.input, minWidth: 0, width: "100%" }}
                            placeholder="Description"
                            value={row.description}
                            onChange={(e) =>
                              updatePendingPiece(row.key, { description: e.target.value })
                            }
                            disabled={isReadOnly || !piecesTableAvailable}
                          />

                          <div style={styles.inlineFieldWrap}>
                            <input
                              style={{ ...styles.input, ...styles.inputWithSuffix }}
                              inputMode="numeric"
                              placeholder="Qté"
                              value={row.quantite}
                              onChange={(e) =>
                                updatePendingPiece(row.key, { quantite: e.target.value })
                              }
                              disabled={isReadOnly || !piecesTableAvailable}
                            />
                            <span style={styles.inlineSuffix}>QT</span>
                          </div>

                          <div style={styles.inlineFieldWrap}>
                            <input
                              style={{ ...styles.input, ...styles.inputWithSuffix }}
                              inputMode="decimal"
                              placeholder="Coût"
                              value={row.prix_unitaire}
                              onChange={(e) =>
                                updatePendingPiece(row.key, { prix_unitaire: e.target.value })
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
                          <div style={styles.badgeSupersed}>Supersed détecté</div>
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
              <button type="button" style={styles.btnDanger} onClick={closePieceModal}>
                Annuler
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={addPieces}
                disabled={isReadOnly || !piecesTableAvailable || pendingPieces.length === 0}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}