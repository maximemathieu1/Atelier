import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/* =========================
   Types
========================= */

type Client = {
  id: string;
  nom: string;
  acomba_client_code: string | null;

  telephone: string | null;
  courriel: string | null;

  adresse_numero: string | null;
  adresse_rue: string | null;
  adresse_ville: string | null;
  adresse_province: string | null;
  adresse_code_postal: string | null;
  adresse_pays: string | null;

  note_generale: string | null;
};

type ClientContact = {
  id: string;
  client_id: string;
  nom: string;
  poste: string | null;
  telephone: string | null;
  courriel: string | null;
  principal: boolean | null;
  type_facturation: boolean | null;
  created_at: string;
};

type ClientConfig = {
  id: string;
  client_id: string;
  taux_horaire: number | null;
  marge_pieces: number | null;
  frais_atelier_pourcentage: number | null;
  actif: boolean | null;
  note_facturation: string | null;
  created_at: string;
};

type TauxMO = {
  id: string;
  client_id: string;
  type_unite_id: string | null;
  taux_horaire: number;
  actif: boolean;
  created_at: string;
};

type MargePiece = {
  id: string;
  client_id: string;
  categorie: string;
  marge_pourcentage: number;
  actif: boolean;
  created_at: string;
};

type UniteOption = {
  id: string;
  categorie: "type_unite" | "motorisation" | "freins" | "suspension";
  libelle: string;
  ordre: number;
  actif: boolean;
};

type UniteRow = {
  id: string;
  client_id?: string | null;
  type_unite_id?: string | null;
  numero?: string | null;
  no_unite?: string | null;
  unite?: string | null;
  numero_interne?: string | null;
  identifiant?: string | null;
  immatriculation?: string | null;
  plaque?: string | null;
  marque?: string | null;
  modele?: string | null;
  annee?: number | string | null;
  actif?: boolean | null;
  [key: string]: any;
};

type TabKey = "fiche" | "contacts" | "configuration" | "unites";

function numOrNull(v: string) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: any) {
  return Boolean(v);
}

function firstFilled(...vals: any[]) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function getUnitCode(u: UniteRow) {
  return firstFilled(u.numero, u.no_unite, u.unite, u.numero_interne, u.identifiant) || "—";
}

function getUnitPlate(u: UniteRow) {
  return firstFilled(u.immatriculation, u.plaque) || "—";
}

function getUnitTypeLabel(u: UniteRow, mapLabel: Map<string, string>) {
  if (!u.type_unite_id) return "—";
  return mapLabel.get(u.type_unite_id) ?? String(u.type_unite_id);
}

function getUnitTitle(u: UniteRow) {
  return firstFilled(u.marque, "") || firstFilled(u.modele, "")
    ? `${firstFilled(u.marque)} ${firstFilled(u.modele)}`.trim()
    : "—";
}

function sortUnits(rows: UniteRow[]) {
  return [...rows].sort((a, b) => {
    const aa = getUnitCode(a).toLowerCase();
    const bb = getUnitCode(b).toLowerCase();
    return aa.localeCompare(bb, "fr");
  });
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
  w = 190,
}: {
  label: string;
  children: any;
  hint?: string;
  w?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ width: w, flex: `0 0 ${w}px`, fontWeight: 800, lineHeight: 1.1 }}>
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

/* =========================
   Component
========================= */

export default function ClientView() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>("fiche");
  const [client, setClient] = useState<Client | null>(null);

  const isEditMode = searchParams.get("edit") === "1";

  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [ctNom, setCtNom] = useState("");
  const [ctPoste, setCtPoste] = useState("");
  const [ctTel, setCtTel] = useState("");
  const [ctMail, setCtMail] = useState("");
  const [ctPrincipal, setCtPrincipal] = useState(true);
  const [ctFacturation, setCtFacturation] = useState(false);
  const [showAddContactForm, setShowAddContactForm] = useState(false);

  const [cfg, setCfg] = useState<ClientConfig | null>(null);

  const [tauxMO, setTauxMO] = useState<TauxMO[]>([]);
  const [marges, setMarges] = useState<MargePiece[]>([]);

  const [units, setUnits] = useState<UniteRow[]>([]);
  const [unitsError, setUnitsError] = useState<string>("");

  const [opts, setOpts] = useState<UniteOption[]>([]);
  const typeOpts = useMemo(
    () => opts.filter((o) => o.categorie === "type_unite" && o.actif),
    [opts]
  );
  const mapLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of opts) m.set(o.id, o.libelle);
    return m;
  }, [opts]);

  const title = useMemo(() => {
    if (!client) return "Client";
    return client.nom?.trim() ? client.nom.trim() : "Client";
  }, [client]);

