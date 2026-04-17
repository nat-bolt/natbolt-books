import { Plus, Trash2 } from 'lucide-react';

export default function DocumentItemsCard({
  title,
  items = [],
  emptyText,
  editable = false,
  addLabel = 'Add',
  onAdd,
  onRemove,
  onDecreaseQty,
  onIncreaseQty,
  onPriceChange,
  onPriceKeyDown,
  qtyLabel = 'Qty',
  priceLabel = 'Price',
  totalLabel = 'Total',
}) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <p className="section-label mb-0">{title}</p>
        {editable && onAdd ? (
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg bg-brand-mid px-3 py-1.5 text-sm font-semibold text-white"
            onClick={onAdd}
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="py-3 text-center text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={`${item.id || item.name}-${i}`} className={`border-b border-gray-100 last:border-0 ${editable ? 'py-2' : 'flex items-center justify-between py-1.5'}`}>
              {editable ? (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="truncate text-xs text-gray-400">₹{item.unitPrice} each</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 p-1 text-red-400"
                      onClick={() => onRemove?.(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex h-10 w-24 shrink-0 items-center gap-1 rounded-xl border border-gray-200 bg-white px-1">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 font-bold text-gray-600"
                        onClick={() => onDecreaseQty?.(i)}
                      >
                        −
                      </button>
                      <span className="min-w-0 flex-1 text-center text-sm font-medium">{item.qty}</span>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 font-bold text-gray-600"
                        onClick={() => onIncreaseQty?.(i)}
                      >
                        +
                      </button>
                    </div>
                    <input
                      type="tel"
                      inputMode="decimal"
                      enterKeyHint="done"
                      className="h-10 w-24 rounded-xl border border-gray-200 px-2 py-1 text-center text-sm"
                      value={item.unitPrice === 0 ? '' : item.unitPrice}
                      onChange={(e) => onPriceChange?.(i, e.target.value === '0' ? '' : e.target.value)}
                      onKeyDown={onPriceKeyDown}
                    />
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-[11px] text-gray-400">{totalLabel}</p>
                      <span className="text-sm font-semibold">₹{item.total?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-400">{qtyLabel}: {item.qty} × ₹{item.unitPrice}</p>
                  </div>
                  <span className="text-sm font-semibold">₹{item.total?.toFixed(2)}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
