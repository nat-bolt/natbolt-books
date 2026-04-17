import BillPreviewSheet from './BillPreviewSheet';
import PdfPreviewModal from './PdfPreviewModal';
import WhatsAppReturnPrompt from './WhatsAppReturnPrompt';

export default function DocumentPreviewLayer({
  bill,
  shop,
  customer,
  t,
  language,
  previewAssets,
  previewRef,
  showPdfPreview,
  pdfPreviewImage,
  pdfLoading,
  onClosePreview,
  onDownloadPreview,
  showWhatsAppReturnPrompt,
  onSharePdfAfterWhatsApp,
  onCloseWhatsAppPrompt,
}) {
  return (
    <>
      <PdfPreviewModal
        open={showPdfPreview}
        previewImageUrl={pdfPreviewImage}
        loading={pdfLoading}
        onClose={onClosePreview}
        onDownload={onDownloadPreview}
      />
      <WhatsAppReturnPrompt
        open={showWhatsAppReturnPrompt}
        loading={pdfLoading}
        onAction={onSharePdfAfterWhatsApp}
        onClose={onCloseWhatsAppPrompt}
      />

      {bill && shop ? (
        <div className="pointer-events-none fixed left-[-10000px] top-0">
          <div ref={previewRef}>
            <BillPreviewSheet
              bill={bill}
              shop={shop}
              customer={customer}
              t={t}
              lang={language}
              previewAssets={previewAssets}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
