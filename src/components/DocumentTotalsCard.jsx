export default function DocumentTotalsCard({
  rows = [],
  grandTotalLabel,
  grandTotalValue,
  footerRows = [],
  className = '',
}) {
  return (
    <div className={`card space-y-2 ${className}`.trim()}>
      {rows.map((row) => (
        <div key={row.label} className={`flex justify-between text-sm ${row.className || 'text-gray-600'}`}>
          <span>{row.label}</span>
          <span className={row.valueClassName || ''}>{row.value}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-gray-200 pt-2">
        <span className="font-bold text-brand-dark">{grandTotalLabel}</span>
        <span className="text-xl font-bold text-brand-dark">{grandTotalValue}</span>
      </div>
      {footerRows.map((row) => (
        <div key={row.label} className={`flex justify-between text-sm ${row.className || 'text-gray-600'}`}>
          <span>{row.label}</span>
          <span className={row.valueClassName || ''}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
