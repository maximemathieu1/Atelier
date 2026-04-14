import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type EmployeRow = {
  id: string;
  auth_user_id: string | null;
  nom_complet: string;
  role: string | null;
  actif: boolean;
  created_at: string;
};

type AuthUser = {
  id: string;
  email: string | null;
};

const pageStyle: React.CSSProperties = {
  padding: 16,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  marginBottom: 16,
};

const gridHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 2fr) minmax(140px, 1fr) 120px minmax(260px, 1.4fr)",
  gap: 12,
  alignItems: "center",
  fontWeight: 700,
  paddingBottom: 10,
  marginBottom: 10,
  borderBottom: "1px solid #e5e7eb",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 2fr) minmax(140px, 1fr) 120px minmax(260px, 1.4fr)",
  gap: 12,
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid #f3f4f6",
};

const mobileRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "12px 0",
  borderBottom: "1px solid #f3f4f6",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

const btnGhostStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 600,
};

const btnDangerStyle: React.CSSProperties = {
  ...btnGhostStyle,
  border: "1px solid #fecaca",
  color: "#b91c1c",
};

const badgeOkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #a7f3d0",
  background: "#ecfdf5",
  color: "#065f46",
  fontWeight: 700,
  fontSize: 12,
};

const badgeOffStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#6b7280",
  fontWeight: 700,
  fontSize: 12,
};

const roles = [
  { value: "mecano", label: "Mécano" },
  { value: "admin", label: "Admin" },
  { value: "bureau", label: "Bureau" },
  { value: "gestion", label: "Gestion" },
];

function useIsMobile(bp = 900) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < bp : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);

  return isMobile;
}

function EmployeEditor({
  employe,
  currentAuthUserId,
  onRefresh,
  isMobile,
}: {
  employe: EmployeRow;
  currentAuthUserId: string | null;
  onRefresh: () => Promise<void>;
  isMobile: boolean;
}) {
  const [nomComplet, setNomComplet] = useState(employe.nom_complet || "");
  const [role, setRole] = useState(employe.role || "mecano");
  const [actif, setActif] = useState(!!employe.actif);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNomComplet(employe.nom_complet || "");
    setRole(employe.role || "mecano");
    setActif(!!employe.actif);
  }, [employe]);

  const isLinkedToCurrentUser = useMemo(() => {
    return !!currentAuthUserId && employe.auth_user_id === currentAuthUserId;
  }, [currentAuthUserId, employe.auth_user_id]);

  async function handleSave() {
    const nom = nomComplet.trim();
    if (!nom) {
      alert("Le nom complet est obligatoire.");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("employes")
      .update({
        nom_complet: nom,
        role: role || "mecano",
        actif,
      })
      .eq("id", employe.id);

    setBusy(false);

    if (error) {
      alert("Erreur lors de l'enregistrement : " + error.message);
      return;
    }

    await onRefresh();
  }

  async function handleDelete() {
    const ok = window.confirm(`Supprimer l'employé "${employe.nom_complet}" ?`);
    if (!ok) return;

    setBusy(true);

    const { error } = await supabase.from("employes").delete().eq("id", employe.id);

    setBusy(false);

    if (error) {
      alert("Erreur lors de la suppression : " + error.message);
      return;
    }

    await onRefresh();
  }

  async function handleLinkCurrentUser() {
    if (!currentAuthUserId) {
      alert("Aucun utilisateur connecté.");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("employes")
      .update({ auth_user_id: currentAuthUserId })
      .eq("id", employe.id);

    setBusy(false);

    if (error) {
      alert("Erreur lors de la liaison : " + error.message);
      return;
    }

    await onRefresh();
  }

  async function handleUnlink() {
    setBusy(true);

    const { error } = await supabase
      .from("employes")
      .update({ auth_user_id: null })
      .eq("id", employe.id);

    setBusy(false);

    if (error) {
      alert("Erreur lors du retrait du lien : " + error.message);
      return;
    }

    await onRefresh();
  }

  return (
    <>
      <div style={isMobile ? mobileRowStyle : rowStyle}>
        <input
          style={inputStyle}
          value={nomComplet}
          onChange={(e) => setNomComplet(e.target.value)}
          placeholder="Nom complet"
        />

        <select
          style={selectStyle}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={actif}
            onChange={(e) => setActif(e.target.checked)}
          />
          Actif
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btnGhostStyle} onClick={handleSave} disabled={busy}>
            Enregistrer
          </button>

          <button
            type="button"
            style={btnGhostStyle}
            onClick={handleLinkCurrentUser}
            disabled={busy || !currentAuthUserId}
          >
            Lier au user connecté
          </button>

          {(isLinkedToCurrentUser || employe.auth_user_id) && (
            <button type="button" style={btnGhostStyle} onClick={handleUnlink} disabled={busy}>
              Retirer le lien
            </button>
          )}

          <button type="button" style={btnDangerStyle} onClick={handleDelete} disabled={busy}>
            Supprimer
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 8,
          marginBottom: 12,
          fontSize: 13,
          color: "#4b5563",
        }}
      >
        <div>
          <strong>auth_user_id :</strong> {employe.auth_user_id || "—"}
        </div>

        <div>
          {isLinkedToCurrentUser ? (
            <span style={badgeOkStyle}>User connecté lié</span>
          ) : employe.auth_user_id ? (
            <span style={badgeOffStyle}>Lié à un autre user</span>
          ) : (
            <span style={badgeOffStyle}>Aucun lien</span>
          )}
        </div>
      </div>
    </>
  );
}

