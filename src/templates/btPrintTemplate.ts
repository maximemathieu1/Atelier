const btPrintTemplate = `
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bon de travail</title>

<style>
* { box-sizing: border-box; }
@page { size: Letter; margin: 10mm; }

:root{
  --text:#111111;
  --muted:#5f5f5f;
  --line:#c9cdd3;
  --card:#eceff3;
  --card-header:#d7dde4;
  --card-header-2:#cbd2da;
  --black:#111111;
}

html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  color: var(--text);
  font-size: 12px;
  background: #ffffff;
}

.page {
  padding: 2mm;
}

.header {
  display: grid;
  grid-template-columns: 1fr 250px;
  gap: 24px;
  align-items: start;
  margin-bottom: 16px;
}

.company-name {
  font-size: 26px;
  font-weight: 900;
  color: var(--black);
  margin-bottom: 8px;
  letter-spacing: -0.2px;
}

.company-meta {
  font-size: 11px;
  line-height: 1.55;
  color: #333333;
}

.doc-side {
  text-align: right;
}

.doc-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.3px;
  color: var(--muted);
  margin-bottom: 4px;
  text-transform: uppercase;
}

.doc-number {
  font-size: 24px;
  font-weight: 900;
  color: var(--black);
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
  color: var(--muted);
  font-weight: 700;
  text-align: left;
}

.doc-meta .v {
  color: var(--black);
  font-weight: 800;
  text-align: right;
}

.section {
  border: 1px solid var(--line);
  margin-bottom: 14px;
  overflow: hidden;
  background: #fff;
  break-inside: avoid;
  page-break-inside: avoid;
}

.section-h {
  background: linear-gradient(180deg, var(--card-header) 0%, var(--card-header-2) 100%);
  color: #1f1f1f;
  padding: 9px 12px;
  font-weight: 900;
  font-size: 12px;
  border-bottom: 1px solid var(--line);
}

.section-b {
  padding: 10px 12px;
  background: #ffffff;
}

.client-block {
  margin-bottom: 10px;
}

.client-meta {
  font-size: 11px;
  line-height: 1.5;
  color: #333333;
}

.vehicle-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1.9fr 1fr;
  gap: 16px;
  align-items: start;
}

.vehicle-item {
  min-width: 0;
}

.vehicle-label {
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--muted);
  margin-bottom: 4px;
  letter-spacing: .2px;
}

.vehicle-value {
  font-size: 13px;
  font-weight: 800;
  color: var(--black);
  word-break: break-word;
  line-height: 1.25;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
}

.tbl th {
  text-align: left;
  padding: 9px 11px;
  background: linear-gradient(180deg, var(--card-header) 0%, var(--card-header-2) 100%);
  color: #1f1f1f;
  font-weight: 900;
  font-size: 11px;
}

.tbl td {
  padding: 10px 11px;
  border-bottom: 1px solid var(--line);
  color: var(--black);
  vertical-align: top;
}

.tbl tr:last-child td {
  border-bottom: none;
}

.tbl td.amount,
.tbl th.amount {
  text-align: right;
}

.tbl td.center,
.tbl th.center {
  text-align: center;
}

.totals-inline {
  margin-top: 14px;
  margin-left: auto;
  width: 340px;
  max-width: 100%;
}

.totals-inline table {
  width: 100%;
  border-collapse: collapse;
}

.totals-inline td {
  padding: 7px 0;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
}

.totals-inline td:last-child {
  text-align: right;
  font-weight: 800;
}

.totals-inline tr:last-child td {
  border-bottom: none;
}

.footer-note {
  margin-top: 18px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  font-size: 10px;
  color: var(--muted);
  text-align: center;
  line-height: 1.5;
}

@media print {
  .page { padding: 0; }
}
</style>
</head>

<body>
<div class="page">

  <div class="header">
  <div>
    <div class="company-name">{{entreprise_nom_affiche}}</div>
    <div class="company-meta">
      <div>{{entreprise_adresse_l1}}</div>
      <div>{{entreprise_ville}} {{entreprise_province}} {{entreprise_code_postal}}</div>
    </div>
  </div>

  <div class="doc-side">
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
      <tr>
        <td class="k">Statut</td>
        <td class="v">{{bt_statut}}</td>
      </tr>
      {{bon_commande_row}}
    </table>
  </div>
</div>

  <div class="section">
    <div class="section-h">{{client_nom}}</div>
    <div class="section-b">
      <div class="client-block">
        <div class="client-meta">
          <div>{{client_adresse_l1}}</div>
          <div>{{client_ville}}</div>
          <div>{{client_telephone}}</div>
        </div>
      </div>

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
            <th class="center" style="width:160px;">Date</th>
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
            <th style="width:120px;">SKU</th>
            <th>Description</th>
            <th class="center" style="width:70px;">Qté</th>
            <th style="width:90px;">Unité</th>
            <th class="amount" style="width:130px;">Prix</th>
            <th class="amount" style="width:140px;">Total</th>
          </tr>
        </thead>
        <tbody>
          {{pieces_rows}}
        </tbody>
      </table>
    </div>
  </div>

  <div style="margin-top: 14px;">
  <div class="totals-inline">
    <table>
      <tr>
        <td>Pièces</td>
        <td>{{total_pieces}}</td>
      </tr>
      <tr>
        <td>Main-d’œuvre ({{total_heures}} h)</td>
        <td>{{total_main_oeuvre}}</td>
      </tr>
      <tr>
        <td>Frais atelier</td>
        <td>{{total_frais_atelier}}</td>
      </tr>
      <tr>
        <td>Sous-total</td>
        <td>{{total_general}}</td>
      </tr>
    </table>
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