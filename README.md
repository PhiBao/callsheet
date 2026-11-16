# Callsheet

**A medical bill, read on your own computer, turned into the call you should make.**

Callsheet reads an explanation of benefits in the browser, checks the arithmetic in Rust, and
writes a one-page script for the billing office. The name, member ID, account number, phone
number, and address never leave the browser.

**Live:** https://callsheet-hybrid.web.app · **Repo:** https://github.com/PhiBao/callsheet · **License:** Apache-2.0

Built for **#BuildHybridAI 2026**, Web/Chrome track, using **Firebase AI Logic hybrid inference**.

---

## The problem

People already paste medical bills into chatbots. The advice works often enough that it spreads:
one public post describes a $1,400 reduction, another a hospital bill cut from $195,000 to
$33,000. The same threads carry the warning: a consumer chatbot is not a covered entity, and a bill
full of names, member IDs, and diagnoses is exactly the document you should not hand to a server
you do not control.

The alternatives are also a hand-off. Goodbill reviews and negotiates, but you send the bill and they
take a share of the savings. Dollar For screens for charity care, but you send the bill and your
income. Both are useful. Neither is the ten minutes before the first phone call.

The first useful move on a surprise bill is not a negotiation. It is a question: *what is this line,
why is it here twice, and why does the total not match?*

## What it does

1. **Reads the document on this computer.** Gemini Nano, through Firebase AI Logic in
   `ONLY_ON_DEVICE` mode, returns a structured JSON read. If the device cannot run the model, the
   read refuses immediately. It does not fall back to the cloud with the document.
2. **Shows you the read.** A review step lists every line and every amount, editable. Nothing is
   sealed until you say so. A wrong extraction must never become a wrong question.
3. **Checks the arithmetic in Rust.** The same crate the tests exercise is compiled to WebAssembly
   and runs in the page: duplicate code on the same day, a printed total that does not match the
   lines, printed column totals that disagree with their columns.
4. **Seals a packet.** Private fields are dropped at the boundary, not filtered later. The packet
   holds dates, codes, amounts, the checks, and gloss ids.
5. **Shows you the packet before it goes.** The middle column is the exact content allowed to
   leave, and the fields that stay are listed underneath it.
6. **Writes the questions in the cloud.** Gemini Flash-Lite, through Firebase AI Logic in
   `ONLY_IN_CLOUD` mode, sees only the packet.
7. **Fences the draft.** Rust drops any sentence with an amount that is not in the packet, an
   amount that belongs to a different code, a date that is not on the bill, an unknown gloss id, a
   private field, or imperative advice. Dropped sentences are shown with the reason.
8. **Finishes locally.** The billing phone number is put back into the sheet after the draft is
   verified. It was never in the packet.

The sheet is a call sheet: an opener filled in from the bill, the questions ordered by dollar
impact, a write-this-down block, and the phone number. It prints, copies, and downloads.

## The 60-second demo

1. The synthetic bill is on screen. Printed amount due `$146.00`. The lines add to `$110.00`.
   Code `99213` is on two lines with the same date.
2. **Read it on this computer.** The read takes 20 to 55 seconds the first time. The status line
   says so.
3. The review step shows five lines. The duplicate is labelled in words, not only in colour.
4. **Looks right — seal the packet.** The middle column fills with the sealed packet.
5. **Write the questions.** The cloud answers from the packet alone.
6. The call sheet appears. The first question is the `$36.00` difference. The second is the
   duplicate visit. The billing phone number is at the bottom.
7. **Prove the fence.** A planted `$999.00` fee, a planted patient name, a planted phone number,
   and a planted amount on the wrong code are all dropped, each with its reason.

A screen recording is in `docs/video/callsheet-demo.mp4`.

## Why hybrid, and why this split

