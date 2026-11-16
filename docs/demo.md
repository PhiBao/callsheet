# Demo and test plan

## The demo video

The video is 1:40, well inside the three-minute limit. It has to say who the product is for, what
the problem is, and how Firebase AI Logic makes the private read possible. Judges may score from
the video alone.

The recording is `docs/video/callsheet-demo.mp4` (1:40, 1920×1080, narrated, subtitles burned in
and a sidecar `.srt`). It is a real screen recording of the hosted app, cut into five segments: a
title card, the real read starting, a hybrid-split explainer while the slow first read runs, the
review and sheet from the labeled captured read, and a close card.

### 0:00–0:12 — Title card

> People paste medical bills into chatbots. The name, the member ID, and the phone number go with
> them. Callsheet does the reading on your own computer instead.

### 0:12–0:34 — The real read starts

The hosted app opens on the synthetic bill: printed amount due `$146.00`, the lines adding to
`$110.00`, and code `99213` on two lines with the same date. **Read it on this computer** is
pressed, and the status line shows the on-device read starting.

> This is a real explanation of benefits. The printed amount due is one hundred forty-six dollars.
> The lines add up to one hundred ten. Two visits carry the same code. Press read. The model runs
> here, through Firebase AI Logic. The bill is not uploaded.

### 0:34–0:59 — The split, while the read runs

A full-screen explainer card shows the boundary: the read, the Rust checks, and the seal stay on the
computer; only the sealed packet crosses; the questions come back to the fence; the phone is filled
in locally.

> On-device is private, and it costs nothing to run. It is also slow, and it is small. So the device
> does what it is good at: it reads the document, and it checks it. The cloud does what it is good
> at: it writes the questions. Between them is a sealed packet. No name, no member ID, no phone. The
> bill never crosses.

### 0:59–1:27 — The review, the sheet, and the fence

The recording resumes at `?demo=captured`, which opens the captured read with the UI labeled as
captured. The five editable lines are shown, the packet is sealed, the cloud writes from the packet
alone, the sheet puts the phone number back locally, and **Prove the fence** drops all four planted
sentences.

> This is the read from that run. Five lines, every amount editable. Nothing is sealed until you say
> so. Seal it. The cloud writes from the packet alone. The sheet puts the phone number back, locally.
> And the check the model cannot change: a made-up fee, a patient name, a phone number, and an
> amount on the wrong code. All four are dropped, each with its reason.

### 1:27–1:40 — Close card

> A private read. A sealed packet. A check the model cannot change. Callsheet. The code, the live
> demo, and the proof are in the repository.

## Recording checklist

- Use desktop Chrome with the built-in model available. On this machine the full Chrome stable build
  is at `/home/kiter/.cache/chrome-stable/root/opt/google/chrome/chrome`, and the profile with the
  model is `/home/kiter/.cache/callsheet-chrome-stable`.
- Record at 1920×1080.
- Pre-warm the built-in model with the project's `assets/warm.js` init script. A cold first read
  takes 40 to 120 seconds; the recording is 1:40 total.
- Start the read live. Cut to the explainer while it runs, and resume on the labeled captured read
  for the review, the sheet, and the fence. Do not present the captured entry as a live read.
- Record the fence proof live.
- Keep the synthetic pill visible in every shot.
- Upload to YouTube as public, attach `docs/video/callsheet-demo.srt` as the caption track, and
  paste the URL into the submission pack.

## Judge test path

1. Open https://callsheet-hybrid.web.app in desktop Chrome 139+.
2. The sample bill is on screen, labelled synthetic.
3. Press **Paste text** and paste any bill or EOB, or press **Upload PDF** for a PDF.
4. Press **Read it on this computer**. If the model is available, the review step appears. If it is
   not, the app says so and offers the deterministic parser instead.
5. Edit anything wrong in the review. Press **Looks right — seal the packet**.
6. The questions are written. Press **Prove the fence** to see the four planted attacks dropped.
7. Press **Print** for a one-page sheet with the opener, the questions, a write-this-down block, and
   the billing phone number.
8. Check the proof strip: packet hash, `on_device`, `in_cloud`, the check ids, the fence counts, the
   receipt id, the timing, and the glossary version.

Judges are not required to test. That is why the video carries the same path.

## Reliability plan

The on-device read depends on Chrome having the model. The app handles the three cases honestly:

| Case | What happens |
| --- | --- |
| Model ready | The read runs. The pill says "On-device model ready". |
| Model downloading | The pill says so, the read waits up to five minutes, and the status line explains the wait. |
| Model unavailable or no Prompt API | The read refuses immediately with a plain-language message and offers the deterministic parser. Nothing is uploaded. |
| App Check attestation fails | The cloud write fails, the sheet falls back to the deterministic questions, and the sheet says why. |
| Cloud unreachable | Same fallback. The sheet is never empty. |

A read that has not finished in 180 seconds is abandoned with an explanation, and there is a
**Stop waiting** control.

## Test matrix

| Test | How | Expected |
| --- | --- | --- |
| Duplicate line | `cargo test -p callsheet-rules flags_the_duplicate_visit` | `duplicate-99213-2026-10-02` |
| Total mismatch | `cargo test -p callsheet-rules flags_the_total_mismatch` | `$146.00`, `$110.00`, `$36.00` |
| Private fields dropped | `cargo test -p callsheet-rules seal_drops_private_fields` | no name, member ID, phone in the packet |
| Unknown amount dropped | `cargo test -p callsheet-rules drops_a_sentence_with_a_number_that_was_not_in_the_packet` | `$999.00` reason |
| Wrong code dropped | `cargo test -p callsheet-rules drops_an_amount_that_belongs_to_a_different_code` | "not a charge for the code named here" |
| Date not on the bill | `cargo test -p callsheet-rules drops_a_date_that_is_not_on_the_bill` | date reason |
| Advice blocked | `cargo test -p callsheet-rules drops_imperative_advice` | advisory reason |
| Phone reformatted | `cargo test -p callsheet-rules drops_a_reformatted_phone_number` | private-field reason |
| Question allowed | `cargo test -p callsheet-rules allows_a_question_that_mentions_disputing` | kept |
| String null citation | `cargo test -p callsheet-rules treats_the_string_null_as_no_citation` | kept, no citation |
| Local parser | `pnpm --dir apps/web test` | 13 tests |
| Whole flow | `node scripts/e2e-local.mjs` | packet, sheet, phone, fence |
| No model at all | `node scripts/test-no-model.mjs` | refusal, then `local/parse` |
| Mobile at 390px | `node scripts/test-mobile.mjs` | no horizontal overflow |
| Extraction accuracy | `node scripts/measure-accuracy.mjs` | 40/40 fields |

## What not to do in the video

- Do not show a real bill, a real name, or a real member ID.
- Do not claim a specific dollar saving.
- Do not call the sheet legal, medical, or financial advice.
- Do not hide that the sample is synthetic.
- Do not edit out the wait.
- Do not present the deterministic parser as a model read. It is labelled `local/parse`.
