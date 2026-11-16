import { useEffect, useMemo, useState } from 'react';
import { Masthead } from './components/Masthead';
import { BillPane } from './components/BillPane';
import { SlotPane } from './components/SlotPane';
import { SheetPane } from './components/SheetPane';
import { Receipt } from './components/Receipt';
import { ReviewPane } from './components/ReviewPane';
import { SourceBar } from './components/SourceBar';
import { getClient, templateDraft } from './lib/ai';
import { GLOSS_REFS, GLOSSARY_VERSION } from './lib/glossary';
import { loadRules, sha256Hex, type Rules } from './lib/rules';
import { writeAndVerify, type ScriptRun } from './lib/pipeline';
import { SAMPLE_BILL_TEXT, SAMPLE_EXTRACTION, CAPTURED_READ } from './lib/sample';
import { parseEobText } from './lib/parse';
import { buildSheet } from './lib/sheet';
import type { Extraction, SealedPacket } from './types';

type Stage = 'idle' | 'reading' | 'review' | 'writing' | 'done' | 'error';
type SourceMode = 'sample' | 'paste' | 'pdf';
type ModelStatus = 'unknown' | 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'not-exposed';

export default function App() {
  const client = useMemo(() => getClient(), []);
  const [rules, setRules] = useState<Rules | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [extraction, setExtraction] = useState<Extraction>(SAMPLE_EXTRACTION);
  const [packet, setPacket] = useState<SealedPacket | null>(null);
  const [packetHash, setPacketHash] = useState<string | null>(null);
  const [readSource, setReadSource] = useState<
    import('./types').InferenceSource | null
  >(null);
  const [script, setScript] = useState<ScriptRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [fenceProved, setFenceProved] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('unknown');

  const [sourceMode, setSourceMode] = useState<SourceMode>('sample');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState<string>(SAMPLE_BILL_TEXT);

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

  useEffect(() => {
    const lm = window.LanguageModel;
    if (!lm) {
      setModelStatus('not-exposed');
      return;
    }
    lm.availability()
      .then((status) => setModelStatus(status as ModelStatus))
      .catch(() => setModelStatus('unavailable'));
  }, []);

  function resetDocument(nextMode: SourceMode, text: string, name: string | null) {
    setSourceMode(nextMode);
    setDocumentText(text);
    setFileName(name);
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

  function handleSample() {
    resetDocument('sample', SAMPLE_BILL_TEXT, null);
  }

  function handlePasteTab() {
    resetDocument('paste', pasteText, null);
  }

  function handlePasteChange(value: string) {
    setPasteText(value);
    if (sourceMode === 'paste') {
      setDocumentText(value);
      setStage('idle');
      setExtraction(SAMPLE_EXTRACTION);
      setPacket(null);
      setPacketHash(null);
      setScript(null);
      setError(null);
    }
  }

  function handlePdf(text: string, name: string) {
    resetDocument('pdf', text, name);
  }

  async function sealAndWrite(nextExtraction: Extraction) {
    if (!rules) return;
    const sealed = rules.seal(nextExtraction, GLOSS_REFS);
    const hash = await sha256Hex(JSON.stringify(sealed));
    setPacket(sealed);
    setPacketHash(hash);
    setStage('writing');
    setError(null);
    try {
      const run = await writeAndVerify(client, rules, sealed, nextExtraction);
      setScript({ ...run, note: captured ? CAPTURED_READ.note : run.note });
      setStage('done');
      const id = await client.recordReceipt({
        packetHash: hash,
        readSource: readSource ?? 'ON_DEVICE',
        scriptSource: run.source,
        checkIds: sealed.checks.map((c) => c.id),
        accepted: run.verdict.accepted.length,
        dropped: run.verdict.dropped.length,
        glossaryVersion: GLOSSARY_VERSION,
      });
      setReceiptId(id);
    } catch (e) {
      console.error('[callsheet] write failed', e);
      setError(
        e instanceof Error
          ? e.message
          : 'The writing step failed. The packet was sealed, but the cloud did not answer.',
      );
      setStage('review');
    }
  }

  async function handleRead() {
    if (!rules) {
      setError('The rules engine is still loading. Try again in a moment.');
      return;
    }
    if (!documentText.trim()) {
      setError('Paste a bill first, or use the sample bill.');
      return;
    }
    setStage('reading');
    setError(null);
    setScript(null);
    setReceiptId(null);
    setPacket(null);
    setPacketHash(null);
    setCaptured(false);
    try {
      const read = await client.readBill(documentText);
      if (read.source === 'IN_CLOUD') {
        setError(
          'The SDK returned a cloud read for a private document. That must not happen with ONLY_ON_DEVICE. The run is treated as failed, and the packet was not sent.',
        );
        setStage('error');
        return;
      }
      setExtraction(read.extraction);
      setReadSource(read.source);
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

  function handleParseFallback() {
    if (!rules) return;
    const parsed = parseEobText(documentText);
    if (parsed.lines.length === 0) {
      setError(
        'The local parser could not read that text. Paste a bill with a line table, or use the sample.',
      );
      return;
    }
    setExtraction(parsed);
    setReadSource('FIXTURE_PARSE');
    setCaptured(false);
    setError(null);
    void sealAndWrite(parsed);
  }

  function handleCapturedRead() {
    if (!rules) return;
    setStage('reading');
    setError(null);
    setScript(null);
    setReceiptId(null);
    setFenceProved(false);
    setExtraction(CAPTURED_READ.extraction);
    setReadSource('CAPTURED_ON_DEVICE');
    setCaptured(true);
    setStage('review');
  }

  function handleReset() {
    resetDocument('sample', SAMPLE_BILL_TEXT, null);
    setPasteText('');
  }

  function handleProveFence() {
    if (!rules || !packet || !script) return;
    const firstCode = packet.lines[0]?.code ?? '99213';
    const patient = extraction.private.patient_name || 'the patient';
    const phone = extraction.private.provider_phone || '555-014-2280';
    const planted = {
      sentences: [
        ...script.draft.sentences,
        {
          text: 'You should also ask about the $999.00 facility fee on this bill.',
          citation: null,
        },
        {
          text: `${patient} should call the number on the back of the card.`,
          citation: null,
        },
        {
          text: `Please call me back at ${phone.replace(/[^0-9]/g, '')}.`,
          citation: null,
        },
        {
          text: `Code ${firstCode} was also charged at $90.00.`,
          citation: null,
        },
      ],
    };
    const verdict = rules.verify(packet, extraction, planted);
    setScript({ ...script, verdict });
    setFenceProved(true);
  }

  function handleUseTemplate() {
    if (!rules || !packet) return;
    const draft = templateDraft(packet);
    const verdict = rules.verify(packet, extraction, draft);
    setScript({
      draft,
      verdict,
      source: 'LOCAL_CLOUD',
      elapsed_ms: 0,
      note: 'Deterministic questions built from the packet. No cloud call.',
    });
    setStage('done');
  }

  const checks = packet?.checks ?? [];
  const showReview = stage === 'review';
  const sheet = script && packet ? buildSheet(packet, script.verdict, extraction) : null;

  return (
    <div className="app">
      <Masthead
        clientKind={client.kind}
        clientLabel={client.label}
        stage={stage}
        captured={captured}
        modelStatus={modelStatus}
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

      <SourceBar
        mode={sourceMode}
        onSample={handleSample}
        onPaste={handlePasteTab}
        onPdf={handlePdf}
        pasteText={pasteText}
        onPasteChange={handlePasteChange}
        fileName={fileName}
        disabled={stage === 'reading' || stage === 'writing'}
      />

      {rulesError && (
        <div className="error" style={{ marginTop: 14 }}>
          The rules engine did not load: {rulesError}. Run{' '}
          <code>wasm-pack build crates/callsheet-rules --target web --out-dir ../../apps/web/src/wasm</code>{' '}
          and reload.
        </div>
      )}

      {error && (
        <div className="error" style={{ marginTop: 14 }} role="alert">
          <div>{error}</div>
          <div className="error-actions">
            <button
              className="button button--ghost"
              onClick={handleParseFallback}
              disabled={!rules}
              style={{ padding: '6px 10px', fontSize: 11 }}
            >
              Re-read with the local parser
            </button>
            <button
              className="button button--ghost"
              onClick={handleCapturedRead}
              disabled={!rules}
              style={{ padding: '6px 10px', fontSize: 11 }}
            >
              Use the captured on-device read
            </button>
          </div>
        </div>
      )}

      {client.kind === 'local' && (
        <div
          className="status"
          style={{ marginTop: 12, borderTop: '1px solid var(--rule)', paddingTop: 12 }}
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
          rulesReady={!!rules}
          synthetic={sourceMode === 'sample'}
          previewText={sourceMode === 'sample' ? null : documentText}
        />
        {showReview ? (
          <ReviewPane
            extraction={extraction}
            checks={checks}
            onSeal={() => void sealAndWrite(extraction)}
            onParse={handleParseFallback}
            onEdit={setExtraction}
          />
        ) : (
          <SlotPane
            packet={packet}
            packetHash={packetHash}
            extraction={extraction}
            onWrite={() => packet && void sealAndWrite(extraction)}
            busy={stage === 'writing'}
            done={stage === 'done'}
          />
        )}
        <SheetPane
          sheet={sheet}
          verdict={script?.verdict ?? null}
          note={script?.note}
          busy={stage === 'writing'}
          onProveFence={handleProveFence}
          fenceProved={fenceProved}
          onUseTemplate={handleUseTemplate}
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