| Step | Where | Why |
| --- | --- | --- |
| Read the document | On device, `ONLY_ON_DEVICE` | The document is the sensitive object. If the model is missing, the product must stop, not upload. |
| Check the arithmetic | On device, Rust/WASM | A total is a fact. A model should not be able to change it. |
| Write the questions | Cloud, `ONLY_IN_CLOUD` | Nano is a small model, good at extraction and poor at calm prose. The cloud only needs the packet. |
| Fence the draft | On device, Rust/WASM | The cloud can hallucinate a number. The fence is the last thing between the model and the sheet. |
| Fill in the phone | On device | The number is private, and it is only needed after the draft exists. |

`PREFER_ON_DEVICE` is deliberately not used for the read. A preference mode falls back to the
cloud when Nano is missing, which is exactly the failure this product exists to prevent.

## What is genuinely new

1. **The private read cannot fall back.** The inference mode is a hard boundary.
2. **The model writes the prose and cannot change the verdict.** The duplicate and the total
   mismatch are Rust findings. The cloud is handed a packet that already contains them.
3. **The fence is relational, not a bag of values.** An amount is only allowed next to the code it
   belongs to. "Code 99213 was charged at $90.00" is dropped when `$90.00` is another code's
   charge, even though both numbers are in the packet.
4. **The glosses are local.** The cloud supplies a citation id. The one-line explanation is
   appended on the device from an authored corpus, so the model cannot paraphrase it.
5. **The artifact is a call sheet, not a chat.** Opener, questions, write-this-down, phone,
   print.

## The fence

Sixteen Rust tests. Four of them plant an attack and expect a drop:

| Planted sentence | Dropped because |
| --- | --- |
| "You should also ask about the $999.00 facility fee on this bill." | amount is not in the packet |
| "Alex Rivera should call the number on the back of the card." | mentions a private field |
| "Please call me back at 5550142280." | the phone digits survive reformatting |
| "Code 70450 was also charged at $90.00." | the amount belongs to a different code |

And four that must pass:

| Sentence | Kept because |
| --- | --- |
| "The printed amount due is $146.00 and the lines add to $110.00." | both amounts are packet-level |
| "Code 99213 appears on 2 lines. The patient share is $52.00." | a bare small integer is a count, not money |
| "Should I dispute this charge with the billing office?" | a question is not advice |
| "Code 99213 is an office visit for an established patient." | the gloss id is one we authored |

The live **Prove the fence** button runs the same four attacks against the real packet.

## Your own bill

Paste the text of a bill or EOB, or drop in a PDF. The text is read in the tab.

The on-device read was measured against five synthetic bills with deliberately different shapes:
a clinic EOB, a bill with no error to find, a hospital statement with no `Line` column and a
`You owe` total, a bill whose printed total is twice its line sum, and a single-line bill with a
non-ASCII name.

**40 / 40 fields correct — 100%.** Patient, member id, phone, line count, every code, every
patient amount, and the amount due. The method, the fixtures, and the honest limits are in
[`docs/accuracy.md`](docs/accuracy.md); the script is `scripts/measure-accuracy.mjs`.

That measurement found a real bug: the first version recovered the amount due only from a line
labelled "Amount due from patient", so the hospital statement read `$0.00`. The recovery now tries
a list of labels in order.

## Architecture

```
┌────────────────────────────── Browser ───────────────────────────────┐
│  pasted text · PDF text (pdf.js, local)                               │
│        │                                                             │
│        ▼                                                             │
│  Firebase AI Logic  ONLY_ON_DEVICE   structured bill JSON             │
│        │                                  │                          │
│        │                                  ▼                          │
│        │                          review step (editable)              │
│        │                                  │                          │
│        │                                  ▼                          │
│        │                          Rust/WASM checks                   │
│        │                                  │                          │
│        │                                  ▼                          │
│        │                          sealed packet (no PII)               │
│        │                                  │                          │
│        │                    user reviews the packet                   │
│        │                                  │                          │
│        ▼                                  ▼                          │
│  Firebase AI Logic  ONLY_IN_CLOUD  ◄──  packet only                   │
│        │                                                             │
│        ▼                                                             │
│  Rust/WASM citation fence  ──►  kept sentences + dropped reasons     │
│        │                                                             │
│        ▼                                                             │
│  local fill-in (phone, opener)  ──►  call sheet                      │
└───────────────────────────────────────────────────────────────────────┘
        │                    │                         │
        ▼                    ▼                         ▼
   App Check           Firestore receipt         Remote Config
   reCAPTCHA           public, append-only       model, glossary version
   Enterprise          hash + sources +         kill switch for the
                       counts, no raw text       writing step
```

