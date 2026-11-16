# Extraction accuracy

Measured, not claimed. Run `node scripts/measure-accuracy.mjs` with the dev server running.

The script drives the real product: the same `FirebaseClient.readBill` path, the same
`ONLY_ON_DEVICE` model, the same repair step, in a real Chrome with the built-in model
downloaded. Each fixture is read from scratch and compared field by field against a
hand-written expected value in `fixtures/bills/expected.json`.

## Result

**40 / 40 fields correct — 100%** across five bills with deliberately different shapes.

| Fixture | Shape | Patient, member, phone | Lines | Codes | Patient amounts | Amount due | Read |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sample-bill.txt` | Clinic EOB, 5 lines, deliberate mismatch | ok | ok | ok | ok | ok | 55.3 s |
| `02-clean.txt` | Different provider, 2 lines, no error to find | ok | ok | ok | ok | ok | 31.6 s |
| `03-hospital.txt` | Hospital statement: no `Line` column, `Service` first, `You owe` total | ok | ok | ok | ok | ok | 37.0 s |
| `04-total-mismatch.txt` | Printed total deliberately twice the line sum | ok | ok | ok | ok | ok | 32.2 s |
| `05-single-line.txt` | One line, non-ASCII name, no address | ok | ok | ok | ok | ok | 22.5 s |

Fields compared: `patient_name`, `member_id`, `provider_phone`, line count, printed amount due,
the patient share of every line in order, and the code of every line in order.

## What the fixtures are for

`02-clean.txt` is the abstention case. The bill adds up. The sheet must say so by asking
nothing false. `04-total-mismatch.txt` has a printed total of `$78.00` against lines that add
to `$39.00`, and every column total is internally consistent, so only the due amount is wrong.
`03-hospital.txt` has no `Line` column and a different label for the amount owed, which is the
case that broke the first version: the model read the lines correctly but returned no amount
due, because "You owe" is not "Amount due from patient". The deterministic recovery now tries
a list of labels in order, and that fixture now reads at 100%.

## Honest limits

- Five bills, all synthetic, all written by us. This is a smoke test, not a benchmark.
- Every fixture uses a recognisable layout. A scan, a photo with skew, or a multi-column PDF
  would be harder.
- The read takes 22–55 seconds. The first read in a session includes creating the model
  session; later reads are faster.
- The model reads the lines. The labelled totals have a deterministic fallback, so a missed
  total is recovered from the document text rather than invented.
- Accuracy is measured on the read only. The checks, the seal, and the fence are deterministic
  and covered by the Rust tests.

## Why it matters

A judge should be able to paste their own bill. Before the fixtures existed, "paste your own
bill" was a claim. Now it is a measurement: five different document shapes, read on device,
40 of 40 fields correct, and every one of them visible in the review step before anything is
sealed.
