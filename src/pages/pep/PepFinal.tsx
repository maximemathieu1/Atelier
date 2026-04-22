import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type PepPayload = {
  unite_id?: string;
  mecano_id?: string;
  mecano_nom?: string;
  type_pep?: string;
  unite?: string;
  marque?: string;
  modele?: string;
  annee?: string;
  odom?: string;
  niv?: string;
  plaque?: string;
  pnbv?: string;
  type?: string;
  raison?: string;
  num_mecano?: string;
  date_pep?: string;
  date_prochain?: string;
  commentaires?: string;
  measures?: Record<string, string>;
  rules_so_active?: Array<{ cat?: string; el?: string } | string>;
  defects?: Array<{
    categorie?: string;
    element?: string;
    loc_code?: string;
    def_code?: string;
    gravite?: string;
  }>;
  signature?: string;
};

type PepArchiveInsert = {
  unite_id: string;
  unite: string | null;
  date_pep: string | null;
  date_prochain: string | null;
  num_mecano: string | null;
  odometre: string | null;
  payload_json: PepPayload;
  signature_data_url: string | null;
  html_complet: string;
  pages_html: string[];
};

const PEP_TEMPLATE_ID = "d71006cc-cfd7-4e49-83dd-918ee4201b89";

const EXTRA_STYLE = `
<style>
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}

.line{
  position:relative;
  display:inline-block;
  vertical-align:bottom;
}
.line::before{
  content:attr(data-value);
  position:absolute;
  left:2px;
  bottom:100%;
  transform:translateY(-1px);
  font-weight:600;
  color:#1d2430;
  white-space:nowrap;
  pointer-events:none;
}

.pep-center{
  text-align:center !important;
  font-weight:700;
}
.pep-so{
  color:#666;
}

.pep-page-footer{
  position:absolute;
  left:10px;
  right:10px;
  bottom:10px;
  display:grid;
  grid-template-columns:1fr 1fr 1fr 1fr;
  gap:12px;
  background:transparent;
}

.pep-foot-cell{
  position:relative;
  min-height:44px;
}

.pep-foot-line{
  position:relative;
  display:block;
  width:100%;
  border-top:1px solid #1d2430;
  padding-top:3px;
  text-align:left;
  color:#2e3b4e;
  font-size:7.8pt;
}

.pep-foot-line::before{
  content:attr(data-value);
  position:absolute;
  left:50%;
  bottom:100%;
  transform:translate(-50%,-2px);
  font-weight:600;
  color:#1d2430;
  white-space:nowrap;
  pointer-events:none;
  text-align:center;
}

.pf-sign-slot{
  position:absolute;
  left:0;
  right:0;
  bottom:40px;
  height:32px;
  display:flex;
  align-items:flex-end;
  justify-content:center;
  pointer-events:none;
}

.pf-sign-img{
  max-width:100%;
  max-height:34px;
  object-fit:contain;
  display:block;
}

.page{
  position:relative;
  min-height:100vh;
  box-sizing:border-box;
  padding-bottom:72px !important;
}

@media print {
  html, body { background:#fff; }
  .page {
    page-break-after: always;
    break-after: page;
  }
  .page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
}
</style>
`;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function keyOf(cat: unknown, el: unknown): string {
  return `${normalizeText(cat)}|||${normalizeText(el)}`;
}

