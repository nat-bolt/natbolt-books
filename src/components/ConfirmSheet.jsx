import { AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';

const TONE_STYLES = {
  danger: {
    iconWrap: 'bg-red-100 text-red-600',
    confirmClass: 'btn-danger',
  },
  warning: {
    iconWrap: 'bg-amber-100 text-amber-600',
    confirmClass: 'bg-amber-500 text-white',
  },
  neutral: {
    iconWrap: 'bg-gray-100 text-gray-600',
    confirmClass: 'btn-primary',
  },
};

export default function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'danger',
}) {
  if (!open) return null;

  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.danger;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-white px-5 pt-4 shadow-2xl"
        style={{
          maxHeight: 'calc(var(--app-height, 100dvh) - var(--safe-top, 0px) - 24px)',
          paddingBottom: 'calc(var(--safe-bottom, 8px) + 20px)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200" />
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneStyle.iconWrap}`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-brand-dark">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{body}</p>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-600"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`flex-1 rounded-2xl py-3 text-sm font-semibold ${toneStyle.confirmClass}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
