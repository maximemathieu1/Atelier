export default function FacturesFournisseurs() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Factures fournisseurs</h1>
        <p style={styles.text}>
          Module bientôt branché.
        </p>
        <p style={styles.subtext}>
          Cette section servira à importer les factures fournisseurs, les prévisualiser,
          les lier à l’inventaire ou à un BT, puis les autoriser pour paiement.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: 24,
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
    maxWidth: 760,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    color: "#182235",
  },
  text: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 800,
    color: "#1d4ed8",
  },
  subtext: {
    marginTop: 8,
    color: "#667085",
    lineHeight: 1.5,
  },
};