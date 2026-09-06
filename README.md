````markdown
# Gemini Clarity

### Write anything. Understand everything.

Gemini Clarity is a private AI thinking companion that helps people turn everyday reflections into clearer thinking.

Instead of treating a journal as a collection of isolated entries, Gemini Clarity helps users explore conversations around their thoughts, discover how their thinking evolves over time, and ask grounded questions about their own journal.

---

## Why Gemini Clarity?

Most AI journaling experiences stop at generating a response to the current entry.

Gemini Clarity goes further:

**Write → Reflect → Save → Discover connections → Ask your journal**

Its signature feature, **Life Threads**, connects related reflections and shows how an idea, concern, or decision changes across a user's thinking.

---

## Key Features

### 🧠 Deepen with Gemini

Turn a written reflection into a private, multi-turn conversation with Gemini.

Gemini helps the user explore the thought more deeply while preserving the original reflection and conversation context.

### 🧵 Life Threads

Life Threads discovers meaningful connections across saved reflections.

It can surface:

- recurring thoughts
- changing perspectives
- repeated concerns
- evolving decisions
- unresolved questions

Connections are grounded in the user's own saved reflections rather than invented personal history.

### 🔎 Ask My Journal

Ask natural-language questions about your journal.

Responses separate:

- **Answer** — what the journal evidence supports
- **Evidence** — the reflections supporting the answer
- **Gemini Interpretation** — Gemini's interpretation of the evidence

When the journal does not contain enough evidence, Gemini Clarity avoids fabricating an answer.

### ✍️ Reflection Journal

Write, save, revisit, and manage personal reflections in a private journal.

Reflections remain available across authenticated sessions.

### 🔐 Private by Architecture

User identity is established through Firebase Authentication, while journal data is accessed through authenticated server APIs.

The browser never directly reads or writes the application's Firestore data.

---

## The Gemini Clarity Experience

```text
Write a thought
      ↓
Deepen with Gemini
      ↓
Save the reflection
      ↓
Discover Life Threads
      ↓
Ask My Journal
      ↓
Understand how your thinking evolves
````

---

## Architecture

```text
┌──────────────────────────────┐
│          Browser             │
│                              │
│ React + TypeScript + Vite    │
└──────────────┬───────────────┘
               │
               │ Firebase Google Sign-In
               ▼
┌──────────────────────────────┐
│       Cloud Run API          │
│                              │
│ Express + Firebase Admin     │
│ Authenticated API boundary   │
└───────┬──────────┬───────────┘
        │          │
        │          └──────────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐             ┌─────────────────┐
│   Firestore   │             │ Secret Manager  │
│               │             │                 │
│ User-isolated │             │ Gemini API key  │
│ journal data  │             │ pinned version  │
└───────────────┘             └────────┬────────┘
                                      │
                                      ▼
                              ┌─────────────────┐
                              │   Gemini API    │
                              │                 │
                              │ Multi-turn AI   │
                              └─────────────────┘
