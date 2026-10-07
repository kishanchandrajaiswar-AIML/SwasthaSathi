<div align="center">
  <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80" alt="SwasthaSathi Banner" width="600" style="border-radius: 12px;"/>
  <h1>🏥 SwasthaSathi</h1>
  <p><strong>AI-Powered Healthcare Triage & Rural Facility Navigation System</strong></p>
  <p>A Hackathon Project built for seamless patient triaging, bilingual voice support, and deterministic safety checks.</p>
</div>

<br>

## 🚀 The Problem
In rural and semi-urban healthcare settings, patient overcrowding and lack of immediate triaging leads to delayed care for critical patients. Frontline health workers (ASHAs/ANMs) often face language barriers and rely on manual symptom checks, causing inefficiencies and potential misdiagnoses.

## 💡 The Solution: SwasthaSathi
**SwasthaSathi** is a mobile-first, production-ready web platform that acts as an intelligent clinical decision support system. It listens to symptoms via voice (Hindi/Marathi/English), transcribes them, and runs them through a dual-engine architecture:
1. **Groq-Powered LLM**: Understands complex colloquial symptom descriptions.
2. **Deterministic Safety Rules**: Guarantees zero-hallucination detection of Red Flags (e.g., chest pain, breathing difficulty) to immediately suggest emergency responses.

## ✨ Key Features
- 🎙️ **Multilingual Voice Assistant**: Uses Groq Whisper STT to allow patients and workers to speak symptoms in Hindi, Marathi, or English.
- 🩺 **Deterministic Safety Triage**: AI extracts symptoms, but clinical risk leveling (HOME_CARE vs VISIT_PHC vs EMERGENCY) is governed by strict, hardcoded medical safety rules.
- 📍 **GPS-Powered Facility Locator**: Automatically detects the user's location and calculates the distance to the nearest verified PHC, CHC, and private clinics.
- 🔐 **Supabase Cloud Integration**: Full authentication (Patient & Clinician portals) and secure storage of health records using Row Level Security (RLS).
- 📊 **Lab Report Explainer**: Evaluates laboratory values strictly against printed reference ranges to avoid diagnosis hallucination.
- 📱 **Mobile-First Glassmorphism UI**: Beautiful, lightweight Vanilla CSS framework built to feel like a premium native mobile application on any device.

## 🛠️ Technology Stack
- **Frontend**: HTML5, Vanilla JavaScript, Custom CSS3 (Glassmorphism & Micro-animations)
- **Backend API**: Python 3 (Native `http.server` for zero-dependency portability)
- **Database & Auth**: Supabase (PostgreSQL, GoTrue Auth, RLS)
- **AI & Processing**: Groq LLM API (Llama 3 / Mixtral for NLP), Groq Whisper (Speech-to-Text)
- **Deployment**: Render.com (Backend + Frontend unified hosting)

## ⚙️ Local Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kishanchandrajaiswar-AIML/SwasthaSathi.git
   cd SwasthaSathi
   ```

2. **Set up the Python Environment:**
   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # Mac/Linux
   source .venv/bin/activate
   
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (do not commit it!) and add your keys:
   ```env
   GROQ_API_KEY=gsk_your_groq_key_here
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJ...your_anon_key
   PORT=8080
   ```

4. **Run the Application:**
   ```bash
   python server.py
   ```
   Open `http://localhost:8080` in your browser.

## ☁️ Cloud Deployment (Render.com)
SwasthaSathi is fully configured for automatic deployment on Render.
1. Create a New **Web Service** on Render.com.
2. Connect this GitHub repository.
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `python server.py`
5. Add `GROQ_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` as Environment Variables.

---
*Built with ❤️ for Healthcare Innovation.*
