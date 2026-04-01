/**
 * exportCsv.js
 * Client-side CSV export for NatBolt Billu bills — no external library needed.
 *
 * Usage:
 *   exportBillsCSV(bills, shop)          → downloads "NatBolt_Bills_<month>.csv"
 *   exportBillsCSVBlob(bills, shop)      → returns Blob (for sharing)
 */

function esc(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // If value contains comma, newline, or double-quote → wrap in quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function buildRows(bills) {
  const headers = [
    'Bill No', 'Date', 'Type', 'Status',
    'Customer Name', 'Customer Phone', 'Vehicle No',
    'Parts Subtotal', 'Labour', 'GST Applied',
    'CGST', 'SGST', 'Grand Total',
    'Paid Amount', 'Balance Due', 'Payment Mode',
  ];

  const rows = bills.map((b) => [
    b.billNumber || b.estimateNumber || '',
    fmtDate(b.createdAt),
    b.type === 'estimate' ? 'Estimate' : 'Bill',
    b.status || '',
    b.customerName || '',
    b.customerPhone || '',
    b.vehicleNo || '',
    b.partsSubtotal ?? '',
    b.labourCharge ?? '',
    b.isGST ? 'Yes' : 'No',
    b.cgst ?? '',
    b.sgst ?? '',
    b.grandTotal ?? '',
    b.paidAmount ?? '',
    b.balanceDue ?? '',
    b.paymentMode || '',
  ]);

  return [headers, ...rows];
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(esc).join(',')).join('\r\n');
}

export function exportBillsCSV(bills, shop) {
  if (!bills?.length) return;
  const rows    = buildRows(bills);
  const csv     = rowsToCsv(rows);
  const blob    = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url     = URL.createObjectURL(blob);
  const now     = new Date();
  const month   = now.toLocaleString('en-IN', { month: 'short', year: 'numeric' }).replace(' ', '_');
  const shopSlug = (shop?.shopName || 'NatBolt').replace(/\s+/g, '_').slice(0, 20);
  const filename = `${shopSlug}_Bills_${month}.csv`;

  const a  = document.createElement('a');
  a.href   = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportBillsCSVBlob(bills, shop) {
  const rows = buildRows(bills);
  const csv  = rowsToCsv(rows);
  return new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
}
