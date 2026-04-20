import { NavLink, Outlet } from "react-router-dom";

const styles = {
  page: {
    padding: 20,
  } as React.CSSProperties,

  headerWrap: {
    marginBottom: 18,
  } as React.CSSProperties,

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: "#111827",
  } as React.CSSProperties,

  subtitle: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 14,
  } as React.CSSProperties,

  tabsWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 18,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 12,
  } as React.CSSProperties,

  tab: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 10,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
    transition: "all 0.15s ease",
  } as React.CSSProperties,

  tabActive: {
    background: "#1d4ed8",
    color: "#ffffff",
    border: "1px solid #1d4ed8",
  } as React.CSSProperties,

  contentWrap: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 0,
    overflow: "hidden",
  } as React.CSSProperties,
};

function PepTabLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/pep/nouvelle"}
      style={({ isActive }) => ({
        ...styles.tab,
        ...(isActive ? styles.tabActive : {}),
      })}
    >
      {children}
    </NavLink>
  );
}

export default function PepAccueil() {
  return (
    <div style={styles.page}>
      <div style={styles.headerWrap}>
        <h1 style={styles.title}>PEP</h1>
        <div style={styles.subtitle}>
          Gestion des fiches PEP, du suivi et de l’administration.
        </div>
      </div>

      <div style={styles.tabsWrap}>
        <PepTabLink to="/pep/nouvelle">Inspection PEP</PepTabLink>
        <PepTabLink to="/pep/suivi">Suivi PEP</PepTabLink>
        <PepTabLink to="/pep/admin">Configuration</PepTabLink>
      </div>

      <div style={styles.contentWrap}>
        <Outlet />
      </div>
    </div>
  );
}