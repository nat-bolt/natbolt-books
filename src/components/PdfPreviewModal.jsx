import { Download, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PdfPreviewModal({
  open,
  previewImageUrl,
  loading,
  onClose,
  onDownload,
}) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/55 flex flex-col min-h-0" style={{ height: 'var(--app-height, 100dvh)' }}>
      <div
        className="mx-auto w-full max-w-lg bg-white px-4 pb-3 pt-3 shrink-0 shadow-sm"
        style={{
          paddingTop: 'calc(var(--safe-top) + 50px)',
          minHeight: 'calc(var(--header-base-height) + var(--safe-top) + 12px)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-mid/20 bg-white text-brand-mid"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
            <span className="sr-only">{t('common.close')}</span>
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-bold text-brand-dark">{t('bill.viewPdf')}</p>
          <button
            type="button"
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-mid px-4 text-sm font-semibold text-white disabled:opacity-60"
            onClick={onDownload}
            disabled={!previewImageUrl || loading}
          >
            <Download className="w-4 h-4" />
            {t('bill.downloadPdf')}
          </button>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 bg-gray-100 overflow-y-auto"
        style={{ paddingBottom: 'calc(var(--screen-page-bottom) + 8px)' }}
      >
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-brand-dark">
            <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">{t('common.loading')}</p>
          </div>
        ) : previewImageUrl ? (
          <div className="mx-auto w-full max-w-lg px-3 pt-5 pb-6">
            <div className="mx-auto max-w-full rounded-[28px] bg-white shadow-lg border border-gray-200 p-3">
              <img
                src={previewImageUrl}
                alt={t('bill.viewPdf')}
                className="w-full h-auto rounded-2xl border border-gray-200 bg-white block"
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center px-6 text-center text-sm text-gray-500">
            {t('common.error')}
          </div>
        )}
      </div>
    </div>
  );
}