function escapeAttr(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectExtraStyle(doc: Document) {
  doc.head.insertAdjacentHTML("beforeend", EXTRA_STYLE);
}

function fillHeader(doc: Document, payload: PepPayload) {
  const valueMap: Record<string, string> = {
    unite: String(payload.unite ?? ""),
    marque: String(payload.marque ?? ""),
    modele: String(payload.modele ?? ""),
    annee: String(payload.annee ?? ""),
    odom: String(payload.odom ?? ""),
    niv: String(payload.niv ?? ""),
    plaque: String(payload.plaque ?? ""),
    pnbv: String(payload.pnbv ?? ""),
    type: String(payload.type ?? ""),
    raison: String(payload.raison ?? ""),
  };

  const labelAliases: Record<string, keyof typeof valueMap> = {
    unite: "unite",
    marque: "marque",
    modele: "modele",
    annee: "annee",
    odometre: "odom",
    odom: "odom",
    niv: "niv",
    plaque: "plaque",
    pnbv: "pnbv",
    type: "type",
    raison: "raison",
  };

  const labels = Array.from(doc.querySelectorAll(".label"));

  labels.forEach((labelEl) => {
    const raw = normalizeText(labelEl.textContent).replace(/\s*:\s*$/, "").trim();
    const mappedKey = labelAliases[raw];
    if (!mappedKey) return;

    let candidate = labelEl.nextElementSibling as HTMLElement | null;

    while (candidate && !candidate.classList.contains("line")) {
      candidate = candidate.nextElementSibling as HTMLElement | null;
    }

    if (!candidate) return;
    candidate.setAttribute("data-value", valueMap[mappedKey] ?? "");
  });
}

function markTables(doc: Document, payload: PepPayload) {
  const soPairs = new Set<string>();
  const rawSo = Array.isArray(payload.rules_so_active) ? payload.rules_so_active : [];

  rawSo.forEach((entry) => {
    if (typeof entry === "string") {
      soPairs.add(keyOf("*", entry));
    } else {
      soPairs.add(keyOf(entry?.cat, entry?.el));
    }
  });

  const defects = Array.isArray(payload.defects) ? payload.defects : [];
  const defectByCatEl: Record<
    string,
    Record<
      string,
      {
        min: boolean;
        maj: boolean;
        locs: Set<string>;
        defs: Set<string>;
      }
    >
  > = {};

  defects.forEach((d) => {
    const cat = normalizeText(d.categorie);
    const el = normalizeText(d.element);
    if (!cat || !el) return;

    if (!defectByCatEl[cat]) defectByCatEl[cat] = {};
    if (!defectByCatEl[cat][el]) {
      defectByCatEl[cat][el] = {
        min: false,
        maj: false,
        locs: new Set<string>(),
        defs: new Set<string>(),
      };
    }

    const bucket = defectByCatEl[cat][el];
    const grav = normalizeText(d.gravite);

    if (grav === "min") bucket.min = true;
    if (grav === "maj") bucket.maj = true;
    if (d.loc_code) bucket.locs.add(String(d.loc_code).trim());
    if (d.def_code) bucket.defs.add(String(d.def_code).trim());
  });

  const tables = Array.from(doc.querySelectorAll("table")).filter((table) => {
    const ths = Array.from(table.querySelectorAll("thead th, tr th")).map((th) =>
      normalizeText(th.textContent)
    );
    return ths.includes("s/o") && ths.includes("element") && ths.includes("c");
  });

  tables.forEach((table) => {
    const headerRow = Array.from(table.querySelectorAll("tr")).find((tr) => tr.querySelector("th"));
    const idx: Record<string, number> = {};

    if (headerRow) {
      Array.from(headerRow.children).forEach((cell, i) => {
        const k = normalizeText(cell.textContent);
        if (k === "s/o") idx.so = i;
        if (k === "loc") idx.loc = i;
        if (k === "element") idx.el = i;
        if (k === "c") idx.c = i;
        if (k === "min") idx.min = i;
        if (k === "maj") idx.maj = i;
        if (k === "def") idx.def = i;
      });
    }

    const title = table.previousElementSibling;
    const catKey =
      title && title.classList.contains("section-title")
        ? normalizeText(title.textContent)
        : "";

    const rows = Array.from(table.querySelectorAll("tbody tr")).filter((tr) => tr.querySelector("td"));

    rows.forEach((tr) => {
      const tds = Array.from(tr.children) as HTMLElement[];
      const elTxt = (tds[idx.el]?.textContent ?? "").trim();
      const elKey = normalizeText(elTxt);

      const soCell = tds[idx.so];
      const locCell = tds[idx.loc];
      const cCell = tds[idx.c];
      const minCell = tds[idx.min];
      const majCell = tds[idx.maj];
      const defCell = tds[idx.def];

      if (soCell) soCell.textContent = "";
      if (locCell) locCell.textContent = "";
      if (cCell) cCell.textContent = "";
      if (minCell) minCell.textContent = "";
      if (majCell) majCell.textContent = "";
      if (defCell) defCell.textContent = "";

      const exactSoKey = keyOf(catKey, elKey);
      const anySoKey = keyOf("*", elKey);

      if (soPairs.has(exactSoKey) || soPairs.has(anySoKey)) {
        if (soCell) {
          soCell.textContent = "X";
          soCell.classList.add("pep-center", "pep-so");
        }
        return;
      }

      const defectInfo = defectByCatEl[catKey]?.[elKey];
      if (defectInfo) {
        if (minCell && defectInfo.min) {
          minCell.textContent = "X";
          minCell.classList.add("pep-center");
        }
        if (majCell && defectInfo.maj) {
          majCell.textContent = "X";
          majCell.classList.add("pep-center");
        }
        if (locCell && defectInfo.locs.size > 0) {
          locCell.textContent = Array.from(defectInfo.locs).join("/");
        }
        if (defCell && defectInfo.defs.size > 0) {
          defCell.textContent = Array.from(defectInfo.defs).join("/");
        }
        return;
      }

      if (cCell) {
        cCell.textContent = "X";
        cCell.classList.add("pep-center");
      }
    });
  });
}

function fillMeasures(doc: Document, payload: PepPayload) {
  const measures = payload.measures ?? {};
  Object.keys(measures).forEach((key) => {
    const els = doc.querySelectorAll(`[data-measure="${key}"]`);
    els.forEach((el) => {
      el.textContent = String(measures[key] ?? "").trim();
    });
  });
}

function fillComments(doc: Document, payload: PepPayload) {
  const lines = String(payload.commentaires ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  const notesBox = doc.querySelector(".notes-box");
  if (!notesBox) return;

  const rows = Array.from(notesBox.querySelectorAll("div"));
  rows.forEach((row, i) => {
    row.innerHTML = "";
    const span = doc.createElement("span");
    span.textContent = lines[i] || "";
    row.appendChild(span);
  });
}

function ensurePageFooters(doc: Document, payload: PepPayload) {
  const pages = Array.from(doc.querySelectorAll(".page"));
  pages.forEach((page) => {
    if (page.querySelector(".pep-page-footer")) return;

    const footer = doc.createElement("div");
    footer.className = "pep-page-footer";

    footer.innerHTML = `
      <div class="pep-foot-cell">
        <span class="pf-sign-slot">
          <img class="pf-sign-img" ${payload.signature ? `src="${escapeAttr(payload.signature)}"` : ""} />
        </span>
        <span class="pep-foot-line pf-sign-label">SIGNATURE</span>
      </div>
      <div class="pep-foot-cell">
        <span class="pep-foot-line pf-num" data-value="${escapeAttr(payload.num_mecano)}">NUMÉRO DU MÉCANICIEN</span>
      </div>
      <div class="pep-foot-cell">
        <span class="pep-foot-line pf-date" data-value="${escapeAttr(payload.date_pep)}">DATE (AAAA-MM-JJ)</span>
      </div>
      <div class="pep-foot-cell">
        <span class="pep-foot-line pf-next" data-value="${escapeAttr(payload.date_prochain)}">DATE PROCHAINE INSP.</span>
      </div>
    `;

    page.appendChild(footer);
  });
}

function buildPageDocument(pageHtml: string, originalHeadHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
${originalHeadHtml}
</head>
<body>
${pageHtml}
</body>
</html>`;
}

function processOneDocument(doc: Document, payload: PepPayload) {
  injectExtraStyle(doc);
  fillHeader(doc, payload);
  markTables(doc, payload);
  fillMeasures(doc, payload);
  fillComments(doc, payload);
  ensurePageFooters(doc, payload);
}

function splitTemplateIntoPages(rawTemplateHtml: string, payload: PepPayload): string[] {
  const parser = new DOMParser();
  const fullDoc = parser.parseFromString(rawTemplateHtml, "text/html");

  const originalHeadHtml = fullDoc.head ? fullDoc.head.innerHTML : "";
  const pageNodes = Array.from(fullDoc.querySelectorAll(".page"));

  if (pageNodes.length === 0) {
    const singleDoc = parser.parseFromString(rawTemplateHtml, "text/html");
    processOneDocument(singleDoc, payload);

    return [
      `<!DOCTYPE html>
<html lang="fr">
<head>
${singleDoc.head ? singleDoc.head.innerHTML : originalHeadHtml}
</head>
<body>
${singleDoc.body ? singleDoc.body.innerHTML : ""}
</body>
</html>`,
    ];
  }

  return pageNodes.map((pageNode) => {
    const pageDoc = parser.parseFromString(
      `<!DOCTYPE html><html lang="fr"><head>${originalHeadHtml}</head><body>${pageNode.outerHTML}</body></html>`,
      "text/html"
    );

    processOneDocument(pageDoc, payload);

    return buildPageDocument(
      pageDoc.body ? pageDoc.body.innerHTML : pageNode.outerHTML,
      pageDoc.head ? pageDoc.head.innerHTML : originalHeadHtml
    );
  });
}

function buildFullProcessedDocument(rawTemplateHtml: string, payload: PepPayload): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawTemplateHtml, "text/html");
  processOneDocument(doc, payload);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
${doc.head ? doc.head.innerHTML : ""}
</head>
<body>
${doc.body ? doc.body.innerHTML : ""}
</body>
</html>`;
}

function dateOnlyOrToday(value?: string | null) {
  const s = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyToIsoMidday(value?: string | null) {
  return `${dateOnlyOrToday(value)}T12:00:00.000Z`;
}

function isPepTaskLabel(value: unknown) {
  const v = normalizeText(value);
  return v.includes("pep") || v.includes("inspection periodique");
}

async function resolvePepHourlyRate(uniteId: string) {
  const { data: uniteRow } = await supabase
    .from("unites")
    .select("client_id,type_unite_id")
    .eq("id", uniteId)
    .maybeSingle();

  const clientId = (uniteRow as any)?.client_id ?? null;
  const typeUniteId = (uniteRow as any)?.type_unite_id ?? null;

  if (!clientId) return 0;

  if (typeUniteId) {
    const { data: clientMoRows } = await supabase
      .from("client_taux_main_oeuvre")
      .select("taux_horaire,type_unite_id")
      .eq("client_id", clientId)
      .eq("actif", true);

    const exact = (clientMoRows || []).find(
      (row: any) => String(row.type_unite_id || "") === String(typeUniteId)
    );
    const generic = (clientMoRows || []).find((row: any) => !row.type_unite_id);
    const picked = exact || generic;
    if (picked?.taux_horaire != null && Number.isFinite(Number(picked.taux_horaire))) {
      return Number(picked.taux_horaire);
    }
  }

  const { data: cfg } = await supabase
    .from("client_configuration")
    .select("taux_horaire")
    .eq("client_id", clientId)
    .maybeSingle();

  return cfg?.taux_horaire != null && Number.isFinite(Number(cfg.taux_horaire))
    ? Number(cfg.taux_horaire)
    : 0;
}

async function getOrCreatePepBt(
  uniteId: string,
  datePep: string,
  km: number | null,
  mecanoNom: string | null,
  numMecano: string | null
) {
  const { data: existingBt, error: existingBtErr } = await supabase
    .from("bons_travail")
    .select("*")
    .eq("unite_id", uniteId)
    .in("statut", ["ouvert", "a_faire", "en_cours"])
    .order("date_ouverture", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingBtErr) throw existingBtErr;

  if (existingBt?.id) {
    if (
      km != null &&
      Number.isFinite(km) &&
      (existingBt.km == null || Number(km) > Number(existingBt.km || 0))
    ) {
      const { error: kmErr } = await supabase
        .from("bons_travail")
        .update({ km })
        .eq("id", existingBt.id);
      if (kmErr) throw kmErr;
      return { bt: { ...existingBt, km }, created: false as const };
    }
    return { bt: existingBt, created: false as const };
  }

  const { data: createdBt, error: createBtErr } = await supabase
    .from("bons_travail")
    .insert({
      unite_id: uniteId,
      statut: "ouvert",
      date_ouverture: dateOnlyToIsoMidday(datePep),
      km,
    })
    .select("*")
    .single();

  if (createBtErr) throw createBtErr;

  const tauxHoraire = await resolvePepHourlyRate(uniteId);
  const mecanoNomFinal =
    String(mecanoNom || "").trim() || String(numMecano || "").trim() || "PEP";

  const { error: moErr } = await supabase.from("bt_main_oeuvre").insert({
    bt_id: createdBt.id,
    mecano_nom: mecanoNomFinal,
    description: null,
    heures: 1,
    taux_horaire: tauxHoraire,
  });
  if (moErr) throw moErr;

  return { bt: createdBt, created: true as const };
}

async function syncPepTaskAndHistorique(btRow: any, datePep: string, km: number | null) {
  const doneDateIso = dateOnlyToIsoMidday(datePep);
  const doneDateOnly = dateOnlyOrToday(datePep);

  let openTaskQuery = supabase
    .from("unite_notes")
    .select("id,unite_id,titre,details,created_at,entretien_template_item_id,entretien_unite_item_id,entretien_auto")
    .eq("unite_id", btRow.unite_id)
    .eq("entretien_template_item_id", PEP_TEMPLATE_ID)
    .is("entretien_unite_item_id", null)
    .limit(1);

  let { data: openTask, error: openTaskErr } = await openTaskQuery.maybeSingle();
  if (openTaskErr) throw openTaskErr;

  if (!openTask) {
    const { data: fallbackOpenTasks, error: fallbackOpenErr } = await supabase
      .from("unite_notes")
      .select("id,unite_id,titre,details,created_at,entretien_template_item_id,entretien_unite_item_id,entretien_auto")
      .eq("unite_id", btRow.unite_id)
      .order("created_at", { ascending: false });

    if (fallbackOpenErr) throw fallbackOpenErr;
    openTask = (fallbackOpenTasks || []).find((row: any) => isPepTaskLabel(row.titre)) || null;
  }

  let doneTaskQuery = supabase
    .from("bt_taches_effectuees")
    .select("id,unite_note_id,titre")
    .eq("bt_id", btRow.id)
    .eq("entretien_template_item_id", PEP_TEMPLATE_ID)
    .is("entretien_unite_item_id", null)
    .limit(1);

  let { data: doneTask, error: doneTaskErr } = await doneTaskQuery.maybeSingle();
  if (doneTaskErr) throw doneTaskErr;

  if (!doneTask) {
    const { data: fallbackDoneTasks, error: fallbackDoneErr } = await supabase
      .from("bt_taches_effectuees")
      .select("id,unite_note_id,titre")
      .eq("bt_id", btRow.id)
      .order("date_effectuee", { ascending: false });

    if (fallbackDoneErr) throw fallbackDoneErr;
    doneTask = (fallbackDoneTasks || []).find((row: any) => isPepTaskLabel(row.titre)) || null;
  }

  if (!doneTask) {
    const insertRow = openTask
      ? {
          bt_id: btRow.id,
          unite_id: btRow.unite_id,
          unite_note_id: openTask.id,
          titre: openTask.titre,
          details: openTask.details,
          date_effectuee: doneDateIso,
          entretien_template_item_id: PEP_TEMPLATE_ID,
          entretien_unite_item_id: null,
          entretien_auto: true,
        }
      : {
          bt_id: btRow.id,
          unite_id: btRow.unite_id,
          unite_note_id: null,
          titre: "Entretien périodique - PEP 90 jours",
          details: null,
          date_effectuee: doneDateIso,
          entretien_template_item_id: PEP_TEMPLATE_ID,
          entretien_unite_item_id: null,
          entretien_auto: true,
        };

    const { error: insertDoneErr } = await supabase.from("bt_taches_effectuees").insert(insertRow);
    if (insertDoneErr) throw insertDoneErr;
  }

  if (openTask?.id) {
    const { error: deleteOpenTaskErr } = await supabase
      .from("unite_notes")
      .delete()
      .eq("id", openTask.id);

    if (deleteOpenTaskErr) throw deleteOpenTaskErr;
  }

  const { data: existingHist, error: existingHistErr } = await supabase
    .from("unite_entretien_historique")
    .select("id")
    .eq("unite_id", btRow.unite_id)
    .eq("bt_id", btRow.id)
    .eq("template_item_id", PEP_TEMPLATE_ID)
    .is("unite_item_id", null)
    .limit(1)
    .maybeSingle();

  if (existingHistErr) throw existingHistErr;

  const histPayload = {
    unite_id: btRow.unite_id,
    template_item_id: PEP_TEMPLATE_ID,
    unite_item_id: null,
    bt_id: btRow.id,
    nom_snapshot: "PEP 90 jours",
    frequence_km_snapshot: null,
    frequence_jours_snapshot: 90,
    date_effectuee: doneDateOnly,
    km_effectue: km,
    note: "PEP finalisé",
  };

  if (existingHist?.id) {
    const { error: histUpdErr } = await supabase
      .from("unite_entretien_historique")
      .update(histPayload)
      .eq("id", existingHist.id);

    if (histUpdErr) throw histUpdErr;
  } else {
    const { error: histInsertErr } = await supabase
      .from("unite_entretien_historique")
      .insert(histPayload);

    if (histInsertErr) throw histInsertErr;
  }

  try {
    await supabase.rpc("sync_entretien_due_tasks", {
      p_unite_id: btRow.unite_id,
      p_bt_id: btRow.id,
    });
  } catch {
    // non bloquant
  }
}


async function attachPepPdfToBt(
  btId: string,
  pepArchiveId: string,
  filename: string,
  pdfBlob: Blob
) {
  const path = `bt/${btId}/pep/${pepArchiveId}.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from("bt-documents")
    .upload(path, pdfBlob, {
      upsert: true,
      contentType: "application/pdf",
    });

  if (uploadErr) throw uploadErr;

  const { data: existingDoc, error: existingDocErr } = await supabase
    .from("bt_documents")
    .select("id")
    .eq("bt_id", btId)
    .eq("pep_id", pepArchiveId)
    .eq("type", "pep")
    .maybeSingle();

  if (existingDocErr) throw existingDocErr;

  const row = {
    bt_id: btId,
    pep_id: pepArchiveId,
    type: "pep",
    nom_fichier: filename,
    storage_path: path,
    mime_type: "application/pdf",
    taille_bytes: pdfBlob.size,
    source: "auto_pep",
  } as any;

  if (existingDoc?.id) {
    const { error } = await supabase
      .from("bt_documents")
      .update(row)
      .eq("id", existingDoc.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("bt_documents").insert(row);
    if (error) throw error;
  }
}

export default function PepFinal() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as { payload?: PepPayload } | null;

  const [pages, setPages] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [signature, setSignature] = useState("");
  const [printHtml, setPrintHtml] = useState("");
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [draftSignature, setDraftSignature] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveDone, setArchiveDone] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);

  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state?.payload) {
      navigate("/pep/nouvelle", { replace: true });
    }
  }, [state?.payload, navigate]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!actionsMenuRef.current) return;
      if (!actionsMenuRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const basePayload = state?.payload ?? null;

  const payload = useMemo<PepPayload | null>(() => {
    if (!basePayload) return null;
    return {
      ...basePayload,
      signature,
    };
  }, [basePayload, signature]);

  const isSigned = Boolean(signature && signature.trim());

 useEffect(() => {
  if (!payload) return;

  let cancelled = false;
  const currentPayload = payload;

  async function loadPreview() {
    try {
      const res = await fetch("/templates/Fiche.sans.footer.html", { cache: "no-store" });
      if (!res.ok) throw new Error("Impossible de charger le template PEP.");

      const rawTemplate = await res.text();
      const splitPages = splitTemplateIntoPages(rawTemplate, currentPayload);
      const fullProcessed = buildFullProcessedDocument(rawTemplate, currentPayload);

      if (!cancelled) {
        setPages(splitPages);
        setPrintHtml(fullProcessed);
        setPageIndex((prev) => Math.min(prev, Math.max(splitPages.length - 1, 0)));
      }
    } catch (e) {
      if (!cancelled) console.error(e);
    }
  }

  loadPreview();

  return () => {
    cancelled = true;
  };
}, [payload]);

  useEffect(() => {
    if (!signModalOpen) return;

    const canvas = signCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!draftSignature) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = draftSignature;
  }, [signModalOpen, draftSignature]);

  function getCanvasPoint(
    canvas: HTMLCanvasElement | null,
    e: React.PointerEvent<HTMLCanvasElement>
  ) {
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function handleSignPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { x, y } = getCanvasPoint(canvas, e);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111827";
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  }

  function handleSignPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;

    const canvas = signCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { x, y } = getCanvasPoint(canvas, e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function finishSignDrawing() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const canvas = signCanvasRef.current;
    if (!canvas) return;

    setDraftSignature(canvas.toDataURL("image/png"));
  }

  function openSignModal() {
    setDraftSignature(signature);
    setSignModalOpen(true);
  }

  function clearDraftSignature() {
    const canvas = signCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDraftSignature("");
  }

  function confirmSignature() {
    setSignature(draftSignature);
    setArchiveError("");
    setArchiveDone(false);
    setSignModalOpen(false);
  }

  function requireSignature(): boolean {
    if (isSigned) return true;

    setArchiveError("Signature requise avant d'imprimer ou d'archiver le PEP.");
    setArchiveDone(false);
    setActionsOpen(false);
    return false;
  }

  function handlePrint() {
    if (!printHtml) return;

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
      setTimeout(() => {
        iframe.remove();
      }, 500);
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
      } catch (e) {
        console.error(e);
        cleanup();
      }
    };

    const doc = iframe.contentDocument;
    if (!doc) {
      cleanup();
      return;
    }

    doc.open();
    doc.write(printHtml);
    doc.close();
  }

  function handlePrintClick() {
    if (!requireSignature()) return;
    setArchiveError("");
    setArchiveDone(false);
    setActionsOpen(false);
    handlePrint();
  }

  async function handleArchivePep() {
  if (!payload) return;

  if (!payload.unite_id) {
    setArchiveError("unite_id manquant dans le payload envoyé depuis PepNouvelle.");
    setArchiveDone(false);
    return;
  }

  if (!printHtml) {
    setArchiveError("Le HTML final n'est pas prêt.");
    setArchiveDone(false);
    return;
  }

  setArchiveBusy(true);
  setArchiveDone(false);
  setArchiveError("");

  try {
    const insertPayload: PepArchiveInsert = {
      unite_id: payload.unite_id,
      unite: payload.unite ?? null,
      date_pep: payload.date_pep ?? null,
      date_prochain: payload.date_prochain ?? null,
      num_mecano: payload.num_mecano ?? null,
      odometre: payload.odom ?? null,
      payload_json: payload,
      signature_data_url: signature || null,
      html_complet: printHtml,
      pages_html: pages,
    };

    const { data: insertedArchive, error } = await supabase
      .from("pep_archives")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) throw error;

    const pepArchiveId = String((insertedArchive as any)?.id || "").trim();
    if (!pepArchiveId) {
      throw new Error("Impossible de récupérer l'identifiant du PEP archivé.");
    }

    const km =
      payload.odom != null &&
      String(payload.odom).trim() !== "" &&
      Number.isFinite(Number(payload.odom))
        ? Number(payload.odom)
        : null;

    const { bt } = await getOrCreatePepBt(
      payload.unite_id,
      payload.date_pep ?? new Date().toISOString().slice(0, 10),
      km,
      payload.mecano_nom ?? null,
      payload.num_mecano ?? null
    );

    await syncPepTaskAndHistorique(
      bt,
      payload.date_pep ?? new Date().toISOString().slice(0, 10),
      km
    );

    const pepPdfFilename = `PEP-${payload.unite || "unite"}-${payload.date_pep || new Date().toISOString().slice(0, 10)}.pdf`;

    const pdfBlob = await renderPepPdfBlob(printHtml, pepPdfFilename);

    await attachPepPdfToBt(
      bt.id,
      pepArchiveId,
      pepPdfFilename,
      pdfBlob
    );

    setArchiveDone(true);
    setArchiveError("");
  } catch (e: any) {
    console.error(e);
    setArchiveError(e?.message ?? "Erreur inconnue pendant l'archivage.");
    setArchiveDone(false);
  } finally {
    setArchiveBusy(false);
  }
}

  function handleArchiveClick() {
    if (!requireSignature()) return;
    setActionsOpen(false);
    handleArchivePep();
  }

  const totalPages = pages.length || 1;
  const safePageIndex = Math.min(pageIndex, Math.max(totalPages - 1, 0));
  const currentPage = pages[safePageIndex] || "";

  if (!state?.payload) return null;

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <button type="button" onClick={() => navigate(-1)} style={styles.btnSecondary}>
          Retour
        </button>

        <div style={styles.topbarTitle}>Aperçu final PEP</div>

        <div style={styles.topbarActions}>
          <button type="button" onClick={openSignModal} style={styles.btnSecondary}>
            {signature ? "Modifier signature" : "Signer"}
          </button>

          <div style={styles.actionsMenuWrap} ref={actionsMenuRef}>
            <button
              type="button"
              onClick={() => setActionsOpen((v) => !v)}
              style={styles.btnPrimary}
            >
              ...
            </button>

            {actionsOpen && (
              <div style={styles.actionsMenu}>
                <button
                  type="button"
                  onClick={handlePrintClick}
                  style={{
                    ...styles.actionsMenuItem,
                    ...(!isSigned ? styles.actionsMenuItemDisabled : {}),
                  }}
                >
                  Imprimer
                </button>

                <button
                  type="button"
                  onClick={handleArchiveClick}
                  style={{
                    ...styles.actionsMenuItem,
                    ...(!isSigned || archiveBusy ? styles.actionsMenuItemDisabled : {}),
                  }}
                >
                  {archiveBusy ? "Archivage..." : "Archiver le PEP"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(archiveDone || archiveError) && (
        <div
          style={{
            ...styles.infoBanner,
            ...(archiveError ? styles.infoBannerError : styles.infoBannerSuccess),
          }}
        >
          {archiveError || "PEP archivé avec succès."}
        </div>
      )}

      <div style={styles.viewerWrap}>
        <div style={styles.viewer}>
          <iframe
            key={safePageIndex}
            title={`Aperçu PEP page ${safePageIndex + 1}`}
            srcDoc={currentPage}
            style={styles.pageFrame}
          />
        </div>

        <div style={styles.pagination}>
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={safePageIndex === 0}
            style={{
              ...styles.btnSecondary,
              opacity: safePageIndex === 0 ? 0.5 : 1,
              cursor: safePageIndex === 0 ? "not-allowed" : "pointer",
            }}
          >
            ←
          </button>

          <div style={styles.pageIndicator}>
            Page {safePageIndex + 1} / {totalPages}
          </div>

          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePageIndex >= totalPages - 1}
            style={{
              ...styles.btnSecondary,
              opacity: safePageIndex >= totalPages - 1 ? 0.5 : 1,
              cursor: safePageIndex >= totalPages - 1 ? "not-allowed" : "pointer",
            }}
          >
            →
          </button>
        </div>
      </div>

      {signModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Signature</div>
              <button
                type="button"
                onClick={() => setSignModalOpen(false)}
                style={styles.modalClose}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <canvas
                ref={signCanvasRef}
                width={1200}
                height={320}
                style={styles.signCanvas}
                onPointerDown={handleSignPointerDown}
                onPointerMove={handleSignPointerMove}
                onPointerUp={finishSignDrawing}
                onPointerLeave={finishSignDrawing}
              />

              <div style={styles.modalActions}>
                <button type="button" onClick={clearDraftSignature} style={styles.btnSecondary}>
                  Effacer
                </button>

                <button
                  type="button"
                  onClick={() => setSignModalOpen(false)}
                  style={styles.btnSecondary}
                >
                  Annuler
                </button>

                <button type="button" onClick={confirmSignature} style={styles.btnPrimary}>
                  Confirmer
                </button>
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
    minHeight: "100vh",
    background: "#e5e7eb",
    padding: 20,
    display: "grid",
    gap: 16,
    boxSizing: "border-box",
  },
  topbar: {
    display: "grid",
    gridTemplateColumns: "160px 1fr auto",
    alignItems: "center",
    gap: 12,
    background: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: 14,
    padding: 16,
  },
  topbarTitle: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
  },
  topbarActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  actionsMenuWrap: {
    position: "relative",
  },
  actionsMenu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    minWidth: 190,
    background: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    boxShadow: "0 12px 30px rgba(0,0,0,0.14)",
    overflow: "hidden",
    zIndex: 50,
    display: "grid",
  },
  actionsMenuItem: {
    border: "none",
    borderBottom: "1px solid #f1f5f9",
    background: "#ffffff",
    color: "#111827",
    textAlign: "left",
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  actionsMenuItemDisabled: {
    opacity: 0.45,
  },
  viewerWrap: {
    display: "grid",
    gap: 14,
  },
  viewer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    background: "#cbd5e1",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: 20,
    overflow: "hidden",
  },
  pageFrame: {
    width: 794,
    height: 1123,
    border: "none",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    borderRadius: 4,
    display: "block",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  pageIndicator: {
    minWidth: 120,
    textAlign: "center",
    fontSize: 15,
    fontWeight: 700,
    color: "#111827",
  },
  btnPrimary: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnSecondary: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  infoBanner: {
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 700,
  },
  infoBannerSuccess: {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#065f46",
  },
  infoBannerError: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: 20,
  },
  modalCard: {
    width: "min(920px, 100%)",
    background: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #d1d5db",
    boxShadow: "0 20px 50px rgba(0,0,0,0.20)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f8fafc",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
  },
  modalClose: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
    width: 36,
    height: 36,
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
  },
  modalBody: {
    padding: 16,
    display: "grid",
    gap: 14,
  },
  signCanvas: {
    width: "100%",
    height: 220,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    touchAction: "none",
    cursor: "crosshair",
    display: "block",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
};