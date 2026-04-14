import { useEffect, useState } from "react";
import { get } from "idb-keyval";
import { supabase } from "../../lib/supabaseClient";
import {
  dirKey,
  pickAcombaDirForTransporteur,
  preflightDirPermission,
} from "../../pages/facturation/facturation.shared";

const ACOMBA_FOLDER_LABEL = "Groupe Breton";

type AcombaForm = {
  id: string | null;
  acomba_prefix: string;
  gl_compte_client: string;
  gl_tps: string;
  gl_tvq: string;

  gl_main_oeuvre_externe: string;
  gl_pieces_externe: string;
  gl_frais_atelier_externe: string;

  gl_main_oeuvre_interne: string;
  gl_pieces_interne: string;
  gl_frais_atelier_interne: string;

  gl_main_oeuvre_interne_ta: string;
  gl_pieces_interne_ta: string;
  gl_frais_atelier_interne_ta: string;

  updated_at: string | null;
};

type FolderState = {
  configured: boolean;
  folderName: string;
};

type ParametresAcombaRow = {
  id: string | null;
  acomba_prefix: string | null;
  gl_compte_client: string | null;
  gl_tps: string | null;
  gl_tvq: string | null;

  gl_main_oeuvre_externe: string | null;
  gl_pieces_externe: string | null;
  gl_frais_atelier_externe: string | null;

  gl_main_oeuvre_interne: string | null;
  gl_pieces_interne: string | null;
  gl_frais_atelier_interne: string | null;

  gl_main_oeuvre_interne_ta: string | null;
  gl_pieces_interne_ta: string | null;
  gl_frais_atelier_interne_ta: string | null;

  updated_at: string | null;
};

const EMPTY_FORM: AcombaForm = {
  id: null,
  acomba_prefix: "CCImport",
  gl_compte_client: "",
  gl_tps: "",
  gl_tvq: "",

  gl_main_oeuvre_externe: "",
  gl_pieces_externe: "",
  gl_frais_atelier_externe: "",

  gl_main_oeuvre_interne: "",
  gl_pieces_interne: "",
  gl_frais_atelier_interne: "",

  gl_main_oeuvre_interne_ta: "",
  gl_pieces_interne_ta: "",
  gl_frais_atelier_interne_ta: "",

  updated_at: null,
};

function mapRowToForm(row: ParametresAcombaRow): AcombaForm {
  return {
    id: row.id ?? null,
    acomba_prefix: row.acomba_prefix ?? "CCImport",
    gl_compte_client: row.gl_compte_client ?? "",
    gl_tps: row.gl_tps ?? "",
    gl_tvq: row.gl_tvq ?? "",

    gl_main_oeuvre_externe: row.gl_main_oeuvre_externe ?? "",
    gl_pieces_externe: row.gl_pieces_externe ?? "",
    gl_frais_atelier_externe: row.gl_frais_atelier_externe ?? "",

    gl_main_oeuvre_interne: row.gl_main_oeuvre_interne ?? "",
    gl_pieces_interne: row.gl_pieces_interne ?? "",
    gl_frais_atelier_interne: row.gl_frais_atelier_interne ?? "",

    gl_main_oeuvre_interne_ta: row.gl_main_oeuvre_interne_ta ?? "",
    gl_pieces_interne_ta: row.gl_pieces_interne_ta ?? "",
    gl_frais_atelier_interne_ta: row.gl_frais_atelier_interne_ta ?? "",

    updated_at: row.updated_at ?? null,
  };
}

