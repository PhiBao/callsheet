import type { ClientKind } from '../lib/ai';

type Props = {
  clientKind: ClientKind;
  clientLabel: string;
  stage: string;
  captured: boolean;
  onReset: () => void;
};

export function Masthead({ clientKind, clientLabel, stage, captured, onReset }: Props) {
  return (
    <header className="masthead">
      <div className="brand">
        <svg
          className="brand-mark"
          viewBox="0 0 32 32"
          role="img"
          aria-label="Callsheet mark"
        >
          <path d="M4 2h15l9 9v19H4z" fill="#fffdf8" stroke="#1c1915" strokeWidth="1.6" />
          <path d="M19 2v9h9" fill="none" stroke="#1c1915" strokeWidth="1.6" />
          <line x1="8" y1="17" x2="24" y2="17" stroke="#1f4e5f" strokeWidth="2.2" />
          <line x1="8" y1="22" x2="19" y2="22" stroke="#9c3412" strokeWidth="2.2" />
        </svg>
        <div>
          <div className="wordmark">Callsheet</div>
          <div className="tagline">A bill, turned into the call you should make</div>
        </div>
      </div>

      <div className="masthead-meta">
        <span className="pill pill--synthetic">Synthetic demo</span>
        {captured && <span className="pill pill--local">Captured trace</span>}
        <span className={`pill ${clientKind === 'firebase' ? 'pill--live' : 'pill--local'}`}>
          {clientLabel}
        </span>
        {stage !== 'idle' && (
          <button className="button button--ghost" onClick={onReset} style={{ padding: '6px 10px' }}>
            Start over
          </button>
        )}
      </div>
    </header>
  );
}
