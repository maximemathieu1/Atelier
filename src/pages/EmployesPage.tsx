import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getEmployeConnecte, type EmployeConnecte } from "../lib/getEmployeConnecte";

type EmployeRow = {
  id: string;
  email: string;
  nom_complet: string;
  role: string | null;
  actif: boolean;
  created_at?: string;
};

type AuthUser = {
  id: string;
  email: string | null;
};

const roles = [
  { value: "mecano", label: "Mécano" },
  { value: "admin", label: "Admin" },
  { value: "bureau", label: "Bureau" },
  { value: "gestion", label: "Gestion" },
];

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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
  background: "#fff",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

const btnBlueStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #2563eb",
  background: "#2563eb",
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

const btnDangerTextStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "#b91c1c",
  cursor: "pointer",
  fontWeight: 600,
};

const btnMenuTextStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 600,
};

const gridHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(220px,1.5fr) minmax(240px,1.4fr) minmax(140px,1fr) 120px 90px",
  gap: 12,
  alignItems: "center",
  fontWeight: 700,
  paddingBottom: 10,
  marginBottom: 10,
  borderBottom: "1px solid #e5e7eb",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(220px,1.5fr) minmax(240px,1.4fr) minmax(140px,1fr) 120px 90px",
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

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17,24,39,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
  overflow: "hidden",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "16px 18px",
  borderBottom: "1px solid #e5e7eb",
};

const modalBodyStyle: React.CSSProperties = {
  padding: 18,
  display: "grid",
  gap: 14,
};

const modalFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  padding: "16px 18px",
  borderTop: "1px solid #e5e7eb",
};

const actionWrapStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-block",
};

const actionBtnStyle: React.CSSProperties = {
  width: 42,
  height: 38,
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
};

const actionMenuStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  right: 0,
  minWidth: 180,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 18px 45px rgba(0,0,0,0.16)",
  padding: 6,
  zIndex: 1000,
};

