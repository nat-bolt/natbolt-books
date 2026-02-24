import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Pencil, X, RotateCcw, Plus, RefreshCw } from 'lucide-react';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import { supabase } from '../supabase';

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
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-brand-dark text-lg">
            {isNew ? 'Add Custom Part' : 'Edit Part'}
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
              {isNew || isCustom ? 'Part Name *' : 'Custom Name (optional)'}
            </label>
            <input
              className="input-field"
              placeholder={isNew ? 'e.g. LED Headlight' : part?.name}
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
                  Default: ₹{part.default_price}
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
          {saving ? 'Saving…' : isNew ? 'Add Part' : 'Save Changes'}
        </button>
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
    if (!window.confirm('Reset all custom prices back to defaults?')) return;
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

  return (
    <Layout title={t('catalogue.title')}>
      <div className="p-4 space-y-4">
        {/* Header info */}
        <div className="bg-brand-light rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-brand-dark text-sm">{t('catalogue.subtitle')}</p>
              <p className="text-xs text-gray-500 mt-1">
                {catalogue.length} parts · {overrideCount} customised
              </p>
            </div>
            <button
              onClick={loadCatalogue}
              className="p-2 rounded-xl bg-white/70 text-brand-mid"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {overrideCount > 0 && (
            <button
              className="mt-2 text-xs text-red-500 font-semibold flex items-center gap-1"
              onClick={handleResetAll}
            >
              <RotateCcw className="w-3 h-3" /> Reset all to defaults
            </button>
          )}
        </div>

        {/* Add custom part button */}
        <button
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-brand-light rounded-2xl py-3 text-brand-mid font-semibold text-sm"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="w-4 h-4" /> Add Custom Part
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder={t('catalogue.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-brand-dark truncate">
                    {getPartName(part, language)}
                    {(part.is_overridden || part.is_custom) && (
                      <span className="ml-2 text-xs text-brand-mid font-normal bg-brand-light px-1.5 py-0.5 rounded-full">
                        {part.is_custom ? 'custom' : 'modified'}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">
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
                      className="w-8 h-8 rounded-xl bg-brand-light flex items-center justify-center"
                      onClick={() => setEditPart(part)}
                    >
                      <Pencil className="w-3.5 h-3.5 text-brand-mid" />
                    </button>
                    {(part.is_overridden || part.is_custom) && (
                      <button
                        className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center"
                        onClick={() => handleResetOverride(part)}
                        title={part.is_custom ? 'Delete custom part' : 'Reset to default price'}
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
    </Layout>
  );
}
