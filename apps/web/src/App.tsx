import { useEffect, useMemo, useState } from 'react';
import { Masthead } from './components/Masthead';
import { BillPane } from './components/BillPane';
import { SlotPane } from './components/SlotPane';
import { SheetPane } from './components/SheetPane';
import { Receipt } from './components/Receipt';
import { getClient } from './lib/ai';
import { GLOSS_REFS, GLOSSARY_VERSION } from './lib/glossary';
import { loadRules, sha256Hex, type Rules } from './lib/rules';
import { readAndSeal, writeAndVerify, type ScriptRun } from './lib/pipeline';
import { SAMPLE_BILL_TEXT, SAMPLE_EXTRACTION, CAPTURED_READ } from './lib/sample';
import type { Extraction, SealedPacket } from './types';

type Stage = 'idle' | 'reading' | 'review' | 'writing' | 'done' | 'error';

export default function App() {
  const client = useMemo(() => getClient(), []);
  const [rules, setRules] = useState<Rules | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [extraction, setExtraction] = useState<Extraction>(SAMPLE_EXTRACTION);
  const [packet, setPacket] = useState<SealedPacket | null>(null);
  const [packetHash, setPacketHash] = useState<string | null>(null);
  const [readSource, setReadSource] = useState<import('./types').InferenceSource | null>(null);
  const [script, setScript] = useState<ScriptRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [fenceProved, setFenceProved] = useState(false);
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    let live = true;
    loadRules()
      .then((r) => {
        if (live) setRules(r);
      })
      .catch((e: unknown) => {
        if (live) setRulesError(String(e instanceof Error ? e.message : e));
      });
    return () => {
      live = false;
    };
  }, []);

  async function handleRead() {
    if (!rules) {
      setError('The rules engine is still loading. Try again in a moment.');
      return;
    }
    setStage('reading');
    setError(null);
    setScript(null);
    setReceiptId(null);
    try {
      const run = await readAndSeal(client, rules, SAMPLE_BILL_TEXT, GLOSS_REFS);
      if (run.read.source === 'IN_CLOUD') {
        setError(
          'The SDK returned a cloud read for a private document. That must not happen with ONLY_ON_DEVICE. The run is treated as failed, and the packet was not sent.',
        );
        setStage('error');
        return;
      }
      setExtraction(run.read.extraction);
      setPacket(run.packet);
      setPacketHash(run.packetHash);
      setReadSource(run.read.source);
      setCaptured(false);
      setStage('review');
    } catch (e) {
      console.error('on-device read failed', e);
      setError(
        e instanceof Error
          ? e.message
          : 'The on-device read failed. The bill was not uploaded and no cloud fallback was attempted.',
      );
      setStage('error');
    }
  }

  async function handleWrite() {
    if (!rules || !packet) return;
    setStage('writing');
    setError(null);
    try {
      const run = await writeAndVerify(client, rules, packet, extraction);
      setScript({ ...run, note: captured ? CAPTURED_READ.note : run.note });
      setStage('done');
      if (packetHash) {
        const id = await client.recordReceipt({
          packetHash,
          readSource: readSource ?? 'ON_DEVICE',
          scriptSource: run.source,
          checkIds: packet.checks.map((c) => c.id),
          accepted: run.verdict.accepted.length,
          dropped: run.verdict.dropped.length,
          glossaryVersion: GLOSSARY_VERSION,
        });
        setReceiptId(id);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'The writing step failed. The packet was sealed, but the cloud did not answer.',
      );
      setStage('review');
    }
  }

  function handleReset() {
    setStage('idle');
    setExtraction(SAMPLE_EXTRACTION);
    setPacket(null);
    setPacketHash(null);
    setReadSource(null);
    setScript(null);
    setError(null);
    setReceiptId(null);
    setFenceProved(false);
    setCaptured(false);
  }

  async function handleCapturedRead() {
    if (!rules) return;
    setStage('reading');
    setError(null);
    setScript(null);
    setReceiptId(null);
    setFenceProved(false);
    setExtraction(CAPTURED_READ.extraction);
    const sealed = rules.seal(CAPTURED_READ.extraction, GLOSS_REFS);
    const hash = await sha256Hex(JSON.stringify(sealed));
    setPacket(sealed);
    setPacketHash(hash);
    setReadSource('CAPTURED_ON_DEVICE');
    setCaptured(true);
    setStage('review');
  }

  function handleProveFence() {
    if (!rules || !packet || !script) return;
    const planted = {
      sentences: [
        ...script.draft.sentences,
        {
          text: 'You should also ask about the $999.00 facility fee on this bill.',
          citation: null,
        },
        {
          text: 'Alex Rivera should call the number on the back of the card.',
          citation: null,
        },
      ],
    };
    const verdict = rules.verify(packet, extraction, planted);
    setScript({ ...script, verdict });
    setFenceProved(true);
  }

  const checks = packet?.checks ?? [];
  const phone = extraction.private.provider_phone || SAMPLE_EXTRACTION.private.provider_phone;

  return (
    <div className="app">
      <Masthead
        clientKind={client.kind}
        clientLabel={client.label}
        stage={stage}
        captured={captured}
        onReset={handleReset}
      />

      <section className="intro">
        <h1>The bill is not the problem. The call is.</h1>
        <p>
          Callsheet reads an explanation of benefits on your own computer, checks the arithmetic,
          and writes the questions to ask the billing office. The name and member ID stay in the
          browser.
        </p>
      </section>

      {rulesError && (
        <div className="error" style={{ marginBottom: 16 }}>
          The rules engine did not load: {rulesError}. Run{' '}
          <code>wasm-pack build crates/callsheet-rules --target web --out-dir ../../apps/web/src/wasm</code>{' '}
          and reload.
        </div>
      )}

      {error && (
        <div className="error" style={{ marginBottom: 16 }} role="alert">
          <div>{error}</div>
          <button
            className="button button--ghost"
            onClick={handleCapturedRead}
            disabled={!rules}
            style={{ marginTop: 10, padding: '6px 10px', fontSize: 11 }}
          >
            Use the captured on-device read (not a live run)
          </button>
        </div>
      )}

      {client.kind === 'local' && (
        <div
          className="status"
          style={{ marginBottom: 14, borderTop: '1px solid var(--rule)', paddingTop: 12 }}
        >
          <span className="status-dot" style={{ background: 'var(--ink-faint)' }} />
          Local development mode: raw Chrome Prompt API for the read, template questions for the
          write. Add <code>VITE_FIREBASE_CONFIG</code> for the Firebase AI Logic submission path.
        </div>
      )}

      <main className="desk">
        <BillPane
          extraction={extraction}
          checks={checks}
          onRead={handleRead}
          busy={stage === 'reading'}
          done={stage !== 'idle' && stage !== 'error'}
          captured={captured}
        />
        <SlotPane
          packet={packet}
          packetHash={packetHash}
          extraction={extraction}
          onWrite={handleWrite}
          busy={stage === 'writing'}
          done={stage === 'done'}
        />
        <SheetPane
          verdict={script?.verdict ?? null}
          phone={phone}
          note={script?.note}
          busy={stage === 'writing'}
          onProveFence={handleProveFence}
          fenceProved={fenceProved}
        />
      </main>

      <Receipt
        packetHash={packetHash}
        readSource={readSource}
        scriptSource={script?.source ?? null}
        checkIds={checks.map((c) => c.id)}
        accepted={script?.verdict.accepted.length ?? 0}
        dropped={script?.verdict.dropped.length ?? 0}
        receiptId={receiptId}
      />

      <footer className="footer">
        <p>
          <strong>What is real:</strong> the on-device read, the Rust checks, the citation fence, the
          packet hash, and the receipt. <strong>What is not:</strong> negotiation, fair-price
          benchmarks, charity-care eligibility, or a diagnosis. The sample bill is synthetic.
        </p>
        <p>
          A reading aid, not medical, legal, or financial advice. Built for #BuildHybridAI 2026.
        </p>
      </footer>
    </div>
  );
}