function useIsMobile(bp = 980) {
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

function StatutText({ actif }: { actif: boolean }) {
  return (
    <span style={{ fontWeight: 600, color: actif ? "#111827" : "#6b7280" }}>
      {actif ? "Actif" : "Inactif"}
    </span>
  );
}

function EmployeRowItem({
  employe,
  isMobile,
  onRefresh,
  onEdit,
  openMenuId,
  setOpenMenuId,
}: {
  employe: EmployeRow;
  isMobile: boolean;
  onRefresh: () => Promise<void>;
  onEdit: (employe: EmployeRow) => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isOpen = openMenuId === employe.id;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleOutside);
    }

    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen, setOpenMenuId]);

  async function handleToggleActif() {
    setBusy(true);

    const { error } = await supabase
      .from("employes")
      .update({ actif: !employe.actif })
      .eq("id", employe.id);

    setBusy(false);
    setOpenMenuId(null);

    if (error) {
      alert("Erreur lors du changement de statut : " + error.message);
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
    setOpenMenuId(null);

    if (error) {
      alert("Erreur lors de la suppression : " + error.message);
      return;
    }

    await onRefresh();
  }

  return (
    <div style={isMobile ? mobileRowStyle : rowStyle}>
      <div style={{ fontWeight: 600 }}>{employe.nom_complet || "—"}</div>

      <div>{employe.email || "—"}</div>

      <div>{roles.find((r) => r.value === employe.role)?.label || employe.role || "—"}</div>

      <div>
        <StatutText actif={!!employe.actif} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: isMobile ? "flex-start" : "flex-end",
        }}
      >
        <div style={actionWrapStyle} ref={menuRef}>
          <button
            type="button"
            style={actionBtnStyle}
            disabled={busy}
            onClick={() => setOpenMenuId(isOpen ? null : employe.id)}
          >
            ...
          </button>

          {isOpen && (
            <div style={actionMenuStyle}>
              <button
                type="button"
                style={btnMenuTextStyle}
                onClick={() => {
                  setOpenMenuId(null);
                  onEdit(employe);
                }}
              >
                Modifier
              </button>

              <button
                type="button"
                style={btnMenuTextStyle}
                onClick={handleToggleActif}
                disabled={busy}
              >
                {employe.actif ? "Inactif" : "Actif"}
              </button>

              <button
                type="button"
                style={btnDangerTextStyle}
                onClick={handleDelete}
                disabled={busy}
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmployesPage() {
  const isMobile = useIsMobile(980);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [employeConnecte, setEmployeConnecte] = useState<EmployeConnecte | null>(null);
  const [employes, setEmployes] = useState<EmployeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [formNomComplet, setFormNomComplet] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("mecano");
  const [formActif, setFormActif] = useState(true);

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

  async function loadEmployeConnecte() {
    const employe = await getEmployeConnecte();
    setEmployeConnecte(employe);
  }

  async function loadEmployes() {
    setLoading(true);

    const { data, error } = await supabase
      .from("employes")
      .select("id, email, nom_complet, role, actif, created_at")
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

  async function refreshAll() {
    await Promise.all([loadAuthUser(), loadEmployeConnecte(), loadEmployes()]);
  }

  useEffect(() => {
    refreshAll();
  }, []);

  function resetForm() {
    setFormNomComplet("");
    setFormEmail("");
    setFormRole("mecano");
    setFormActif(true);
  }

  function openAddModal() {
    resetForm();
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (adding) return;
    setShowAddModal(false);
  }

  function openEditModal(employe: EmployeRow) {
    setEditingId(employe.id);
    setFormNomComplet(employe.nom_complet || "");
    setFormEmail(employe.email || "");
    setFormRole(employe.role || "mecano");
    setFormActif(!!employe.actif);
    setShowEditModal(true);
  }

  function closeEditModal() {
    if (savingEdit) return;
    setShowEditModal(false);
    setEditingId(null);
  }

  async function handleAdd() {
    const nom = formNomComplet.trim();
    const courriel = formEmail.trim().toLowerCase();

    if (!nom) {
      alert("Le nom complet est obligatoire.");
      return;
    }

    if (!courriel) {
      alert("Le courriel est obligatoire.");
      return;
    }

    setAdding(true);

    const { error } = await supabase.from("employes").insert({
      nom_complet: nom,
      email: courriel,
      role: formRole || "mecano",
      actif: formActif,
    });

    setAdding(false);

    if (error) {
      alert("Erreur lors de l'ajout : " + error.message);
      return;
    }

    setShowAddModal(false);
    resetForm();
    await refreshAll();
  }

  async function handleSaveEdit() {
    const nom = formNomComplet.trim();
    const courriel = formEmail.trim().toLowerCase();

    if (!editingId) return;

    if (!nom) {
      alert("Le nom complet est obligatoire.");
      return;
    }

    if (!courriel) {
      alert("Le courriel est obligatoire.");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("employes")
      .update({
        nom_complet: nom,
        email: courriel,
        role: formRole || "mecano",
        actif: formActif,
      })
      .eq("id", editingId);

    setSavingEdit(false);

    if (error) {
      alert("Erreur lors de l'enregistrement : " + error.message);
      return;
    }

    closeEditModal();
    await refreshAll();
  }

  const filteredEmployes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employes;

    return employes.filter((e) => {
      return (
        (e.nom_complet || "").toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q) ||
        (e.role || "").toLowerCase().includes(q) ||
        (e.actif ? "actif" : "inactif").includes(q)
      );
    });
  }, [employes, search]);

  return (
    <div style={pageStyle}>
      <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
    flexWrap: "wrap",
  }}
>
  <div style={titleStyle}>Employés</div>

  <button type="button" style={btnBlueStyle} onClick={openAddModal}>
    Ajouter un employé
  </button>
</div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Utilisateur connecté</div>
        <div style={{ marginBottom: 6 }}>
          <strong>Nom :</strong> {employeConnecte?.nom_complet || "Non trouvé"}
        </div>
        <div>
          <strong>Email :</strong> {authUser?.email || "—"}
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 700 }}>Liste des employés</div>

          <div style={{ width: isMobile ? "100%" : 320 }}>
            <input
              style={inputStyle}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un employé"
            />
          </div>
        </div>

        {loading ? (
          <div>Chargement...</div>
        ) : filteredEmployes.length === 0 ? (
          <div>Aucun employé.</div>
        ) : (
          <>
            {!isMobile && (
              <div style={gridHeaderStyle}>
                <div>Nom</div>
                <div>Courriel</div>
                <div>Rôle</div>
                <div>Statut</div>
                <div style={{ textAlign: "right" }}>Action</div>
              </div>
            )}

            {filteredEmployes.map((employe) => (
              <EmployeRowItem
                key={employe.id}
                employe={employe}
                isMobile={isMobile}
                onRefresh={refreshAll}
                onEdit={openEditModal}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
            ))}
          </>
        )}
      </div>

      {showAddModal && (
        <div style={modalBackdropStyle} onClick={closeAddModal}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Ajouter un employé</div>

              <button
                type="button"
                onClick={closeAddModal}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                ×
              </button>
            </div>

            <div style={modalBodyStyle}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Nom complet</div>
                <input
                  style={inputStyle}
                  value={formNomComplet}
                  onChange={(e) => setFormNomComplet(e.target.value)}
                  placeholder="Nom complet"
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Courriel</div>
                <input
                  style={inputStyle}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Courriel"
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Rôle</div>
                <select
                  style={selectStyle}
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={formActif}
                  onChange={(e) => setFormActif(e.target.checked)}
                />
                Employé actif
              </label>
            </div>

            <div style={modalFooterStyle}>
              <button type="button" style={btnGhostStyle} onClick={closeAddModal} disabled={adding}>
                Annuler
              </button>

              <button type="button" style={btnBlueStyle} onClick={handleAdd} disabled={adding}>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div style={modalBackdropStyle} onClick={closeEditModal}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Modifier l’employé</div>

              <button
                type="button"
                onClick={closeEditModal}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                ×
              </button>
            </div>

            <div style={modalBodyStyle}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Nom complet</div>
                <input
                  style={inputStyle}
                  value={formNomComplet}
                  onChange={(e) => setFormNomComplet(e.target.value)}
                  placeholder="Nom complet"
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Courriel</div>
                <input
                  style={inputStyle}
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Courriel"
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Rôle</div>
                <select
                  style={selectStyle}
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={formActif}
                  onChange={(e) => setFormActif(e.target.checked)}
                />
                Employé actif
              </label>
            </div>

            <div style={modalFooterStyle}>
              <button
                type="button"
                style={btnGhostStyle}
                onClick={closeEditModal}
                disabled={savingEdit}
              >
                Annuler
              </button>

              <button
                type="button"
                style={btnBlueStyle}
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}