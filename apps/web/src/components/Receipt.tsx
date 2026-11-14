import type { InferenceSource } from '../types';

type Props = {
  packetHash: string | null;
  readSource: InferenceSource | null;
  scriptSource: InferenceSource | null;
  checkIds: string[];
  accepted: number;
  dropped: number;
  receiptId: string | null;
};

function sourceLabel(source: InferenceSource | null): string {
  switch (source) {
    case 'ON_DEVICE':
      return 'on_device';
    case 'IN_CLOUD':
      return 'in_cloud';
    case 'LOCAL_ON_DEVICE':
      return 'local/on_device';
    case 'LOCAL_CLOUD':
      return 'local/template';
    case 'CAPTURED_ON_DEVICE':
      return 'captured/on_device';
    default:
      return '—';
  }
}

function checkLabel(id: string): string {
  if (id === 'total-mismatch') return 'total';
  if (id.startsWith('duplicate-')) return 'duplicate';
  if (id === 'total-billed-mismatch') return 'billed';
  if (id === 'total-patient-mismatch') return 'patient';
  return id;
}

export function Receipt({
  packetHash,
  readSource,
  scriptSource,
  checkIds,
  accepted,
  dropped,
  receiptId,
}: Props) {
  return (
    <section className="receipt" aria-label="Proof receipt">
      <div>
        <div className="receipt-title">Proof, not a claim</div>
        <div className="receipt-hash">
          {packetHash ? `packet sha256 ${packetHash}` : 'The packet hash appears after the read.'}
        </div>
      </div>
      <div className="receipt-grid">
        <div className="receipt-item">
          <dt>Read source</dt>
          <dd className={readSource === 'ON_DEVICE' || readSource === 'LOCAL_ON_DEVICE' ? 'good' : ''}>
            {sourceLabel(readSource)}
          </dd>
        </div>
        <div className="receipt-item">
          <dt>Write source</dt>
          <dd>{sourceLabel(scriptSource)}</dd>
        </div>
        <div className="receipt-item">
          <dt>Checks</dt>
          <dd>{checkIds.length ? checkIds.map(checkLabel).join(' · ') : '—'}</dd>
        </div>
        <div className="receipt-item">
          <dt>Fence</dt>
          <dd className={dropped > 0 ? 'signal' : 'good'}>
            {accepted} kept · {dropped} dropped
          </dd>
        </div>
        <div className="receipt-item">
          <dt>Receipt</dt>
          <dd>{receiptId ?? 'local only'}</dd>
        </div>
      </div>
    </section>
  );
}
