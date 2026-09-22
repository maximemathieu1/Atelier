import { get } from "idb-keyval";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import {
  nextCCImportName,
  factureNoToAcombaNo,
  factureNoToRef8,
  makeCCHeader,
  makeCCFileContent,
  formatFLine,
  formatTLine,
  preflightDirPermission,
  writeFileToTransporteurDir,
  downloadTextFile,
  dirKey,
  ensurePermission,
} from "../pages/facturation/facturation.shared";

const ACOMBA_FOLDER_LABEL = "Groupe Breton";

type ReferenceRow = {
  factureNo: string;
  client: string;
  dateFacture: string;
  mainOeuvre: number;
  pieces: number;
  fraisAtelier: number;
  tps: number;
  tvq: number;
  total: number;
};

function toNum(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function btExportLabel(bt: any) {
  const numero = String(bt?.numero ?? "").trim() || "BT sans numéro";
  const client = String(bt?.client_nom ?? "").trim();
  const suffix = client ? ` — ${client}` : "";
  return `${numero}${suffix}`;
}

function withBtExportContext(bt: any, error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Erreur inconnue");
  const label = btExportLabel(bt);

  // Évite de doubler le préfixe si l'erreur a déjà été contextualisée.
  if (message.startsWith(`${label} — `)) return new Error(message);
  return new Error(`${label} — ${message}`);
}

function formatDateOnly(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-CA");
}

function exportDateStamp(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}-${mi}-${ss}`;
}

function makeReferenceFilename(now = new Date()) {
  return `Export ${exportDateStamp(now)}.xlsx`;
}

function pushCreditLine(lines: string[], compte: string, montant: number) {
  const c = String(compte ?? "").trim();
  const m = round2(montant);
  if (!c || m <= 0) return;
  lines.push(formatTLine(c, null, m));
}

function buildReferenceXlsx(rows: ReferenceRow[]) {
  const data = rows.map((r) => ({
    "No facture": r.factureNo,
    Client: r.client,
    Date: r.dateFacture,
    "Main-d’œuvre": round2(r.mainOeuvre),
    Pièces: round2(r.pieces),
    "Frais atelier": round2(r.fraisAtelier),
    TPS: round2(r.tps),
    TVQ: round2(r.tvq),
    Total: round2(r.total),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");

  return XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;
}

async function writeBinaryFileToConfiguredDir(
  label: string,
  filename: string,
  bytes: ArrayBuffer
) {
  const dir = await get<FileSystemDirectoryHandle>(dirKey(label));
  if (!dir) {
    throw new Error(`Dossier non configuré pour “${label}”.`);
  }

  const ok = await ensurePermission(dir);
  if (!ok) {
    throw new Error(`Permission refusée pour écrire dans “${label}”.`);
  }

  const fh = await dir.getFileHandle(String(filename).trim(), { create: true });
  const w = await fh.createWritable();
  await w.write(bytes);
  await w.close();
}

function downloadBinaryFile(filename: string, bytes: ArrayBuffer) {
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function makeCCEntryContentBt(opts: {
  factureDate: Date;
  code: string;
  factureNo: string;
  total: number;
  ref: string;
  glAR: string;
  glMain: string;
  glPieces: string;
  glFrais: string;
  glTPS: string;
  glTVQ: string;
  montantMain: number;
  montantPieces: number;
  montantFrais: number;
  montantTPS: number;
  montantTVQ: number;
}) {
  const lines: string[] = [];

  const total = round2(opts.total);
  const tps = round2(opts.montantTPS);
  const tvq = round2(opts.montantTVQ);

  const revenuHtCible = round2(total - tps - tvq);

  const main = round2(opts.montantMain);
  const pieces = round2(opts.montantPieces);
  let frais = round2(opts.montantFrais);

  const revenuHtActuel = round2(main + pieces + frais);
  const deltaHt = round2(revenuHtCible - revenuHtActuel);

  const samePiecesAndFrais =
    String(opts.glPieces ?? "").trim() &&
    String(opts.glFrais ?? "").trim() &&
    String(opts.glPieces).trim() === String(opts.glFrais).trim();

  frais = round2(frais + deltaHt);

  lines.push(
    formatFLine({
      date: opts.factureDate,
      code: opts.code,
      factureNo: opts.factureNo,
      total,
      ref: opts.ref,
    })
  );

  lines.push(formatTLine(opts.glAR, total, null));
  pushCreditLine(lines, opts.glMain, main);

  if (samePiecesAndFrais) {
    pushCreditLine(lines, opts.glPieces, round2(pieces + frais));
  } else {
    pushCreditLine(lines, opts.glPieces, pieces);
    pushCreditLine(lines, opts.glFrais, frais);
  }

  pushCreditLine(lines, opts.glTPS, tps);
  pushCreditLine(lines, opts.glTVQ, tvq);

  return lines.join("\r\n") + "\r\n";
}

function resolveGlSet(mode: string | null | undefined, settings: any) {
  if (mode === "interne") {
    return {
      glMain: String(settings.gl_main_oeuvre_interne ?? "").trim(),
      glPieces: String(settings.gl_pieces_interne ?? "").trim(),
      glFrais: String(settings.gl_frais_atelier_interne ?? "").trim(),
    };
  }

  if (mode === "interne_ta") {
    return {
      glMain: String(settings.gl_main_oeuvre_interne_ta ?? "").trim(),
      glPieces: String(settings.gl_pieces_interne_ta ?? "").trim(),
      glFrais: String(settings.gl_frais_atelier_interne_ta ?? "").trim(),
    };
  }

  return {
    glMain: String(settings.gl_main_oeuvre_externe ?? "").trim(),
    glPieces: String(settings.gl_pieces_externe ?? "").trim(),
    glFrais: String(settings.gl_frais_atelier_externe ?? "").trim(),
  };
}

async function loadSettings() {
  const { data: settings, error: settingsError } = await supabase
    .from("parametres_entreprise")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (settingsError || !settings) {
    throw new Error("Paramètres Acomba manquants.");
  }

  return settings;
}

async function loadClientAndUnite(bt: any) {
  if (!bt.client_id) {
    throw new Error("Client manquant sur le bon de travail.");
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, nom, acomba_client_code")
    .eq("id", bt.client_id)
    .maybeSingle();

  if (clientError) throw new Error(clientError.message);

  const clientCode = String((client as any)?.acomba_client_code ?? "")
    .trim()
    .toUpperCase();

  if (!clientCode) {
    throw new Error("Code client Acomba manquant dans la fiche client.");
  }

  const clientName = String((client as any)?.nom ?? "").trim() || "";

  // Facture Centre de service séparée : toujours traitée comme une vente externe,
  // même si le BT source est rattaché à une unité interne. Le client_id de la ligne
  // est déjà celui du CLIENT ou du FABRICANT visé par la facture.
  if (bt.facturation_partie) {
    return {
      clientCode,
      clientName,
      modeComptable: "externe",
      isFactureDirecte: false,
    };
  }

  // Facture directe : aucune unité n'est requise.
  // Une vente/facture sans unité est comptabilisée comme un travail externe.
  if (!bt.unite_id) {
    return {
      clientCode,
      clientName,
      modeComptable: "externe",
      isFactureDirecte: true,
    };
  }

  const { data: unite, error: uniteError } = await supabase
    .from("unites")
    .select("id, no_unite, mode_comptable")
    .eq("id", bt.unite_id)
    .maybeSingle();

  if (uniteError) throw new Error(uniteError.message);

  const modeComptable = String((unite as any)?.mode_comptable ?? "")
    .trim()
    .toLowerCase();

  if (!modeComptable) {
    throw new Error(`Mode comptable manquant sur l’unité ${String((unite as any)?.no_unite ?? bt.unite_id ?? "").trim() || "inconnue"}.`);
  }

  if (!["externe", "interne", "interne_ta"].includes(modeComptable)) {
    throw new Error(`Mode comptable invalide sur l’unité ${String((unite as any)?.no_unite ?? bt.unite_id ?? "").trim() || "inconnue"} : « ${modeComptable} ».`);
  }

  return {
    clientCode,
    clientName,
    modeComptable,
    isFactureDirecte: false,
  };
}

type BuiltBtExport = {
  entry: string;
  referenceRow: ReferenceRow;
};

async function buildBtEntry(bt: any, settings: any): Promise<BuiltBtExport> {
  try {
    const glAR = String((settings as any).gl_compte_client ?? "").trim();
    const glTPS = String((settings as any).gl_tps ?? "").trim();
    const glTVQ = String((settings as any).gl_tvq ?? "").trim();
  
    if (!glAR || !glTPS || !glTVQ) {
      throw new Error("GL compte client / TPS / TVQ manquants dans les paramètres.");
    }
  
    const { clientCode, clientName, modeComptable } = await loadClientAndUnite(bt);
    const { glMain, glPieces, glFrais } = resolveGlSet(modeComptable, settings);
  
    if (!glMain || !glPieces || !glFrais) {
      throw new Error(`GL manquants pour le mode comptable « ${modeComptable} ».`);
    }
  
    const factureNoRaw = String(bt.numero ?? "").trim();
    if (!factureNoRaw) {
      throw new Error("Numéro de bon de travail manquant.");
    }
  
    const montantMain = round2(toNum(bt.total_main_oeuvre));
    const montantPieces = round2(toNum(bt.total_pieces));
    const montantFrais = round2(toNum(bt.total_frais_atelier));
    const montantTPS = round2(toNum(bt.total_tps));
    const montantTVQ = round2(toNum(bt.total_tvq));
    const total = round2(toNum(bt.total_final));
  
    if (total <= 0) {
      throw new Error("Total du bon de travail invalide.");
    }
  
    const factureNo = factureNoToAcombaNo(factureNoRaw);
    const ref = factureNoToRef8(factureNoRaw);
  
    const entry = makeCCEntryContentBt({
      factureDate: new Date(bt.date_fermeture ?? new Date().toISOString()),
      code: clientCode,
      factureNo,
      total,
      ref,
      glAR,
      glMain,
      glPieces,
      glFrais,
      glTPS,
      glTVQ,
      montantMain,
      montantPieces,
      montantFrais,
      montantTPS,
      montantTVQ,
    });
  
    const referenceRow: ReferenceRow = {
      factureNo: factureNoRaw,
      client: clientName || clientCode,
      dateFacture: formatDateOnly(bt.date_fermeture),
      mainOeuvre: montantMain,
      pieces: montantPieces,
      fraisAtelier: montantFrais,
      tps: montantTPS,
      tvq: montantTVQ,
      total,
    };
  
    return { entry, referenceRow };
  } catch (error) {
    throw withBtExportContext(bt, error);
  }
}

export async function buildBtAcombaFile(bt: any) {
  const settings = await loadSettings();
  const acomba_prefix =
    String((settings as any).acomba_prefix ?? "CCImport").trim() || "CCImport";

  const built = await buildBtEntry(bt, settings);

  const filename = nextCCImportName(acomba_prefix);
  const header = makeCCHeader(new Date(), "Groupe Breton");
  const content = makeCCFileContent(header, [built.entry]);

  return {
    filename,
    content,
    referenceRows: [built.referenceRow],
    referenceFilename: makeReferenceFilename(new Date()),
  };
}

async function saveAcombaFiles(
  filename: string,
  content: string,
  referenceRows: ReferenceRow[],
  referenceFilename: string
) {
  const xlsxBytes = buildReferenceXlsx(referenceRows);

  try {
    await preflightDirPermission(ACOMBA_FOLDER_LABEL);
    await writeFileToTransporteurDir(ACOMBA_FOLDER_LABEL, filename, content);
    await writeBinaryFileToConfiguredDir(ACOMBA_FOLDER_LABEL, referenceFilename, xlsxBytes);

    return {
      filename,
      content,
      referenceFilename,
      savedToLocalFolder: true,
      folderLabel: ACOMBA_FOLDER_LABEL,
    };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.warn("Écriture dossier local échouée, fallback téléchargement:", msg);

    downloadTextFile(filename, content);
    downloadBinaryFile(referenceFilename, xlsxBytes);

    return {
      filename,
      content,
      referenceFilename,
      savedToLocalFolder: false,
      folderLabel: ACOMBA_FOLDER_LABEL,
      fallbackReason: msg,
    };
  }
}

export async function exportBtToAcomba(bt: any) {
  const built = await buildBtAcombaFile(bt);
  return await saveAcombaFiles(
    built.filename,
    built.content,
    built.referenceRows,
    built.referenceFilename
  );
}

export async function exportBatchBtToAcomba(bts: any[]) {
  if (!Array.isArray(bts) || bts.length === 0) {
    throw new Error("Aucun bon de travail sélectionné.");
  }

  const settings = await loadSettings();
  const acomba_prefix =
    String((settings as any).acomba_prefix ?? "CCImport").trim() || "CCImport";

  const rowsSorted = [...bts].sort((a, b) => {
    const da = String(a.date_fermeture ?? "");
    const db = String(b.date_fermeture ?? "");
    const cmpDate = da.localeCompare(db);
    if (cmpDate !== 0) return cmpDate;

    return String(a.numero ?? "").localeCompare(String(b.numero ?? ""), "fr-CA", {
      numeric: true,
      sensitivity: "base",
    });
  });

  // Précontrôle complet : on valide toutes les factures AVANT de créer un fichier.
  // Ainsi, un batch de 20 factures peut afficher les 3-4 problèmes à corriger
  // en une seule fois au lieu de s'arrêter sur la première erreur.
  const validationResults = await Promise.all(
    rowsSorted.map(async (bt) => {
      try {
        return { ok: true as const, bt, built: await buildBtEntry(bt, settings) };
      } catch (error) {
        return {
          ok: false as const,
          bt,
          error: error instanceof Error ? error.message : String(error ?? "Erreur inconnue"),
        };
      }
    }),
  );

  const validationErrors = validationResults.filter(
    (result): result is Extract<(typeof validationResults)[number], { ok: false }> => !result.ok,
  );

  if (validationErrors.length > 0) {
    const details = validationErrors
      .map((result, index) => `${index + 1}. ${result.error}`)
      .join("\n");

    throw new Error(
      `Précontrôle Acomba : ${validationErrors.length} erreur${validationErrors.length > 1 ? "s" : ""} détectée${validationErrors.length > 1 ? "s" : ""}.\n\n${details}\n\nAucun fichier Acomba n'a été généré. Corrige ces éléments puis relance l'export.`,
    );
  }

  const builtRows = validationResults.map((result) => {
    if (!result.ok) throw new Error(result.error);
    return result.built;
  });

  const filename = nextCCImportName(acomba_prefix);
  const header = makeCCHeader(new Date(), "Groupe Breton");
  const content = makeCCFileContent(
    header,
    builtRows.map((x) => x.entry)
  );

  const referenceRows = builtRows.map((x) => x.referenceRow);
  const referenceFilename = makeReferenceFilename(new Date());

  const res = await saveAcombaFiles(filename, content, referenceRows, referenceFilename);

  const exportedAt = new Date().toISOString();

  const ordinaryIds = rowsSorted
    .filter((x) => !x.facturation_partie_id)
    .map((x) => x.id);

  const partIds = rowsSorted
    .map((x) => String(x.facturation_partie_id || "").trim())
    .filter(Boolean);

  if (ordinaryIds.length > 0) {
    const { error } = await supabase
      .from("bons_travail")
      .update({
        statut: "facture",
        export_acomba_at: exportedAt,
      })
      .in("id", ordinaryIds);

    if (error) throw new Error(error.message);
  }

  if (partIds.length > 0) {
    const { error } = await supabase
      .from("bt_facturation_parties")
      .update({
        statut: "facture",
        export_acomba_at: exportedAt,
      })
      .in("id", partIds);

    if (error) throw new Error(error.message);

    const centreServiceBtIds = Array.from(
      new Set(
        rowsSorted
          .filter((x) => x.facturation_partie_id)
          .map((x) => String(x.source_bt_id || x.id || "").trim())
          .filter(Boolean),
      ),
    );

    for (const btId of centreServiceBtIds) {
      const { data: parties, error: partStatusError } = await supabase
        .from("bt_facturation_parties")
        .select("statut")
        .eq("bt_id", btId);

      if (partStatusError) throw new Error(partStatusError.message);

      if (parties?.length && parties.every((p: any) => p.statut === "facture")) {
        const { error: parentError } = await supabase
          .from("bons_travail")
          .update({ statut: "facture", export_acomba_at: exportedAt })
          .eq("id", btId);

        if (parentError) throw new Error(parentError.message);
      }
    }
  }

  return {
    ...res,
    type: "batch",
    btIds: ordinaryIds,
    facturationPartieIds: partIds,
    count: rowsSorted.length,
  };
}