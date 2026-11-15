# Callsheet — build goal

**Goal:** Ship a submission-quality web app that reads a medical bill or EOB on the
user's own Chrome, checks it, and writes the questions to ask the billing office,
without the name or member ID leaving the browser. Enter it in #BuildHybridAI 2026
(Web/Chrome) for the Grand Prize and Best Web/Chrome.

**Definition of done:**

- On-device read through Firebase AI Logic, `ONLY_ON_DEVICE`, with the SDK's
  `inferenceSource` shown in the UI.
- Rust rules crate that checks duplicate lines and the printed total, compiled to
  WASM and used by the page.
- Sealed packet reviewed by the user; cloud prose only from that packet; citation
  fence drops anything new; local fill-in of the phone number.
- App Check, anonymous auth, Firestore receipt with no raw bill text, Remote Config.
- Hosted URL, Apache-2.0 public repo, README with a real/captured/absent table,
  two diagrams, deliberate favicon.
- A real on-device read is captured on video, or the blocker is reported.

**Non-goals:** iOS, Android in the MVP, generic redaction, chat, medical or legal
advice, fair-price estimates, charity-care determination, accounts beyond anonymous,
image generation or speech.

**Hard deadline:** submissions close 2026-11-30 14:00 PT. Repo commits after that are
not evaluated.

## Build ledger

| Date | State | Next |
| --- | --- | --- |
| 2026-11-14 | Discovery approved. Repo empty. Chrome for Testing 149 present. Rust nightly + wasm32-unknown-unknown present. | Nano spike. |
| 2026-11-14 | Chrome for Testing cannot fetch the model component. Full Chrome stable downloads it. `LanguageModel.prompt` returned `ready`. | Build the rules crate and the desk. |
| 2026-11-14 | Rust rules crate: 9 tests pass. WASM built. Vite/React/TS app renders the bill, the boundary, and the sheet. | Wire the real read. |
| 2026-11-14 | Real on-device read through the raw Prompt API works end to end: 5 lines, `$146.00`, duplicate 99213, `$36.00` difference. Citation fence keeps 7, drops a planted `$999.00` and a patient name. Production build passes the same flow. | Firebase project, App Check, hosted URL, video. |
| 2026-11-15 | Firebase project `callsheet-hybrid` created. AI Logic config, App Check app registration with reCAPTCHA Enterprise, Firestore, and Hosting are live. The hosted app shows `READ SOURCE on_device`, `WRITE SOURCE in_cloud`, a Firestore receipt id, and the fence proof. The 2:18 demo is in `docs/video/callsheet-demo.mp4`. | Upload the video to YouTube, submit on Devpost. |
