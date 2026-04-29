import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../lib/supabaseClient";

type FactureStatut =
  | "a_traiter"
  | "en_validation"
  | "autorisee_paiement"
  | "payee"
  | "ignoree";

type FactureFournisseur = {
  id: string;
  fournisseur: string;
  nom_fichier: string;
  chemin_local_original: string | null;
  chemin_local_actuel: string | null;
  storage_path: string | null;
  statut: FactureStatut;
  type_traitement: string;
  bt_id: string | null;
  note: string | null;
  autorise_email: string | null;
  autorise_le: string | null;
  payee_email: string | null;
  payee_le: string | null;
  fichier_taille: number | null;
  fichier_last_modified: number | null;
  po_detecte?: string | null;
  unite_id?: string | null;
  traitement_mode?: string | null;
  created_at: string;
};

type LocalPdfRef = {
  file: File;
  fournisseurHandle: any;
};

type PieceLine = {
  sku: string;
  description: string;
  quantite: number;
  cout_unitaire: number;
  unite: string;
};

type BtOption = {
  id: string;
  numero: string | null;
  titre: string | null;
  statut: string | null;
  unite_id: string | null;
  client_nom?: string | null;
  marge_pieces_snapshot?: number | null;
  unites?: {
    id: string;
    numero: string | null;
    nom: string | null;
  } | null;
};

const BUCKET = "factures-fournisseurs";

const tabs: { key: FactureStatut | "toutes"; label: string }[] = [
  { key: "a_traiter", label: "À traiter" },
  { key: "en_validation", label: "En validation" },
  { key: "autorisee_paiement", label: "Autorisées paiement" },
  { key: "payee", label: "Payées" },
  { key: "ignoree", label: "Ignorées" },
  { key: "toutes", label: "Toutes" },
];

