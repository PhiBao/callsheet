# Demo and test plan

## The three-minute video

The first thirty seconds have to say who it is for, what the problem is, and how Firebase AI Logic
makes the private read possible. Judges may score from the video alone.

The recording is `docs/video/callsheet-demo.mp4` (1:40, 1920×1080, narrated, subtitles burned in
and a sidecar `.srt`). It is a real screen recording of the hosted app, cut into five segments: a
title card, the real read starting, a hybrid-split explainer while the slow first read runs, the
review and sheet from the labeled captured read, and a close card.

### 0:00–0:08 — Title card

> Paste any bill. It is read on your computer, checked in Rust, and never leaves the browser.

### 0:08–0:20 — The bill

The desk is on screen. The synthetic bill is on the left, the boundary in the middle, the sheet on
the right. Nothing has been read yet.

> This is an explanation of benefits. People paste these into chatbots. The name, member ID, and
> phone go with it.

### 0:20–0:25 — The source bar

Point at the three tabs: Sample bill, Paste text, Upload PDF.

> Or your own. Paste it, or drop in a PDF. The text is read in this tab.

### 0:25–1:30 — The private read

Click **Read it on this computer**. The status line says the model is working. The wait is real:
20 to 60 seconds on a warm machine, longer the first time.

> This is Gemini Nano, through Firebase AI Logic, in ONLY_ON_DEVICE mode. If this browser cannot run
> the model, the read refuses. It does not upload the bill.

### 1:30–1:40 — The review

The middle column becomes the review: five line cards, each with editable description, billed,
allowed, plan, and patient share. Below them the private fields, also editable.

> This is what the model read. Correct anything wrong before it is sealed. The packet is built from
> these numbers, not from the original document.

### 1:40–1:50 — Seal and write

Click **Looks right — seal the packet**, then the write runs.

> The packet drops the private fields at the boundary. The cloud sees codes, dates, and amounts.

### 1:50–2:00 — The sheet

> The cloud wrote the questions. The Rust fence checked every sentence before it reached this
> page. The phone number is filled in here, locally. It was never in the packet.

### 2:00–2:08 — Prove the fence

Click **Prove the fence**. Four planted sentences appear with their reasons:

| Planted | Reason shown |
| --- | --- |
| "You should also ask about the $999.00 facility fee on this bill." | amount $999.00 is not in the packet |
| "Alex Rivera should call the number on the back of the card." | mentions a private field: patient name |
| "Please call me back at 5550142280." | mentions a private field: provider phone |
| "Code 99213 was also charged at $90.00." | amount $90.00 is not a charge for the code named here |

> An amount that belongs to another code is dropped. A number that was never on the bill is
> dropped. A name or a phone number is dropped. The model writes the prose. It does not get to
> change the arithmetic.

### 2:08 — End card

> A bill, turned into the call you should make. A private on-device read. A sealed packet. A check
> the model cannot change.

## Recording checklist

- Use desktop Chrome with the built-in model available. On this machine the full Chrome stable build
  is at `/home/kiter/.cache/chrome-stable/root/opt/google/chrome/chrome`, and the profile with the
  model is `/home/kiter/.cache/callsheet-chrome-stable`.
- Record at 1600×1200 so the whole desk fits without scrolling.
- Record the live read. Do not preload the extraction. If the model is slow, keep the wait: the
  status line explains it and honesty scores better than a cut.
- Record the fence proof live.
- Keep the synthetic pill visible in every shot.
- Upload to YouTube as public. Processing can take hours.

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
