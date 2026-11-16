### The problem

People paste medical bills into chatbots. The advice works often enough that it spreads: one public post describes a $1,400 reduction, another a hospital bill cut from $195,000 to $33,000. The same threads carry the warning that a consumer chatbot is not a covered entity, and a bill full of names, member IDs, and diagnoses is exactly the document you should not hand to a server you do not control.

Other options also mean handing over the bill. Goodbill reviews and negotiates, but you send the bill and they take a share of the savings. Dollar For screens for charity care, but you send the bill and your income. Both are useful. Neither helps with the ten minutes before the first phone call.

The first useful move on a surprise bill is a question: what is this line, why is it here twice, and why does the total not match?

### What Callsheet does

Callsheet reads an explanation of benefits or a provider bill in the browser, checks the arithmetic, and writes a one-page script for the billing office. The name, member ID, account number, phone number, and address never leave the browser.

The sample is synthetic and deliberately wrong. The printed amount due is $146.00, the lines add to $110.00, and code 99213 appears twice on the same date. The sheet asks about the $36.00 difference and the duplicate visit. A judge can check both in ten seconds.

### How Firebase AI Logic is used

Callsheet uses both inference modes for different jobs.

1. Read, on device. Gemini Nano through Firebase AI Logic in `ONLY_ON_DEVICE` mode returns a structured JSON read of the bill. If the device cannot run the model, the read throws. The app does not upload the bill. `inferenceSource` is shown in the UI.
2. Check, on device. A Rust crate compiled to WebAssembly flags a code that appears twice on the same date and a printed total that does not match the lines. The model cannot change those findings.
3. Seal. Private fields and free-text descriptions are dropped at the boundary. The packet holds dates, codes, amounts, the checks, and gloss ids.
4. Write, in the cloud. Gemini Flash-Lite through Firebase AI Logic in `ONLY_IN_CLOUD` mode sees only that packet. It returns short sentences with optional gloss citations.
5. Fence, on device. The same Rust crate drops any sentence with a dollar amount not in the packet, a code not in the packet, an unknown gloss id, or a private field. Dropped sentences are shown with the reason.
6. Finish, on device. The billing phone number is filled in after the draft is verified. It was never in the packet.

App Check with reCAPTCHA Enterprise protects the AI Logic calls and is enforced. Firestore holds a public, append-only receipt: a SHA-256 packet hash, the two inference sources, the check ids, and the fence counts. It never stores the bill. Remote Config holds the cloud model and glossary version.

### Why it is different

- The read uses `ONLY_ON_DEVICE`, so it cannot fall back to the cloud with the document. `PREFER_ON_DEVICE` would allow that fallback.
- The model writes the prose. Rust owns the duplicate finding and the total mismatch.
- The fence is visible. A planted $999.00 and a patient name are dropped in front of you.
- The output is a one-page call sheet with an opener, questions, a write-this-down block, and the phone number.
- The glossary has four authored codes. If a code is not in it, the sheet abstains.

### What is real

The on-device read, the Rust checks, the fence, the packet hash, and the receipt are real. The sample bill is synthetic. Negotiation, fair-price benchmarks, charity-care eligibility, and medical or legal advice are not built.

### Links

Live demo: https://callsheet-hybrid.web.app

Repo: https://github.com/PhiBao/callsheet
