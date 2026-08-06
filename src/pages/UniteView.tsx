import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import UniteEntretienPage from "./UniteEntretienPage";

type Unite = {
  id: string;
  no_unite: string;
  actif: boolean;

  statut: string | null;
  km_actuel: number | null;

  marque: string | null;
  modele: string | null;
  annee: number | null;
  plaque: string | null;
  niv: string | null;

  note_generale: string | null;
  date_mise_en_service: string | null;

  client_id: string | null;

  type_unite_id: string | null;
  motorisation_id: string | null;
  freins_id: string | null;
  type_freins_id: string | null;
  suspension_id: string | null;

  mode_comptable: string | null;

  attache_remorque: boolean | null;
  coffre: boolean | null;
  espace_bagage: boolean | null;
  nb_passagers: number | null;

  pnbv: number | null;
  groupe_accessoire: string | null;
};

type ClientOption = {
  id: string;
  nom: string;
};

type SuiviTacheType = "a_planifier" | "urgent" | "hors_service";

type NoteMeca = {
  id: string;
  unite_id: string;
  titre: string;
  details: string | null;
  created_at: string;
  suivi_type?: SuiviTacheType | null;
};

type Option = {
  id: string;
  categorie:
    | "type_unite"
    | "motorisation"
    | "freins"
    | "type_freins"
    | "suspension"
    | "groupe_accessoire";
  libelle: string;
  ordre: number;
  actif: boolean;
};

type KmLog = {
  id: string;
  unite_id: string;
  km: number | null;
  source: string | null;
  bt_id: string | null;
  bt_numero?: string | null;
  created_at: string;
  note: string | null;
};

type TabKey = "infos" | "pep" | "kilometrage" | "notes" | "entretien";

type UniteAttribute = {
  id: string;
  code: string;
  libelle: string;
  type_valeur: "bool" | "texte" | "nombre" | "liste";
  categorie: string | null;
  ordre: number;
  actif: boolean;
};

type UniteAttributeOption = {
  id: string;
  attribute_id: string;
  valeur: string;
  libelle: string;
  ordre: number;
  actif: boolean;
};

type UniteAttributeValueRow = {
  id: string;
  unite_id: string;
  attribute_id: string;
  attribute_code: string;
  attribute_libelle: string;
  type_valeur: "bool" | "texte" | "nombre" | "liste";
  categorie: string | null;
  ordre: number;
  valeur_bool: boolean | null;
  valeur_text: string | null;
  valeur_number: number | null;
  valeur_option: string | null;
};

function isoToInputDate(v: string | null) {
  if (!v) return "";
  return v.includes("T") ? v.slice(0, 10) : v.slice(0, 10);
}

function fmtDateTime(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("fr-CA");
}

function fmtKm(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return `${Number(v).toLocaleString("fr-CA")} km`;
}

function toBool(v: any): boolean {
  return Boolean(v);
}

function numOrNull(v: string) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: any;
}) {
  return (
    <button
      type="button"
      className={"tab" + (active ? " active" : "")}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  children,
  hint,
}: {
  label: string;
  children: any;
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ width: 190, flex: "0 0 190px", fontWeight: 800, lineHeight: 1.1 }}>
        {label}
        {hint ? (
          <div className="muted" style={{ fontWeight: 600, marginTop: 4 }}>
            {hint}
          </div>
        ) : null}
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>{children}</div>
    </div>
  );
}

