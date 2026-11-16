# Callsheet — build goal

**Goal (2026-11-16):** Turn the verified hybrid demo into a product a judge can test on
their own document. The thesis is unchanged — a private on-device read, a sealed packet,
a verdict the model cannot change, a call sheet with the phone filled in locally. The
weakness is the surface: one hard-coded synthetic bill.

**Strengthening plan (from the deep product review):**

1. **Phase 1 — Own-document input.** Paste text, local PDF text, a deterministic local
   parser fallback, an extraction review step before sealing, Nano preflight, timeout and
   cancel. Done when a judge on a browser without Nano finishes the full loop with their
   own pasted EOB.
2. **Phase 2 — The sheet is worth calling with.** Locally-filled opener, questions ordered
   by dollar impact, write-this-down section, print/copy/download. Show `Allowed` and
   `Date`. Per-line allowed-identity check and a clean-bill scenario.
3. **Phase 3 — The fence matches the pitch.** Per-line tuple validation, deterministic
   gloss text, date whitelist, normalized PII matching, advice blocklist, no free-text
   descriptions in the packet, ~20 adversarial fence tests. Real Remote Config or remove
   the claim. Dead auth removed. App Check enforcement confirmed.
4. **Phase 4 — Reliability and feel.** Honest progress and elapsed times, plain-language
   error taxonomy, mobile pass, duplicate rows labeled in words, not color alone.
5. **Phase 5 — Freeze.** Judge-device matrix, five synthetic bills scored for extraction
   accuracy, latency budget measured, then freeze features.

**Explicit non-goals:** Android/iOS, negotiation, fair-price data, accounts, chat, a copied
CPT glossary, a generic redactor.

**Hard deadline:** submissions close 2026-11-30 14:00 PT. Repo commits after that are not
evaluated. Target freeze: 2026-11-27.

## Build ledger

| Date | State | Next |
| --- | --- | --- |
| 2026-11-14 | Discovery approved. Repo empty. Chrome for Testing 149 present. Rust nightly + wasm32-unknown-unknown present. | Nano spike. |
| 2026-11-14 | Chrome for Testing cannot fetch the model component. Full Chrome stable downloads it. `LanguageModel.prompt` returned `ready`. | Build the rules crate and the desk. |
| 2026-11-14 | Rust rules crate: 9 tests pass. WASM built. Vite/React/TS app renders the bill, the boundary, and the sheet. | Wire the real read. |
| 2026-11-14 | Real on-device read through the raw Prompt API works end to end: 5 lines, `$146.00`, duplicate 99213, `$36.00` difference. Citation fence keeps 7, drops a planted `$999.00` and a patient name. Production build passes the same flow. | Firebase project, App Check, hosted URL, video. |
| 2026-11-15 | Firebase project `callsheet-hybrid` created. AI Logic config, App Check app registration with reCAPTCHA Enterprise, Firestore, and Hosting are live. The hosted app shows `READ SOURCE on_device`, `WRITE SOURCE in_cloud`, a Firestore receipt id, and the fence proof. The 2:18 demo is in `docs/video/callsheet-demo.mp4`. | Upload the video to YouTube, submit on Devpost. |
| 2026-11-16 | Deep product review. Verified the loop is real; the surface is one hard-coded synthetic bill. Plan: own-document input, extraction review, relational fence, printable sheet, real Remote Config. | Phase 1: paste/PDF input, local parser fallback, preflight. |
| 2026-11-16 | Phase 1 done. Paste-text and PDF sources, deterministic local parser fallback (13 TS tests), extraction review with editing, Nano preflight pill, honest source labels. A judge-supplied EOB reads on-device, seals, writes in-cloud, and writes a Firestore receipt. Fixed the `"null"` citation fence bug (Rust 11/11). | Phase 2: printable call sheet. |
| 2026-11-16 | Phase 2 done. The sheet is a call sheet: locally-filled opener, questions ordered by dollar impact, write-this-down section, print/copy/download, and a print stylesheet that shows only the sheet. Provider and address are now editable in the review. | Phase 3: relational fence. |
| 2026-11-16 | Phase 3 done. The fence now binds a code to its own amounts, whitelists dates, normalizes phone and member-id digits, blocks imperative advice, drops free-text descriptions from the packet, and appends glosses on the device instead of letting the model write them. 16 Rust tests; the live proof drops all four planted attacks. | Phase 4: reliability, Remote Config, mobile. |
