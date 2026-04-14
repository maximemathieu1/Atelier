import { NavLink, useLocation } from "react-router-dom";
import ParametresConfiguration from "./ParametresConfiguration";
import ParametresCompatibilite from "./ParametresCompatibilite";
import ParametresAcomba from "./ParametresAcomba";
import ParametresEntrepriseFacturation from "./ParametresEntrepriseFacturation";

function getTabFromPath(pathname: string) {
  if (pathname.includes("/compatibilite")) return "compatibilite";
  if (pathname.includes("/acomba")) return "acomba";
  if (pathname.includes("/entreprise-facturation")) return "entreprise-facturation";
  return "configuration";
}

export default function ParametresSysteme() {
  const location = useLocation();
  const activeTab = getTabFromPath(location.pathname);

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #d6dbe3",
    textDecoration: "none",
    fontWeight: 800,
    background: isActive ? "var(--primary, #2563eb)" : "#fff",
    color: isActive ? "#fff" : "var(--text, #0f172a)",
    boxShadow: isActive ? "inset 0 -1px 0 rgba(0,0,0,.08)" : "none",
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1 style={{ margin: 0 }}>Paramètres système</h1>
          <div className="muted">
            Configuration générale, compatibilité, facturation et paramètres Acomba.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <NavLink
          to="/parametres-systeme/configuration"
          style={tabStyle(activeTab === "configuration")}
        >
          Configuration
        </NavLink>

        <NavLink
          to="/parametres-systeme/compatibilite"
          style={tabStyle(activeTab === "compatibilite")}
        >
          Compatibilité
        </NavLink>

        <NavLink
          to="/parametres-systeme/entreprise-facturation"
          style={tabStyle(activeTab === "entreprise-facturation")}
        >
          Entreprise / Facturation
        </NavLink>

        <NavLink
          to="/parametres-systeme/acomba"
          style={tabStyle(activeTab === "acomba")}
        >
          Acomba
        </NavLink>
      </div>

      {activeTab === "configuration" && <ParametresConfiguration />}
      {activeTab === "compatibilite" && <ParametresCompatibilite />}
      {activeTab === "entreprise-facturation" && <ParametresEntrepriseFacturation />}
      {activeTab === "acomba" && <ParametresAcomba />}
    </div>
  );
}