import { Camera, Check } from 'lucide-react';
import DocumentItemsCard from './DocumentItemsCard';
import DocumentTotalsCard from './DocumentTotalsCard';

export default function DocumentEditPanel({
  items,
  onAddClick,
  onRemoveItem,
  onDecreaseQty,
  onIncreaseQty,
  onPriceChange,
  onPriceKeyDown,
  itemsTitle,
  addLabel,
  emptyText,
  labourLabel,
  labourValue,
  onLabourChange,
  onLabourKeyDown,
  labourPlaceholder = '0',
  gstLabel,
  isGST,
  onToggleGST,
  totalRows,
  grandTotalLabel,
  grandTotalValue,
  onCancel,
  onSave,
  saving,
  cancelLabel,
  saveLabel,
  savingLabel,
  photoTitle,
  photoHint,
  photoPreparing = false,
  photoPreview = '',
  photoInputRef,
  onPhotoSelect,
  onPhotoRemove,
  photoTapLabel,
  photoHelpLabel,
  photoPreparingLabel,
  replacePhotoLabel,
  removePhotoLabel,
}) {
  return (
    <>
      <DocumentItemsCard
        title={itemsTitle}
        items={items}
        emptyText={emptyText}
        editable
        addLabel={addLabel}
        onAdd={onAddClick}
        onRemove={onRemoveItem}
        onDecreaseQty={onDecreaseQty}
        onIncreaseQty={onIncreaseQty}
        onPriceChange={onPriceChange}
        onPriceKeyDown={onPriceKeyDown}
      />

      {onPhotoSelect ? (
        <div className="card space-y-3">
          <p className="section-label mb-0">{photoTitle}</p>
          {photoHint ? <p className="-mt-2 text-xs text-gray-500">{photoHint}</p> : null}
          {photoPreparing ? (
            <div className="flex items-center gap-2 text-xs text-brand-mid">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-mid border-t-transparent" />
              {photoPreparingLabel}
            </div>
          ) : null}

          {photoPreview ? (
            <div className="space-y-3">
              <img
                src={photoPreview}
                alt={photoTitle}
                className="h-56 w-full rounded-xl border-2 border-gray-200 object-cover"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
                  onClick={() => photoInputRef?.current?.click()}
                >
                  {replacePhotoLabel}
                </button>
                <button
                  type="button"
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-red-500"
                  onClick={onPhotoRemove}
                >
                  {removePhotoLabel}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-6 text-gray-500 transition-colors hover:border-brand-mid hover:text-brand-mid active:bg-gray-50"
              onClick={() => photoInputRef?.current?.click()}
            >
              <Camera className="h-10 w-10" />
              <div className="text-center">
                <span className="block text-sm font-medium">{photoTapLabel}</span>
                {photoHelpLabel ? <span className="text-xs">{photoHelpLabel}</span> : null}
              </div>
            </button>
          )}

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhotoSelect}
          />
        </div>
      ) : null}

      <div className="card space-y-3">
        <div>
          <label className="section-label">{labourLabel}</label>
          <input
            type="tel"
            inputMode="decimal"
            className="input-field"
            placeholder={labourPlaceholder}
            value={labourValue}
            onChange={onLabourChange}
            onKeyDown={onLabourKeyDown}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <div
            className={`h-6 w-11 rounded-full transition-colors ${isGST ? 'bg-brand-mid' : 'bg-gray-300'}`}
            onClick={onToggleGST}
          >
            <div className={`mt-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isGST ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm font-medium">{gstLabel}</span>
        </label>
      </div>

      <DocumentTotalsCard
        rows={totalRows}
        grandTotalLabel={grandTotalLabel}
        grandTotalValue={grandTotalValue}
      />

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="btn-accent flex flex-grow items-center justify-center gap-2"
          onClick={onSave}
          disabled={saving}
        >
          <Check className="h-4 w-4" />
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </>
  );
}
