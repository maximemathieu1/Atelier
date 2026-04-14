// src/pages/facturation/facturation.shared.ts
import { get, set } from "idb-keyval";

/* =========================
   CONFIG
========================= */
export const EMAIL_FUNCTION_NAME = "smart-function";
export const CC_SEQ_KEY = "acomba_ccimport_seq";

/* =========================
   Taxes
========================= */
export type TaxRates = { tps_rate: number; tvq_rate: number };
export const DEFAULT_TAX_RATES: TaxRates = { tps_rate: 0.05, tvq_rate: 0.09975 };

/* =========================
   Helpers num / totals
========================= */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const toNum = (v: any) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export function calcTotals(
  base: number,
  hotel: number,
  autres: number,
  surcharge: number,
  rates: TaxRates
) {
  const sous_total = round2(base + hotel + autres + surcharge);
  const tps_montant = round2(sous_total * toNum(rates.tps_rate));
  const tvq_montant = round2(sous_total * toNum(rates.tvq_rate));
  const total = round2(sous_total + tps_montant + tvq_montant);
  return { sous_total, tps_montant, tvq_montant, total };
}

/* =========================
   Fuel surcharge
========================= */
export type FuelSettings = {
  is_enabled: boolean;
  diesel_reference_price: number;
  consumption_l_100km: number;
};