Diagrams:

- [`docs/diagrams/where-the-bill-goes.svg`](docs/diagrams/where-the-bill-goes.svg) — the boundary.
- [`docs/diagrams/read-seal-write-verify.svg`](docs/diagrams/read-seal-write-verify.svg) — the
  sequence.

## Data model

`Extraction` — private, stays in the page:

```
private: { patient_name, member_id, account_number, provider_name, provider_phone, service_address }
lines:   [{ line, date, code, description, billed_cents, allowed_cents, plan_paid_cents, patient_cents }]
printed_amount_due_cents, printed_total_billed_cents, printed_total_patient_cents, claim_number
```

`SealedPacket` — the only thing the cloud reads:

```
lines:   [{ date, code, billed_cents, allowed_cents, plan_paid_cents, patient_cents }]
printed_amount_due_cents, printed_total_billed_cents, printed_total_patient_cents
checks:  [{ id, severity, message, line_numbers, numbers_cents }]
glossary:[{ code, gloss_id }]
```

Free-text descriptions are dropped at the seal. The cloud gets codes and amounts.

## What is real, what is captured, what is absent

| Claim | State |
| --- | --- |
| On-device read through Firebase AI Logic `ONLY_ON_DEVICE` | Implemented and measured: 40/40 fields across five bill shapes. |
| Rust checks: duplicate code, printed total, column totals | Implemented, 16 tests, compiled to WASM and used by the page. |
| Relational citation fence | Implemented and tested, including the code-to-amount binding. |
| Cloud writing through `ONLY_IN_CLOUD` | Implemented and verified on the hosted app. |
| Firestore receipt | Implemented. Public, append-only, a 64-character packet hash, the two inference sources, the check ids, and the fence counts. Never the bill. |
| App Check | Registered with reCAPTCHA Enterprise and **enforced** for Firebase AI Logic. |
| Remote Config | Real. Holds the cloud model, the glossary version, and a kill switch for the writing step. |
| Paste text and PDF input | Implemented. PDF text is extracted in the tab with `pdf.js`. |
| Deterministic local parser fallback | Implemented, 5 unit tests. Labeled `local/parse` in the proof strip. Never presented as a model read. |
| Review step | Implemented. Every line and every private field is editable before sealing. |
| Print, copy, download | Implemented. The print stylesheet shows only the sheet. |
| Negotiation, fair-price data, charity-care eligibility, medical or legal advice | Not built, on purpose. |
| Android, iOS | Not built. |

**One disclosure.** The hosted build carries a registered App Check **debug token**, so the demo
works in any browser even when reCAPTCHA scores a headless or proxied session badly. The contest
rules allow debug tokens in submissions. The App Check app is registered and enforcement is on;
the token only replaces the browser attestation step. Without it, a judge whose browser fails
attestation still gets a usable sheet, because the writing step falls back to the deterministic
questions and says so.

## Hackathon relevance

- **Track:** Web/Chrome.
- **Required technology:** Firebase AI Logic hybrid inference with App Check. Both inference modes
  are used for a reason, not as a toggle.
- **Judging criteria:**
  - *Technological implementation* — two real modes, `inferenceSource` from the SDK, structured
    output, a Rust engine compiled to WASM, App Check enforced, Remote Config live.
  - *Design* — a document, a boundary, and a sheet. Not a dashboard.
  - *Potential impact* — a checkable arithmetic error on a document people already paste into
    chatbots. Five bill shapes measured.
  - *Quality of the idea* — a verdict the model cannot change, on a document that never leaves the
    machine.

