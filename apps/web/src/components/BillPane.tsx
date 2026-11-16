import type { Check, Extraction } from '../types';
import { formatMoney } from '../lib/format';

type Props = {
  extraction: Extraction;
  checks: Check[];
  onRead: () => void;
  busy: boolean;
  done: boolean;
  captured: boolean;
  rulesReady: boolean;
  synthetic: boolean;
  previewText?: string | null;
};

export function BillPane({
  extraction,
  checks,
  onRead,
  busy,
  done,
  captured,
  rulesReady,
  synthetic,
  previewText,
}: Props) {
  const flagged = new Set(
    checks.flatMap((c) => (c.id.startsWith('duplicate-') ? c.line_numbers : [])),
  );
  const totalMismatch = checks.some((c) => c.id === 'total-mismatch');
  const lineSum = extraction.lines.reduce((a, l) => a + l.patient_cents, 0);

  return (
    <section className="desk-col desk-col--bill" aria-labelledby="bill-heading">
      <div className="panel-head">
        <span className="panel-kicker">01 · The document</span>
        <h2 className="panel-title" id="bill-heading">
          Explanation of benefits
        </h2>
      </div>

      {previewText && !done ? (
        <pre className="document-preview">{previewText}</pre>
      ) : (
        <article className="bill" aria-label="Synthetic explanation of benefits">
        <header className="bill-head">
          <div className="bill-provider">{extraction.private.provider_name || 'Provider'}</div>
          <div className="bill-address">{extraction.private.service_address}</div>
          <div className="bill-address">Billing office {extraction.private.provider_phone}</div>
          <div className="bill-synthetic">
            {synthetic
              ? 'Synthetic demonstration · not a real patient'
              : 'Read in this tab · nothing uploaded'}
          </div>
        </header>

        <dl className="bill-meta">
          <div>
            <dt>Patient</dt>
            <dd>{extraction.private.patient_name}</dd>
          </div>
          <div>
            <dt>Member ID</dt>
            <dd>{extraction.private.member_id}</dd>
          </div>
          <div>
            <dt>Account</dt>
            <dd>{extraction.private.account_number}</dd>
          </div>
          <div>
            <dt>Claim</dt>
            <dd>{extraction.claim_number ?? '—'}</dd>
          </div>
          <div>
            <dt>Date of service</dt>
            <dd>{extraction.lines[0]?.date ?? '—'}</dd>
          </div>
        </dl>

        <div className="bill-table-wrap">
          <table className="bill-table">
            <thead>
              <tr>
                <th>Line</th>
                <th>Code</th>
                <th>Description</th>
                <th>Billed</th>
                <th>Plan</th>
                <th>You</th>
              </tr>
            </thead>
            <tbody>
              {extraction.lines.map((line) => (
                <tr
                  key={`${line.line}-${line.code}`}
                  className={flagged.has(line.line) ? 'bill-row--flag' : undefined}
                >
                  <td>{line.line}</td>
                  <td>{line.code}</td>
                  <td>{line.description}</td>
                  <td>{formatMoney(line.billed_cents)}</td>
                  <td>{formatMoney(line.plan_paid_cents)}</td>
                  <td>{formatMoney(line.patient_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="bill-summary">
          <dt>Total billed</dt>
          <dd>{formatMoney(extraction.printed_total_billed_cents ?? 0)}</dd>
          <dt>Total patient responsibility on the lines</dt>
          <dd>{formatMoney(lineSum)}</dd>
        </dl>

        <div className={`bill-due ${totalMismatch ? 'bill-due--flag' : ''}`}>
          <span className="bill-due-label">Amount due from patient</span>
          <span className="bill-due-value">{formatMoney(extraction.printed_amount_due_cents)}</span>
        </div>

        <div className="bill-foot">
          Remit to {extraction.private.provider_name}, PO Box 4410, Springfield. Include the account
          number.
        </div>
        </article>
      )}

      <div className="status status--busy" aria-live="polite" style={{ marginTop: 16 }}>
        {!rulesReady ? (
          <>
            <span className="status-dot" />
            Loading the rules engine…
          </>
        ) : busy ? (
          <>
            <span className="status-dot" />
            Reading on this computer. The first prompt can take twenty seconds.
          </>
        ) : captured ? (
          <>
            <span className="status-dot" style={{ background: 'var(--signal)' }} />
            Captured on-device read. Not a live run.
          </>
        ) : done ? (
          <>
            <span className="status-dot" />
            Read on this computer. Nothing was uploaded.
          </>
        ) : (
          <>
            <span className="status-dot" />
            Ready. The bill has not been read yet.
          </>
        )}
      </div>

      <button
        className="button button--wide"
        onClick={onRead}
        disabled={!rulesReady || busy || (done && !captured)}
        style={{ marginTop: 10 }}
      >
        {!rulesReady
          ? 'Loading the rules engine…'
          : captured
            ? busy
              ? 'Reading…'
              : 'Try a live read'
            : done
              ? 'Bill read'
              : busy
                ? 'Reading…'
                : 'Read it on this computer'}
      </button>
    </section>
  );
}
