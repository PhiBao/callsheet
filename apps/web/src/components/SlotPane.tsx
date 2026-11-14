import type { Extraction, SealedPacket } from '../types';
import { formatMoney, shortDate } from '../lib/format';

type Props = {
  packet: SealedPacket | null;
  packetHash: string | null;
  extraction: Extraction;
  onWrite: () => void;
  busy: boolean;
  done: boolean;
};

export function SlotPane({ packet, packetHash, extraction, onWrite, busy, done }: Props) {
  return (
    <section className="desk-col desk-col--slot" aria-labelledby="slot-heading">
      <div className="slot">
        <div>
          <div className="panel-head panel-head--stack" style={{ marginBottom: 10 }}>
            <span className="panel-kicker">02 · The boundary</span>
            <h2 className="panel-title" id="slot-heading">
              What crosses
            </h2>
          </div>
          <div className="slot-rule">
            <span className="slot-dot" />
          </div>
        </div>

        {!packet ? (
          <>
            <p className="slot-copy">
              Nothing has crossed yet. The read happens on this computer. When it is done, this
              column shows the exact packet the cloud is allowed to see.
            </p>
            <div className="packet">
              <div className="packet-head">
                <span>Sealed packet</span>
                <span>empty</span>
              </div>
              <div className="packet-empty">No bytes prepared.</div>
            </div>
          </>
        ) : (
          <>
            <p className="slot-copy">
              The bill stayed here. Only these codes, dates, and amounts are allowed to leave.
            </p>
            <div className="packet">
              <div className="packet-head">
                <span>Sealed packet</span>
                <span>{packet.lines.length} lines</span>
              </div>
              <div className="packet-row">
                <span>printed_due</span>
                <span>{formatMoney(packet.printed_amount_due_cents)}</span>
              </div>
              {packet.lines.map((line, i) => (
                <div className="packet-row" key={`${line.code}-${i}`}>
                  <span>
                    {line.code} · {shortDate(line.date)}
                  </span>
                  <span>you {formatMoney(line.patient_cents)}</span>
                </div>
              ))}
              <div className="packet-row">
                <span>checks</span>
                <span>{packet.checks.length}</span>
              </div>
              <div className="packet-row">
                <span>gloss</span>
                <span>{packet.glossary.length}</span>
              </div>
            </div>

            <div className="excluded">
              <div className="excluded-label">Kept on this computer</div>
              <dl className="kept-list">
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
                  <dt>Phone</dt>
                  <dd>{extraction.private.provider_phone}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{extraction.private.service_address}</dd>
                </div>
              </dl>
            </div>

            <div className="excluded">
              <div className="excluded-label">Allowed to cross</div>
              <div className="excluded-list">
                {packet.glossary.map((g) => (
                  <span className="chip chip--kept" key={g.gloss_id}>
                    {g.code}
                  </span>
                ))}
              </div>
            </div>

            {packetHash && (
              <div className="receipt-hash" title="SHA-256 of the packet">
                sha256 · {packetHash.slice(0, 24)}…
              </div>
            )}

            <button
              className="button button--wide"
              onClick={onWrite}
              disabled={busy || done}
              style={{ marginTop: 2 }}
            >
              {done ? 'Questions written' : busy ? 'Writing…' : 'Write the questions'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