export function monthStartFromIso(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function calcFuelSurchargeKm(opts: {
  km: number;
  dieselReferencePrice: number;
  dieselMonthPrice: number;
  consumptionL100: number;
}) {
  const km = toNum(opts.km);
  const dieselReferencePrice = toNum(opts.dieselReferencePrice);
  const dieselMonthPrice = toNum(opts.dieselMonthPrice);
  const consumptionL100 = toNum(opts.consumptionL100);

  if (km <= 0 || dieselReferencePrice <= 0 || dieselMonthPrice <= 0 || consumptionL100 <= 0) {
    return 0;
  }

  const diff = dieselMonthPrice - dieselReferencePrice;
  if (diff <= 0) return 0;

  const litresConsumed = (km / 100) * consumptionL100;
  return round2(litresConsumed * diff);
}

/* =========================
   Transporteurs
========================= */
export type Carrier = "B" | "C" | "S";
export const CARRIER_LABEL: Record<Carrier, string> = { B: "B", C: "C", S: "S" };
export const LS_FACT_CARRIERS_KEY = "facturation.transporteurs";

export function loadCarrierSetFact(): Set<Carrier> {
  try {
    const raw = localStorage.getItem(LS_FACT_CARRIERS_KEY);
    if (!raw) return new Set<Carrier>(["B", "C", "S"]);
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set<Carrier>(["B", "C", "S"]);
    const valid = arr.filter((x) => x === "B" || x === "C" || x === "S") as Carrier[];
    return new Set<Carrier>(valid.length ? valid : ["B", "C", "S"]);
  } catch {
    return new Set<Carrier>(["B", "C", "S"]);
  }
}

export function saveCarrierSetFact(setValue: Set<Carrier>) {
  try {
    localStorage.setItem(LS_FACT_CARRIERS_KEY, JSON.stringify(Array.from(setValue)));
  } catch {}
}

export function popupMissing(title: string, items: string[]) {
  alert(`${title}\n\n${items.map((x) => `• ${x}`).join("\n")}`);
}

/* =========================
   Types facturation
========================= */
export type Statut = "réservation" | "contrat" | "à vérifier" | "à facturer" | "facturé" | "annulé";
export type TransportType = "scolaire" | "autocar";

export type Contrat = {
  id: string;
  numero: string | null;
  no_reservation: string | null;

  coffre?: boolean | null;
  remorque?: boolean | null;
  coffre_montant?: number | null;
  remorque_montant?: number | null;

  client: string;
  client_id: string | null;
  compagnie_id: string | null;
  transporteur_code?: string | null;

  fuel_surcharge_enabled?: boolean | null;
  fuel_surcharge_reference_price_override?: number | null;

  chauffeur?: string | null;
  po_number?: string | null;

  depart_lieu: string | null;
  destination: string | null;

  start_at: string;
  end_at: string;

  status: Statut;
  transport_type?: TransportType | null;

  note?: string | null;
  remarque_interne?: string | null;

  km?: number | null;
  heures?: number | null;

  montant_base?: number | null;
  hotel_repas?: number | null;
  autres_frais?: number | null;

  surcharge_carburant_applicable?: boolean | null;
  surcharge_carburant_montant?: number | null;
  surcharge_carburant_note?: string | null;
  surcharge_carburant_reference_price?: number | null;
  surcharge_carburant_month_price?: number | null;
  surcharge_carburant_period_start?: string | null;
  surcharge_carburant_period_end?: string | null;

  sous_total?: number | null;
  tps_montant?: number | null;
  tvq_montant?: number | null;
  total?: number | null;

  facture_email_sent_at?: string | null;
  facture_email_sent_to?: string | null;
};

export type ClientAcomba = {
  id: string;
  acomba_client_code: string | null;
  acomba_gl_revenu: string | null;
  acomba_compte_revenu: string | null;
  acomba_gl_revenu_scolaire: string | null;
  acomba_gl_revenu_autocar: string | null;
};

export type CompagnieAcomba = {
  id: string;
  code1: string | null;
  nom_legal?: string | null;
  acomba_export_prefix: string | null;
  acomba_gl_ar: string | null;
  acomba_gl_tps: string | null;
  acomba_gl_tvq: string | null;
  acomba_gl_car: string | null;
};

export type SavedEmail = {
  id: string;
  email: string;
  label: string;
  name?: string;
  contactId?: string | null;
};

export type ClientContact = {
  id: string;
  client_id: string;
  type: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  notes: string | null;
};

/* =========================
   Helpers contrat / fuel
========================= */
export function getFactureNo(c: Contrat) {
  return ((c.numero ?? "").trim() || (c.no_reservation ?? "").trim() || "").trim();
}

export function resolveFuelInputs(
  c: Contrat,
  fuelSettings: FuelSettings,
  fuelHistoryByMonth: Record<string, number>,
  kmOverride?: number
) {
  const km = toNum(kmOverride ?? c.km);
  const monthKey = monthStartFromIso(c.end_at || c.start_at);

  const dieselReferencePrice =
    toNum(c.surcharge_carburant_reference_price) ||
    toNum(c.fuel_surcharge_reference_price_override) ||
    toNum(fuelSettings.diesel_reference_price);

  const dieselMonthPrice =
    toNum(c.surcharge_carburant_month_price) ||
    toNum(fuelHistoryByMonth[monthKey]) ||
    toNum(fuelHistoryByMonth["__fallback__"]);

  const consumptionL100 = toNum(fuelSettings.consumption_l_100km);

  return {
    km,
    dieselReferencePrice,
    dieselMonthPrice,
    consumptionL100,
  };
}

/* =========================
   Acomba helpers
========================= */
export function nextCCImportName(prefix = "CCImport") {
  const cur = Number(localStorage.getItem(CC_SEQ_KEY) || "0");
  const next = cur + 1;
  localStorage.setItem(CC_SEQ_KEY, String(next));
  return `${prefix}.${String(next).padStart(3, "0")}`;
}

export function factureNoToAcombaNo(factureNo: string) {
  return String(factureNo || "").split("-").join("").trim();
}

export function factureNoToRef8(factureNo: string) {
  const s = String(factureNo || "").trim();
  return s.slice(0, 8).padEnd(8, " ");
}

export function yymmdd(d: Date) {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export function padRight(s: string, n: number) {
  return (s ?? "").slice(0, n).padEnd(n, " ");
}

export function money2(n: number) {
  return Number(n ?? 0).toFixed(2);
}

export function formatFLine(opts: {
  date: Date;
  code: string;
  factureNo: string;
  total: number;
  ref: string;
}) {
  const datePart = yymmdd(opts.date);
  const code8 = padRight(String(opts.code || "").toUpperCase().trim(), 8);
  const fac7 = padRight(String(opts.factureNo || "").trim(), 7);
  const totalStr = money2(Number(opts.total ?? 0));
  const ref9 = padRight(String(opts.ref || "").trim().slice(0, 9), 9);
  const prefix = `F${datePart}${code8}${fac7}`;
  const totalEnd = 32;
  const spacesBeforeTotal = Math.max(0, totalEnd - totalStr.length - prefix.length);
  return `${prefix}${" ".repeat(spacesBeforeTotal)}${totalStr}    ${ref9} `;
}

export function formatTLine(compte: string, debit: number | null, credit: number | null) {
  const acct = padRight(String(compte ?? "").trim(), 5);

  const field8 = (v: number | null) => {
    if (v == null) return "        ";
    const s = money2(v);
    const cut = s.length > 8 ? s.slice(-8) : s;
    return padRight(cut, 8);
  };

  return `T${acct}  ${field8(debit)} ${field8(credit)} `;
}

export function makeCCHeader(headerDate: Date, companyHeaderName: string) {
  const dateStr = headerDate.toLocaleDateString("fr-CA", {
    day: "2-digit",
    month: "long",
    year: "2-digit",
  });
  return `Importation de contrats ${companyHeaderName || "Groupe Breton"} le ${dateStr}`;
}

export function makeCCEntryContent(opts: {
  factureDate: Date;
  code: string;
  factureNo: string;
  total: number;
  ref: string;
  glAR: string;
  glRevenu: string;
  glTPS: string;
  glTVQ: string;
  glCAR: string | null;
  montantRevenu: number;
  montantTPS: number;
  montantTVQ: number;
  montantCAR: number;
}) {
  const lines: string[] = [];

  lines.push(
    formatFLine({
      date: opts.factureDate,
      code: opts.code,
      factureNo: opts.factureNo,
      total: opts.total,
      ref: opts.ref,
    })
  );

  lines.push(formatTLine(opts.glAR, opts.total, null));
  lines.push(formatTLine(opts.glRevenu, null, opts.montantRevenu));
  lines.push(formatTLine(opts.glTPS, null, opts.montantTPS));
  lines.push(formatTLine(opts.glTVQ, null, opts.montantTVQ));

  if (opts.glCAR && String(opts.glCAR).trim().length > 0) {
    lines.push(formatTLine(opts.glCAR, null, opts.montantCAR));
  }

  return lines.join("\r\n") + "\r\n";
}

export function makeCCFileContent(header: string, entries: string[]) {
  return `${header}\r\n${entries.join("")}\r\n`;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=ISO-8859-1" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================
   File system Acomba
========================= */
export function dirKey(label: string) {
  return `acomba:dir:${String(label || "").trim().toLowerCase()}`;
}

export async function ensurePermission(handle: FileSystemDirectoryHandle) {
  const opts = { mode: "readwrite" as const };
  try {
    // @ts-ignore
    const q = await handle.queryPermission?.(opts);
    if (q === "granted") return true;
    // @ts-ignore
    const r = await handle.requestPermission?.(opts);
    return r === "granted";
  } catch {
    return false;
  }
}

export async function preflightDirPermission(label: string) {
  const dir = await get<FileSystemDirectoryHandle>(dirKey(label));
  if (!dir) {
    throw new Error(`Dossier non configuré pour “${label}”. Clique “Choisir dossier…”.`);
  }
  const ok = await ensurePermission(dir);
  if (!ok) {
    throw new Error(`Permission refusée pour “${label}”. Ouvre “Réglages Acomba” et re-choisis le dossier.`);
  }
}

export async function pickAcombaDirForTransporteur(transporteur: string) {
  if (!("showDirectoryPicker" in window)) {
    throw new Error("FS Access API non supportée. Utilise Edge/Chrome sur Windows.");
  }

  const label = String(transporteur || "").trim() || "Autres";

  // @ts-ignore
  const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
    id: `acomba-${label.toLowerCase().replace(/[^a-z0-9-_]/g, "-")}`,
    mode: "readwrite",
  });

  if (!(await ensurePermission(handle))) throw new Error("Permission refusée.");
  await set(dirKey(label), handle);
}

export async function writeFileToTransporteurDir(
  transporteur: string,
  filename: string,
  content: string
) {
  const label = String(transporteur || "").trim() || "Autres";

  const dir = await get<FileSystemDirectoryHandle>(dirKey(label));
  if (!dir) {
    throw new Error(`Dossier non configuré pour “${label}”. Clique “Choisir dossier ${label}”.`);
  }
  if (!(await ensurePermission(dir))) {
    throw new Error(`Permission refusée pour écrire dans “${label}”.`);
  }

  const fh = await dir.getFileHandle(String(filename).trim(), { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
}

export async function exportAcombaByTransporteurToFolders(opts: {
  files: Array<{ transporteur: string; filename: string; content: string }>;
}) {
  for (const f of opts.files) {
    const transporteur = String(f.transporteur ?? "").trim() || "Autres";
    const filename = String(f.filename ?? "").trim();

    if (!filename) {
      throw new Error(`Nom de fichier vide pour transporteur: ${transporteur}`);
    }

    await writeFileToTransporteurDir(transporteur, filename, f.content);
  }
}

/* =========================
   Sorting
========================= */
export type SortDir = "asc" | "desc";

export function flipDir(d: SortDir): SortDir {
  return d === "asc" ? "desc" : "asc";
}

export function cmpStr(a: any, b: any) {
  return String(a ?? "").localeCompare(String(b ?? ""), "fr-CA", { sensitivity: "base" });
}

export function cmpNum(a: any, b: any) {
  const na = Number(a ?? 0);
  const nb = Number(b ?? 0);
  return na === nb ? 0 : na < nb ? -1 : 1;
}

export function cmpDateIso(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return a === b ? 0 : a < b ? -1 : 1;
}

export function sortIndicator(active: boolean, dir: SortDir) {
  if (!active) return "";
  return dir === "asc" ? " ▲" : " ▼";
}