import type { Verdict } from '../types';

type Props = {
  verdict: Verdict | null;
  phone: string;
  note?: string;
  busy: boolean;
  onProveFence: () => void;
  fenceProved: boolean;
};

export function SheetPane({ verdict, phone, note, busy, onProveFence, fenceProved }: Props) {
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

        {!verdict ? (
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
            {verdict.accepted.length > 0 ? (
              <ol className="questions">
                {verdict.accepted.map((sentence, i) => (
                  <li className="question" key={`${sentence.text}-${i}`}>
                    <span>
                      {sentence.text}
                      {sentence.citation && (
                        <span className="question-cite">
                          {sentence.citation.startsWith('g-') ? 'gloss' : 'check'} ·{' '}
                          {sentence.citation}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="error">
                Every sentence was dropped by the fence. The template questions on the bill screen
                are still safe to use.
              </div>
            )}

            <div className="phone">
              <span className="phone-label">Billing office</span>
              <span className="phone-number">{phone || '—'}</span>
            </div>

            <p className="sheet-note">
              Filled in from the bill, on this computer, after the cloud draft came back. The phone
              number was never in the packet.
            </p>

            <div className="fence">
              <div className="fence-head">
                <span>Citation fence</span>
                <span>
                  {verdict.accepted.length} kept · {verdict.dropped.length} dropped
                </span>
              </div>
              {verdict.dropped.length === 0 ? (
                <div className="fence-empty">
                  Every sentence used a number, code, or gloss that was already in the packet.
                </div>
              ) : (
                verdict.dropped.map((d, i) => (
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
          A reading aid, not medical, legal, or financial advice. Callsheet does not tell you to pay
          or not to pay. It helps you ask better questions.
        </p>
      </div>
    </section>
  );
}