async function loadClient() {
  if (!id) return;

  const { data, error } = await supabase
    .from("clients")
    .select(
      [
        "id",
        "nom",
        "acomba_client_code",
        "telephone",
        "courriel",
        "adresse_numero",
        "adresse_rue",
        "adresse_ville",
        "adresse_province",
        "adresse_code_postal",
        "adresse_pays",
        "note_generale",
      ].join(",")
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    alert(error?.message || "Client introuvable");
    setClient(null);
    return;
  }

  const clientRow = data as unknown as Client;
  setClient(clientRow);
}  async function loadContacts() {
    if (!id) return;
    const { data, error } = await supabase
      .from("client_contacts")
      .select("id,client_id,nom,poste,telephone,courriel,principal,type_facturation,created_at")
      .eq("client_id", id)
      .order("principal", { ascending: false })
      .order("type_facturation", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("client_contacts:", error.message);
      setContacts([]);
      return;
    }
    setContacts((data as any) ?? []);
  }

  async function ensureConfigRow() {
    if (!id) return;

    const { data, error } = await supabase
      .from("client_configuration")
      .select(
        "id,client_id,taux_horaire,marge_pieces,frais_atelier_pourcentage,actif,note_facturation,created_at"
      )
      .eq("client_id", id)
      .maybeSingle();

    if (error) {
      console.warn("client_configuration:", error.message);
      setCfg(null);
      return;
    }

    if (!data) {
      const { data: ins, error: eIns } = await supabase
        .from("client_configuration")
        .insert({
          client_id: id,
          taux_horaire: null,
          marge_pieces: null,
          frais_atelier_pourcentage: null,
          actif: true,
          note_facturation: null,
        })
        .select(
          "id,client_id,taux_horaire,marge_pieces,frais_atelier_pourcentage,actif,note_facturation,created_at"
        )
        .single();

      if (eIns) {
        console.warn("client_configuration insert:", eIns.message);
        setCfg(null);
        return;
      }
      setCfg(ins as any);
      return;
    }

    setCfg(data as any);
  }

  async function loadOverrides() {
    if (!id) return;

    const [{ data: mo, error: eMo }, { data: mp, error: eMp }] = await Promise.all([
      supabase
        .from("client_taux_main_oeuvre")
        .select("id,client_id,type_unite_id,taux_horaire,actif,created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_marge_pieces")
        .select("id,client_id,categorie,marge_pourcentage,actif,created_at")
        .eq("client_id", id)
        .order("categorie", { ascending: true }),
    ]);

    if (eMo) {
      console.warn("client_taux_main_oeuvre:", eMo.message);
      setTauxMO([]);
    } else {
      setTauxMO((mo as any) ?? []);
    }

    if (eMp) {
      console.warn("client_marge_pieces:", eMp.message);
      setMarges([]);
    } else {
      setMarges((mp as any) ?? []);
    }
  }

  async function loadUnits() {
    if (!id) return;

    setUnitsError("");

    const { data, error } = await supabase.from("unites").select("*").eq("client_id", id);

    if (error) {
      console.warn("unites:", error.message);
      setUnits([]);
      setUnitsError(error.message);
      return;
    }

    setUnits(sortUnits(((data as any) ?? []) as UniteRow[]));
  }

  async function loadTypeOptions() {
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

  async function refreshAll() {
    await Promise.all([
      loadTypeOptions(),
      loadClient(),
      loadContacts(),
      ensureConfigRow(),
      loadOverrides(),
      loadUnits(),
    ]);
  }

  function resetContactForm() {
    setCtNom("");
    setCtPoste("");
    setCtTel("");
    setCtMail("");
    setCtPrincipal(true);
    setCtFacturation(false);
  }

  function openEditMode() {
    const next = new URLSearchParams(searchParams);
    next.set("edit", "1");
    setSearchParams(next);
  }

  function closeEditMode() {
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next);
    setShowAddContactForm(false);
  }

  async function cancelEdit() {
    await refreshAll();
    resetContactForm();
    closeEditMode();
  }

  async function saveClient() {
    if (!client || busy) return;
    setBusy(true);
    try {
      const payload = {
        nom: client.nom?.trim() || "",
        acomba_client_code: client.acomba_client_code?.trim().toUpperCase() || null,
        telephone: client.telephone?.trim() || null,
        courriel: client.courriel?.trim() || null,
        adresse_numero: client.adresse_numero?.trim() || null,
        adresse_rue: client.adresse_rue?.trim() || null,
        adresse_ville: client.adresse_ville?.trim() || null,
        adresse_province: client.adresse_province?.trim() || null,
        adresse_code_postal: client.adresse_code_postal?.trim() || null,
        adresse_pays: client.adresse_pays?.trim() || null,
        note_generale: client.note_generale ?? null,
      };

      const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
      if (error) throw error;

      await refreshAll();
      closeEditMode();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteClient() {
    if (!client || busy) return;
    if (!confirm("Supprimer ce client ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", client.id);
      if (error) throw error;
      nav("/clients", { replace: true });
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addContact() {
    if (!id || busy || !isEditMode) return;
    const nom = ctNom.trim();
    if (!nom) return;

    setBusy(true);
    try {
      const payload: any = {
        client_id: id,
        nom,
        poste: ctPoste.trim() || null,
        telephone: ctTel.trim() || null,
        courriel: ctMail.trim() || null,
        principal: Boolean(ctPrincipal),
        type_facturation: Boolean(ctFacturation),
      };

      if (payload.principal) {
        await supabase.from("client_contacts").update({ principal: false }).eq("client_id", id);
      }

      const { error } = await supabase.from("client_contacts").insert(payload);
      if (error) throw error;

      resetContactForm();
      setShowAddContactForm(false);
      await loadContacts();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact(contactId: string) {
    if (busy || !isEditMode) return;
    if (!confirm("Supprimer ce contact ?")) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("client_contacts").delete().eq("id", contactId);
      if (error) throw error;
      await loadContacts();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveConfigDefaults() {
    if (!id || !cfg || busy || !isEditMode) return;
    setBusy(true);
    try {
      const payload = {
        client_id: id,
        taux_horaire: cfg.taux_horaire ?? null,
        marge_pieces: cfg.marge_pieces ?? null,
        frais_atelier_pourcentage: cfg.frais_atelier_pourcentage ?? null,
        actif: cfg.actif ?? true,
        note_facturation: cfg.note_facturation?.trim() || null,
      };

      const { error } = await supabase.from("client_configuration").update(payload).eq("client_id", id);
      if (error) throw error;

      await ensureConfigRow();
      closeEditMode();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function upsertTauxMO(type_unite_id: string | null, taux: number | null) {
    if (!id || busy || !isEditMode) return;
    const t = taux ?? null;
    if (t === null) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("client_taux_main_oeuvre")
        .upsert(
          {
            client_id: id,
            type_unite_id,
            taux_horaire: t,
            actif: true,
          },
          { onConflict: "client_id,type_unite_id" }
        );

      if (error) throw error;
      await loadOverrides();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeTauxMO(rowId: string) {
    if (busy || !isEditMode) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("client_taux_main_oeuvre").delete().eq("id", rowId);
      if (error) throw error;
      await loadOverrides();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function upsertMargePiece(categorie: string, marge: number | null) {
    if (!id || busy || !isEditMode) return;
    const cat = String(categorie ?? "").trim();
    const m = marge ?? null;
    if (!cat || m === null) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("client_marge_pieces")
        .upsert(
          {
            client_id: id,
            categorie: cat,
            marge_pourcentage: m,
            actif: true,
          },
          { onConflict: "client_id,categorie" }
        );

      if (error) throw error;
      await loadOverrides();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeMargePiece(rowId: string) {
    if (busy || !isEditMode) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("client_marge_pieces").delete().eq("id", rowId);
      if (error) throw error;
      await loadOverrides();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const [newTypeUniteId, setNewTypeUniteId] = useState<string>("");
  const [newTauxMO, setNewTauxMO] = useState<string>("");

  const [newCatPiece, setNewCatPiece] = useState<string>("");
  const [newMargePiece, setNewMargePiece] = useState<string>("");

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id) return <div className="page">ID client manquant.</div>;
  if (!client) return <div className="page">Chargement…</div>;

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
          <div className="muted">Fiche client • contacts • configuration • unités</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="ghost" onClick={() => nav("/clients")} disabled={busy} type="button">
            Retour
          </button>

          {!isEditMode ? (
            <button className="btn-primary" onClick={openEditMode} disabled={busy} type="button">
              Modifier
            </button>
          ) : (
            <>
              <button className="ghost" onClick={cancelEdit} disabled={busy} type="button">
                Annuler
              </button>
              <button className="btn-primary" onClick={saveClient} disabled={busy} type="button">
                Enregistrer
              </button>
            </>
          )}

          <button
            className="ghost"
            onClick={deleteClient}
            disabled={busy}
            type="button"
            style={{ borderStyle: "solid", borderColor: "#fecaca", color: "#991b1b", background: "#fff" }}
          >
            Supprimer
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 10 }}>
        <TabBtn active={tab === "fiche"} onClick={() => setTab("fiche")}>
          Fiche client
        </TabBtn>
        <TabBtn active={tab === "contacts"} onClick={() => setTab("contacts")}>
          Contacts
        </TabBtn>
        <TabBtn active={tab === "configuration"} onClick={() => setTab("configuration")}>
          Configuration
        </TabBtn>
        <TabBtn active={tab === "unites"} onClick={() => setTab("unites")}>
          Unités
        </TabBtn>
      </div>

      {tab === "fiche" && (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="card">
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Fiche client</div>
                <div className="muted">Coordonnées et adresse.</div>
              </div>

              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <Row label="Nom">
                  <input
                    className="input"
                    value={client.nom ?? ""}
                    onChange={(e) => setClient({ ...client, nom: e.target.value })}
                    placeholder="Nom du client"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Code client Acomba" hint="Requis pour export comptable">
                  <input
                    className="input"
                    value={client.acomba_client_code ?? ""}
                    onChange={(e) =>
                      setClient({
                        ...client,
                        acomba_client_code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Ex: CLIENT001"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Téléphone">
                  <input
                    className="input"
                    value={client.telephone ?? ""}
                    onChange={(e) => setClient({ ...client, telephone: e.target.value })}
                    placeholder="Téléphone"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Courriel">
                  <input
                    className="input"
                    value={client.courriel ?? ""}
                    onChange={(e) => setClient({ ...client, courriel: e.target.value })}
                    placeholder="Courriel"
                    disabled={!isEditMode}
                  />
                </Row>

                <div style={{ height: 2, background: "var(--border)", margin: "6px 0" }} />

                <div style={{ fontWeight: 900 }}>Adresse</div>

                <Row label="Numéro">
                  <input
                    className="input"
                    value={client.adresse_numero ?? ""}
                    onChange={(e) => setClient({ ...client, adresse_numero: e.target.value })}
                    placeholder="Ex: 123"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Rue">
                  <input
                    className="input"
                    value={client.adresse_rue ?? ""}
                    onChange={(e) => setClient({ ...client, adresse_rue: e.target.value })}
                    placeholder="Ex: Rue Principale"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Ville">
                  <input
                    className="input"
                    value={client.adresse_ville ?? ""}
                    onChange={(e) => setClient({ ...client, adresse_ville: e.target.value })}
                    placeholder="Ex: Saint-Georges"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Province">
                  <input
                    className="input"
                    value={client.adresse_province ?? ""}
                    onChange={(e) => setClient({ ...client, adresse_province: e.target.value })}
                    placeholder="Ex: QC"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Code postal">
                  <input
                    className="input"
                    value={client.adresse_code_postal ?? ""}
                    onChange={(e) => setClient({ ...client, adresse_code_postal: e.target.value })}
                    placeholder="Ex: G5Y 1A1"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Pays">
                  <input
                    className="input"
                    value={client.adresse_pays ?? ""}
                    onChange={(e) => setClient({ ...client, adresse_pays: e.target.value })}
                    placeholder="Ex: Canada"
                    disabled={!isEditMode}
                  />
                </Row>
              </div>
            </div>

            <div className="card">
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Note client</div>
                <div className="muted">Visible partout (ex: atelier / BT).</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <textarea
                  className="input"
                  value={client.note_generale ?? ""}
                  onChange={(e) => setClient({ ...client, note_generale: e.target.value })}
                  placeholder="Note générale…"
                  style={{ width: "100%", minHeight: 110 }}
                  disabled={!isEditMode}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Contacts</div>
                <div className="muted">Ajouter au moins un contact et identifier ceux de facturation.</div>
              </div>

              {isEditMode && (
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => {
                    if (showAddContactForm) {
                      setShowAddContactForm(false);
                      resetContactForm();
                    } else {
                      setShowAddContactForm(true);
                    }
                  }}
                  disabled={busy}
                >
                  {showAddContactForm ? "Fermer" : "Ajouter contact"}
                </button>
              )}
            </div>

            {isEditMode && showAddContactForm && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <input
                  className="input"
                  value={ctNom}
                  onChange={(e) => setCtNom(e.target.value)}
                  placeholder="Nom *"
                />
                <input
                  className="input"
                  value={ctPoste}
                  onChange={(e) => setCtPoste(e.target.value)}
                  placeholder="Poste"
                />
                <input
                  className="input"
                  value={ctTel}
                  onChange={(e) => setCtTel(e.target.value)}
                  placeholder="Téléphone"
                />
                <input
                  className="input"
                  value={ctMail}
                  onChange={(e) => setCtMail(e.target.value)}
                  placeholder="Courriel"
                />

                <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={toBool(ctPrincipal)}
                      onChange={(e) => setCtPrincipal(e.target.checked)}
                    />
                    Principal
                  </label>

                  <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={toBool(ctFacturation)}
                      onChange={(e) => setCtFacturation(e.target.checked)}
                    />
                    Facturation
                  </label>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      setShowAddContactForm(false);
                      resetContactForm();
                    }}
                    disabled={busy}
                  >
                    Annuler
                  </button>

                  <button className="btn-primary" onClick={addContact} disabled={busy} type="button">
                    Ajouter
                  </button>
                </div>
              </div>
            )}

            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="list">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Poste</th>
                    <th>Téléphone</th>
                    <th>Courriel</th>
                    <th>Type</th>
                    <th style={{ width: 140, textAlign: "right" }} />
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr className="row" key={c.id}>
                      <td style={{ fontWeight: 900 }}>
                        {c.nom}
                        {toBool(c.principal) ? (
                          <span className="muted" style={{ fontWeight: 800 }}>
                            {" "}
                            • Principal
                          </span>
                        ) : null}
                      </td>
                      <td>{c.poste ?? ""}</td>
                      <td>{c.telephone ?? ""}</td>
                      <td>{c.courriel ?? ""}</td>
                      <td>
                        {toBool(c.type_facturation) ? (
                          <span style={{ fontWeight: 800 }}>Facturation</span>
                        ) : (
                          <span className="muted">Contact</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isEditMode && (
                          <button
                            className="ghost"
                            type="button"
                            onClick={() => deleteContact(c.id)}
                            disabled={busy}
                            style={{
                              borderStyle: "solid",
                              borderColor: "#fecaca",
                              color: "#991b1b",
                              background: "#fff",
                            }}
                          >
                            Supprimer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {contacts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">
                        Aucun contact pour l’instant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="hint">
              Coche “Facturation” pour rendre ce contact sélectionnable lors de l’envoi de facture.
            </div>
          </div>
        </div>
      )}

      {tab === "configuration" && (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="card">
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Configuration BT / facturation</div>
                <div className="muted">Ces valeurs servent de fallback si aucun override ne s’applique.</div>
              </div>

              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <Row label="Client actif" hint="Disponible pour BT et facturation">
                  <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={cfg?.actif !== false}
                      onChange={(e) => setCfg((v) => (v ? { ...v, actif: e.target.checked } : v))}
                      disabled={!isEditMode}
                    />
                    Actif
                  </label>
                </Row>

                <Row label="Taux horaire (défaut)" hint="Main-d’œuvre">
                  <input
                    className="input"
                    value={cfg?.taux_horaire ?? ""}
                    onChange={(e) => setCfg((v) => (v ? { ...v, taux_horaire: numOrNull(e.target.value) } : v))}
                    inputMode="decimal"
                    placeholder="Ex: 155"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Marge pièces (défaut)" hint="%">
                  <input
                    className="input"
                    value={cfg?.marge_pieces ?? ""}
                    onChange={(e) => setCfg((v) => (v ? { ...v, marge_pieces: numOrNull(e.target.value) } : v))}
                    inputMode="decimal"
                    placeholder="Ex: 25"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Frais atelier" hint="% sur la main-d’œuvre">
                  <input
                    className="input"
                    value={cfg?.frais_atelier_pourcentage ?? ""}
                    onChange={(e) =>
                      setCfg((v) => (v ? { ...v, frais_atelier_pourcentage: numOrNull(e.target.value) } : v))
                    }
                    inputMode="decimal"
                    placeholder="Ex: 5"
                    disabled={!isEditMode}
                  />
                </Row>

                <Row label="Note facturation" hint="Interne">
                  <textarea
                    className="input"
                    value={cfg?.note_facturation ?? ""}
                    onChange={(e) => setCfg((v) => (v ? { ...v, note_facturation: e.target.value } : v))}
                    placeholder="Ex: appliquer taux spécial, note de facturation, consigne client..."
                    style={{ width: "100%", minHeight: 100 }}
                    disabled={!isEditMode}
                  />
                </Row>

                {isEditMode && (
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button className="btn-primary" type="button" onClick={saveConfigDefaults} disabled={busy || !cfg}>
                      Enregistrer configuration
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Overrides • Taux main d’œuvre par type d’unité</div>
                <div className="muted">Ex: scolaire vs minibus vs autocar, etc.</div>
              </div>

              {isEditMode && (
                <div className="toolbar" style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <select className="input" value={newTypeUniteId} onChange={(e) => setNewTypeUniteId(e.target.value)}>
                    <option value="">Choisir type d’unité…</option>
                    {typeOpts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.libelle}
                      </option>
                    ))}
                  </select>

                  <input
                    className="input"
                    value={newTauxMO}
                    onChange={(e) => setNewTauxMO(e.target.value)}
                    inputMode="decimal"
                    placeholder="Taux (ex: 165)"
                  />

                  <button
                    className="btn-primary"
                    type="button"
                    disabled={busy || !newTypeUniteId || numOrNull(newTauxMO) === null}
                    onClick={async () => {
                      const t = numOrNull(newTauxMO);
                      if (t === null) return;
                      await upsertTauxMO(newTypeUniteId, t);
                      setNewTauxMO("");
                      setNewTypeUniteId("");
                    }}
                  >
                    Ajouter / MAJ
                  </button>
                </div>
              )}

              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="list">
                  <thead>
                    <tr>
                      <th>Type d’unité</th>
                      <th>Taux</th>
                      <th style={{ width: 140, textAlign: "right" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {tauxMO.map((r) => (
                      <tr className="row" key={r.id}>
                        <td style={{ fontWeight: 900 }}>
                          {r.type_unite_id ? mapLabel.get(r.type_unite_id) ?? r.type_unite_id : "—"}
                        </td>
                        <td>{r.taux_horaire}</td>
                        <td style={{ textAlign: "right" }}>
                          {isEditMode && (
                            <button
                              className="ghost"
                              type="button"
                              onClick={() => removeTauxMO(r.id)}
                              disabled={busy}
                              style={{ borderStyle: "solid" }}
                            >
                              Supprimer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {tauxMO.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          Aucun override.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Overrides • Marge pièces par catégorie</div>
                <div className="muted">Ex: Freins, Pneus, Électrique, etc.</div>
              </div>

              {isEditMode && (
                <div className="toolbar" style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    value={newCatPiece}
                    onChange={(e) => setNewCatPiece(e.target.value)}
                    placeholder="Catégorie (ex: Freins)"
                  />
                  <input
                    className="input"
                    value={newMargePiece}
                    onChange={(e) => setNewMargePiece(e.target.value)}
                    inputMode="decimal"
                    placeholder="Marge % (ex: 30)"
                  />
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={busy || !newCatPiece.trim() || numOrNull(newMargePiece) === null}
                    onClick={async () => {
                      const m = numOrNull(newMargePiece);
                      if (m === null) return;
                      await upsertMargePiece(newCatPiece, m);
                      setNewCatPiece("");
                      setNewMargePiece("");
                    }}
                  >
                    Ajouter / MAJ
                  </button>
                </div>
              )}

              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="list">
                  <thead>
                    <tr>
                      <th>Catégorie</th>
                      <th>Marge %</th>
                      <th style={{ width: 140, textAlign: "right" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {marges.map((r) => (
                      <tr className="row" key={r.id}>
                        <td style={{ fontWeight: 900 }}>{r.categorie}</td>
                        <td>{r.marge_pourcentage}</td>
                        <td style={{ textAlign: "right" }}>
                          {isEditMode && (
                            <button
                              className="ghost"
                              type="button"
                              onClick={() => removeMargePiece(r.id)}
                              disabled={busy}
                              style={{ borderStyle: "solid" }}
                            >
                              Supprimer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {marges.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          Aucun override.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="hint">Les catégories sont libres pour l’instant. Si tu veux, on pourra normaliser ça plus tard.</div>
            </div>
          </div>
        </div>
      )}

      {tab === "unites" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card">
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Unités liées au client</div>
              <div className="muted">
                Cet onglet affiche les unités liées via <b>unites.client_id</b>.
              </div>
            </div>

            {unitsError ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  border: "1px solid #fecaca",
                  background: "#fff1f2",
                  borderRadius: 12,
                  color: "#991b1b",
                  fontWeight: 700,
                }}
              >
                Impossible de charger les unités : {unitsError}
              </div>
            ) : null}

            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="list">
                <thead>
                  <tr>
                    <th>Unité</th>
                    <th>Type</th>
                    <th>Plaque</th>
                    <th>Marque / Modèle</th>
                    <th>Année</th>
                    <th>Statut</th>
                    <th style={{ width: 160, textAlign: "right" }} />
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr className="row" key={u.id}>
                      <td style={{ fontWeight: 900 }}>{getUnitCode(u)}</td>
                      <td>{getUnitTypeLabel(u, mapLabel)}</td>
                      <td>{getUnitPlate(u)}</td>
                      <td>{getUnitTitle(u)}</td>
                      <td>{u.annee ?? "—"}</td>
                      <td>{u.actif === false ? "Inactive" : "Active"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="ghost" type="button" onClick={() => nav(`/unites/${u.id}`)} disabled={busy}>
                          Ouvrir
                        </button>
                      </td>
                    </tr>
                  ))}

                  {units.length === 0 && !unitsError && (
                    <tr>
                      <td colSpan={7} className="muted">
                        Aucune unité liée à ce client pour l’instant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="hint">Quand tu lieras une unité à ce client, elle apparaîtra ici automatiquement.</div>
          </div>
        </div>
      )}
    </div>
  );
}