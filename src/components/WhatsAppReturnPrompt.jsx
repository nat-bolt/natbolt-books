export default function WhatsAppReturnPrompt({
  open,
  loading,
  title = 'Message sent?',
  description = 'Share the PDF with the customer now.',
  actionLabel = 'Share PDF',
  dismissLabel = 'Later',
  onAction,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-brand-dark">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
        <div className="mt-4 flex gap-3">
          <button
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600"
            onClick={onClose}
            disabled={loading}
          >
            {dismissLabel}
          </button>
          <button
            className="flex-1 btn-primary text-sm"
            onClick={onAction}
            disabled={loading}
          >
            {loading ? '…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
