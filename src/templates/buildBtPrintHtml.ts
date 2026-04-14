import btTemplate from "./btPrintTemplate";

export function buildBtPrintHtml(data: any) {
  let html = btTemplate;

  function replace(key: string, value: any) {
    html = html.replaceAll(`{{${key}}}`, value ?? "");
  }

  // Champs simples
  replace("bt_numero", data.bt.numero);
  replace("date_ouverture", data.date_ouverture);
  replace("date_fermeture", data.date_fermeture);
  replace("bt_statut", data.bt.statut);

  replace("client_nom", data.client.nom);
  replace("client_adresse_l1", data.client.adresse || "");
  replace("client_ville", data.client.ville || "");
  replace("client_telephone", data.client.telephone || "");

  replace("unite_no", data.unite.no_unite);
  replace("unite_plaque", data.unite.plaque || "");
  replace("unite_niv", data.unite.niv || "");
  replace("bt_km", data.bt.km || "");

  replace("total_pieces", data.total_pieces);
  replace("total_main_oeuvre", data.total_main_oeuvre);
  replace("total_frais_atelier", data.total_frais_atelier);
  replace("total_general", data.total_general);
  replace("total_tps", data.total_tps);
  replace("total_tvq", data.total_tvq);
  replace("total_final", data.total_final);

  replace("notes_bt", data.notes || "");

  // PO conditionnel
  const poBlock = data.bt.bon_commande
    ? `<div class="k">Bon de commande</div><div class="v">${data.bt.bon_commande}</div>`
    : "";

  replace("bon_commande_block", poBlock);

  // Rows dynamiques
  replace("pieces_rows", data.piecesRows);
  replace("taches_effectuees_rows", data.tachesRows);
  replace("taches_ouvertes_rows", data.tachesOuvertesRows);
  replace("pointages_rows", data.pointagesRows);
  replace("temps_manuels_rows", data.tempsRows);

  return html;
}