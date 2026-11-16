import type { Check, Extraction } from '../types';

type Props = {
  extraction: Extraction;
  checks: Check[];
  onSeal: () => void;
  onParse: () => void;
  onEdit: (extraction: Extraction) => void;
};

/**
 * The gate between the model and the packet. The user sees and can correct
 * exactly what was read before anything is sealed. A wrong extraction must
 * never become a wrong question.
 */
export function ReviewPane({ extraction, checks, onSeal, onParse, onEdit }: Props) {
  function updateLine(index: number, key: keyof Extraction['lines'][number], value: string) {
    const lines = extraction.lines.map((line, i) =>
      i === index
        ? { ...line, [key]: key.endsWith('_cents') ? Number(value) * 100 || 0 : value }
        : line,
    );
    onEdit({ ...extraction, lines });
  }

  function updatePrivate(key: keyof Extraction['private'], value: string) {
    onEdit({ ...extraction, private: { ...extraction.private, [key]: value } });
  }

  return (
    <section className="desk-col desk-col--slot" aria-labelledby="review-heading">
      <div className="slot">
        <div className="panel-head panel-head--stack" style={{ marginBottom: 10 }}>
          <span className="panel-kicker">02 · The boundary</span>
          <h2 className="panel-title" id="review-heading">
            Check the read
          </h2>
        </div>
        <p className="slot-copy">
          What the on-device model read. Correct anything wrong; the packet is built from these
          numbers, not from the original document.
        </p>

        <div className="line-cards">
          {extraction.lines.map((line, index) => (
            <div className="line-card" key={`${line.line}-${line.code}-${index}`}>
              <div className="line-card-head">
                <span>Line {line.line}</span>
                <span>{line.date}</span>
                <span className="line-card-code">{line.code}</span>
              </div>
              <input
                className="cell-input cell-input--text"
                value={line.description}
                onChange={(e) => updateLine(index, 'description', e.target.value)}
                aria-label={`Line ${line.line} description`}
              />
              <div className="line-amounts">
                <label>
                  Billed
                  <input
                    className="cell-input"
                    value={(line.billed_cents / 100).toFixed(2)}
                    onChange={(e) => updateLine(index, 'billed_cents', e.target.value)}
                    aria-label={`Line ${line.line} billed`}
                  />
                </label>
                <label>
                  Allowed
                  <input
                    className="cell-input"
                    value={(line.allowed_cents / 100).toFixed(2)}
                    onChange={(e) => updateLine(index, 'allowed_cents', e.target.value)}
                    aria-label={`Line ${line.line} allowed`}
                  />
                </label>
                <label>
                  Plan
                  <input
                    className="cell-input"
                    value={(line.plan_paid_cents / 100).toFixed(2)}
                    onChange={(e) => updateLine(index, 'plan_paid_cents', e.target.value)}
                    aria-label={`Line ${line.line} plan paid`}
                  />
                </label>
                <label>
                  You
                  <input
                    className="cell-input"
                    value={(line.patient_cents / 100).toFixed(2)}
                    onChange={(e) => updateLine(index, 'patient_cents', e.target.value)}
                    aria-label={`Line ${line.line} patient share`}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <dl className="review-private">
          <div>
            <dt>Patient</dt>
            <dd>
              <input
                className="cell-input cell-input--wide"
                value={extraction.private.patient_name}
                onChange={(e) => updatePrivate('patient_name', e.target.value)}
              />
            </dd>
          </div>
          <div>
            <dt>Member ID</dt>
            <dd>
              <input
                className="cell-input cell-input--wide"
                value={extraction.private.member_id}
                onChange={(e) => updatePrivate('member_id', e.target.value)}
              />
            </dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>
              <input
                className="cell-input cell-input--wide"
                value={extraction.private.provider_phone}
                onChange={(e) => updatePrivate('provider_phone', e.target.value)}
              />
            </dd>
          </div>
        </dl>

        {checks.length > 0 && (
          <div className="review-checks">
            {checks.map((check) => (
              <div className="review-check" key={check.id}>
                <span className={`review-check-dot review-check-dot--${check.severity}`} />
                {check.message}
              </div>
            ))}
          </div>
        )}

        <div className="review-actions">
          <button className="button button--wide" onClick={onSeal}>
            Looks right — seal the packet
          </button>
          <button className="button button--ghost button--wide" onClick={onParse}>
            Re-read with the local parser
          </button>
        </div>
        <div className="source-hint">
          “Re-read with the local parser” is a deterministic, non-AI fallback. It is labeled in the
          proof strip.
        </div>
      </div>
    </section>
  );
}
