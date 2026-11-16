# Submission pack

Everything here is ready to paste into Devpost, except the two URLs that need a deployment and a
video.

## Project

- **Name:** Callsheet
- **Tagline:** A medical bill, read on your own computer, turned into the call you should make.
- **Track:** Web/Chrome
- **Repo:** https://github.com/PhiBao/callsheet
- **Hosted URL:** https://callsheet-hybrid.web.app
- **Devpost project:** https://devpost.com/software/callsheet-bnsymd (submitted 2026-11-16)
- **Video:** https://youtu.be/jCZbUMxgJZM (1:40, 1080p, narrated, English subtitles burned in).
  The source file is `docs/video/callsheet-demo.mp4` and the sidecar captions are
  `docs/video/callsheet-demo.srt`.
- **Devpost description:** [`docs/devpost-description.md`](devpost-description.md).
- **Project media:** six gallery images in `docs/media/` (bill, editable review, sealed packet, call
  sheet, fence proof, trust boundary) plus `docs/media/thumbnail.jpg`, added through the Devpost MCP.

## Description (paste into Devpost)

### The problem

People already paste medical bills into chatbots. The advice works often enough that it spreads:
one public post describes a $1,400 reduction, another a hospital bill cut from $195,000 to $33,000.
The same threads carry the warning: a consumer chatbot is not a covered entity, and a bill full of
names, member IDs, and diagnoses is exactly the document you should not hand to a server you do not
control.

The alternatives are also a hand-off. Goodbill reviews and negotiates, but you send the bill and they
take a share of the savings. Dollar For screens for charity care, but you send the bill and your
income. Both are useful. Neither is the ten minutes before the first phone call.

### What Callsheet does

Callsheet reads an explanation of benefits or a provider bill in the browser, checks the arithmetic,
and writes a one-page script for the billing office. The name, member ID, account number, phone
number, and address never leave the browser.

The sample is synthetic and deliberately wrong: the printed amount due is $146.00, the lines add to
$110.00, and code 99213 appears twice on the same date. The sheet asks about the $36.00 difference
and the duplicate visit. A judge can check both in ten seconds.

### How Firebase AI Logic is used

The hybrid split is the product, not a fallback toggle.

1. **Read, on device.** Gemini Nano through Firebase AI Logic in `ONLY_ON_DEVICE` mode returns a
   structured JSON read of the bill. If the device cannot run the model, the read throws. It does
   not fall back to the cloud with the document. `inferenceSource` is shown in the UI.
2. **Check, on device.** A Rust crate compiled to WebAssembly flags a code that appears twice on
   the same date and a printed total that does not match the lines. The model cannot change the
   verdict.
3. **Seal.** Private fields are dropped at the boundary. The packet contains dates, codes, amounts,
   the checks, and gloss ids only. Free-text descriptions are dropped with the private fields.
4. **Write, in the cloud.** Gemini Flash-Lite through Firebase AI Logic in `ONLY_IN_CLOUD` mode sees
   only the packet. It returns short sentences with optional gloss citations.
5. **Fence, on device.** The same Rust crate drops any sentence with a dollar amount not in the
   packet, a code not in the packet, an unknown gloss id, or a private field. The dropped sentences
   are shown with the reason.
6. **Finish, on device.** The billing phone number is filled in after the draft is verified. It was
   never in the packet.

App Check with reCAPTCHA Enterprise protects the AI Logic calls. The receipt is public and
append-only: a SHA-256 packet hash, the two inference sources, the check ids, and the fence counts.
It never stores the bill. Remote Config holds the cloud model and glossary version.

### Why it is different

- The private read cannot fall back. `PREFER_ON_DEVICE` is deliberately not used for the bill.
- The model writes the prose, but it cannot change the arithmetic.
- The fence is visible. A planted `$999.00` and a patient name are dropped in front of you.
- The artifact is a call sheet, not a chat.
- The glossary is small and authored. If a code is not in it, the sheet abstains.

### What is real

The on-device read, the Rust checks, the fence, the packet hash, and the receipt are real. The
sample bill is synthetic. Negotiation, fair-price benchmarks, charity-care eligibility, and medical
or legal advice are not built.

### Built with

firebase, firebase-ai-logic, gemini-nano, gemini-3.5-flash-lite, app-check, anonymous-auth,
firestore, remote-config, react, typescript, vite, rust, webassembly, wasm-bindgen.

## Custom submission answers

| Likely question | Answer |
| --- | --- |
| Which platform? | Web (Chrome). |
| How did you use Firebase AI Logic? | `ONLY_ON_DEVICE` for the private structured read; `ONLY_IN_CLOUD` for the prose from the sealed packet; `inferenceSource` shown in the proof strip; App Check enforced. |
| New or existing project? | New. Built during the submission period. No pre-existing product code. |
| What did you build during the submission period? | The whole app: the Rust rules crate and WASM build, the desk UI, the on-device read, the seal, the cloud script, the citation fence, the receipt, the tests, the diagrams, and the docs. |
| Anything mocked? | The sample bill is synthetic and labeled. No model output is faked. The local development mode uses the raw Chrome Prompt API and is labeled as not the submission path. |
| Open source license? | Apache-2.0, in `LICENSE`, detected at the top of the repo. |

## Pre-submission checklist

- [x] Firebase project created, AI Logic enabled with the Get started wizard, App Check with
      reCAPTCHA Enterprise, Firestore, Remote Config.
- [x] `apps/web/.env.local` has `VITE_FIREBASE_CONFIG` and `VITE_APP_CHECK_SITE_KEY`.
- [x] `firestore.rules` deployed.
- [x] `pnpm --dir apps/web build` passes.
- [x] Hosted URL loads and the read works on a machine with the model.
- [x] The cloud write works from the hosted URL with App Check.
- [x] The fence proof works.
- [x] The repo is public and the license is visible in the About section.
- [x] The video is public on YouTube, under three minutes, English, and shows the on-device read.
- [x] The Devpost project is submitted, not left as a draft.
- [x] The submission is made before 2026-11-30 14:00 PT.

## Known timing

- Submissions close: **2026-11-30 14:00 PT**.
- Judging: 2026-12-10 to 2026-12-16.
- Winners: on or around 2026-12-21.
- A project can win one grand prize and one Best of category prize.
- Only the first three minutes of the video are evaluated.
