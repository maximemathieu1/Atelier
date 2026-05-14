const btPrintTemplate = `
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bon de travail</title>

<style>
* {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

@page { size: Letter; margin: 10mm; }

:root{
  --blue:#1f3a5f;
  --text:#1d2430;
  --line:#cfd7e6;
  --soft:#f7f9fc;
}

html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  color: var(--text);
  font-size: 11px;
  line-height: 1.25;
}

.page {
  padding: 2mm;
}

.brandbar{
  background: var(--blue) !important;
  color:#fff !important;
  padding:6px 10px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  font-size:11px;
  font-weight:700;
  margin-bottom: 12px;
}

.header {
  display: grid;
  grid-template-columns: 1fr 270px;
  gap: 20px;
  align-items: start;
  margin-bottom: 14px;
}

.company-name {
  font-size: 28px;
  font-weight: 900;
  color: var(--text);
  margin-bottom: 8px;
}

.company-meta {
  font-size: 11px;
  line-height: 1.55;
  color: #333333;
}

.doc-side {
  border: 2px solid #000;
  padding: 10px 12px;
}

.doc-label {
  text-align: center;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.doc-number {
  text-align: center;
  font-size: 24px;
  font-weight: 900;
  color: var(--text);
  margin-bottom: 10px;
}

.doc-meta {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.doc-meta td {
  padding: 2px 0;
  vertical-align: top;
}

.doc-meta .k {
  font-weight: 700;
  text-align: left;
}

.doc-meta .v {
  font-weight: 800;
  text-align: right;
}

.section {
  margin-bottom: 14px;
  break-inside: avoid;
  page-break-inside: avoid;
}

.section-h {
  background: var(--blue) !important;
  color: #fff !important;
  padding: 4px 6px;
  font-weight: 700;
  font-size: 11px;
}

.section-b {
  border: 1px solid var(--line);
  padding: 8px;
  background: #fff;
}

.vehicle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.6fr 1fr;
  gap: 8px;
  align-items: start;
}

.vehicle-item {
  min-width: 0;
}

.vehicle-label {
  font-size: 10px;
  font-weight: 700;
  color: #555;
  margin-bottom: 3px;
  text-transform: uppercase;
}

.vehicle-value {
  font-size: 12px;
  font-weight: 900;
  color: var(--text);
  border-bottom: 1px solid #000;
  padding-bottom: 2px;
  word-break: break-word;
  min-height: 18px;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.tbl th {
  text-align: left;
  padding: 4px 6px;
  background: #e9eef6 !important;
  border: 1px solid var(--line);
  color: var(--text);
  font-weight: 700;
  font-size: 10px;
}

.tbl td {
  padding: 5px 6px;
  border: 1px solid var(--line);
  color: var(--text);
  vertical-align: top;
  font-size: 10.5px;
}

.tbl tbody tr:nth-child(even) td {
  background: var(--soft) !important;
}

.tbl td.amount,
.tbl th.amount {
  text-align: right;
}

.tbl td.center,
.tbl th.center {
  text-align: center;
}

.totals-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.totals-box {
  width: 320px;
  max-width: 100%;
}

.total-row {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid #000;
  font-size: 11px;
}

.total-row .label {
  font-weight: 700;
}

.total-row .value {
  text-align: right;
  font-weight: 800;
}

.total-final .label,
.total-final .value {
  font-size: 13px;
  font-weight: 900;
}

.footer-note {
  margin-top: 18px;
  font-size: 10px;
  text-align: left;
  color: #444;
}

@media print {
  html, body {
    width: 216mm;
    min-height: 279mm;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .page {
    padding: 0;
  }

  .brandbar,
  .section-h,
  .tbl th,
  .tbl tbody tr:nth-child(even) td {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
</style>
</head>

<body>
<div class="page">

  <div class="brandbar">
    <div>GROUPE BRETON</div>
    <div>BON DE TRAVAIL</div>
  </div>

  <div class="header">
    <div>
      <div class="company-name">{{entreprise_nom_affiche}}</div>
      <div class="company-meta">
        <div>{{entreprise_adresse_l1}}</div>
        <div>{{entreprise_ville}} {{entreprise_province}} {{entreprise_code_postal}}</div>
      </div>
    </div>

    <div class="doc-side">
      <div class="doc-label">Bon de travail</div>
      <div class="doc-number">{{bt_numero}}</div>

      <table class="doc-meta">
        <tr>
          <td class="k">Ouverture</td>
          <td class="v">{{date_ouverture}}</td>
        </tr>
        <tr>
          <td class="k">Fermeture</td>
          <td class="v">{{date_fermeture}}</td>
        </tr>
        {{bon_commande_row}}
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-h">{{client_nom}}</div>
    <div class="section-b">
      <div class="vehicle-grid">
        <div class="vehicle-item">
          <div class="vehicle-label">Unité</div>
          <div class="vehicle-value">{{unite_no}}</div>
        </div>

        <div class="vehicle-item">
          <div class="vehicle-label">Plaque</div>
          <div class="vehicle-value">{{unite_plaque}}</div>
        </div>

        <div class="vehicle-item">
          <div class="vehicle-label">NIV</div>
          <div class="vehicle-value">{{unite_niv}}</div>
        </div>

        <div class="vehicle-item">
          <div class="vehicle-label">Kilométrage</div>
          <div class="vehicle-value">{{bt_km}}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-h">Travaux effectués</div>
    <div class="section-b">
      <table class="tbl">
        <thead>
          <tr>
            <th>Description</th>
            <th class="center" style="width:150px;">Date</th>
          </tr>
        </thead>
        <tbody>
          {{taches_effectuees_rows}}
        </tbody>
      </table>
    </div>
  </div>

  {{taches_ouvertes_section}}

  <div class="section">
    <div class="section-h">Pièces</div>
    <div class="section-b">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:110px;">SKU</th>
            <th>Description</th>
            <th class="center" style="width:60px;">Qté</th>
            <th style="width:80px;">Unité</th>
            <th class="amount" style="width:110px;">Prix</th>
            <th class="amount" style="width:120px;">Total</th>
          </tr>
        </thead>
        <tbody>
          {{pieces_rows}}
        </tbody>
      </table>
    </div>
  </div>

  <div class="totals-wrap">
    <div class="totals-box">
      <div class="total-row">
        <div class="label">Pièces</div>
        <div class="value">{{total_pieces}}</div>
      </div>

      <div class="total-row">
        <div class="label">Main-d’œuvre ({{total_heures}} h)</div>
        <div class="value">{{total_main_oeuvre}}</div>
      </div>

      <div class="total-row">
        <div class="label">Frais atelier</div>
        <div class="value">{{total_frais_atelier}}</div>
      </div>

      <div class="total-row total-final">
        <div class="label">Sous-total</div>
        <div class="value">{{total_general}}</div>
      </div>
    </div>
  </div>

  <div class="footer-note">
    Document généré automatiquement par l’atelier.
  </div>

</div>
</body>
</html>
`;

export default btPrintTemplate;