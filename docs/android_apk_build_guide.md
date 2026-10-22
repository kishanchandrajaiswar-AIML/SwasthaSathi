# SwasthaSathi Android APK Build & Deployment Guide

This guide describes how to build, test, and generate the release **SwasthaSathi Android APK** with bundled UI and Supabase Edge Functions.

---

## 🏛️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SwasthaSathi Android APK                 │
│         (Native Android Wrapper with Bundled Web UI)        │
│                                                             │
│   • HTML / CSS / JS assets bundled inside app (assets/public)│
│   • Offline Deterministic Safety Engine (0 ms latency)      │
│   • Local Storage for Vitals & Patient History              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                (Internet connection for online features)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Edge Functions                    │
│                 (Secure Serverless Backend)                 │
│                                                             │
│   • POST /functions/v1/triage      -> Groq Llama 3.3 70B    │
│   • POST /functions/v1/transcribe  -> Groq Whisper STT      │
│   • POST /functions/v1/report      -> Lab Range Comparator  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       ┌─────────────────┐           ┌─────────────────┐
       │     Groq AI     │           │    Supabase     │
       │ (AI Assessment) │           │ (Auth & Data)   │
       └─────────────────┘           └─────────────────┘
```

---

## 🛠️ Prerequisites

1. **Node.js** (v18 or higher)
2. **Android Studio** (Koala / Hedgehog or newer) with:
   - Android SDK (API level 33 or 34 recommended)
   - Android SDK Build-Tools
   - Java Development Kit (JDK 17 or 21)
3. **Supabase CLI** (optional, for deploying edge functions):
   ```bash
   npm install -g supabase
   ```

---

## 🚀 Step-by-Step Build Instructions

### 1. Build and Sync Web Assets
Compile and sync your web application assets into the Android native assets directory:
```bash
npm run cap:build
```
This runs `node build.cjs` and synchronizes `dist/` directly into `android/app/src/main/assets/public`.

---

### 2. Open Project in Android Studio
To open the native Android project in Android Studio:
```bash
npm run cap:open
```
Or open the `android/` folder directly from Android Studio.

---

### 3. Build APK via Command Line (Gradle)

If you have Android SDK and JDK configured in your environment:

#### Debug APK:
```bash
cd android
./gradlew assembleDebug       # Linux / macOS
gradlew.bat assembleDebug     # Windows
```
The output APK will be generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

#### Release APK:
```bash
cd android
./gradlew assembleRelease     # Linux / macOS
gradlew.bat assembleRelease   # Windows
```
The output APK will be generated at:
`android/app/build/outputs/apk/release/app-release-unsigned.apk`

---

## ⚡ Deploying Supabase Edge Functions

To deploy the secure AI backend functions to your Supabase project (`gsrosxssydqirmhgwpdo`):

1. **Login to Supabase CLI:**
   ```bash
   npx supabase login
   ```

2. **Link Your Project:**
   ```bash
   npx supabase link --project-ref gsrosxssydqirmhgwpdo
   ```

3. **Set the Secret Groq API Key:**
   ```bash
   npx supabase secrets set GROQ_API_KEY=your_groq_api_key_here
   ```

4. **Deploy Edge Functions:**
   ```bash
   npx supabase functions deploy triage --no-verify-jwt
   npx supabase functions deploy transcribe --no-verify-jwt
   npx supabase functions deploy report --no-verify-jwt
   ```

---

## 🔒 Security Best Practices

1. **Zero Secret Leaks in APK**:
   The Android APK only holds the public `SUPABASE_ANON_KEY`. The `GROQ_API_KEY` is securely stored inside Supabase Secrets and accessed exclusively by the serverless Edge Functions.
2. **Deterministic Offline Emergency Protection**:
   Critical emergency triggers (heart attack, stroke, acute respiratory distress, severe poisoning) are processed client-side immediately, enabling the 108/112 dialer even without network connectivity.
3. **Row-Level Security (RLS)**:
   All patient and doctor records in PostgreSQL are strictly segregated by `auth.uid() = user_id`.
