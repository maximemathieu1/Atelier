import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type ParametresEntreprise = {
  id: string | null;
  nom_legal: string;
  nom_affiche: string;
  adresse_l1: string;
  adresse_l2: string;
  ville: string;
  province: string;
  code_postal: string;
  telephone: string;
  email_facturation: string;
  tps_no: string;
  tvq_no: string;
  tps_rate: string;
  tvq_rate: string;
  conditions_paiement: string;
  note_facture: string;
  updated_at?: string | null;
};

const EMPTY_FORM: ParametresEntreprise = {
  id: null,
  nom_legal: "",
  nom_affiche: "",
  adresse_l1: "",
  adresse_l2: "",
  ville: "",
  province: "QC",
  code_postal: "",
  telephone: "",
  email_facturation: "",
  tps_no: "",
  tvq_no: "",
  tps_rate: "0.05",
  tvq_rate: "0.09975",
  conditions_paiement: "Paiement dû sur réception de la facture.",
  note_facture: "",
  updated_at: null,
};

export default function ParametresEntrepriseFacturation() {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [form, setForm] = useState<ParametresEntreprise>(EMPTY_FORM);

  async function load() {
    setBusy(true);
    setErr("");
    setMsg("");

    const { data, error } = await supabase
      .from("parametres_entreprise")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    if (data) {
      setForm({
        id: data.id ?? null,
        nom_legal: data.nom_legal ?? "",
        nom_affiche: data.nom_affiche ?? "",
        adresse_l1: data.adresse_l1 ?? "",
        adresse_l2: data.adresse_l2 ?? "",
        ville: data.ville ?? "",
        province: data.province ?? "QC",
        code_postal: data.code_postal ?? "",
        telephone: data.telephone ?? "",
        email_facturation: data.email_facturation ?? "",
        tps_no: data.tps_no ?? "",
        tvq_no: data.tvq_no ?? "",
        tps_rate: String(data.tps_rate ?? "0.05"),
        tvq_rate: String(data.tvq_rate ?? "0.09975"),
        conditions_paiement:
          data.conditions_paiement ?? "Paiement dû sur réception de la facture.",
        note_facture: data.note_facture ?? "",
        updated_at: data.updated_at ?? null,
      });
    } else {
      setForm(EMPTY_FORM);
    }

    setBusy(false);
  }

  useEffect(() => {
    load();
  }, []);

  function setField<K extends keyof ParametresEntreprise>(
    key: K,
    value: ParametresEntreprise[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setErr("");
    setMsg("");

    const payload = {
      nom_legal: form.nom_legal.trim(),
      nom_affiche: form.nom_affiche.trim(),
      adresse_l1: form.adresse_l1.trim(),
      adresse_l2: form.adresse_l2.trim(),
      ville: form.ville.trim(),
      province: form.province.trim(),
      code_postal: form.code_postal.trim(),
      telephone: form.telephone.trim(),
      email_facturation: form.email_facturation.trim(),
      tps_no: form.tps_no.trim(),
      tvq_no: form.tvq_no.trim(),
      tps_rate: Number(String(form.tps_rate).replace(",", ".")) || 0,
      tvq_rate: Number(String(form.tvq_rate).replace(",", ".")) || 0,
      conditions_paiement: form.conditions_paiement.trim(),
      note_facture: form.note_facture.trim(),
      updated_at: new Date().toISOString(),
    };

    let error: any = null;
    let data: any = null;

    if (form.id) {
      const res = await supabase
        .from("parametres_entreprise")
        .update(payload)
        .eq("id", form.id)
        .select("*")
        .single();

      error = res.error;
      data = res.data;
    } else {
      const res = await supabase
        .from("parametres_entreprise")
        .insert(payload)
        .select("*")
        .single();

      error = res.error;
      data = res.data;
    }

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    setForm((prev) => ({
      ...prev,
      id: data.id ?? prev.id,
      updated_at: data.updated_at ?? new Date().toISOString(),
      tps_rate: String(data.tps_rate ?? prev.tps_rate),
      tvq_rate: String(data.tvq_rate ?? prev.tvq_rate),
    }));

    setMsg("Paramètres enregistrés.");
    setSaving(false);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 1px 2px rgba(0,0,0,.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text, #0f172a)" }}>
              Entreprise / Facturation
            </div>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              Informations utilisées pour les factures, courriels et calculs de taxes.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {form.updated_at ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Mise à jour : {new Date(form.updated_at).toLocaleString("fr-CA")}
              </div>
            ) : null}

            <button
              type="button"
              onClick={save}
              disabled={saving || busy}
              style={{
                border: "1px solid #1d4ed8",
                background: saving ? "#93c5fd" : "#2563eb",
                color: "#fff",
                fontWeight: 800,
                borderRadius: 10,
                padding: "10px 16px",
                cursor: saving || busy ? "default" : "pointer",
              }}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>

        {err ? (
          <div
            style={{
              marginTop: 14,
              background: "#fef2f2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 600,
            }}
          >
            {err}
          </div>
        ) : null}

        {msg ? (
          <div
            style={{
              marginTop: 14,
              background: "#ecfdf5",
              color: "#166534",
              border: "1px solid #bbf7d0",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 600,
            }}
          >
            {msg}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <Card title="Entreprise">
          <Grid>
            <Field label="Nom légal">
              <Input
                value={form.nom_legal}
                onChange={(e) => setField("nom_legal", e.target.value)}
                placeholder="Ex. Autobus Breton inc."
              />
            </Field>

            <Field label="Nom affiché">
              <Input
                value={form.nom_affiche}
                onChange={(e) => setField("nom_affiche", e.target.value)}
                placeholder="Ex. Groupe Breton"
              />
            </Field>

            <Field label="Adresse ligne 1">
              <Input
                value={form.adresse_l1}
                onChange={(e) => setField("adresse_l1", e.target.value)}
                placeholder="Ex. 123 rue Exemple"
              />
            </Field>

            <Field label="Adresse ligne 2">
              <Input
                value={form.adresse_l2}
                onChange={(e) => setField("adresse_l2", e.target.value)}
                placeholder="Ex. Saint-Georges QC G5Y 1A1"
              />
            </Field>

            <Field label="Ville">
              <Input
                value={form.ville}
                onChange={(e) => setField("ville", e.target.value)}
                placeholder="Ex. Saint-Georges"
              />
            </Field>

            <Field label="Province">
              <Input
                value={form.province}
                onChange={(e) => setField("province", e.target.value)}
                placeholder="QC"
              />
            </Field>

            <Field label="Code postal">
              <Input
                value={form.code_postal}
                onChange={(e) => setField("code_postal", e.target.value)}
                placeholder="Ex. G5Y 1A1"
              />
            </Field>

            <Field label="Téléphone">
              <Input
                value={form.telephone}
                onChange={(e) => setField("telephone", e.target.value)}
                placeholder="Ex. 418-228-8096"
              />
            </Field>

            <Field label="Courriel de facturation">
              <Input
                value={form.email_facturation}
                onChange={(e) => setField("email_facturation", e.target.value)}
                placeholder="Ex. facturation@groupebreton.com"
              />
            </Field>
          </Grid>
        </Card>

        <Card title="Taxes">
          <Grid>
            <Field label="No TPS">
              <Input
                value={form.tps_no}
                onChange={(e) => setField("tps_no", e.target.value)}
                placeholder="Ex. 123456789RT0001"
              />
            </Field>

            <Field label="Taux TPS">
              <Input
                value={form.tps_rate}
                onChange={(e) => setField("tps_rate", e.target.value)}
                placeholder="Ex. 0.05"
              />
            </Field>

            <Field label="No TVQ">
              <Input
                value={form.tvq_no}
                onChange={(e) => setField("tvq_no", e.target.value)}
                placeholder="Ex. 1234567890TQ0001"
              />
            </Field>

            <Field label="Taux TVQ">
              <Input
                value={form.tvq_rate}
                onChange={(e) => setField("tvq_rate", e.target.value)}
                placeholder="Ex. 0.09975"
              />
            </Field>
          </Grid>
        </Card>

        <Card title="Facture">
          <div style={{ display: "grid", gap: 14 }}>
            <Field label="Conditions de paiement">
              <Textarea
                value={form.conditions_paiement}
                onChange={(e) => setField("conditions_paiement", e.target.value)}
                placeholder="Ex. Paiement dû dans les 30 jours suivant la date de facture."
                rows={3}
              />
            </Field>

            <Field label="Note par défaut au bas de la facture">
              <Textarea
                value={form.note_facture}
                onChange={(e) => setField("note_facture", e.target.value)}
                placeholder="Ex. Merci de votre confiance."
                rows={5}
              />
            </Field>
          </div>
        </Card>
      </div>

      {busy ? (
        <div style={{ color: "#64748b", fontWeight: 600 }}>Chargement...</div>
      ) : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 18,
        boxShadow: "0 1px 2px rgba(0,0,0,.04)",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text, #0f172a)", marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        height: 42,
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        padding: "0 12px",
        fontSize: 14,
        color: "#0f172a",
        background: "#fff",
        outline: "none",
        ...(props.style || {}),
      }}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        padding: "10px 12px",
        fontSize: 14,
        color: "#0f172a",
        background: "#fff",
        outline: "none",
        resize: "vertical",
        ...(props.style || {}),
      }}
    />
  );
}