export default function EmployesPage() {
  const isMobile = useIsMobile(900);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [employes, setEmployes] = useState<EmployeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [nomComplet, setNomComplet] = useState("");
  const [role, setRole] = useState("mecano");
  const [actif, setActif] = useState(true);
  const [adding, setAdding] = useState(false);

  async function loadAuthUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      setAuthUser(null);
      return;
    }

    setAuthUser({
      id: data.user.id,
      email: data.user.email ?? null,
    });
  }

  async function loadEmployes() {
    setLoading(true);

    const { data, error } = await supabase
      .from("employes")
      .select("*")
      .order("nom_complet", { ascending: true });

    if (error) {
      alert("Erreur lors du chargement des employés : " + error.message);
      setEmployes([]);
      setLoading(false);
      return;
    }

    setEmployes((data || []) as EmployeRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAuthUser();
    loadEmployes();
  }, []);

  async function handleAdd() {
    const nom = nomComplet.trim();
    if (!nom) {
      alert("Le nom complet est obligatoire.");
      return;
    }

    setAdding(true);

    const { error } = await supabase.from("employes").insert({
      nom_complet: nom,
      role: role || "mecano",
      actif,
    });

    setAdding(false);

    if (error) {
      alert("Erreur lors de l'ajout : " + error.message);
      return;
    }

    setNomComplet("");
    setRole("mecano");
    setActif(true);

    await loadEmployes();
  }

  return (
    <div style={pageStyle}>
      <div style={titleStyle}>Employés</div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Ajouter un employé</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(220px, 2fr) minmax(140px, 1fr) 120px auto",
            gap: 12,
            alignItems: "center",
          }}
        >
          <input
            style={inputStyle}
            value={nomComplet}
            onChange={(e) => setNomComplet(e.target.value)}
            placeholder="Nom complet"
          />

          <select style={selectStyle} value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={actif}
              onChange={(e) => setActif(e.target.checked)}
            />
            Actif
          </label>

          <button type="button" style={btnStyle} onClick={handleAdd} disabled={adding}>
            Ajouter
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Utilisateur connecté</div>
        <div style={{ marginBottom: 6 }}>
          <strong>ID :</strong> {authUser?.id || "Non connecté"}
        </div>
        <div>
          <strong>Email :</strong> {authUser?.email || "—"}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Liste des employés</div>

        {loading ? (
          <div>Chargement...</div>
        ) : employes.length === 0 ? (
          <div>Aucun employé.</div>
        ) : (
          <>
            {!isMobile && (
              <div style={gridHeaderStyle}>
                <div>Nom</div>
                <div>Rôle</div>
                <div>Statut</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>
            )}

            {employes.map((employe) => (
              <EmployeEditor
                key={employe.id}
                employe={employe}
                currentAuthUserId={authUser?.id || null}
                onRefresh={loadEmployes}
                isMobile={isMobile}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}