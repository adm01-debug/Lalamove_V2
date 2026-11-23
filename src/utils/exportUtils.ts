/**
 * Export utilities for CSV, JSON, Excel (.xlsx), and PDF text download
 */


function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export array of objects to CSV file
 */
export function exportToCSV(data: Record<string, unknown>[], filenameBase: string) {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = val === null || val === undefined ? '' : String(val);
        // Escape commas and quotes
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ),
  ];
  
  // UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF';
  downloadFile(bom + csvRows.join('\n'), `${filenameBase}.csv`, 'text/csv;charset=utf-8');
}

/**
 * Export data to JSON file
 */
export function exportToJSON(data: unknown, filenameBase: string) {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${filenameBase}.json`, 'application/json');
}

/**
 * Export one or more sheets to a native Excel (.xlsx) workbook.
 * Each sheet is an array of flat objects; keys of the first row define columns.
 */
export function exportToExcel(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  filenameBase: string,
) {
  import('xlsx').then((XLSX) => {
  const workbook = XLSX.utils.book_new();
  let added = 0;
  sheets.forEach((sheet) => {
    if (!sheet.rows.length) return;
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    // Larguras de coluna aproximadas com base no conteúdo.
    const headers = Object.keys(sheet.rows[0]);
    worksheet['!cols'] = headers.map((h) => {
      const maxLen = sheet.rows.reduce((m, r) => {
        const v = r[h];
        const len = v === null || v === undefined ? 0 : String(v).length;
        return Math.max(m, len);
      }, h.length);
      return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
    });
    // Nome de aba do Excel: máx. 31 caracteres, sem caracteres inválidos.
    const safeName = (sheet.name || `Planilha${added + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
    added += 1;
  });
  if (added === 0) return;
  XLSX.writeFile(workbook, `${filenameBase}.xlsx`);
  }).catch(() => { /* xlsx module load failed; toast handled by caller */ });
}


/**
 * Export a simple text-based PDF-like report (HTML rendered as printable)
 */
export function exportToPDFText(
  report: {
    title: string;
    sections: { title: string; content: string }[];
  },
  filenameBase: string
) {
  const now = new Date().toLocaleString('pt-BR');
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
    h1 { color: #1a1a2e; border-bottom: 3px solid #4361ee; padding-bottom: 10px; }
    h2 { color: #4361ee; margin-top: 24px; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-size: 13px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <p class="meta">Gerado em: ${now}</p>
  ${report.sections.map(s => `<h2>${s.title}</h2><pre>${s.content}</pre>`).join('\n')}
</body>
</html>`;

  // Open in new window for printing as PDF
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    // Small delay to ensure rendering before print dialog
    setTimeout(() => win.print(), 500);
  } else {
    // Fallback: download as HTML
    downloadFile(html, `${filenameBase}.html`, 'text/html');
  }
}
