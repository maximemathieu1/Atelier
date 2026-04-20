import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";

export default function ParametresConfiguration() {
  const nav = useNavigate();

  const styles = {
    page: {
      padding: 16,
      display: "grid",
      gap: 14,
    } as CSSProperties,
    card: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 16,
      boxShadow: "0 8px 30px rgba(0,0,0,.05)",
    } as CSSProperties,
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: 14,
    } as CSSProperties,
    sectionCard: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,.08)",
      borderRadius: 14,
      padding: 16,
      boxShadow: "0 8px 24px rgba(0,0,0,.04)",
      display: "grid",
      gap: 12,
    } as CSSProperties,
    title: {
      margin: 0,
      fontSize: 22,
      fontWeight: 900,
      color: "#0f172a",
    } as CSSProperties,
    subtitle: {
      color: "rgba(0,0,0,.6)",
      fontSize: 14,
    } as CSSProperties,
    sectionTitle: {
      fontSize: 18,
      fontWeight: 900,
      color: "#0f172a",
      margin: 0,
    } as CSSProperties,
    sectionText: {
      color: "rgba(0,0,0,.62)",
      fontSize: 14,
      lineHeight: 1.45,
    } as CSSProperties,
    btnPrimary: {
      padding: "10px 14px",
      borderRadius: 10,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
      width: "fit-content",
    } as CSSProperties,
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Configuration</h1>
        <div style={styles.subtitle}>
          Choisis la section à administrer.
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>Unités</h2>
          <div style={styles.sectionText}>
            Gère les options fixes de l’unité, les attributs dynamiques PEP et les
            options des attributs de type liste.
          </div>
          <button
            type="button"
            style={styles.btnPrimary}
            onClick={() => nav("/systeme/parametres/unites")}
          >
            Ouvrir
          </button>
        </div>

        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>Pièces</h2>
          <div style={styles.sectionText}>
            Gère les catégories de pièces utilisées par l’inventaire.
          </div>
          <button
            type="button"
            style={styles.btnPrimary}
            onClick={() => nav("/systeme/parametres/pieces")}
          >
            Ouvrir
          </button>
        </div>

        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>Templates</h2>
          <div style={styles.sectionText}>
            Gère les templates d’entretien périodique et leurs lignes.
          </div>
          <button
            type="button"
            style={styles.btnPrimary}
            onClick={() => nav("/systeme/parametres/templates")}
          >
            Ouvrir
          </button>
        </div>
      </div>
    </div>
  );
}