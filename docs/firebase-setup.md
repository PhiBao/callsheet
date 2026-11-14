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

1. Open **Security → App Check**.
2. Register the web app with **reCAPTCHA Enterprise**.
3. Create a reCAPTCHA Enterprise key for the domain in the Google Cloud console, or use the
   Firebase guided flow.
4. Copy the **site key** into `VITE_APP_CHECK_SITE_KEY`.

For localhost, the app can use a debug token. Set `FIREBASE_APPCHECK_DEBUG_TOKEN=true` in the
browser or let the app print one, then register it in **App Check → Apps → Manage debug tokens**.
Never commit a debug token.

A hosted demo needs a real reCAPTCHA Enterprise site key. A debug token will not work in a judge's
browser.

## 4. Authentication

1. Open **Authentication → Sign-in method**.
2. Enable **Anonymous**.
3. The app signs in anonymously so a receipt can be scoped to the browser. It does not ask for an
   email.

## 5. Firestore

1. Create a Firestore database in production mode.
2. Deploy the rules:

```bash
firebase deploy --only firestore:rules
```

The rules accept only a 64-character packet hash, two source strings, a bounded list of check ids,
and counts. They reject a document that contains a raw bill.

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
