import { useRef, useState } from 'react';
import { extractPdfText } from '../lib/pdf';

type Props = {
  mode: 'sample' | 'paste' | 'pdf';
  onSample: () => void;
  onPaste: (text: string) => void;
  onPdf: (text: string, name: string) => void;
  pasteText: string;
  onPasteChange: (value: string) => void;
  fileName: string | null;
  disabled: boolean;
};

export function SourceBar({
  mode,
  onSample,
  onPaste,
  onPdf,
  pasteText,
  onPasteChange,
  fileName,
  disabled,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) {
        setPdfError('No text was found in that PDF. It may be a scan; paste the text instead.');
        return;
      }
      onPdf(text, file.name);
    } catch {
      setPdfError('That PDF could not be read. Paste the text instead.');
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <section className="source" aria-label="Document source">
      <div className="source-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === 'sample'}
          className={`source-tab ${mode === 'sample' ? 'source-tab--active' : ''}`}
          onClick={onSample}
          disabled={disabled}
        >
          Sample bill
        </button>
        <button
          role="tab"
          aria-selected={mode === 'paste'}
          className={`source-tab ${mode === 'paste' ? 'source-tab--active' : ''}`}
          onClick={() => onPaste(pasteText)}
          disabled={disabled}
        >
          Paste text
        </button>
        <button
          role="tab"
          aria-selected={mode === 'pdf'}
          className={`source-tab ${mode === 'pdf' ? 'source-tab--active' : ''}`}
          onClick={() => fileRef.current?.click()}
          disabled={disabled || pdfBusy}
        >
          {pdfBusy ? 'Reading PDF…' : 'Upload PDF'}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="source-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void handleFile(file);
        }}
      />

      {mode === 'paste' && (
        <div className="source-panel">
          <label className="source-label" htmlFor="paste-area">
            Paste the bill or explanation of benefits text
          </label>
          <textarea
            id="paste-area"
            className="paste-area"
            value={pasteText}
            onChange={(e) => onPasteChange(e.target.value)}
            placeholder={'Patient: …\nMember ID: …\nLine  Date  Code  Description  Billed  Allowed  Plan paid  You owe\n1  2026-10-02  99213  Office visit  $180.00  $128.00  $102.00  $26.00\n…\nAmount due from patient: $146.00'}
            spellCheck={false}
          />
          <div className="source-hint">
            Stays in this tab. Nothing is uploaded until you press “Read it on this computer”.
          </div>
        </div>
      )}

      {mode === 'pdf' && (
        <div className="source-panel">
          <div className="source-label">
            {fileName ? `PDF loaded: ${fileName}` : 'Choose a PDF to read its text'}
          </div>
          {pdfError && <div className="source-error">{pdfError}</div>}
          <div className="source-hint">
            The PDF is read in this tab. Scanned PDFs need the text pasted instead.
          </div>
        </div>
      )}
    </section>
  );
}
