import { useEffect, useRef } from 'react';
import type { Sheet } from '../lib/sheet';
import { sheetToText } from '../lib/sheet';
import type { Verdict } from '../types';

type Props = {
  sheet: Sheet | null;
  verdict: Verdict | null;
  note?: string;
  busy: boolean;
  onProveFence: () => void;
  fenceProved: boolean;
  onUseTemplate: () => void;
};

export function SheetPane({
  sheet,
  verdict,
  note,
  busy,
  onProveFence,
  fenceProved,
  onUseTemplate,
}: Props) {
  const fenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fenceProved) {
      fenceRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [fenceProved]);
  function handleCopy() {
    if (!sheet) return;
    void navigator.clipboard?.writeText(sheetToText(sheet)).catch(() => {});
  }

  function handleDownload() {
    if (!sheet) return;
    const blob = new Blob([sheetToText(sheet)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'callsheet.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="desk-col desk-col--sheet" aria-labelledby="sheet-heading">
      <div className="sheet">
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <span className="panel-kicker">03 · The call</span>
          <span className="panel-kicker">read aloud</span>
        </div>

        <div className="sheet-head">
          <h2 className="sheet-title" id="sheet-heading">
            Call the billing office
          </h2>
          <span className="sheet-sub">one page · no login</span>
        </div>

        {!sheet ? (
          <div className="sheet-empty">
            <strong>The sheet appears after the questions are written.</strong>
            <p>
              First the bill is read on this computer. Then the sealed packet is sent to the cloud.
              Then the Rust fence checks every sentence before it can reach this page.
            </p>
            {busy && (
              <div className="status status--busy" aria-live="polite">
                <span className="status-dot" />
                Writing from the sealed packet. This can take a few seconds.
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="sheet-actions no-print">
              <button className="button button--ghost" onClick={() => window.print()}>
                Print
              </button>
              <button className="button button--ghost" onClick={handleCopy}>
                Copy
              </button>
              <button className="button button--ghost" onClick={handleDownload}>
                Download
              </button>
            </div>

            <p className="sheet-opener">{sheet.opener}</p>

            {sheet.questions.length > 0 ? (
              <ol className="questions">
                {sheet.questions.map((question, i) => (
                  <li className="question" key={`${question}-${i}`}>
                    <span>{question}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="error">
                <div>
                  Every sentence was dropped by the fence. The deterministic questions built from
                  the packet are still safe to use.
                </div>
                <button
                  className="button button--ghost"
                  onClick={onUseTemplate}
                  style={{ marginTop: 10, padding: '6px 10px', fontSize: 11 }}
                >
                  Use the deterministic questions
                </button>
              </div>
            )}

            <dl className="write-down">
              {sheet.writeDown.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd />
                </div>
              ))}
            </dl>

            <div className="phone">
              <span className="phone-label">Billing office</span>
              <span className="phone-number">{sheet.phone}</span>
            </div>

            <p className="sheet-note">
              Filled in from the bill, on this computer, after the cloud draft came back. The phone
              number was never in the packet.
            </p>

            <div className="fence no-print" ref={fenceRef}>
              <div className="fence-head">
                <span>Citation fence</span>
                <span>
                  {verdict?.accepted.length ?? 0} kept · {verdict?.dropped.length ?? 0} dropped
                </span>
              </div>
              {verdict && verdict.dropped.length === 0 ? (
                <div className="fence-empty">
                  Every sentence used a number, code, or gloss that was already in the packet.
                </div>
              ) : (
                verdict?.dropped.map((d, i) => (
                  <div className="fence-item" key={`${d.text}-${i}`}>
                    <span>{d.text}</span>
                    <em>{d.reason}</em>
                  </div>
                ))
              )}
              {!fenceProved && (
                <button
                  className="button button--ghost"
                  onClick={onProveFence}
                  style={{ marginTop: 10, padding: '6px 10px', fontSize: 11 }}
                >
                  Prove the fence
                </button>
              )}
            </div>

            {note && <p className="sheet-note">{note}</p>}
          </>
        )}

        <p className="sheet-note" style={{ marginTop: 'auto' }}>
          {sheet?.disclaimer ?? 'A reading aid, not medical, legal, or financial advice.'}
        </p>
      </div>
    </section>
  );
}