export default function ParametresAcomba() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [folderState, setFolderState] = useState<FolderState>({
    configured: false,
    folderName: "",
  });

  const [form, setForm] = useState<AcombaForm>(EMPTY_FORM);

  async function loadFolderState() {
    try {
      const handle = await get<FileSystemDirectoryHandle>(dirKey(ACOMBA_FOLDER_LABEL));
      if (handle) {
        setFolderState({
          configured: true,
          folderName: handle.name || "",
        });
      } else {
        setFolderState({
          configured: false,
          folderName: "",
        });
      }
    } catch {
      setFolderState({
        configured: false,
        folderName: "",
      });
    }
  }

  async function load() {
    setLoading(true);
    setErr("");
    setMsg("");

    const [dbRes] = await Promise.all([
      supabase
        .from("parametres_entreprise")
        .select(
          [
            "id",
            "acomba_prefix",
            "gl_compte_client",
            "gl_tps",
            "gl_tvq",
            "gl_main_oeuvre_externe",
            "gl_pieces_externe",
            "gl_frais_atelier_externe",
            "gl_main_oeuvre_interne",
            "gl_pieces_interne",
            "gl_frais_atelier_interne",
            "gl_main_oeuvre_interne_ta",
            "gl_pieces_interne_ta",
            "gl_frais_atelier_interne_ta",
            "updated_at",
          ].join(", ")
        )
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadFolderState(),
    ]);

    const { data, error } = dbRes;

    if (error) {
      setErr(error.message);
      setForm(EMPTY_FORM);
      setLoading(false);
      return;
    }

    if (data) {
      const row = data as unknown as ParametresAcombaRow;
      setForm(mapRowToForm(row));
    } else {
      setForm(EMPTY_FORM);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function setField<K extends keyof AcombaForm>(key: K, value: AcombaForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setErr("");
    setMsg("");

    const payload = {
      acomba_prefix: form.acomba_prefix.trim() || "CCImport",
      gl_compte_client: form.gl_compte_client.trim(),
      gl_tps: form.gl_tps.trim(),
      gl_tvq: form.gl_tvq.trim(),

      gl_main_oeuvre_externe: form.gl_main_oeuvre_externe.trim(),
      gl_pieces_externe: form.gl_pieces_externe.trim(),
      gl_frais_atelier_externe: form.gl_frais_atelier_externe.trim(),

      gl_main_oeuvre_interne: form.gl_main_oeuvre_interne.trim(),
      gl_pieces_interne: form.gl_pieces_interne.trim(),
      gl_frais_atelier_interne: form.gl_frais_atelier_interne.trim(),

      gl_main_oeuvre_interne_ta: form.gl_main_oeuvre_interne_ta.trim(),
      gl_pieces_interne_ta: form.gl_pieces_interne_ta.trim(),
      gl_frais_atelier_interne_ta: form.gl_frais_atelier_interne_ta.trim(),

      updated_at: new Date().toISOString(),
    };

    let error: any = null;
    let data: unknown = null;

    if (form.id) {
      const res = await supabase
        .from("parametres_entreprise")
        .update(payload)
        .eq("id", form.id)
        .select(
          [
            "id",
            "acomba_prefix",
            "gl_compte_client",
            "gl_tps",
            "gl_tvq",
            "gl_main_oeuvre_externe",
            "gl_pieces_externe",
            "gl_frais_atelier_externe",
            "gl_main_oeuvre_interne",
            "gl_pieces_interne",
            "gl_frais_atelier_interne",
            "gl_main_oeuvre_interne_ta",
            "gl_pieces_interne_ta",
            "gl_frais_atelier_interne_ta",
            "updated_at",
          ].join(", ")
        )
        .single();

      error = res.error;
      data = res.data;
    } else {
      const res = await supabase
        .from("parametres_entreprise")
        .insert(payload)
        .select(
          [
            "id",
            "acomba_prefix",
            "gl_compte_client",
            "gl_tps",
            "gl_tvq",
            "gl_main_oeuvre_externe",
            "gl_pieces_externe",
            "gl_frais_atelier_externe",
            "gl_main_oeuvre_interne",
            "gl_pieces_interne",
            "gl_frais_atelier_interne",
            "gl_main_oeuvre_interne_ta",
            "gl_pieces_interne_ta",
            "gl_frais_atelier_interne_ta",
            "updated_at",
          ].join(", ")
        )
        .single();

      error = res.error;
      data = res.data;
    }

    if (error || !data) {
      setErr(error?.message || "Erreur lors de l’enregistrement.");
      setSaving(false);
      return;
    }

    const row = data as ParametresAcombaRow;
    setForm(mapRowToForm(row));

    setMsg("Paramètres enregistrés.");
    setSaving(false);
  }

  async function chooseLocalFolder() {
    setFolderBusy(true);
    setErr("");
    setMsg("");

    try {
      await pickAcombaDirForTransporteur(ACOMBA_FOLDER_LABEL);
      await loadFolderState();
      setMsg(`Dossier local configuré pour ${ACOMBA_FOLDER_LABEL}.`);
    } catch (e: any) {
      setErr(e?.message ?? "Impossible de choisir le dossier local.");
    } finally {
      setFolderBusy(false);
    }
  }

  async function testLocalFolder() {
    setFolderBusy(true);
    setErr("");
    setMsg("");

    try {
      await preflightDirPermission(ACOMBA_FOLDER_LABEL);
      await loadFolderState();
      setMsg(`Dossier local valide pour ${ACOMBA_FOLDER_LABEL}.`);
    } catch (e: any) {
      setErr(e?.message ?? "Dossier local non valide.");
    } finally {
      setFolderBusy(false);
    }
  }

  function fmtDateTime(v: string | null) {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("fr-CA");
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text, #0f172a)" }}>
              Acomba
            </div>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              Paramètres comptables et dossier local utilisés pour l’export Acomba de l’atelier.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {form.updated_at ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Mise à jour : {fmtDateTime(form.updated_at)}
              </div>
            ) : null}

            <button
              type="button"
              onClick={chooseLocalFolder}
              disabled={folderBusy || saving || loading}
              style={ghostBtn(folderBusy || saving || loading)}
            >
              {folderBusy ? "Traitement..." : "Choisir dossier local"}
            </button>

            <button
              type="button"
              onClick={testLocalFolder}
              disabled={folderBusy || saving || loading}
              style={ghostBtn(folderBusy || saving || loading)}
            >
              {folderBusy ? "Traitement..." : "Tester dossier"}
            </button>

            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              style={primaryBtn(saving || loading)}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>

        {err ? <AlertBox tone="error">{err}</AlertBox> : null}

        {msg ? <AlertBox tone="success">{msg}</AlertBox> : null}
      </div>

      <Card title="Export">
        <Grid>
          <Field label="Préfixe export">
            <Input
              value={form.acomba_prefix}
              onChange={(e) => setField("acomba_prefix", e.target.value)}
              placeholder="Ex. CCImport"
            />
          </Field>

          <Field label="Dossier local">
            <StatusBox configured={folderState.configured}>
              {folderState.configured
                ? `Configuré${folderState.folderName ? ` : ${folderState.folderName}` : ""}`
                : "Aucun dossier sélectionné"}
            </StatusBox>
          </Field>

          <Field label="Compte client (AR)">
            <Input
              value={form.gl_compte_client}
              onChange={(e) => setField("gl_compte_client", e.target.value)}
              placeholder="Ex. 1100-00"
            />
          </Field>

          <Field label="GL TPS">
            <Input
              value={form.gl_tps}
              onChange={(e) => setField("gl_tps", e.target.value)}
              placeholder="Ex. 2310-00"
            />
          </Field>

          <Field label="GL TVQ">
            <Input
              value={form.gl_tvq}
              onChange={(e) => setField("gl_tvq", e.target.value)}
              placeholder="Ex. 2320-00"
            />
          </Field>
        </Grid>
      </Card>

      <Card title="Externe">
        <Grid>
          <Field label="GL main-d’œuvre externe">
            <Input
              value={form.gl_main_oeuvre_externe}
              onChange={(e) => setField("gl_main_oeuvre_externe", e.target.value)}
              placeholder="Ex. 4200-00"
            />
          </Field>

          <Field label="GL pièces externes">
            <Input
              value={form.gl_pieces_externe}
              onChange={(e) => setField("gl_pieces_externe", e.target.value)}
              placeholder="Ex. 4210-00"
            />
          </Field>

          <Field label="GL frais atelier externes">
            <Input
              value={form.gl_frais_atelier_externe}
              onChange={(e) => setField("gl_frais_atelier_externe", e.target.value)}
              placeholder="Ex. 4220-00"
            />
          </Field>
        </Grid>
      </Card>

      <Card title="Interne">
        <Grid>
          <Field label="GL main-d’œuvre interne">
            <Input
              value={form.gl_main_oeuvre_interne}
              onChange={(e) => setField("gl_main_oeuvre_interne", e.target.value)}
              placeholder="Ex. 5200-00"
            />
          </Field>

          <Field label="GL pièces internes">
            <Input
              value={form.gl_pieces_interne}
              onChange={(e) => setField("gl_pieces_interne", e.target.value)}
              placeholder="Ex. 5210-00"
            />
          </Field>

          <Field label="GL frais atelier internes">
            <Input
              value={form.gl_frais_atelier_interne}
              onChange={(e) => setField("gl_frais_atelier_interne", e.target.value)}
              placeholder="Ex. 5220-00"
            />
          </Field>
        </Grid>
      </Card>

      <Card title="Interne TA">
        <Grid>
          <Field label="GL main-d’œuvre interne TA">
            <Input
              value={form.gl_main_oeuvre_interne_ta}
              onChange={(e) => setField("gl_main_oeuvre_interne_ta", e.target.value)}
              placeholder="Ex. 6200-00"
            />
          </Field>

          <Field label="GL pièces internes TA">
            <Input
              value={form.gl_pieces_interne_ta}
              onChange={(e) => setField("gl_pieces_interne_ta", e.target.value)}
              placeholder="Ex. 6210-00"
            />
          </Field>

          <Field label="GL frais atelier internes TA">
            <Input
              value={form.gl_frais_atelier_interne_ta}
              onChange={(e) => setField("gl_frais_atelier_interne_ta", e.target.value)}
              placeholder="Ex. 6220-00"
            />
          </Field>
        </Grid>
      </Card>

      {loading ? <div style={{ color: "#64748b", fontWeight: 600 }}>Chargement...</div> : null}
    </div>
  );
}

function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 800,
    borderRadius: 10,
    padding: "10px 16px",
    cursor: disabled ? "default" : "pointer",
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid #1d4ed8",
    background: disabled ? "#93c5fd" : "#2563eb",
    color: "#fff",
    fontWeight: 800,
    borderRadius: 10,
    padding: "10px 16px",
    cursor: disabled ? "default" : "pointer",
  };
}

function AlertBox({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const isError = tone === "error";
  return (
    <div
      style={{
        marginTop: 14,
        background: isError ? "#fef2f2" : "#ecfdf5",
        color: isError ? "#991b1b" : "#166534",
        border: `1px solid ${isError ? "#fecaca" : "#bbf7d0"}`,
        borderRadius: 12,
        padding: "10px 12px",
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function StatusBox({
  configured,
  children,
}: {
  configured: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: 42,
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        padding: "10px 12px",
        fontSize: 14,
        color: configured ? "#0f172a" : "#64748b",
        background: "#fff",
        display: "flex",
        alignItems: "center",
      }}
    >
      {children}
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
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: "var(--text, #0f172a)",
          marginBottom: 14,
        }}
      >
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