import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

const DEFAULT_CATEGORIES = ['all', 'oil', 'engine', 'brakes', 'tyres', 'body', 'electricals', 'other'];

function formatCategoryLabel(category) {
  return category
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CatalogueModal({
  catalogue = [],
  onAdd,
  onClose,
  title = 'Add Part / Service',
  searchPlaceholder = 'Search parts…',
  emptyText = 'No parts found',
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');

  const categories = [
    ...DEFAULT_CATEGORIES,
    ...Array.from(
      new Set(
        catalogue
          .map((part) => String(part.category || '').trim().toLowerCase())
          .filter(Boolean)
          .filter((partCategory) => !DEFAULT_CATEGORIES.includes(partCategory))
      )
    ),
  ];

  const filtered = catalogue.filter((p) => {
    const nameMatches = (p.name || '').toLowerCase().includes(q.toLowerCase());
    const partCategory = String(p.category || 'other').trim().toLowerCase() || 'other';
    const categoryMatches = category === 'all' || partCategory === category;
    return nameMatches && categoryMatches;
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/50" onClick={onClose}>
      <div
        className="mx-auto flex max-h-[76vh] w-full max-w-lg flex-col rounded-t-2xl bg-white p-4 shadow-2xl"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold text-brand-dark">{title}</p>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <input
          className="input-field mb-3"
          placeholder={searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="-mx-1 mb-3 overflow-x-auto overflow-y-hidden px-1 pb-3">
          <div className="inline-flex min-w-max gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
                  category === item
                    ? 'bg-brand-mid text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
                onClick={() => setCategory(item)}
              >
                {t(`parts.categories.${item}`, { defaultValue: formatCategoryLabel(item) })}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3 border-b border-gray-100" />
        <div className="space-y-1 overflow-y-auto pt-1">
          {filtered.map((p) => (
            <button
              key={p.id || p.shop_part_id || p.default_part_id || p.name}
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-brand-light active:bg-brand-light"
              onClick={() => onAdd(p)}
            >
              <span className="text-sm font-medium">{p.name}</span>
              <span className="text-sm font-semibold text-brand-mid">₹{Number(p.price).toFixed(2)}</span>
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">{emptyText || t('common.na')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