```

### Request flow

1. The user authenticates with Google through Firebase Authentication.
2. The browser obtains a Firebase ID token.
3. The browser sends authenticated requests to the Cloud Run backend.
4. Cloud Run verifies the Firebase token server-side.
5. The server derives the user's UID from the verified token.
6. Firestore operations are restricted to that user's data.
7. Gemini credentials are retrieved server-side from Google Cloud Secret Manager.
8. Gemini interactions remain behind the authenticated server boundary.

---

## Security & Privacy

Security is a core part of Gemini Clarity rather than an afterthought.

### Authentication

* Google Sign-In through Firebase Authentication
* Firebase ID tokens verified server-side
* Revocation-aware token verification
* Protected API boundaries
* Logout and transient session cleanup

### Authorization & Data Isolation

* User identity is derived from the verified Firebase token
* Client-supplied UID values are ignored
* Firestore client read/write access is denied
* Backend data paths are constructed from the authenticated UID
* Cross-user resource access is rejected
* Resource IDs are validated before database access

### Secret Protection

* Gemini credentials are stored in Google Cloud Secret Manager
* Secret Manager access uses Application Default Credentials
* A pinned secret version is used in production
* Gemini credentials are never exposed to the frontend
* No service-account private key is stored in source control
* Production credential failures fail closed

### AI Security

* User content is treated as untrusted input
* Prompt-injection attempts are explicitly considered
* Gemini responses are handled through server-side boundaries
* Life Threads validates evidence references against retrieved user-owned reflections
* Ask My Journal validates evidence before presenting journal-grounded results
* Unsupported claims are not presented as confirmed journal facts

### API & Reliability Security

* Request payload size limits
* Malformed JSON protection
* Resource ID validation
* Defensive error handling
* Bounded Gemini retries
* Idempotency protection for repeated submissions
* Safe errors without stack-trace leakage
* Network and database failure recovery with draft preservation

---

## Firestore Security

The browser is intentionally prevented from directly accessing application data.

Firestore client rules use a deny-by-default posture:

```text
allow read, write: if false;
```

Application data is managed through the authenticated Cloud Run backend using Firebase Admin SDK and Application Default Credentials.

This ensures that the browser cannot bypass the application's authorization layer to directly read or modify private journal records.

---

## Secret Manager

Production Gemini credentials are retrieved from Google Cloud Secret Manager.

The production configuration uses:

```text
GEMINI_PROJECT_ID=gen-lang-client-0498593678
GEMINI_SECRET_NAME=My_Gemini_Key
GEMINI_SECRET_VERSION=1
```

The actual secret value is never committed to source control.

Never place the real Gemini API key in:

* source files
* `.env` files committed to Git
* frontend code
* client bundles
* API responses
* documentation

---

## Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Lucide icons
* Motion

### Backend

* Node.js
* Express
* TypeScript
* esbuild

### Google Cloud & Firebase

* Firebase Authentication
* Google Cloud Firestore
* Google Cloud Secret Manager
* Google Cloud Run
* Gemini API
* Firebase Admin SDK
* Application Default Credentials (ADC)

---

## Project Structure

```text
gemini-clarity/
│
├── src/
│   ├── components/
│   │   ├── auth/
│   │   ├── home/
│   │   ├── journal/
│   │   ├── reflections/
│   │   ├── threads/
│   │   └── ask/
│   │
│   ├── context/
│   ├── lib/
│   ├── services/
│   └── types/
│
├── server/
│   ├── config/
│   ├── lib/
│   ├── middleware/
│   ├── services/
│   └── types/
│
├── firestore.rules
├── firebase-applet-config.json
├── server.ts
├── vite.config.ts
├── package.json
└── tsconfig.json
```

---

## Data Model

Gemini Clarity manages authenticated user-owned data including:

* Reflections
* Conversations
* Life Threads
* Insights
* User preferences

AI-derived resources are generated and stored through the backend rather than directly from the browser.

---

## Local Development

Install dependencies:

```bash
npm install
```

Run the development environment:

```bash
npm run dev
```

Build the application:

```bash
npm run build
```

Run the production server:

```bash
npm start
```

### Configuration

Use the appropriate Firebase configuration and server-side Google Cloud configuration for your environment.

Never commit:

```text
.env
service-account private keys
Gemini API keys
other secret credentials
```

Firebase web configuration values such as the Firebase project ID and web API key are application configuration and are not substitutes for the protected Gemini credential.

---

## Firebase Setup

Gemini Clarity uses Firebase Authentication for Google Sign-In.

The application uses the authenticated Firebase identity to establish the user's UID.

The backend then verifies the Firebase ID token before allowing protected operations.

---

## Cloud Run Deployment

Gemini Clarity is deployed as a production web application on Google Cloud Run.

The backend:

* runs as an Express server
* verifies Firebase Authentication tokens
* accesses Firestore server-side
* retrieves Gemini credentials from Secret Manager
* communicates with Gemini server-side

### Challenge Verification Label

```text
dev-tutorial=cloud-run-ai-challenge
```

---

## Testing & Verification

Gemini Clarity has been tested across functional, security, stability, and regression scenarios.

### Authentication

* Google Sign-In
* Protected API requests
* Invalid JWT rejection
* Tampered JWT rejection
* Logout and session cleanup

### User Isolation

* Cross-user reflection access
* Cross-user conversation access
* Cross-user Life Thread access
* Spoofed UID parameters
* Arbitrary Firestore path attempts

### AI Security

* Prompt-injection attempts
* Fake evidence ID injection
* Evidence validation
* Insufficient-evidence handling

### Input & API Reliability

* Oversized request rejection
* Malformed JSON handling
* Gemini rate-limit handling
* Gemini service-unavailable handling
* Firestore persistence failures
* Network interruptions
* Duplicate submissions and idempotency

### Application Regression

* Reflection creation and persistence
* Reflection history
* Multi-turn Thinking Companion
* Life Threads
* Ask My Journal
* Logout and re-login
* Production build

### Build Validation

```text
TypeScript: PASS
Production Build: PASS
Server Startup: PASS
```

---

## Screenshots & Demo

The following screenshots can be added here:

1. Home / Thought Canvas
2. Reflection Editor
3. Deepen with Gemini
4. Life Threads
5. Ask My Journal

### Live Application

```text
https://gemini-clarity-1073609439419.us-west1.run.app
```

---

## Google Gen AI Academy APAC — Cohort 3 Ideathon

Gemini Clarity was created for the Google Gen AI Academy APAC Edition Cohort 3 Ideathon.

The project combines:

* Firebase Authentication
* Cloud Firestore
* Cloud Run
* Gemini
* Secret Manager

The goal is to demonstrate how generative AI can become a secure, useful thinking companion while keeping personal journal data isolated and protected.

---

## Future Improvements

Potential future directions include:

* richer temporal visualization of Life Threads
* user-controlled memory management
* deeper privacy-preserving insights
* additional reflection analysis tools

---

## Privacy Principle

Gemini Clarity is designed around a simple principle:

> Your journal belongs to you.

AI helps interpret and connect your reflections, but the system should distinguish between what your journal actually contains and what Gemini infers from it.

AI-generated insights never replace the underlying journal evidence.

````
