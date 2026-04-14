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
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col min-h-0" style={{ height: 'var(--app-height, 100dvh)' }}>
      <div
        className="bg-white px-4 pb-3 border-b border-gray-200 sticky top-0 z-10 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            className="btn-secondary !px-3 !py-2 text-sm"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
            <span className="sr-only">{t('common.close')}</span>
          </button>
          <button
            className="btn-primary !px-4 !py-2 text-sm flex items-center gap-1.5"
            onClick={onDownload}
            disabled={!previewImageUrl || loading}
          >
            <Download className="w-4 h-4" />
            {t('bill.downloadPdf')}
          </button>
        </div>
        <p className="mt-3 text-sm font-bold text-brand-dark truncate">{t('bill.viewPdf')}</p>
      </div>

      <div
        className="flex-1 min-h-0 bg-gray-100 overflow-y-auto"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 4px)' }}
      >
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-brand-dark">
            <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">{t('common.loading')}</p>
          </div>
        ) : previewImageUrl ? (
          <div className="px-3 py-3">
            <img
              src={previewImageUrl}
              alt={t('bill.viewPdf')}
              className="w-full h-auto rounded-2xl shadow-md border border-gray-200 bg-white"
            />
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
