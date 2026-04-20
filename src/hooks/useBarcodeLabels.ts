export function useBarcodeLabels() {
  function buildBarcodeValue(item: any) {
    return item.sku || item.id;
  }

  function openPrintBarcode(item: any) {
    const value = buildBarcodeValue(item);

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Code-barres</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .label {
              text-align: center;
            }
            svg {
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div><strong>${item.nom}</strong></div>
            <div>${value}</div>
            <svg id="barcode"></svg>
          </div>

          <script src="https://cdn.jsdelivr.net/npm/jsbarcode"></script>
          <script>
            JsBarcode("#barcode", "${value}", {
              format: "CODE128",
              width: 2,
              height: 60,
              displayValue: false
            });
            window.print();
          </script>
        </body>
      </html>
    `);

    win.document.close();
  }

  return { openPrintBarcode };
}