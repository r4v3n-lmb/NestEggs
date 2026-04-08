# NestEggs PWA

Couples-first budget and finance manager for South African households.

## What is scaffolded

- React + TypeScript + Vite PWA foundation
- Firebase integration points for:
  - Hosting
  - Authentication (email/password, Google, Apple, phone verification scaffold)
  - Firestore (household/profile/join-code model)
  - Storage (receipt/report path model)
- Core dashboard modules for:
  - Multiple income streams (salary + additional income)
  - Category + subcategory expenses
  - Recurring bills
  - Monthly category limits
  - Savings goal target tracking
  - KPI tracking: cashflow, savings rate, debt ratio, budget variance
  - In-app threshold + overdue alerts
- Offline queue foundation for PWA sync behavior

## Run locally

1. Install dependencies

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill Firebase values.

3. Start app

```bash
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Firebase deployment

1. Update `.firebaserc` project id.
2. Build app: `npm run build`
3. Deploy hosting:

```bash
npx firebase deploy --only hosting
```

## Initial Firestore model

- `households/{householdId}`
  - `name`
  - `joinCode`
  - `currency` (`ZAR`)
  - `members[]`
- `joinCodes/{code}`
  - `householdId`
  - `createdAt`
- `profiles/{uid}`
  - `householdId`

## Next implementation priorities

1. Replace mock finance data with Firestore read/write collections.
2. Complete join-code creation/join flow and phone OTP verification UI.
3. Add receipt upload to Storage and CSV/PDF export functions.
4. Add offline queue replay + conflict strategy (last-write + timeline log).
