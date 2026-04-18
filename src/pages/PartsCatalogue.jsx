import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Pencil, X, RotateCcw, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import { supabase } from '../supabase';
import ConfirmSheet from '../components/ConfirmSheet';
import StatusBadge from '../components/StatusBadge';

// ── Language-aware part name ───────────────────────────────────────────────────
function getPartName(part, language) {
  if (language === 'hi' && part.name_hi) return part.name_hi;
  if (language === 'te' && part.name_te) return part.name_te;
  return part.name;
}

// ── Edit / Add Part Modal ─────────────────────────────────────────────────────
// Handles three modes:
//   1. Edit a default part price (is_custom=false) — upserts shop_parts
//   2. Edit a custom part (is_custom=true)         — updates shop_parts
//   3. Add a new custom part                        — inserts shop_parts
function PartModal({ part, shopId, onSaved, onClose }) {
  const { t } = useTranslation();
  const isNew    = !part;              // adding a brand-new custom part
  const isCustom = part?.is_custom;   // editing an existing custom part

  const [name,  setName]  = useState(part?.name  || '');
  const [price, setPrice] = useState(part ? String(part.price) : '');
  const [unit,  setUnit]  = useState(part?.unit   || 'pc');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) { setError('Enter a valid price'); return; }
    if ((isNew || isCustom) && !name.trim())   { setError('Part name is required'); return; }

    setSaving(true);
    setError('');
    try {
      if (isNew) {
        // Insert a brand-new custom part (default_part_id IS NULL)
        const { error: err } = await supabase
          .from('shop_parts')
          .insert({
            shop_id: shopId,
            name:    name.trim(),
            price:   parsedPrice,
            unit:    unit || 'pc',
          });
        if (err) throw err;
      } else if (isCustom) {
        // Update existing custom part row
        const { error: err } = await supabase
          .from('shop_parts')
          .update({ name: name.trim(), price: parsedPrice, unit })
          .eq('id', part.shop_part_id);
        if (err) throw err;
      } else {
        // Upsert override for a default part
        const { error: err } = await supabase
          .from('shop_parts')
          .upsert(
            {
              shop_id:         shopId,
              default_part_id: part.default_part_id,
              name:            name.trim() || null,    // null = keep default name
              price:           parsedPrice,
              unit:            unit || null,
            },
            { onConflict: 'shop_id,default_part_id' }
          );
        if (err) throw err;
      }
      onSaved();
    } catch (err) {
      console.error('PartModal save error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-lg mx-auto rounded-3xl px-5 pt-5 shadow-2xl"
        style={{
          maxHeight: 'calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 32px)',
          paddingBottom: 'calc(var(--safe-bottom) + 20px)',
        }}
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 -mx-5 mb-4 flex items-center justify-between bg-white px-5 pb-3 pt-1">
          <h3 className="font-bold text-brand-dark text-lg">
            {isNew ? t('catalogue.addCustomPart') : t('catalogue.editPart')}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Show original name for default part edits */}
        {!isNew && !isCustom && (
          <p className="text-sm text-gray-400 mb-4">{part.name}</p>
        )}

        <div className="space-y-3">
          {/* Name field — required for new/custom, optional override for default */}
          <div>
            <label className="section-label">
              {isNew || isCustom ? `${t('catalogue.partName')} *` : t('catalogue.customNameOptional')}
            </label>
            <input
              className="input-field"
              placeholder={isNew ? t('catalogue.partNamePlaceholder') : part?.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            {/* Price */}
            <div className="flex-1">
              <label className="section-label">Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number" inputMode="decimal" className="input-field pl-7"
                  placeholder={String(part?.default_price || '0')}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              {!isNew && !isCustom && part.default_price !== null && (
                <p className="text-xs text-gray-400 mt-1">
                  {t('catalogue.defaultPrice')}: ₹{part.default_price}
                </p>
              )}
            </div>

            {/* Unit */}
            <div className="w-28">
              <label className="section-label">Unit</label>
              <select className="input-field" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {['pc', 'set', 'pair', 'litre', 'ml', 'kg', 'g', 'metre'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <button className="btn-primary w-full mt-5" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : isNew ? t('catalogue.addPart') : t('catalogue.saveChanges')}
        </button>
      </div>
    </div>
  );
}

function ManageSheet({ open, onClose, onRefresh, onResetAll, resetDisabled }) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl bg-white px-5 pt-4 shadow-2xl"
        style={{
          maxHeight: 'calc(var(--app-height) - var(--safe-top) - 24px)',
          paddingBottom: 'calc(var(--safe-bottom) + 20px)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-brand-dark">{t('catalogue.manageTitle')}</h3>
            <p className="mt-1 text-sm text-gray-500">{t('catalogue.manageSubtitle')}</p>
          </div>
          <button type="button" className="rounded-xl p-1 text-gray-400" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left"
            onClick={() => {
              onRefresh();
              onClose();
            }}
          >
            <div>
              <p className="text-sm font-semibold text-brand-dark">{t('catalogue.refreshCatalogue')}</p>
              <p className="mt-1 text-xs text-gray-500">{t('catalogue.refreshSubtitle')}</p>
            </div>
            <RefreshCw className="h-4 w-4 text-brand-mid" />
          </button>

          <button
            type="button"
            disabled={resetDisabled}
            className="flex w-full items-center justify-between rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3 text-left disabled:opacity-50"
            onClick={onResetAll}
          >
            <div>
              <p className="text-sm font-semibold text-red-600">{t('catalogue.resetDefaults')}</p>
              <p className="mt-1 text-xs text-red-400">{t('catalogue.resetDefaultsHint')}</p>
            </div>
            <RotateCcw className="h-4 w-4 text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main PartsCatalogue ───────────────────────────────────────────────────────
export default function PartsCatalogue() {
  const { t }            = useTranslation();
  const { shop, language } = useStore();

  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [cat, setCat]             = useState('all');
  const [editPart, setEditPart]   = useState(null);   // null | part object
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [confirmState, setConfirmState] = useState(null);

  // Fixed ordered category list (matches v8 schema)
  const CATEGORY_LIST = ['all', 'oil', 'engine', 'brakes', 'tyres', 'body', 'electricals', 'custom'];

  useEffect(() => {
    if (!shop) return;
    loadCatalogue();
  }, [shop]);

  const loadCatalogue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_parts_catalogue', { p_shop_id: shop.id });
      if (error) throw error;
      setCatalogue(data || []);
    } catch (err) {
      console.error('PartsCatalogue load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetOverride = async (part) => {
    if (!part.shop_part_id) return;
    try {
      const { error } = await supabase
        .from('shop_parts')
        .delete()
        .eq('id', part.shop_part_id);
      if (error) throw error;
      loadCatalogue();
    } catch (err) {
      console.error('Reset override error:', err);
    }
  };

  const handleResetAll = async () => {
    try {
      // Delete only overrides (where default_part_id IS NOT NULL)
      const { error } = await supabase
        .from('shop_parts')
        .delete()
        .eq('shop_id', shop.id)
        .not('default_part_id', 'is', null);
      if (error) throw error;
      loadCatalogue();
    } catch (err) {
      console.error('Reset all error:', err);
    }
  };

  // Merge category null → 'custom' for display
  const parts = useMemo(() => {
    return catalogue.map((p) => ({
      ...p,
      displayCategory: p.category || 'custom',
    })).filter((p) => {
      const name = getPartName(p, language).toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchCat    = cat === 'all' || p.displayCategory === cat;
      return matchSearch && matchCat;
    });
  }, [catalogue, search, cat, language]);

  const overrideCount = catalogue.filter((p) => p.is_overridden || p.is_custom).length;
  const customCount = catalogue.filter((p) => p.is_custom).length;
  const modifiedCount = catalogue.filter((p) => p.is_overridden && !p.is_custom).length;

  return (
    <Layout title={t('catalogue.title')}>
      <div className="p-4 space-y-4">
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand-dark">{t('catalogue.subtitle')}</p>
              <p className="mt-1 text-xs text-gray-500">
                {t('catalogue.summary', { total: catalogue.length, customised: overrideCount })}
              </p>
            </div>
            <button
              type="button"
              onClick={loadCatalogue}
              className="rounded-xl bg-brand-light p-2 text-brand-mid"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-brand-light/60 px-3 py-2">
              <p className="text-xs font-semibold text-gray-500">{t('catalogue.totalParts')}</p>
              <p className="mt-1 text-lg font-bold text-brand-dark">{catalogue.length}</p>
            </div>
            <div className="rounded-xl bg-blue-50 px-3 py-2">
              <p className="text-xs font-semibold text-blue-500">{t('catalogue.modifiedParts')}</p>
              <p className="mt-1 text-lg font-bold text-blue-700">{modifiedCount}</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold text-amber-500">{t('catalogue.customParts')}</p>
              <p className="mt-1 text-lg font-bold text-amber-700">{customCount}</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder={t('catalogue.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-light py-3 text-sm font-semibold text-brand-mid"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4" /> {t('parts.addCustom')}
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700"
            onClick={() => setShowManage(true)}
          >
            <SlidersHorizontal className="w-4 h-4" /> {t('catalogue.manage')}
          </button>
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORY_LIST.map((c) => (
            <button key={c}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                cat === c ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'
              }`}
              onClick={() => setCat(c)}
            >
              {c === 'all' ? 'All' : t(`parts.categories.${c}`, { defaultValue: c })}
            </button>
          ))}
        </div>

        {/* Parts list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {parts.map((part) => (
              <div
                key={part.shop_part_id || part.default_part_id}
                className="card flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-dark">
                      {getPartName(part, language)}
                    </p>
                    <StatusBadge
                      variant={part.is_custom ? 'warning' : part.is_overridden ? 'bill' : 'neutral'}
                      className="normal-case tracking-normal"
                    >
                      {part.is_custom ? t('catalogue.statusCustom') : part.is_overridden ? t('catalogue.statusModified') : t('catalogue.statusDefault')}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-gray-400 capitalize">
                    {part.displayCategory} · {part.unit}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-brand-mid">₹{Number(part.price).toFixed(0)}</p>
                    {part.is_overridden && part.default_price !== null && (
                      <p className="text-xs text-gray-400 line-through">
                        ₹{Number(part.default_price).toFixed(0)}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center"
                      onClick={() => setEditPart(part)}
                    >
                      <Pencil className="w-3.5 h-3.5 text-brand-mid" />
                    </button>
                    {(part.is_overridden || part.is_custom) && (
                      <button
                        className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center"
                        onClick={() => setConfirmState({ type: 'reset-part', part })}
                        title={part.is_custom ? t('catalogue.deleteCustomPart') : t('catalogue.resetPart')}
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {parts.length === 0 && !loading && (
              <div className="card text-center py-12 text-gray-400">
                <p>{t('catalogue.noParts')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editPart && (
        <PartModal
          part={editPart}
          shopId={shop.id}
          onSaved={() => { setEditPart(null); loadCatalogue(); }}
          onClose={() => setEditPart(null)}
        />
      )}

      {/* Add custom part modal */}
      {showAddModal && (
        <PartModal
          part={null}
          shopId={shop.id}
          onSaved={() => { setShowAddModal(false); loadCatalogue(); }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <ManageSheet
        open={showManage}
        onClose={() => setShowManage(false)}
        onRefresh={loadCatalogue}
        onResetAll={() => {
          setShowManage(false);
          setConfirmState({ type: 'reset-all' });
        }}
        resetDisabled={overrideCount === 0}
      />

      <ConfirmSheet
        open={Boolean(confirmState)}
        title={
          confirmState?.type === 'reset-all'
            ? t('catalogue.resetDefaults')
            : confirmState?.part?.is_custom
              ? t('catalogue.deleteCustomPart')
              : t('catalogue.resetPart')
        }
        body={
          confirmState?.type === 'reset-all'
            ? t('catalogue.resetDefaultsHint')
            : confirmState?.part?.is_custom
              ? t('catalogue.deleteCustomPartHint')
              : t('catalogue.resetPartHint')
        }
        confirmLabel={
          confirmState?.type === 'reset-all'
            ? t('catalogue.resetDefaults')
            : confirmState?.part?.is_custom
              ? t('catalogue.deleteCustomPart')
              : t('catalogue.resetPart')
        }
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmState(null)}
        onConfirm={async () => {
          const current = confirmState;
          setConfirmState(null);
          if (!current) return;
          if (current.type === 'reset-all') {
            await handleResetAll();
            return;
          }
          if (current.type === 'reset-part' && current.part) {
            await handleResetOverride(current.part);
          }
        }}
      />
    </Layout>
  );
}
