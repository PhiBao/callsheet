# Demo and test plan

## The three-minute video

The first thirty seconds have to say who it is for, what the problem is, and how Firebase AI Logic
makes the private read possible. Judges may score from the video alone.

### 0:00–0:20 — The bill and the paste

Screen: the synthetic bill, full frame, no app chrome.

Voice:

> This is an explanation of benefits. People paste this into a chatbot. The name, the member ID,
> the phone number, and the diagnoses go with it. A consumer chatbot is not a covered entity.

Cut to a browser with a chat window and a pasted bill. Do not show a real bill. Use the same
synthetic text.

### 0:20–0:35 — Who it is for

> Callsheet is for the ten minutes before the first phone call. Not a negotiation. Not a diagnosis.
> The questions you should ask the billing office.

### 0:35–1:20 — The private read

Screen: the Callsheet desk. Click **Read it on this computer**.

Show the wait state. It is allowed to take twenty seconds.

> This is Gemini Nano, through Firebase AI Logic, in ONLY_ON_DEVICE mode. If this computer cannot
> run the model, the read throws. It does not upload the bill.

When the packet appears, point at the kept list.

> The name, member ID, account number, phone, and address are still here. The middle column is the
> exact packet the cloud is allowed to see.

### 1:20–1:55 — The check a judge can verify

Point at the bill.

> The printed amount due is one hundred forty-six dollars. The lines add to one hundred ten. That is
> a thirty-six dollar difference. Code 99213 is on two lines on the same date.

> That check is Rust, compiled to WebAssembly, running in this page. The model wrote the read. It
> cannot change the arithmetic.

### 1:55–2:25 — The cloud, and the fence

Click **Write the questions**.

> The cloud model sees only the packet. It writes the questions. Then the same Rust crate checks
> every sentence.

Click **Prove the fence**. The planted `$999.00` and the patient name are dropped, with reasons.

> A number that was not in the packet does not reach the sheet. A patient name does not reach the
> sheet. The sheet shows what was dropped and why.

### 2:25–2:50 — The local fill-in

Point at the phone number.

> The billing office number is filled in here, after the draft came back. It was never in the
> packet. That is the whole split: private read, public writing, local finish.

### 2:50–3:00 — What is real

> The sample is synthetic. The on-device read, the Rust checks, the fence, the packet hash, and the
> receipt are real. The repo has the code, the tests, and the setup. Thank you.

Do not claim negotiation, savings, fair-price benchmarks, charity-care eligibility, or medical
advice. Those are not built.

## Recording checklist

- Use desktop Chrome with the built-in model available. On this machine, the full Chrome stable
  build is at `/tmp/opencode/chrome-stable/opt/google/chrome/chrome`, and the profile with the model
  is `/home/kiter/.cache/callsheet-chrome-stable`.
- Record at 1440×900 or 1920×1080. The desk is designed for a wide screen.
- Capture the whole page, not a cropped panel. The bill, the boundary, and the sheet have to be on
  screen together.
- Record the first read live. Do not preload the extraction. If the model is slow, keep the wait in
  the video; it is honest, and the status line explains it.
- Record the fence proof live. Click **Prove the fence** after the sheet appears.
- Keep the synthetic-demo pill visible in every shot.
- Upload to YouTube as public, not unlisted. The rules say publicly visible.
- Upload at least a day before the deadline; processing can take hours.

## Judge test path

1. Open the hosted URL in desktop Chrome 139+.
2. The synthetic bill is on screen. The synthetic pill is visible.
3. Click **Read it on this computer**. If the model is available, the packet appears. If it is not,
   the app says so and does not upload the bill.
4. Click **Write the questions**. If the Firebase configuration and App Check are live, the cloud
   writes the sheet. If the cloud is unavailable, the template questions still work.
5. Click **Prove the fence**. The planted `$999.00` and the patient name are dropped.
6. Check the proof strip: packet hash, read source, write source, check ids, fence counts, receipt
   id.

Judges are not required to test. That is why the video has to carry the same path.

## Reliability plan

The on-device read depends on Chrome having the model. That is the one environmental dependency.
The plan is:

- Record the real read on the machine where the model works.
- On a machine without the model, the app shows an honest unavailable state. It does not fake the
  badge and does not upload the bill.
- The hosted build can include a captured on-device trace for judges without the model, clearly
  labeled as captured. It is not a live run, and the UI must say so.
- The cloud step can still run on the captured packet, because the packet is real.

The Rust checks and the fence do not depend on the model. They work on the fixture and on the
captured packet.

## Test matrix

| Test | How | Expected |
| --- | --- | --- |
| Duplicate line | `cargo test -p callsheet-rules flags_the_duplicate_visit` | `duplicate-99213-2026-10-02` |
| Total mismatch | `cargo test -p callsheet-rules flags_the_total_mismatch` | `$146.00`, `$110.00`, `$36.00` |
| Private fields dropped | `cargo test -p callsheet-rules seal_drops_private_fields` | no name, member ID, phone in the packet |
| Unknown amount dropped | `cargo test -p callsheet-rules drops_a_sentence_with_a_number_that_was_not_in_the_packet` | `$999.00` reason |
| Patient name dropped | `cargo test -p callsheet-rules drops_a_sentence_that_names_the_patient` | private-field reason |
| Unknown citation dropped | `cargo test -p callsheet-rules drops_an_unknown_citation` | `g-99999` reason |
| Valid citation kept | `cargo test -p callsheet-rules accepts_a_valid_citation` | accepted |
| Line count allowed | `cargo test -p callsheet-rules accepts_a_duplicate_question_with_a_line_count` | accepted |
| Browser flow | `node scripts/e2e-local.mjs` | packet, sheet, phone, fence |
| Production build | `pnpm --dir apps/web build` | `dist/` with the WASM asset |

## Local setup for the demo machine

```bash
# Full Chrome stable, not Chrome for Testing, so the component updater can fetch the model.
# The model is about 4 GB and is stored in the profile.
google-chrome --user-data-dir=/home/kiter/.cache/callsheet-chrome-stable
# Open chrome://components and confirm the on-device model is installed,
# or just open the app and press Read.

# App
pnpm --dir apps/web dev
```

The app's local development mode uses the raw Chrome Prompt API and the template questions. The
submission path uses Firebase AI Logic. The UI labels which one is active.

## What not to do in the video

- Do not show a real bill, a real name, or a real member ID.
- Do not claim a specific dollar saving.
- Do not call the sheet legal, medical, or financial advice.
- Do not hide the fact that the sample is synthetic.
- Do not edit out the wait and then claim the read was instant.