const emptyLine: PieceLine = {
  sku: "",
  description: "",
  quantite: 1,
  cout_unitaire: 0,
  unite: "UN",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function cleanStorageName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function statutLabel(statut: FactureStatut) {
  if (statut === "a_traiter") return "À traiter";
  if (statut === "en_validation") return "En validation";
  if (statut === "autorisee_paiement") return "Autorisée paiement";
  if (statut === "payee") return "Payée";
  if (statut === "ignoree") return "Ignorée";
  return statut;
}

function detectPoFromText(text: string) {
  const patterns = [
    /\bP\.?\s*O\.?\s*[:#\-]?\s*([A-Z0-9\-]{2,20})/i,
    /\bPO\s*[:#\-]?\s*([A-Z0-9\-]{2,20})/i,
    /\bBON\s+DE\s+COMMANDE\s*[:#\-]?\s*([A-Z0-9\-]{2,20})/i,
    /\bPURCHASE\s+ORDER\s*[:#\-]?\s*([A-Z0-9\-]{2,20})/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }

  return "";
}

function extractPossibleLines(text: string): PieceLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const results: PieceLine[] = [];

  for (const line of lines) {
    const moneyMatches = line.match(/\d+[,.]\d{2}/g);
    if (!moneyMatches || moneyMatches.length === 0) continue;

    const skuMatch = line.match(/\b[A-Z0-9][A-Z0-9\-\.\/]{2,24}\b/i);
    if (!skuMatch) continue;

    const sku = skuMatch[0].trim();
    const price = Number(moneyMatches[moneyMatches.length - 1].replace(",", "."));

    if (!sku || Number.isNaN(price)) continue;

    const qtyMatch = line.match(/\b(\d+(?:[,.]\d+)?)\b/);
    const quantite = qtyMatch ? Math.max(1, Number(qtyMatch[1].replace(",", "."))) : 1;

    let description = line
      .replace(sku, "")
      .replace(/\d+[,.]\d{2}/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!description || description.length < 3) {
      description = "Pièce détectée";
    }

    const exists = results.some((r) => r.sku.toLowerCase() === sku.toLowerCase());
    if (!exists) {
      results.push({
        sku,
        description,
        quantite,
        cout_unitaire: price,
        unite: "UN",
      });
    }

    if (results.length >= 20) break;
  }

  return results;
}

function statutStyle(statut: FactureStatut): CSSProperties {
  if (statut === "autorisee_paiement") return { ...styles.badge, ...styles.badgeSuccess };
  if (statut === "payee") return { ...styles.badge, ...styles.badgeDark };
  if (statut === "ignoree") return { ...styles.badge, ...styles.badgeMuted };
  if (statut === "en_validation") return { ...styles.badge, ...styles.badgeInfo };
  return { ...styles.badge, ...styles.badgeWarning };
}

export default function FacturesFournisseurs() {
  const [factures, setFactures] = useState<FactureFournisseur[]>([]);
  const [selected, setSelected] = useState<FactureFournisseur | null>(null);
  const [selectedTab, setSelectedTab] = useState<FactureStatut | "toutes">("a_traiter");

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const [rootHandle, setRootHandle] = useState<any>(null);
  const [localRefs, setLocalRefs] = useState<Record<string, LocalPdfRef>>({});
  const [previewUrl, setPreviewUrl] = useState("");

  const [pdfText, setPdfText] = useState("");
  const [poDetecte, setPoDetecte] = useState("");
  const [uniteDetectee, setUniteDetectee] = useState<any | null>(null);
  const [btSuggere, setBtSuggere] = useState<BtOption | null>(null);
  const [btId, setBtId] = useState("");
  const [btOptions, setBtOptions] = useState<BtOption[]>([]);
  const [pieces, setPieces] = useState<PieceLine[]>([{ ...emptyLine }]);
  const [note, setNote] = useState("");

  const filtered = useMemo(() => {
    if (selectedTab === "toutes") return factures;
    return factures.filter((f) => f.statut === selectedTab);
  }, [factures, selectedTab]);

  useEffect(() => {
    loadFactures();
    loadBtOptions();
  }, []);

  useEffect(() => {
    if (filtered.length > 0 && !selected) {
      selectFacture(filtered[0]);
    }
  }, [filtered, selected]);

  async function loadFactures() {
    setLoading(true);

    const { data, error } = await supabase
      .from("factures_fournisseurs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setFactures((data || []) as FactureFournisseur[]);
    setLoading(false);
  }

  async function loadBtOptions() {
    const { data } = await supabase
      .from("bons_travail")
      .select(
        `
        id,
        numero,
        titre,
        statut,
        unite_id,
        client_nom,
        marge_pieces_snapshot,
        unites:unite_id (
          id,
          numero,
          nom
        )
      `
      )
      .in("statut", ["ouvert", "en_cours", "a_faire"])
      .order("created_at", { ascending: false })
      .limit(200);

    setBtOptions((data || []) as BtOption[]);
  }

  function getRefKey(fournisseur: string, nomFichier: string) {
    return `${fournisseur}/${nomFichier}`;
  }

  async function selectFacture(facture: FactureFournisseur) {
    setSelected(facture);
    setMessage("");
    setPreviewUrl("");
    setPdfText("");
    setPoDetecte(facture.po_detecte || "");
    setUniteDetectee(null);
    setBtSuggere(null);
    setBtId(facture.bt_id || "");
    setPieces([{ ...emptyLine }]);
    setNote(facture.note || "");

    await preparePreview(facture);
  }

  async function preparePreview(facture: FactureFournisseur) {
    setPreviewUrl("");
    setMessage("");

    const ref = localRefs[getRefKey(facture.fournisseur, facture.nom_fichier)];

    if (ref?.file) {
      setPreviewUrl(URL.createObjectURL(ref.file));
      return;
    }

    if (!facture.storage_path) {
      setMessage(
        "Aperçu impossible : cette facture n’a pas de storage_path. Rescanne le dossier local."
      );
      return;
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(facture.storage_path, 60 * 30);

    if (error || !data?.signedUrl) {
      setMessage("Aperçu impossible : " + (error?.message || "URL Storage invalide"));
      return;
    }

    setPreviewUrl(data.signedUrl);
  }

  async function chooseFolderAndScan() {
    if (!("showDirectoryPicker" in window)) {
      alert("Ton navigateur ne supporte pas la sélection de dossier. Utilise Edge ou Chrome.");
      return;
    }

    const handle = await (window as any).showDirectoryPicker({
      mode: "readwrite",
    });

    setRootHandle(handle);
    await scanFolder(handle);
  }

  async function scanExistingFolder() {
    if (!rootHandle) {
      await chooseFolderAndScan();
      return;
    }

    await scanFolder(rootHandle);
  }

  async function scanFolder(handle: any) {
    setScanning(true);
    setMessage("");

    let imported = 0;
    let skipped = 0;
    const refs: Record<string, LocalPdfRef> = {};

    try {
      for await (const [fournisseurName, fournisseurHandle] of handle.entries()) {
        if (fournisseurHandle.kind !== "directory") continue;

        for await (const [fileName, fileHandle] of fournisseurHandle.entries()) {
          if (fileHandle.kind !== "file") continue;
          if (!fileName.toLowerCase().endsWith(".pdf")) continue;

          const file = await fileHandle.getFile();
          const fournisseur = fournisseurName.trim();
          const chemin = `${fournisseur}/${fileName}`;
          const refKey = getRefKey(fournisseur, fileName);

          refs[refKey] = {
            file,
            fournisseurHandle,
          };

          const storagePath = `${new Date().getFullYear()}/${cleanStorageName(
            fournisseur
          )}/${Date.now()}_${cleanStorageName(fileName)}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, file, {
              upsert: false,
              contentType: file.type || "application/pdf",
            });

          if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) {
            console.warn(uploadError.message);
          }

          const { error: insertError } = await supabase.from("factures_fournisseurs").insert({
            fournisseur,
            nom_fichier: fileName,
            chemin_local_original: chemin,
            chemin_local_actuel: chemin,
            storage_path: storagePath,
            statut: "a_traiter",
            type_traitement: "non_classe",
            fichier_taille: file.size,
            fichier_last_modified: file.lastModified,
          });

          if (insertError) {
            if (insertError.code === "23505") skipped++;
            else console.warn(insertError.message);
          } else {
            imported++;
          }
        }
      }

      setLocalRefs((old) => ({ ...old, ...refs }));
      setMessage(`${imported} facture(s) importée(s). ${skipped} doublon(s) ignoré(s).`);
      await loadFactures();
    } catch (err: any) {
      setMessage(err?.message || "Erreur pendant le scan du dossier.");
    } finally {
      setScanning(false);
    }
  }

  async function extractTextFromSelectedPdf() {
    if (!selected) return "";

    try {
      let arrayBuffer: ArrayBuffer | null = null;
      const ref = localRefs[getRefKey(selected.fournisseur, selected.nom_fichier)];

      if (ref?.file) {
        arrayBuffer = await ref.file.arrayBuffer();
      } else if (previewUrl) {
        const res = await fetch(previewUrl);
        arrayBuffer = await res.arrayBuffer();
      }

      if (!arrayBuffer) return "";

      const pdfjs = await import("pdfjs-dist");
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

      let text = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join("\n");
        text += `\n${pageText}`;
      }

      setPdfText(text);
      return text;
    } catch (err: any) {
      console.warn(err?.message || err);
      setMessage(
        "Impossible de lire automatiquement le texte du PDF. Tu peux entrer les lignes manuellement."
      );
      return "";
    }
  }

  async function analyserFacture() {
    if (!selected) return;

    setProcessing(true);
    setMessage("");

    const text = await extractTextFromSelectedPdf();
    const sourceText = `${selected.nom_fichier}\n${text}`;

    const po = detectPoFromText(sourceText);
    setPoDetecte(po);

    if (po) {
      await detectUniteAndBt(po);
    }

    const detectedLines = extractPossibleLines(text);

    if (detectedLines.length > 0) {
      setPieces(detectedLines);
      setMessage(`${detectedLines.length} ligne(s) de pièces préremplie(s). Vérifie avant d’enregistrer.`);
    } else {
      setMessage(
        "PO analysé. Aucune ligne de pièce fiable détectée, tu peux les entrer manuellement."
      );
    }

    setProcessing(false);
  }

  async function detectUniteAndBt(po: string) {
    const cleanPo = po.trim();

    const { data: unite } = await supabase
      .from("unites")
      .select("*")
      .or(`numero.eq.${cleanPo},nom.ilike.%${cleanPo}%`)
      .maybeSingle();

    if (!unite) {
      setUniteDetectee(null);
      setBtSuggere(null);
      return;
    }

    setUniteDetectee(unite);

    const { data: bts } = await supabase
      .from("bons_travail")
      .select("id, numero, titre, statut, unite_id, client_nom, marge_pieces_snapshot")
      .eq("unite_id", unite.id)
      .in("statut", ["ouvert", "en_cours", "a_faire"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (bts?.[0]) {
      setBtSuggere(bts[0] as BtOption);
      setBtId(bts[0].id);
    }
  }

  function updatePiece(index: number, key: keyof PieceLine, value: string | number) {
    setPieces((old) =>
      old.map((line, i) =>
        i === index
          ? {
              ...line,
              [key]: value,
            }
          : line
      )
    );
  }

  function addPieceLine() {
    setPieces((old) => [...old, { ...emptyLine }]);
  }

  function removePieceLine(index: number) {
    setPieces((old) => old.filter((_, i) => i !== index));
  }

  async function findOrCreateInventoryItem(line: PieceLine) {
    const sku = line.sku.trim();
    const description = line.description.trim() || sku || "Pièce à compléter";

    let existing: any = null;

    if (sku) {
      const { data } = await supabase
        .from("inventaire_items")
        .select("*")
        .eq("sku", sku)
        .maybeSingle();

      existing = data;
    }

    if (existing) {
      const newQty = Number(existing.quantite || 0) + Number(line.quantite || 0);

      await supabase
        .from("inventaire_items")
        .update({
          quantite: newQty,
          cout_unitaire: line.cout_unitaire || existing.cout_unitaire || 0,
          fournisseur_principal: selected?.fournisseur || existing.fournisseur_principal || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      return existing.id;
    }

    const { data: created, error } = await supabase
      .from("inventaire_items")
      .insert({
        sku: sku || null,
        nom: description,
        quantite: Number(line.quantite || 0),
        unite: line.unite || "UN",
        cout_unitaire: Number(line.cout_unitaire || 0),
        seuil_alerte: 0,
        actif: true,
        a_completer: true,
        fournisseur_principal: selected?.fournisseur || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return created.id;
  }

  async function addPieceToBt(line: PieceLine, inventaireItemId: string | null) {
    if (!btId) return;

    const bt = btOptions.find((b) => b.id === btId) || btSuggere;
    const marge = Number(bt?.marge_pieces_snapshot || 0);
    const cout = Number(line.cout_unitaire || 0);
    const prixFacture = marge > 0 ? cout * (1 + marge / 100) : cout;
    const totalFacture = prixFacture * Number(line.quantite || 0);

    const { error } = await supabase.from("bt_pieces").insert({
      bt_id: btId,
      description: line.description || line.sku || "Pièce",
      quantite: Number(line.quantite || 1),
      prix_unitaire: cout,
      inventaire_item_id: inventaireItemId,
      sku: line.sku || null,
      unite: line.unite || "UN",
      marge_pct_snapshot: marge,
      prix_facture_unitaire_snapshot: prixFacture,
      total_facture_snapshot: totalFacture,
    });

    if (error) throw error;
  }

  async function saveNoteOnly() {
    if (!selected) return;

    const { error } = await supabase
      .from("factures_fournisseurs")
      .update({
        note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadFactures();
  }

  async function processInventaireAndBt() {
    if (!selected) return;

    const validLines = pieces.filter(
      (p) => (p.sku.trim() || p.description.trim()) && Number(p.quantite) > 0
    );

    if (validLines.length === 0) {
      alert("Ajoute au moins une ligne de pièce.");
      return;
    }

    setProcessing(true);

    try {
      for (const line of validLines) {
        const itemId = await findOrCreateInventoryItem(line);
        if (btId) await addPieceToBt(line, itemId);
      }

      await authorizePayment(selected, "reception_inventaire_bt", true);
    } catch (err: any) {
      alert(err?.message || "Erreur pendant l’enregistrement.");
    } finally {
      setProcessing(false);
    }
  }

  async function authorizeGeneralExpense() {
    if (!selected) return;

    const ok = window.confirm("Autoriser cette facture comme dépense générale ?");
    if (!ok) return;

    await saveNoteOnly();
    await authorizePayment(selected, "depense_generale", true);
  }

  async function setStatut(facture: FactureFournisseur, statut: FactureStatut) {
    const update: any = {
      statut,
      updated_at: new Date().toISOString(),
    };

    if (statut === "payee") {
      const { data } = await supabase.auth.getUser();
      update.payee_par = data.user?.id || null;
      update.payee_email = data.user?.email || null;
      update.payee_le = new Date().toISOString();
    }

    if (statut === "ignoree") {
      update.ignored_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("factures_fournisseurs")
      .update(update)
      .eq("id", facture.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadFactures();
    selectNextFacture(facture.id);
  }

  async function authorizePayment(
    facture: FactureFournisseur,
    mode: string = "autorisation_simple",
    autoNext = false
  ) {
    const { data: userData } = await supabase.auth.getUser();
    const now = new Date();

    const year = String(now.getFullYear());
    const monthFolder = `${pad2(now.getMonth() + 1)}-${year}`;

    let newLocalPath = facture.chemin_local_actuel;
    const ref = localRefs[getRefKey(facture.fournisseur, facture.nom_fichier)];

    if (ref?.file && ref?.fournisseurHandle) {
      try {
        const yearHandle = await ref.fournisseurHandle.getDirectoryHandle(year, {
          create: true,
        });

        const monthHandle = await yearHandle.getDirectoryHandle(monthFolder, {
          create: true,
        });

        let finalName = facture.nom_fichier;
        let counter = 1;

        while (true) {
          try {
            await monthHandle.getFileHandle(finalName, { create: false });
            const dotIndex = facture.nom_fichier.lastIndexOf(".");
            const base =
              dotIndex >= 0 ? facture.nom_fichier.slice(0, dotIndex) : facture.nom_fichier;
            const ext = dotIndex >= 0 ? facture.nom_fichier.slice(dotIndex) : "";
            finalName = `${base}_${counter}${ext}`;
            counter++;
          } catch {
            break;
          }
        }

        const newFileHandle = await monthHandle.getFileHandle(finalName, {
          create: true,
        });

        const writable = await newFileHandle.createWritable();
        await writable.write(ref.file);
        await writable.close();

        await ref.fournisseurHandle.removeEntry(facture.nom_fichier);

        newLocalPath = `${facture.fournisseur}/${year}/${monthFolder}/${finalName}`;
      } catch (err: any) {
        alert(
          "La facture sera autorisée, mais le déplacement local a échoué.\n\n" +
            (err?.message || "")
        );
      }
    }

    const { error } = await supabase
      .from("factures_fournisseurs")
      .update({
        statut: "autorisee_paiement",
        type_traitement: mode,
        traitement_mode: mode,
        bt_id: btId || null,
        note,
        po_detecte: poDetecte || null,
        unite_id: uniteDetectee?.id || null,
        autorise_par: userData.user?.id || null,
        autorise_email: userData.user?.email || null,
        autorise_le: new Date().toISOString(),
        chemin_local_actuel: newLocalPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facture.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadFactures();

    if (autoNext) {
      selectNextFacture(facture.id);
    }
  }

  function selectNextFacture(currentId: string) {
    const activeList = filtered.filter((f) => f.id !== currentId);
    const next = activeList[0];

    if (next) selectFacture(next);
    else setSelected(null);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Factures fournisseurs</h1>
          <p style={styles.subtitle}>Traitement, inventaire, BT et autorisation de paiement.</p>
        </div>

        <div style={styles.headerActions}>
          <button style={styles.secondaryBtn} onClick={scanExistingFolder} type="button">
            Scanner dossier
          </button>

          <button style={styles.primaryBtn} onClick={chooseFolderAndScan} type="button">
            Choisir dossier local
          </button>
        </div>
      </div>

      {message && <div style={styles.notice}>{message}</div>}

      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            style={{
              ...styles.tab,
              ...(selectedTab === tab.key ? styles.tabActive : {}),
            }}
            onClick={() => {
              setSelectedTab(tab.key);
              setSelected(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.console}>
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <strong>Factures</strong>
            <span style={styles.countPill}>{filtered.length}</span>
          </div>

          {loading || scanning ? (
            <div style={styles.empty}>{scanning ? "Scan en cours…" : "Chargement…"}</div>
          ) : filtered.length === 0 ? (
            <div style={styles.empty}>Aucune facture.</div>
          ) : (
            <div>
              {filtered.map((facture) => (
                <button
                  key={facture.id}
                  type="button"
                  style={{
                    ...styles.invoiceRow,
                    ...(selected?.id === facture.id ? styles.invoiceRowActive : {}),
                  }}
                  onClick={() => selectFacture(facture)}
                >
                  <div style={styles.invoiceSupplier}>{facture.fournisseur}</div>
                  <div style={styles.invoiceFile}>{facture.nom_fichier}</div>
                  <div style={statutStyle(facture.statut)}>{statutLabel(facture.statut)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={styles.previewPanel}>
          <div style={styles.panelHeader}>
            <strong>Prévisualisation</strong>
            {selected && <span style={styles.filePill}>{selected.nom_fichier}</span>}
          </div>

          {!selected ? (
            <div style={styles.empty}>Sélectionne une facture.</div>
          ) : previewUrl ? (
            <iframe title="Preview facture" src={previewUrl} style={styles.iframe} />
          ) : (
            <div style={styles.empty}>
              Aperçu PDF non disponible.
              <br />
              <button
                type="button"
                style={{ ...styles.secondaryBtn, marginTop: 12 }}
                onClick={() => selected && preparePreview(selected)}
              >
                Réessayer l’aperçu
              </button>
            </div>
          )}
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.panelHeader}>
            <strong>Traitement</strong>
          </div>

          {!selected ? (
            <div style={styles.empty}>Aucune facture sélectionnée.</div>
          ) : (
            <>
              <div style={styles.infoBox}>
                <div>
                  <strong>{selected.fournisseur}</strong>
                </div>
                <div style={styles.smallMuted}>{selected.nom_fichier}</div>
                <div style={{ marginTop: 8 }}>
                  <span style={statutStyle(selected.statut)}>{statutLabel(selected.statut)}</span>
                </div>
              </div>

              <button
                type="button"
                style={styles.primaryFull}
                onClick={analyserFacture}
                disabled={processing}
              >
                Analyser facture / détecter PO
              </button>

              <div style={styles.formGroup}>
                <label style={styles.label}>PO détecté</label>
                <input
                  style={styles.input}
                  value={poDetecte}
                  onChange={(e) => setPoDetecte(e.target.value)}
                  onBlur={() => poDetecte && detectUniteAndBt(poDetecte)}
                  placeholder="Ex : numéro d’unité"
                />
              </div>

              <div style={styles.detectBox}>
                <div>
                  Unité :{" "}
                  <strong>
                    {uniteDetectee
                      ? `${uniteDetectee.numero || ""} ${uniteDetectee.nom || ""}`.trim()
                      : "—"}
                  </strong>
                </div>
                <div>
                  BT suggéré : <strong>{btSuggere?.numero || btSuggere?.titre || "—"}</strong>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>BT à rattacher</label>
                <select
                  style={styles.input}
                  value={btId}
                  onChange={(e) => setBtId(e.target.value)}
                >
                  <option value="">Aucun BT</option>
                  {btOptions.map((bt) => (
                    <option key={bt.id} value={bt.id}>
                      {(bt.numero || bt.titre || "BT") +
                        " — unité " +
                        (bt.unites?.numero || "—") +
                        (bt.client_nom ? ` — ${bt.client_nom}` : "")}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.sectionTitle}>Pièces à recevoir</div>

              {pieces.map((line, index) => (
                <div key={index} style={styles.pieceCard}>
                  <div style={styles.grid2}>
                    <input
                      style={styles.input}
                      placeholder="No pièce / SKU"
                      value={line.sku}
                      onChange={(e) => updatePiece(index, "sku", e.target.value)}
                    />
                    <input
                      style={styles.input}
                      placeholder="Unité"
                      value={line.unite}
                      onChange={(e) => updatePiece(index, "unite", e.target.value)}
                    />
                  </div>

                  <input
                    style={{ ...styles.input, marginTop: 8 }}
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updatePiece(index, "description", e.target.value)}
                  />

                  <div style={{ ...styles.grid2, marginTop: 8 }}>
                    <input
                      style={styles.input}
                      type="number"
                      step="0.01"
                      placeholder="Qté"
                      value={line.quantite}
                      onChange={(e) => updatePiece(index, "quantite", Number(e.target.value || 0))}
                    />
                    <input
                      style={styles.input}
                      type="number"
                      step="0.01"
                      placeholder="Coût"
                      value={line.cout_unitaire}
                      onChange={(e) =>
                        updatePiece(index, "cout_unitaire", Number(e.target.value || 0))
                      }
                    />
                  </div>

                  {pieces.length > 1 && (
                    <button
                      type="button"
                      style={styles.removeBtn}
                      onClick={() => removePieceLine(index)}
                    >
                      Supprimer ligne
                    </button>
                  )}
                </div>
              ))}

              <button type="button" style={styles.secondaryFull} onClick={addPieceLine}>
                + Ajouter ligne
              </button>

              <div style={styles.formGroup}>
                <label style={styles.label}>Note interne</label>
                <textarea
                  style={styles.textarea}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note pour comptabilité ou atelier..."
                />
              </div>

              <div style={styles.actionsStack}>
                <button
                  type="button"
                  style={styles.greenFull}
                  onClick={processInventaireAndBt}
                  disabled={processing}
                >
                  Réception inventaire {btId ? "+ BT" : ""} + autoriser
                </button>

                <button
                  type="button"
                  style={styles.secondaryFull}
                  onClick={authorizeGeneralExpense}
                  disabled={processing}
                >
                  Autoriser comme dépense générale
                </button>

                <button
                  type="button"
                  style={styles.secondaryFull}
                  onClick={() => selected && setStatut(selected, "en_validation")}
                  disabled={processing}
                >
                  Mettre en validation
                </button>

                <button
                  type="button"
                  style={styles.dangerFull}
                  onClick={() => selected && setStatut(selected, "ignoree")}
                  disabled={processing}
                >
                  Ignorer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    padding: 20,
    background: "#f5f7fb",
    minHeight: "100vh",
    minWidth: 1500,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: "#182235",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#667085",
    fontSize: 14,
  },
  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryBtn: {
    border: "none",
    background: "#1d4ed8",
    color: "#fff",
    borderRadius: 12,
    padding: "11px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid #cfd7e6",
    background: "#fff",
    color: "#182235",
    borderRadius: 12,
    padding: "11px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  notice: {
    background: "#eef6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    fontWeight: 700,
  },
  tabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  tab: {
    border: "1px solid #d7deeb",
    background: "#fff",
    borderRadius: 999,
    padding: "9px 14px",
    cursor: "pointer",
    fontWeight: 800,
    color: "#344054",
  },
  tabActive: {
    background: "#182235",
    color: "#fff",
    borderColor: "#182235",
  },
  console: {
    display: "grid",
    gridTemplateColumns: "330px minmax(700px, 1fr) 440px",
    gap: 14,
    alignItems: "stretch",
    height: "calc(100vh - 155px)",
    minHeight: 760,
  },
  leftPanel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "auto",
  },
  previewPanel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  rightPanel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "auto",
    paddingBottom: 16,
  },
  panelHeader: {
    padding: "14px 16px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    minHeight: 50,
  },
  countPill: {
    background: "#eef2ff",
    color: "#1e3a8a",
    borderRadius: 999,
    padding: "5px 10px",
    fontWeight: 900,
    fontSize: 12,
  },
  filePill: {
    background: "#f2f4f7",
    color: "#475467",
    borderRadius: 999,
    padding: "5px 10px",
    fontWeight: 800,
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 420,
  },
  invoiceRow: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid #edf2f7",
    background: "#fff",
    textAlign: "left",
    padding: 12,
    cursor: "pointer",
  },
  invoiceRowActive: {
    background: "#eef6ff",
  },
  invoiceSupplier: {
    fontWeight: 900,
    color: "#182235",
    marginBottom: 4,
  },
  invoiceFile: {
    color: "#667085",
    fontSize: 12,
    marginBottom: 8,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  iframe: {
    width: "100%",
    height: "100%",
    border: "none",
    flex: 1,
    background: "#fff",
  },
  empty: {
    padding: 24,
    color: "#667085",
    textAlign: "center",
    fontWeight: 700,
  },
  infoBox: {
    margin: 14,
    padding: 12,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  smallMuted: {
    color: "#667085",
    fontSize: 12,
    marginTop: 4,
  },
  formGroup: {
    margin: "14px",
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontWeight: 800,
    color: "#344054",
    fontSize: 13,
  },
  input: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid #d7deeb",
    padding: "0 10px",
    fontWeight: 700,
    boxSizing: "border-box",
    background: "#fff",
  },
  textarea: {
    width: "100%",
    minHeight: 76,
    borderRadius: 10,
    border: "1px solid #d7deeb",
    padding: 10,
    fontWeight: 700,
    boxSizing: "border-box",
    resize: "vertical",
  },
  detectBox: {
    margin: 14,
    padding: 12,
    borderRadius: 14,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#7c2d12",
    fontSize: 13,
    lineHeight: 1.6,
  },
  sectionTitle: {
    margin: "16px 14px 8px",
    fontWeight: 900,
    color: "#182235",
  },
  pieceCard: {
    margin: "10px 14px",
    padding: 10,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#fbfdff",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 90px",
    gap: 8,
  },
  removeBtn: {
    marginTop: 8,
    border: "none",
    background: "transparent",
    color: "#b42318",
    fontWeight: 800,
    cursor: "pointer",
  },
  primaryFull: {
    margin: "14px",
    width: "calc(100% - 28px)",
    border: "none",
    background: "#1d4ed8",
    color: "#fff",
    borderRadius: 12,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryFull: {
    width: "100%",
    border: "1px solid #cfd7e6",
    background: "#fff",
    color: "#182235",
    borderRadius: 12,
    padding: "11px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  greenFull: {
    width: "100%",
    border: "none",
    background: "#027a48",
    color: "#fff",
    borderRadius: 12,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerFull: {
    width: "100%",
    border: "none",
    background: "#b42318",
    color: "#fff",
    borderRadius: 12,
    padding: "11px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  actionsStack: {
    margin: 14,
    display: "grid",
    gap: 8,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 9px",
    fontWeight: 900,
    fontSize: 12,
  },
  badgeWarning: {
    background: "#fff7ed",
    color: "#9a3412",
  },
  badgeInfo: {
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  badgeSuccess: {
    background: "#ecfdf3",
    color: "#027a48",
  },
  badgeDark: {
    background: "#182235",
    color: "#fff",
  },
  badgeMuted: {
    background: "#f2f4f7",
    color: "#667085",
  },
};