function MiniPanel({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

type UniteViewProps = {
  modalMode?: boolean;
  uniteIdOverride?: string;
  onCloseModal?: () => void;
};

export default function UniteView({
  modalMode = false,
  uniteIdOverride,
  onCloseModal,
}: UniteViewProps = {}) {
  const nav = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const id = uniteIdOverride || routeId;
  const [searchParams, setSearchParams] = useSearchParams();

  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>("infos");
  const [modalEditMode, setModalEditMode] = useState(false);

  const [u, setU] = useState<Unite | null>(null);
  const [notes, setNotes] = useState<NoteMeca[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [kmLogs, setKmLogs] = useState<KmLog[]>([]);

  const [opts, setOpts] = useState<Option[]>([]);
  const typeOpts = useMemo(
    () => opts.filter((o) => o.categorie === "type_unite" && o.actif),
    [opts]
  );
  const motOpts = useMemo(
    () => opts.filter((o) => o.categorie === "motorisation" && o.actif),
    [opts]
  );
  const freinsOpts = useMemo(
    () => opts.filter((o) => o.categorie === "freins" && o.actif),
    [opts]
  );
  const typeFreinsOpts = useMemo(
    () => opts.filter((o) => o.categorie === "type_freins" && o.actif),
    [opts]
  );
  const suspOpts = useMemo(
    () => opts.filter((o) => o.categorie === "suspension" && o.actif),
    [opts]
  );
  const groupeAccessoireOpts = useMemo(
    () => opts.filter((o) => o.categorie === "groupe_accessoire" && o.actif),
    [opts]
  );

  const [pepAttributes, setPepAttributes] = useState<UniteAttribute[]>([]);
  const [pepAttributeOptions, setPepAttributeOptions] = useState<UniteAttributeOption[]>([]);
  const [pepAttributeValues, setPepAttributeValues] = useState<Record<string, any>>({});
  const [pepAttributesLoading, setPepAttributesLoading] = useState(false);

  const groupedPepAttributes = useMemo(() => {
    const map = new Map<string, UniteAttribute[]>();

    for (const attr of pepAttributes) {
      const key = attr.categorie?.trim() || "Autres";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(attr);
    }

    return Array.from(map.entries()).map(([categorie, items]) => ({
      categorie,
      items: items.slice().sort((a, b) => {
        const ao = Number(a.ordre ?? 0);
        const bo = Number(b.ordre ?? 0);
        if (ao !== bo) return ao - bo;
        return a.libelle.localeCompare(b.libelle, "fr", { sensitivity: "base" });
      }),
    }));
  }, [pepAttributes]);

  const [openNoteModal, setOpenNoteModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteSuiviType, setNewNoteSuiviType] = useState<SuiviTacheType | "">("");

  const [openKmModal, setOpenKmModal] = useState(false);
  const [newKmValue, setNewKmValue] = useState("");

  const [editingKmId, setEditingKmId] = useState<string | null>(null);
  const [editKmValue, setEditKmValue] = useState("");

  const isEditMode = modalMode ? modalEditMode : searchParams.get("edit") === "1";

  const title = useMemo(() => {
    if (!u) return "Unité";
    return `Unité ${u.no_unite || ""}`.trim();
  }, [u]);

  async function loadClients() {
    const { data, error } = await supabase
      .from("clients")
      .select("id,nom")
      .order("nom", { ascending: true });

    if (error) {
      console.warn("clients:", error.message);
      setClients([]);
      return;
    }

    setClients((data as any) ?? []);
  }

  async function loadOptions() {
    const { data, error } = await supabase
      .from("unite_options")
      .select("id,categorie,libelle,ordre,actif")
      .order("categorie", { ascending: true })
      .order("ordre", { ascending: true })
      .order("libelle", { ascending: true });

    if (error) {
      console.warn("unite_options:", error.message);
      setOpts([]);
      return;
    }

    setOpts((data as any) ?? []);
  }

  async function loadUnite() {
    if (!id) return;

    const { data, error } = await supabase
      .from("unites")
      .select(
        [
          "id",
          "no_unite",
          "actif",
          "statut",
          "km_actuel",
          "marque",
          "modele",
          "annee",
          "plaque",
          "niv",
          "note_generale",
          "date_mise_en_service",
          "client_id",
          "type_unite_id",
          "motorisation_id",
          "freins_id",
          "type_freins_id",
          "suspension_id",
          "mode_comptable",
          "attache_remorque",
          "coffre",
          "espace_bagage",
          "nb_passagers",
          "pnbv",
          "groupe_accessoire",
        ].join(",")
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      alert(error?.message || "Unité introuvable");
      setU(null);
      return;
    }

    setU(data as unknown as Unite);
  }

  async function loadNotes() {
    if (!id) return;

    const { data, error } = await supabase
      .from("unite_notes")
      .select("id,unite_id,titre,details,created_at,suivi_type")
      .eq("unite_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("unite_notes:", error.message);
      setNotes([]);
      return;
    }

    setNotes((data as any) ?? []);
  }

  async function loadKmLogs() {
    if (!id) return;

    const { data, error } = await supabase.rpc("get_unite_km_logs", {
      p_unite_id: id,
    });

    if (error) {
      console.warn("get_unite_km_logs:", error.message);
      setKmLogs([]);
      return;
    }

    setKmLogs(((data as any[]) ?? []) as KmLog[]);
  }

  async function loadPepAttributesForUnit(uniteId: string) {
    setPepAttributesLoading(true);

    const [attrRes, optionRes, valueRes] = await Promise.all([
      supabase
        .from("unite_attributes")
        .select("id, code, libelle, type_valeur, categorie, ordre, actif")
        .eq("actif", true)
        .order("categorie", { ascending: true })
        .order("ordre", { ascending: true })
        .order("libelle", { ascending: true }),

      supabase
        .from("unite_attribute_options")
        .select("id, attribute_id, valeur, libelle, ordre, actif")
        .eq("actif", true)
        .order("ordre", { ascending: true })
        .order("libelle", { ascending: true }),

      supabase
        .from("v_unites_attributes")
        .select("*")
        .eq("unite_id", uniteId)
        .order("categorie", { ascending: true })
        .order("ordre", { ascending: true }),
    ]);

    if (!attrRes.error) {
      setPepAttributes((attrRes.data ?? []) as UniteAttribute[]);
    } else {
      console.warn("unite_attributes:", attrRes.error.message);
      setPepAttributes([]);
    }

    if (!optionRes.error) {
      setPepAttributeOptions((optionRes.data ?? []) as UniteAttributeOption[]);
    } else {
      console.warn("unite_attribute_options:", optionRes.error.message);
      setPepAttributeOptions([]);
    }

    if (!valueRes.error) {
      const rows = (valueRes.data ?? []) as UniteAttributeValueRow[];
      const map: Record<string, any> = {};

      for (const row of rows) {
        if (row.type_valeur === "bool") map[row.attribute_code] = row.valeur_bool ?? false;
        else if (row.type_valeur === "texte") map[row.attribute_code] = row.valeur_text ?? "";
        else if (row.type_valeur === "nombre") map[row.attribute_code] = row.valeur_number ?? "";
        else if (row.type_valeur === "liste") map[row.attribute_code] = row.valeur_option ?? "";
      }

      setPepAttributeValues(map);
    } else {
      console.warn("v_unites_attributes:", valueRes.error.message);
      setPepAttributeValues({});
    }

    setPepAttributesLoading(false);
  }

  async function syncUniteKmFromLastLog() {
    if (!id) return null;

    const { data: latest, error: latestError } = await supabase
      .from("unites_km_log")
      .select("id,km,created_at")
      .eq("unite_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw latestError;

    const km = latest?.km ?? null;

    const { error: updateError } = await supabase
      .from("unites")
      .update({ km_actuel: km })
      .eq("id", id);

    if (updateError) throw updateError;

    setU((prev) => (prev ? { ...prev, km_actuel: km } : prev));
    return km;
  }

  async function refreshAll() {
    await Promise.all([loadClients(), loadOptions(), loadUnite(), loadNotes(), loadKmLogs()]);
  }

  function openEditMode() {
    if (modalMode) {
      setModalEditMode(true);
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set("edit", "1");
    setSearchParams(next);
  }

  function closeEditMode() {
    if (modalMode) {
      setModalEditMode(false);
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next);
  }

  async function cancelEdit() {
    await refreshAll();
    if (id) {
      await loadPepAttributesForUnit(id);
    }
    closeEditMode();
  }

  function setPepAttributeDraft(attributeCode: string, value: any) {
    setPepAttributeValues((prev) => ({
      ...prev,
      [attributeCode]: value,
    }));
  }

  async function saveDynamicPepAttributes(uniteId: string) {
    if (!pepAttributes.length) return;

    const payloads = pepAttributes.map((attr) => {
      const rawValue = pepAttributeValues[attr.code];

      const payload: Record<string, any> = {
        unite_id: uniteId,
        attribute_id: attr.id,
        valeur_bool: null,
        valeur_text: null,
        valeur_number: null,
        valeur_option: null,
      };

      if (attr.type_valeur === "bool") {
        payload.valeur_bool = Boolean(rawValue);
      } else if (attr.type_valeur === "texte") {
        payload.valeur_text = String(rawValue ?? "").trim() || null;
      } else if (attr.type_valeur === "nombre") {
        if (rawValue === "" || rawValue == null) payload.valeur_number = null;
        else {
          const n = Number(rawValue);
          payload.valeur_number = Number.isFinite(n) ? n : null;
        }
      } else if (attr.type_valeur === "liste") {
        payload.valeur_option = String(rawValue ?? "").trim() || null;
      }

      return payload;
    });

    const { error } = await supabase
      .from("unites_attributes_values")
      .upsert(payloads, { onConflict: "unite_id,attribute_id" });

    if (error) throw error;
  }

  async function saveUnite() {
    if (!u || busy) return;
    setBusy(true);

    try {
      const payload = {
        no_unite: u.no_unite?.trim(),
        actif: u.actif !== false,
        statut: u.statut?.trim() || null,
        marque: u.marque?.trim() || null,
        modele: u.modele?.trim() || null,
        annee: u.annee ?? null,
        plaque: u.plaque?.trim() || null,
        niv: u.niv?.trim() || null,
        note_generale: u.note_generale ?? null,
        date_mise_en_service: u.date_mise_en_service ? u.date_mise_en_service : null,
        client_id: u.client_id ?? null,
        type_unite_id: u.type_unite_id ?? null,
        motorisation_id: u.motorisation_id ?? null,
        freins_id: u.freins_id ?? null,
        type_freins_id: u.type_freins_id ?? null,
        suspension_id: u.suspension_id ?? null,
        mode_comptable: u.mode_comptable ?? null,
        attache_remorque: u.attache_remorque ?? null,
        coffre: u.coffre ?? null,
        espace_bagage: u.espace_bagage ?? null,
        nb_passagers: u.nb_passagers ?? null,
        pnbv: u.pnbv ?? null,
        groupe_accessoire: u.groupe_accessoire?.trim() || null,
      };

      const { error } = await supabase.from("unites").update(payload).eq("id", u.id);
      if (error) throw error;

      await saveDynamicPepAttributes(u.id);
      await refreshAll();
      await loadPepAttributesForUnit(u.id);
      closeEditMode();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }


  async function deleteUnite() {
    if (!u || busy) return;
    if (!confirm("Supprimer cette unité ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("unites").delete().eq("id", u.id);
      if (error) throw error;
      if (modalMode) {
        onCloseModal?.();
      } else {
        nav("/unites", { replace: true });
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!id || busy) return;
    const titre = newNoteTitle.trim();
    if (!titre) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("unite_notes").insert({
        unite_id: id,
        titre,
        details: null,
        bt_source_id: null,
        suivi_type: newNoteSuiviType || null,
      });
      if (error) throw error;

      setNewNoteTitle("");
      setNewNoteSuiviType("");
      setOpenNoteModal(false);
      await loadNotes();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doneNote(noteId: string) {
    if (busy) return;
    if (!confirm("Marquer comme fait ? (La tâche sera supprimée)")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("unite_notes").delete().eq("id", noteId);
      if (error) throw error;
      await loadNotes();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addKmLog() {
    if (!id || busy) return;

    const km = numOrNull(newKmValue);
    if (km == null) {
      alert("Entre un KM valide.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("unites_km_log").insert({
        unite_id: id,
        km,
        source: "manuel",
        note: null,
        bt_id: null,
      });

      if (error) throw error;

      await syncUniteKmFromLastLog();
      await loadKmLogs();

      setNewKmValue("");
      setOpenKmModal(false);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function startEditKm(row: KmLog) {
    setEditingKmId(row.id);
    setEditKmValue(String(row.km ?? ""));
  }

  function cancelEditKm() {
    setEditingKmId(null);
    setEditKmValue("");
  }

  async function saveEditKm(row: KmLog) {
    if (busy || !id) return;

    const km = numOrNull(editKmValue);
    if (km == null) {
      alert("Entre un KM valide.");
      return;
    }

    setBusy(true);
    try {
      const { error: logError } = await supabase
        .from("unites_km_log")
        .update({
          km,
          note: null,
        })
        .eq("id", row.id);

      if (logError) throw logError;

      if (row.bt_id) {
        const { error: btError } = await supabase
          .from("bons_travail")
          .update({
            km,
          })
          .eq("id", row.bt_id);

        if (btError) throw btError;
      }

      await syncUniteKmFromLastLog();

      const { error: syncError } = await supabase.rpc("sync_entretien_items_for_unite", {
        p_unite_id: id,
      });

      if (syncError) throw syncError;

      await refreshAll();
      cancelEditKm();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function getSuiviBadge(suiviType: SuiviTacheType | null | undefined) {
    if (suiviType === "hors_service") {
      return { label: "Hors service", bg: "#fff0f0", color: "#c93f3f", border: "#f2c2c2" };
    }
    if (suiviType === "urgent") {
      return { label: "Urgent", bg: "#fff6e8", color: "#b66a00", border: "#ffe2b8" };
    }
    if (suiviType === "a_planifier") {
      return { label: "À planifier", bg: "#eef4ff", color: "#2159d6", border: "#cfe0ff" };
    }
    return null;
  }

  function openBt(btId: string) {
    nav(`/bt/${btId}`);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) {
      setPepAttributes([]);
      setPepAttributeOptions([]);
      setPepAttributeValues({});
      return;
    }
    loadPepAttributesForUnit(id);
  }, [id]);

  if (!id) return <div className="page">ID unité manquant.</div>;
  if (!u) return <div className="page">Chargement…</div>;

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <div className="muted">
            Fiche unité • configuration • PEP • client • notes mécaniques • kilométrage
          </div>
          <div
            style={{
              display: "inline-flex",
              marginTop: 8,
              padding: "5px 10px",
              borderRadius: 999,
              border: `1px solid ${u.actif ? "#bbf7d0" : "#fecaca"}`,
              background: u.actif ? "#f0fdf4" : "#fef2f2",
              color: u.actif ? "#166534" : "#991b1b",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {u.actif ? "Unité active" : "Unité inactive — suivi PEP arrêté"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!modalMode && (
            <button className="ghost" onClick={() => nav("/unites")} disabled={busy} type="button">
              Retour
            </button>
          )}

          {!isEditMode ? (
            <button className="btn-primary" onClick={openEditMode} disabled={busy} type="button">
              Modifier
            </button>
          ) : (
            <>
              <button className="ghost" onClick={cancelEdit} disabled={busy} type="button">
                Annuler
              </button>
              <button className="btn-primary" onClick={saveUnite} disabled={busy} type="button">
                Enregistrer
              </button>
            </>
          )}


          <button
            className="ghost"
            onClick={deleteUnite}
            disabled={busy}
            type="button"
            style={{ borderStyle: "solid", borderColor: "#fecaca", color: "#991b1b", background: "#fff" }}
          >
            Supprimer
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 10 }}>
        <TabBtn active={tab === "infos"} onClick={() => setTab("infos")}>
          Fiche unité
        </TabBtn>
        <TabBtn active={tab === "pep"} onClick={() => setTab("pep")}>
          PEP
        </TabBtn>
        <TabBtn active={tab === "kilometrage"} onClick={() => setTab("kilometrage")}>
          Kilométrage
        </TabBtn>
        <TabBtn active={tab === "notes"} onClick={() => setTab("notes")}>
          Notes mécaniques
        </TabBtn>
        <TabBtn active={tab === "entretien"} onClick={() => setTab("entretien")}>
          Entretien périodique
        </TabBtn>
      </div>

      {tab === "infos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Fiche unité</div>
                <div className="muted">Tout ce qui sert à identifier et configurer l’unité.</div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 900, marginTop: 2 }}>Identité</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Row label="Numéro d’unité">
                  <input
                    className="input"
                    value={u.no_unite ?? ""}
                    onChange={(e) => setU({ ...u, no_unite: e.target.value })}
                    placeholder="Ex: 1212"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row
                  label="Statut"
                  hint="Une unité inactive est retirée du suivi PEP et des entretiens périodiques."
                >
                  <select
                    className="input"
                    value={u.actif === false ? "inactif" : "actif"}
                    onChange={(e) => {
                      const actif = e.target.value === "actif";
                      setU({
                        ...u,
                        actif,
                        statut: actif ? "actif" : "inactif",
                      });
                    }}
                    disabled={!isEditMode}
                  >
                    <option value="actif">Actif</option>
                    <option value="inactif">Inactif</option>
                  </select>
                </Row>

                <Row label="KM actuel" hint="Provient du dernier journal KM">
                  <input
                    className="input"
                    value={u.km_actuel ?? ""}
                    readOnly
                    disabled
                    placeholder="Ex: 245000"
                    inputMode="numeric"
                  />
                </Row>

                <Row label="Mise en service">
                  <input
                    className="input"
                    type="date"
                    value={isoToInputDate(u.date_mise_en_service)}
                    onChange={(e) => setU({ ...u, date_mise_en_service: e.target.value || null })}
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Client" hint="Client lié à cette unité">
                  <select
                    className="input"
                    value={u.client_id ?? ""}
                    onChange={(e) => setU({ ...u, client_id: e.target.value || null })}
                    disabled={!isEditMode}
                  >
                    <option value="">Aucun client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </Row>
              </div>

              <div style={{ height: 2, background: "var(--border)", margin: "6px 0" }} />

              <div style={{ fontWeight: 900, marginTop: 2 }}>Configuration</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Row label="Type">
                  <select
                    className="input"
                    value={u.type_unite_id ?? ""}
                    onChange={(e) => setU({ ...u, type_unite_id: e.target.value ? e.target.value : null })}
                    disabled={!isEditMode}
                  >
                    <option value="">—</option>
                    {typeOpts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.libelle}
                      </option>
                    ))}
                  </select>
                </Row>

                <Row label="Mode comptable" hint="Utilisé pour choisir les GL à l’export Acomba">
                  <select
                    className="input"
                    value={u.mode_comptable ?? ""}
                    onChange={(e) =>
                      setU({
                        ...u,
                        mode_comptable: e.target.value || null,
                      })
                    }
                    disabled={!isEditMode}
                  >
                    <option value="">—</option>
                    <option value="externe">Externe</option>
                    <option value="interne">Interne</option>
                    <option value="interne_ta">Interne TA</option>
                  </select>
                </Row>

                <Row label="Motorisation">
                  <select
                    className="input"
                    value={u.motorisation_id ?? ""}
                    onChange={(e) => setU({ ...u, motorisation_id: e.target.value ? e.target.value : null })}
                    disabled={!isEditMode}
                  >
                    <option value="">—</option>
                    {motOpts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.libelle}
                      </option>
                    ))}
                  </select>
                </Row>

                <Row label="Freins">
                  <select
                    className="input"
                    value={u.freins_id ?? ""}
                    onChange={(e) => setU({ ...u, freins_id: e.target.value ? e.target.value : null })}
                    disabled={!isEditMode}
                  >
                    <option value="">—</option>
                    {freinsOpts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.libelle}
                      </option>
                    ))}
                  </select>
                </Row>

                <Row label="Type freins">
                  <select
                    className="input"
                    value={u.type_freins_id ?? ""}
                    onChange={(e) => setU({ ...u, type_freins_id: e.target.value ? e.target.value : null })}
                    disabled={!isEditMode}
                  >
                    <option value="">—</option>
                    {typeFreinsOpts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.libelle}
                      </option>
                    ))}
                  </select>
                </Row>

                <Row label="Suspension">
                  <select
                    className="input"
                    value={u.suspension_id ?? ""}
                    onChange={(e) => setU({ ...u, suspension_id: e.target.value ? e.target.value : null })}
                    disabled={!isEditMode}
                  >
                    <option value="">—</option>
                    {suspOpts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.libelle}
                      </option>
                    ))}
                  </select>
                </Row>

                <Row label="Passagers">
                  <input
                    className="input"
                    value={u.nb_passagers ?? ""}
                    onChange={(e) => setU({ ...u, nb_passagers: numOrNull(e.target.value) })}
                    inputMode="numeric"
                    placeholder="Ex: 48"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Attributs fixes">
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={toBool(u.attache_remorque)}
                        onChange={(e) => setU({ ...u, attache_remorque: e.target.checked })}
                        disabled={!isEditMode}
                      />
                      Attache remorque
                    </label>

                    <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={toBool(u.coffre)}
                        onChange={(e) => setU({ ...u, coffre: e.target.checked })}
                        disabled={!isEditMode}
                      />
                      Coffre
                    </label>

                    <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={toBool(u.espace_bagage)}
                        onChange={(e) => setU({ ...u, espace_bagage: e.target.checked })}
                        disabled={!isEditMode}
                      />
                      Espace bagage
                    </label>
                  </div>
                </Row>
              </div>

              <div style={{ height: 2, background: "var(--border)", margin: "6px 0" }} />

              <div style={{ fontWeight: 900, marginTop: 2 }}>Immatriculation & identification</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Row label="Marque">
                  <input
                    className="input"
                    value={u.marque ?? ""}
                    onChange={(e) => setU({ ...u, marque: e.target.value })}
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Modèle">
                  <input
                    className="input"
                    value={u.modele ?? ""}
                    onChange={(e) => setU({ ...u, modele: e.target.value })}
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Année">
                  <input
                    className="input"
                    value={u.annee ?? ""}
                    onChange={(e) => setU({ ...u, annee: numOrNull(e.target.value) as any })}
                    inputMode="numeric"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Plaque">
                  <input
                    className="input"
                    value={u.plaque ?? ""}
                    onChange={(e) => setU({ ...u, plaque: e.target.value })}
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="NIV">
                  <input
                    className="input"
                    value={u.niv ?? ""}
                    onChange={(e) => setU({ ...u, niv: e.target.value })}
                    disabled={!isEditMode}
                  />
                </Row>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Note unité (générale)</div>
                <div className="muted">Visible partout (ex: création de BT).</div>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <textarea
                className="input"
                value={u.note_generale ?? ""}
                onChange={(e) => setU({ ...u, note_generale: e.target.value })}
                placeholder="Note générale…"
                style={{ width: "100%", minHeight: 110 }}
                disabled={!isEditMode}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "pep" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Configuration PEP</div>
                <div className="muted">Paramètres utilisés pour le formulaire PEP et les règles S/O.</div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <Row label="PNBV">
                <input
                  className="input"
                  value={u.pnbv ?? ""}
                  onChange={(e) => setU({ ...u, pnbv: numOrNull(e.target.value) })}
                  inputMode="numeric"
                  placeholder="Ex: 13385"
                  disabled={!isEditMode}
                />
              </Row>

              <Row label="Raison" hint="Valeur fixe utilisée dans le PEP">
                <input className="input" value="10" readOnly disabled />
              </Row>

              <Row label="Groupe accessoire">
                <select
                  className="input"
                  value={u.groupe_accessoire ?? ""}
                  onChange={(e) =>
                    setU({
                      ...u,
                      groupe_accessoire: e.target.value || null,
                    })
                  }
                  disabled={!isEditMode}
                >
                  <option value="">—</option>
                  {groupeAccessoireOpts.map((o) => (
                    <option key={o.id} value={o.libelle}>
                      {o.libelle}
                    </option>
                  ))}
                </select>
              </Row>

              <Row label="Motorisation">
                <select
                  className="input"
                  value={u.motorisation_id ?? ""}
                  onChange={(e) => setU({ ...u, motorisation_id: e.target.value ? e.target.value : null })}
                  disabled={!isEditMode}
                >
                  <option value="">—</option>
                  {motOpts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.libelle}
                    </option>
                  ))}
                </select>
              </Row>

              <Row label="Freins">
                <select
                  className="input"
                  value={u.freins_id ?? ""}
                  onChange={(e) => setU({ ...u, freins_id: e.target.value ? e.target.value : null })}
                  disabled={!isEditMode}
                >
                  <option value="">—</option>
                  {freinsOpts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.libelle}
                    </option>
                  ))}
                </select>
              </Row>

              <Row label="Type freins">
                <select
                  className="input"
                  value={u.type_freins_id ?? ""}
                  onChange={(e) => setU({ ...u, type_freins_id: e.target.value ? e.target.value : null })}
                  disabled={!isEditMode}
                >
                  <option value="">—</option>
                  {typeFreinsOpts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.libelle}
                    </option>
                  ))}
                </select>
              </Row>

              <Row label="Suspension">
                <select
                  className="input"
                  value={u.suspension_id ?? ""}
                  onChange={(e) => setU({ ...u, suspension_id: e.target.value ? e.target.value : null })}
                  disabled={!isEditMode}
                >
                  <option value="">—</option>
                  {suspOpts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.libelle}
                    </option>
                  ))}
                </select>
              </Row>
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Attributs PEP dynamiques</div>
                <div className="muted">
                  Ces attributs servent aux règles S/O automatiques selon l’unité.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {pepAttributesLoading ? (
                <div className="muted">Chargement des attributs…</div>
              ) : pepAttributes.length === 0 ? (
                <div className="muted">Aucun attribut dynamique actif.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {groupedPepAttributes.map((group) => (
                    <div
                      key={group.categorie}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontWeight: 900, marginBottom: 10 }}>{group.categorie}</div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {group.items.map((attr) => {
                          const value = pepAttributeValues[attr.code];
                          const optionsForAttr = pepAttributeOptions.filter(
                            (opt) => opt.attribute_id === attr.id
                          );

                          if (attr.type_valeur === "bool") {
                            return (
                              <Row key={attr.id} label={attr.libelle}>
                                <label
                                  style={{
                                    display: "inline-flex",
                                    gap: 8,
                                    alignItems: "center",
                                    fontWeight: 800,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(value)}
                                    onChange={(e) => setPepAttributeDraft(attr.code, e.target.checked)}
                                    disabled={!isEditMode}
                                  />
                                  Actif
                                </label>
                              </Row>
                            );
                          }

                          if (attr.type_valeur === "texte") {
                            return (
                              <Row key={attr.id} label={attr.libelle}>
                                <input
                                  className="input"
                                  type="text"
                                  value={value ?? ""}
                                  onChange={(e) => setPepAttributeDraft(attr.code, e.target.value)}
                                  disabled={!isEditMode}
                                />
                              </Row>
                            );
                          }

                          if (attr.type_valeur === "nombre") {
                            return (
                              <Row key={attr.id} label={attr.libelle}>
                                <input
                                  className="input"
                                  type="number"
                                  value={value ?? ""}
                                  onChange={(e) => setPepAttributeDraft(attr.code, e.target.value)}
                                  disabled={!isEditMode}
                                />
                              </Row>
                            );
                          }

                          return (
                            <Row key={attr.id} label={attr.libelle}>
                              <select
                                className="input"
                                value={value ?? ""}
                                onChange={(e) => setPepAttributeDraft(attr.code, e.target.value)}
                                disabled={!isEditMode}
                              >
                                <option value="">—</option>
                                {optionsForAttr.map((opt) => (
                                  <option key={opt.id} value={opt.valeur}>
                                    {opt.libelle}
                                  </option>
                                ))}
                              </select>
                            </Row>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "kilometrage" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Journal du kilométrage</div>
                <div className="muted">Le KM actuel de l’unité provient toujours du dernier log.</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn-primary" type="button" onClick={() => setOpenKmModal(true)} disabled={busy}>
                  Ajouter KM
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "minmax(240px, 420px)",
                gap: 10,
              }}
            >
              <MiniPanel title="KM actuel">
                <div style={{ fontWeight: 900, fontSize: 26 }}>{fmtKm(u.km_actuel)}</div>
                <div className="muted">Synchronisé avec le dernier enregistrement du journal.</div>
              </MiniPanel>
            </div>

            {openKmModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                  padding: 16,
                }}
                onClick={() => {
                  if (busy) return;
                  setOpenKmModal(false);
                  setNewKmValue("");
                }}
              >
                <div
                  className="card"
                  style={{ width: "100%", maxWidth: 420, margin: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Ajouter une entrée KM</div>

                  <input
                    className="input"
                    value={newKmValue}
                    onChange={(e) => setNewKmValue(e.target.value)}
                    placeholder="KM"
                    inputMode="numeric"
                    autoFocus
                  />

                  <div className="toolbar" style={{ marginTop: 12 }}>
                    <button className="btn-primary" type="button" onClick={addKmLog} disabled={busy}>
                      Enregistrer
                    </button>
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => {
                        setOpenKmModal(false);
                        setNewKmValue("");
                      }}
                      disabled={busy}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="list">
                <thead>
                  <tr>
                    <th style={{ paddingTop: 8, paddingBottom: 8 }}>Date</th>
                    <th style={{ paddingTop: 8, paddingBottom: 8 }}>KM</th>
                    <th style={{ paddingTop: 8, paddingBottom: 8, width: 110 }}>BT</th>
                    <th style={{ width: 120, textAlign: "right", paddingTop: 8, paddingBottom: 8 }} />
                  </tr>
                </thead>
                <tbody>
                  {kmLogs.map((row) => {
                    const isEditing = editingKmId === row.id;

                    return (
                      <tr className="row" key={row.id} style={{ background: "rgba(0,0,0,.025)" }}>
                        <td className="muted" style={{ paddingTop: 8, paddingBottom: 8 }}>
                          {fmtDateTime(row.created_at)}
                        </td>

                        <td style={{ fontWeight: 900, paddingTop: 8, paddingBottom: 8 }}>
                          {isEditing ? (
                            <input
                              className="input"
                              value={editKmValue}
                              onChange={(e) => setEditKmValue(e.target.value)}
                              inputMode="numeric"
                              style={{ minHeight: 34, paddingTop: 6, paddingBottom: 6 }}
                            />
                          ) : (
                            fmtKm(row.km)
                          )}
                        </td>

                        <td style={{ paddingTop: 8, paddingBottom: 8 }}>
                          {row.bt_id ? (
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => row.bt_id && openBt(row.bt_id)}
                              style={{ padding: "4px 8px", minWidth: 0 }}
                            >
                              {row.bt_numero || "Ouvrir BT"}
                            </button>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>

                        <td style={{ textAlign: "right", paddingTop: 8, paddingBottom: 8 }}>
                          {isEditing ? (
                            <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              <button className="btn-primary" type="button" onClick={() => saveEditKm(row)} disabled={busy}>
                                Sauvegarder
                              </button>
                              <button className="ghost" type="button" onClick={cancelEditKm} disabled={busy}>
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button className="ghost" type="button" onClick={() => startEditKm(row)} disabled={busy}>
                              Modifier
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {kmLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        Aucun historique de kilométrage.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="hint">
              Le BT doit écrire dans <b>unites_km_log</b>, puis l’unité se synchronise depuis le dernier log.
            </div>
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Notes mécaniques</div>
              </div>

              <button className="btn-primary" onClick={() => setOpenNoteModal(true)} disabled={busy} type="button">
                Ajouter tâche mécanique
              </button>
            </div>

            {openNoteModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                  padding: 16,
                }}
                onClick={() => {
                  if (busy) return;
                  setOpenNoteModal(false);
                  setNewNoteTitle("");
                  setNewNoteSuiviType("");
                }}
              >
                <div
                  className="card"
                  style={{ width: "100%", maxWidth: 420, margin: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Nouvelle tâche mécanique</div>

                  <input
                    className="input"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="Ex: Vérifier fuite huile"
                    autoFocus
                  />

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                      Suivi tableau de bord
                    </div>
                    <select
                      className="input"
                      value={newNoteSuiviType}
                      onChange={(e) =>
                        setNewNoteSuiviType(e.target.value as SuiviTacheType | "")
                      }
                      style={{ width: "100%" }}
                    >
                      <option value="">Aucun suivi</option>
                      <option value="a_planifier">À planifier</option>
                      <option value="urgent">Urgent</option>
                      <option value="hors_service">Hors service</option>
                    </select>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Si un suivi est choisi, la tâche apparaîtra dans le tableau de bord.
                    </div>
                  </div>

                  <div className="toolbar" style={{ marginTop: 12 }}>
                    <button className="btn-primary" onClick={addNote} disabled={busy} type="button">
                      Enregistrer
                    </button>
                    <button
                      className="ghost"
                      onClick={() => {
                        setOpenNoteModal(false);
                        setNewNoteTitle("");
                        setNewNoteSuiviType("");
                      }}
                      disabled={busy}
                      type="button"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="list">
                <thead>
                  <tr>
                    <th>Titre</th>
                    <th>Créé</th>
                    <th style={{ width: 140, textAlign: "right" }} />
                  </tr>
                </thead>
                <tbody>
                  {notes.map((n) => (
                    <tr className="row" key={n.id}>
                      <td>
                        <div style={{ fontWeight: 900 }}>{n.titre}</div>
                        {(() => {
                          const badge = getSuiviBadge(n.suivi_type as SuiviTacheType | null | undefined);
                          return badge ? (
                            <span
                              style={{
                                display: "inline-flex",
                                marginTop: 6,
                                padding: "4px 9px",
                                borderRadius: 999,
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                fontSize: 12,
                                fontWeight: 900,
                              }}
                            >
                              {badge.label}
                            </span>
                          ) : null;
                        })()}
                      </td>
                      <td className="muted">{fmtDateTime(n.created_at)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="ghost"
                          onClick={() => doneNote(n.id)}
                          disabled={busy}
                          type="button"
                          style={{ borderStyle: "solid" }}
                        >
                          Fait
                        </button>
                      </td>
                    </tr>
                  ))}

                  {notes.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        Aucune note mécanique ouverte.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="hint">Chaque action (ajouter/supprimer) rafraîchit immédiatement.</div>
          </div>
        </div>
      )}

      {tab === "entretien" && <UniteEntretienPage embedded uniteId={id} />}
    </div>
  );
}