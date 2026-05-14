type BarcodeItem = {
  sku: string | null;
  nom: string;
};

type BarcodeFormat = "17x54" | "62x29" | "62x38" | "62x100";

type PrintBarcodeOptions = {
  format?: string;
  qty?: number;
};

const LABEL_FORMATS: Record<
  BarcodeFormat,
  {
    width: string;
    height: string;
    barcodeWidth: string;
    barcodeSvgHeight: string;
    barcodeHeight: number;
    nameFontSize: string;
    skuFontSize: string;
    padding: string;
  }
> = {
  "17x54": {
    width: "54.3mm",
    height: "17mm",
    barcodeWidth: "46mm",
    barcodeSvgHeight: "7mm",
    barcodeHeight: 24,
    nameFontSize: "6.5pt",
    skuFontSize: "6pt",
    padding: "1mm 2mm",
  },
  "62x29": {
    width: "62mm",
    height: "29mm",
    barcodeWidth: "52mm",
    barcodeSvgHeight: "11mm",
    barcodeHeight: 38,
    nameFontSize: "9pt",
    skuFontSize: "8pt",
    padding: "2mm",
  },
  "62x38": {
    width: "62mm",
    height: "38mm",
    barcodeWidth: "54mm",
    barcodeSvgHeight: "15mm",
    barcodeHeight: 50,
    nameFontSize: "10pt",
    skuFontSize: "8pt",
    padding: "2mm",
  },
  "62x100": {
    width: "62mm",
    height: "100mm",
    barcodeWidth: "54mm",
    barcodeSvgHeight: "20mm",
    barcodeHeight: 70,
    nameFontSize: "11pt",
    skuFontSize: "9pt",
    padding: "4mm 2mm",
  },
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeFormat(format?: string): BarcodeFormat {
  if (format === "62x29" || format === "62x38" || format === "62x100") return format;
  return "17x54";
}

export function useBarcodeLabels() {
  function openPrintBarcode(item: BarcodeItem, options: PrintBarcodeOptions = {}) {
    const sku = (item.sku || "").trim();
    const nom = (item.nom || "").trim();

    if (!sku) {
      alert("Aucun SKU pour cette pièce.");
      return;
    }

    const formatKey = normalizeFormat(options.format);
    const format = LABEL_FORMATS[formatKey];
    const qty = Math.max(1, Math.min(100, Number(options.qty) || 1));

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Impossible d’ouvrir la fenêtre d’impression.");
      return;
    }

    const safeSku = escapeHtml(sku);
    const safeNom = escapeHtml(nom);

    const labelsHtml = Array.from({ length: qty })
      .map(
        (_, index) => `
          <div class="label">
            <div class="name">${safeNom}</div>
            <svg id="barcode-${index}" class="barcode"></svg>
            <div class="sku">${safeSku}</div>
          </div>
        `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <title>Code-barres</title>

        <style>
          @page {
            size: ${format.width} ${format.height};
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            background: #fff;
          }

          .label {
            width: ${format.width};
            height: ${format.height};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            padding: ${format.padding};
            page-break-after: always;
            break-after: page;
            overflow: hidden;
          }

          .label:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .name {
            max-width: calc(${format.width} - 4mm);
            font-size: ${format.nameFontSize};
            font-weight: 700;
            text-align: center;
            margin-bottom: 0.7mm;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .barcode {
            width: ${format.barcodeWidth};
            height: ${format.barcodeSvgHeight};
          }

          .sku {
            font-size: ${format.skuFontSize};
            margin-top: 0.7mm;
            text-align: center;
            line-height: 1;
            white-space: nowrap;
          }
        </style>
      </head>

      <body>
        ${labelsHtml}

        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>

        <script>
          const sku = ${JSON.stringify(sku)};
          const qty = ${qty};

          for (let i = 0; i < qty; i++) {
            JsBarcode("#barcode-" + i, sku, {
              format: "CODE128",
              displayValue: false,
              margin: 0,
              width: 1.3,
              height: ${format.barcodeHeight}
            });
          }

          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return {
    openPrintBarcode,
  };
}
