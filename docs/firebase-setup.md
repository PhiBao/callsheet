# Firebase setup

The app is a static Vite build plus Firebase AI Logic. The only server-side work is Firebase
Hosting, Firestore rules, and App Check. There is no model server.

## 1. Create the project

1. Open the [Firebase console](https://console.firebase.google.com/) and create a project.
2. Add a **Web app** to the project. Copy the config object.
3. Upgrade to the **Blaze** plan only if AI Logic or App Check requires it. Text inference with
   `gemini-3.5-flash-lite` is free within the limits; the Spark plan is enough for the demo.

## 2. Enable AI Logic

1. In the console, open **AI Services → AI Logic**.
2. Click **Get started**.
3. Choose the **Gemini Developer API** provider. It is the free-tier path.
4. The guided flow enables the required APIs and enforces App Check for AI Logic.

The app uses two model instances:

- `ONLY_ON_DEVICE` for the bill read. The SDK uses Chrome's built-in Gemini Nano. If the model is
  not available, the call throws; it does not fall back to the cloud.
- `ONLY_IN_CLOUD` with `gemini-3.5-flash-lite` for the questions. It receives only the sealed
  packet.

## 3. App Check

App Check app registration is a console step. The REST API does not expose it.

1. Open **Security → App Check → Apps** for the project:
   <https://console.firebase.google.com/project/callsheet-hybrid/appcheck/apps>
2. Register the web app with **reCAPTCHA Enterprise**.
3. Use the site key already created for this project:
   `6Lf0mSAuAAAAAD00c2J9590hTQ-ZRMm14NODQOa6`
4. The allowed domains are `callsheet-hybrid.web.app`, `callsheet-hybrid.firebaseapp.com`, and
   `localhost`.
5. Open **App Check → APIs** and enforce **AI Logic**.

For localhost, the app can use a debug token. Never commit a debug token.

A hosted demo needs the real reCAPTCHA Enterprise site key. A debug token will not work in a judge's
browser.

## 4. Authentication (optional)

The receipt does **not** require an account. It is a public, append-only proof log with a 64-character
packet hash, two source strings, check ids, and counts. It never contains the bill, a name, a member
id, or a phone.

Anonymous Firebase Auth requires Identity Platform billing on a new project. The core product does
not need it, so the app treats auth as best-effort and the receipt stays public. If you want
account-scoped receipts later, enable billing, initialize Identity Platform, turn on Anonymous, and
tighten `firestore.rules` to `request.auth != null`.

## 5. Firestore

1. Create a Firestore database in production mode.
2. Deploy the rules:

```bash
firebase deploy --only firestore:rules
```

The rules accept only a 64-character packet hash, two source strings, a bounded list of check ids,
and counts. They reject a document that contains a raw bill. The receipt is public and append-only,
so a judge can inspect the proof without an account.

## 6. The environment file

```bash
cd apps/web
cp .env.example .env.local
```

Fill in:

```dotenv
VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
VITE_APP_CHECK_SITE_KEY=...
```

`.env.local` is ignored by git. Do not put these values in the README, the repo, or the submission
form.

## 7. Build and deploy

```bash
pnpm --dir apps/web build
firebase deploy --only hosting
```

`firebase.json` serves `apps/web/dist`, rewrites to `index.html`, and sets a CSP that allows the
Firebase and Gemini endpoints, the WASM runtime, and nothing else.

## 8. What to check

- The app loads at the Hosting URL.
- The read works on desktop Chrome 139+ with the model. The proof strip says `on_device`.
- The write works and the proof strip says `in_cloud`.
- The fence proof drops the planted `$999.00` and the patient name.
- A Firestore receipt exists with a 64-character hash and no bill text.
- App Check is enforced for AI Logic, not just initialized.

## 9. If the model is not available

The app shows an honest unavailable state. It does not fake the badge and does not upload the bill.
The Rust checks and the fence still run on the fixture. The submission video must show one real
on-device read.

## 10. Rolling back

App Check enforcement can lock you out if the site key is wrong. Keep the App Check debug token for
localhost, and check **App Check → APIs → AI Logic** before changing enforcement. The app's read
path fails closed, by design.
