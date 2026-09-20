# Aikiyara

Aikiyara is now backed by a secure Firebase/Gemini server layer while preserving the original productivity planner. The Copilot bundle adds authenticated chat history, App Check verification, document/image analysis, study tools, web grounding, memory, projects, library storage, schedules, sharing, export, GitHub lookup, agent planning, and PWA support.

## Run locally

```bash
npm install
npm start
```

Configure the server-only values from `.env.example` before using protected features:

- `GEMINI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- optional `FIREBASE_STORAGE_BUCKET` and model overrides

Never put Gemini keys or Firebase service-account JSON in the browser or GitHub.

## Deployment

Render uses `npm install` and `npm start`; Node 20.16+ is required. Firebase rules are included in `firestore.rules` and `storage.rules`.

The Firebase web configuration is public client configuration. App Check enforcement and authorized domains should be enabled only after validating the deployed domain.