## Running it

Prerequisites: Node 22+, pnpm 11+, Rust nightly with `wasm32-unknown-unknown`, `wasm-pack` 0.13+,
and desktop Chrome 139+ for the on-device model.

```bash
# Dependencies
pnpm --dir apps/web install

# The rules engine, compiled to WASM
wasm-pack build crates/callsheet-rules --target web --out-dir ../../apps/web/src/wasm --release

# The Rust tests
cargo test -p callsheet-rules

# The app
pnpm --dir apps/web dev
```

Then open `http://127.0.0.1:5173`.

### Firebase setup

The full walkthrough is in [`docs/firebase-setup.md`](docs/firebase-setup.md). The short version:
create a project and a web app, enable AI Logic with the Gemini Developer API, register the web app
for App Check with reCAPTCHA Enterprise and enforce it for Firebase AI Logic, create a Firestore
database, deploy `firestore.rules`, then fill in `apps/web/.env.local`:

```dotenv
VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}
VITE_APP_CHECK_SITE_KEY=...
```

`VITE_APP_CHECK_DEBUG_TOKEN` is optional and only used for a registered debug token.

### Deploying

```bash
pnpm --dir apps/web build
firebase deploy --only hosting,firestore:rules
```

## Tests and measurements

```bash
cargo test -p callsheet-rules          # 16 tests
pnpm --dir apps/web test              # 13 tests
node scripts/measure-accuracy.mjs      # 40/40 fields across five bills
node scripts/e2e-local.mjs             # the whole flow, headless
node scripts/test-no-model.mjs         # the browser with no model
```

## Security and reliability

- **No private field in the packet.** The seal constructs a new struct with only the allowed
  fields. There is no filter-later path.
- **No cloud fallback for the read.** `ONLY_ON_DEVICE` throws when the model is missing, and the
  preflight refuses before the call when the browser cannot run the model at all.
- **No raw bill in Firestore.** The rules accept only a 64-character hash, two source strings, a
  bounded list of check ids, and counts. The receipt is public and append-only so a judge can read
  the proof without an account.
- **No production secrets in the repo.** `.env.local` is ignored. The hosted build's debug token is
  disclosed above and is registered, not secret.
- **A read that cannot hang.** Ninety seconds, or five minutes when the model is still downloading.
  There is a stop control.
- **A cloud failure never dead-ends.** If the writing step fails, the sheet falls back to the
  deterministic questions built from the sealed packet, and says why.
- **CSP and hosting headers.** No third-party scripts, no framing, no referrer.
- **The fence is adversarial.** Sixteen tests, including the four planted attacks.

## Limitations

- The glossary is four authored codes for the demo. If a code is not in it, the sheet abstains. It
  is not a CPT database, and CPT descriptions are licensed by the AMA.
- The five measured bills are synthetic and written by us. A scan, a skewed photo, or a
  multi-column PDF would be harder. The read is 20 to 55 seconds.
- The sample bill is synthetic and labelled as such on screen. A pasted bill is labelled as read in
  this tab.
- The product is US-shaped: it assumes a line table, labelled totals, and CPT-style codes.
- No negotiation, no fair-price benchmarks, no charity-care determination, no accounts.

## Roadmap

1. More bill shapes: insurance denial letters, school and clinic statements.
2. A PDF path that reads a photo with the on-device multimodal model.
3. Saved sheets across visits, so the second bill opens onto the last call.
4. A user-editable glossary, so a patient can add the codes their provider uses.
5. Android, only if a supported device and the on-device model are available.

## License

Apache-2.0. See `LICENSE`.

The sample bill, the glossary glosses, the fixtures, and the diagrams are original work for this
project. The product is a reading aid, not medical, legal, or financial advice.
