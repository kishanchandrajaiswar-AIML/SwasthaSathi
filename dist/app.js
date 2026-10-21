/**
 * SwasthaSathi Real Healthcare Application Controller.
 * Fully connected to Python backend (Groq LLM + Deterministic Safety Engine)
 * and Supabase Cloud Auth & PostgreSQL Database with Row-Level Security (RLS).
 *
 * Key Capabilities:
 * 1. Role-Based Access Control (Patient, Verified Doctor, Pending Doctor)
 * 2. Authentic Doctor Directory with State Medical Council (MMC) Registrations
 * 3. Real Appointment Booking & Consultation Queue Flow
 * 4. Transparent AI Symptom Assessment with Deterministic Emergency Red Flags
 * 5. Clinical Guidelines & Medical Governance (MoHFW, NHM, WHO IMNCI, Tele-MANAS)
 * 6. Isolated Sandbox Demo Mode with 1-Click Role Testing for Judges
 */

(function () {
  'use strict';

  // Application State
  const state = {
    currentView: 'home',
    currentLang: 'en',
    sessionId: 'session-' + Math.random().toString(36).substring(2, 9),
    triageRisk: 'HOME_CARE',
    symptomText: '',
    followups: [],
    followupIndex: 0,
    isEvaluating: false,
    selectedSlot: 'Morning OPD (9:00 AM - 1:00 PM)',
    currentRecommendedDoctor: null,
    
    // User & Profile
    currentUser: null,
    currentProfile: null,
    doctorVerif: null,

    // Location & Facilities
    userLocation: {
      name: '',
      lat: null,
      lng: null,
      isExactGPS: false,
      isManual: false
    },
    facilityFilter: 'ALL',
    facilities: [],
    verifiedDoctors: [],
    appointments: [],

    // Voice Recording State
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    recordingTimerInterval: null,
    recordingSeconds: 0,
    speechRecognition: null,

    // Patient Vitals Record
    patientVitals: {
      temp: null,
      bp: null,
      sugar: null,
      hr: null
    }
  };

  // Multilingual Strings
  const i18n = {
    en: {
      appName: 'SwasthaSathi',
      greetingGuest: 'Welcome, Guest',
      greetingUser: 'Hi, ',
      appointments: 'Upcoming Consultations',
      seeAll: 'See all PHCs',
      quickServices: 'Healthcare Services',
      vitalsHeading: 'Patient Vitals Record',
      recordVitalsBtn: '+ Record Vitals',
      checkSymptoms: 'Check Symptoms / New Triage',
      dockHome: 'Home',
      dockTriage: 'Triage',
      dockRecords: 'Records',
      dockPHCs: 'PHCs',
      dockProfile: 'Profile',
      evaluating: 'Evaluating Safety...',
      evaluateBtn: 'Evaluate Safety →',
      placeholder: 'Type or speak symptoms (e.g., 3-year-old child with high fever for 3 days and not drinking water...)',
      tapToSpeak: 'Tap to Speak',
      listening: 'Listening...',
      copySuccess: '✓ Referral summary copied to clipboard!'
    },
    hi: {
      appName: 'स्वास्थ्यसाथी',
      greetingGuest: 'नमस्ते, अतिथि',
      greetingUser: 'नमस्ते, ',
      appointments: 'आगामी परामर्श',
      seeAll: 'सभी केंद्र देखें',
      quickServices: 'स्वास्थ्य सेवाएं',
      vitalsHeading: 'मरीज़ स्वास्थ्य रिकॉर्ड',
      recordVitalsBtn: '+ माप दर्ज करें',
      checkSymptoms: 'लक्षण जांचें / नया ट्राइएज',
      dockHome: 'होम',
      dockTriage: 'ट्राइएज',
      dockRecords: 'रिपोर्ट्स',
      dockPHCs: 'पीएचसी',
      dockProfile: 'प्रोफाइल',
      evaluating: 'सुरक्षा जांच जारी है...',
      evaluateBtn: 'सुरक्षा जांच करें →',
      placeholder: 'लक्षण लिखें या बोलें (उदा: 3 साल के बच्चे को 3 दिन से तेज बुखार है और वह पानी नहीं पी रहा...)',
      tapToSpeak: 'बोलने के लिए दबाएं',
      listening: 'सुन रहा है...',
      copySuccess: '✓ आशा सारांश क्लिपबोर्ड पर कॉपी हो गया!'
    },
    mr: {
      appName: 'स्वास्थ्यसाथी',
      greetingGuest: 'स्वागत आहे, अतिथी',
      greetingUser: 'नमस्ते, ',
      appointments: 'आगामी वैद्यकीय सल्ला',
      seeAll: 'सर्व केंद्र पहा',
      quickServices: 'आरोग्य सेवा',
      vitalsHeading: 'रुग्ण आरोग्य नोंदी',
      recordVitalsBtn: '+ नोंदी करा',
      checkSymptoms: 'लक्षणे तपासा / नवीन ट्रायज',
      dockHome: 'मुख्य',
      dockTriage: 'ट्रायज',
      dockRecords: 'अहवाल',
      dockPHCs: 'पीएचसी',
      dockProfile: 'प्रोफाइल',
      evaluating: 'सुरक्षा तपासणी सुरू आहे...',
      evaluateBtn: 'सुरक्षा तपासा →',
      placeholder: 'लक्षणे लिहा किंवा बोला (उदा: 3 वर्षांच्या मुलाला 3 दिवस ताप आहे आणि पाणी पीत नाही...)',
      tapToSpeak: 'बोलण्यासाठी टॅप करा',
      listening: 'ऐकत आहे...',
      copySuccess: '✓ आशा सारांश क्लिपबोर्डवर कॉपी झाला!'
    }
  };

  const fallbackQuestions = [
    {
      qEn: 'Is there any difficulty breathing, wheezing, or chest indrawing?',
      qHi: 'क्या सांस लेने में कोई तकलीफ, घरघराहट या छाती खिंच रही है?',
      qMr: 'श्वास घेण्यास काही त्रास, घरघर किंवा छाती खोल जात आहे का?'
    },
    {
      qEn: 'Is the patient able to drink fluids and retain them without vomiting?',
      qHi: 'क्या मरीज पानी या तरल पदार्थ बिना उल्टी किए पी पा रहा है?',
      qMr: 'रुग्ण उलटी न करता पाणी किंवा द्रव पदार्थ पिण्यास सक्षम आहे का?'
    },
    {
      qEn: 'Are there any signs of extreme lethargy, drowsiness, or unresponsiveness?',
      qHi: 'क्या मरीज अत्यधिक सुस्त, बेहोश या अनुत्तरदायी लग रहा है?',
      qMr: 'रुग्ण खूप सुस्त, ग्लानीत किंवा प्रतिसाद देत नाही असे वाटते का?'
    }
  ];

  // DOM Elements Cache
  let views = {};
  let dockButtons = [];

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  async function init() {
    cacheDOMElements();
    startLiveClock();
    setupNavigation();
    setupLanguageSelector();
    setupVitalsModal();
    setupVoiceAssistant();
    setupTriageEngine();
    setupFacilitiesDirectory();
    setupAppointmentsSystem();
    setupSummaryHandoff();
    setupClinicalGuidelines();
    setupAuthHandlers();
    setupLabExplainer();
    setupPreferencesForm();
    setupLegalModals();
    setupCharCounter();

    const summarySessionId = document.getElementById('summarySessionId');
    if (summarySessionId) summarySessionId.textContent = state.sessionId;

    applyLanguage(state.currentLang);
    await fetchFacilities();
    await fetchVerifiedDoctors();

    // Initialize Supabase Client
    if (window.SwasthaSupabase) {
      window.SwasthaSupabase.onAuthStateChange(handleAuthChange);
      await window.SwasthaSupabase.init();
      const user = window.SwasthaSupabase.getUser();
      const profile = window.SwasthaSupabase.getProfileSync();
      handleAuthChange('INIT', null, profile, user);
    }

    await loadAppointments();

    // Route to URL hash if present
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && views[initialHash]) {
      switchView(initialHash);
    }

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '');
      if (h && views[h]) {
        switchView(h);
      }
    });
  }

  function cacheDOMElements() {
    views = {
      home: document.getElementById('view-home'),
      triage: document.getElementById('view-triage'),
      records: document.getElementById('view-records'),
      facilities: document.getElementById('view-facilities'),
      profile: document.getElementById('view-profile'),
      'doctor-dashboard': document.getElementById('view-doctor-dashboard'),
      'doctor-pending': document.getElementById('view-doctor-pending')
    };
    dockButtons = document.querySelectorAll('.dock-item');
  }

  // 1. Live Clock
  function startLiveClock() {
    const liveClock = document.getElementById('liveClock');
    function update() {
      const now = new Date();
      let h = now.getHours();
      let m = now.getMinutes();
      m = m < 10 ? '0' + m : m;
      if (liveClock) liveClock.textContent = `${h}:${m}`;
    }
    update();
    setInterval(update, 10000);
  }

  // 2. Navigation & Role-Based Routing
  function switchView(viewName) {
    // Role-based protection: non-doctors cannot view doctor dashboard
    if (viewName === 'doctor-dashboard') {
      const role = state.currentProfile && state.currentProfile.role;
      if (role !== 'doctor') {
        alert('Clinician verification required to access Doctor Portal. Please sign in with a verified clinician account.');
        switchView('profile');
        return;
      }
      if (state.doctorVerif && state.doctorVerif.status === 'pending') {
        viewName = 'doctor-pending';
      }
    }

    state.currentView = viewName;
    Object.keys(views).forEach(key => {
      if (views[key]) {
        views[key].classList.toggle('active', key === viewName);
      }
    });

    dockButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    document.querySelectorAll('.desktop-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    const scrollArea = document.getElementById('screenScrollArea');
    if (scrollArea) scrollArea.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'facilities') {
      fetchFacilities();
    }

    if (viewName === 'doctor-pending') {
      const pendingDocName = document.getElementById('pendingDocName');
      const pendingDocReg = document.getElementById('pendingDocReg');
      const pendingDocCouncil = document.getElementById('pendingDocCouncil');
      const pendingDocQual = document.getElementById('pendingDocQual');

      if (state.doctorVerif) {
        if (pendingDocName) pendingDocName.textContent = state.doctorVerif.full_name || (state.currentProfile && state.currentProfile.full_name) || 'Registered Medical Officer';
        if (pendingDocReg) pendingDocReg.textContent = state.doctorVerif.registration_number || 'MMC-PENDING';
        if (pendingDocCouncil) pendingDocCouncil.textContent = state.doctorVerif.medical_council || 'State Medical Council';
        if (pendingDocQual) pendingDocQual.textContent = state.doctorVerif.qualification || 'MBBS';
      }
    }
 else if (viewName === 'profile') {
      loadSavedRecommendations();
      loadUserPreferences();
      loadAppointments();
    } else if (viewName === 'doctor-dashboard') {
      loadDoctorDashboard();
    } else if (viewName === 'home') {
      loadAppointments();
    }
  }

  function setupNavigation() {
    dockButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        let targetView = btn.dataset.view;
        // If dock profile is clicked while in doctor mode, route to doctor dashboard
        if (targetView === 'profile' && state.currentProfile && state.currentProfile.role === 'doctor') {
          targetView = (state.doctorVerif && state.doctorVerif.status === 'pending') ? 'doctor-pending' : 'doctor-dashboard';
        }
        window.location.hash = targetView;
        switchView(targetView);
      });
    });

    const launchTriagePillBtn = document.getElementById('launchTriagePillBtn');
    if (launchTriagePillBtn) {
      launchTriagePillBtn.addEventListener('click', () => {
        window.location.hash = 'triage';
        switchView('triage');
      });
    }

    const btnGoToTriage = document.getElementById('btnGoToTriage');
    if (btnGoToTriage) {
      btnGoToTriage.addEventListener('click', () => {
        window.location.hash = 'triage';
        switchView('triage');
      });
    }

    const btnGoToFacilities = document.getElementById('btnGoToFacilities');
    if (btnGoToFacilities) {
      btnGoToFacilities.addEventListener('click', () => {
        window.location.hash = 'facilities';
        switchView('facilities');
      });
    }

    const btnGoToReports = document.getElementById('btnGoToReports');
    if (btnGoToReports) {
      btnGoToReports.addEventListener('click', () => {
        window.location.hash = 'records';
        switchView('records');
      });
    }

    const btnGoToGuidelinesCard = document.getElementById('btnGoToGuidelinesCard');
    if (btnGoToGuidelinesCard) {
      btnGoToGuidelinesCard.addEventListener('click', openGuidelinesModal);
    }

    const navLinkGuidelines = document.getElementById('navLinkGuidelines');
    if (navLinkGuidelines) {
      navLinkGuidelines.addEventListener('click', openGuidelinesModal);
    }

    const userAvatarBtn = document.getElementById('userAvatarBtn');
    if (userAvatarBtn) {
      userAvatarBtn.addEventListener('click', () => {
        if (!state.currentUser) {
          openAuthModal();
        } else if (state.currentProfile && state.currentProfile.role === 'doctor') {
          switchView(state.doctorVerif && state.doctorVerif.status === 'pending' ? 'doctor-pending' : 'doctor-dashboard');
        } else {
          switchView('profile');
        }
      });
    }
  }

  // 3. Language Selector
  function setupLanguageSelector() {
    const langButtons = document.querySelectorAll('.lang-btn');
    langButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        state.currentLang = lang;
        langButtons.forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
        applyLanguage(lang);
      });
    });
  }

  function applyLanguage(lang) {
    const s = i18n[lang] || i18n.en;
    const appHeaderTitle = document.getElementById('appHeaderTitle');
    const appointmentsHeading = document.getElementById('appointmentsHeading');
    const quickServicesHeading = document.getElementById('quickServicesHeading');
    const vitalsRecordHeading = document.getElementById('vitalsRecordHeading');
    const launchBtnText = document.getElementById('launchBtnText');
    const symptomTextArea = document.getElementById('symptomTextArea');
    const evaluateBtnLabel = document.getElementById('evaluateBtnLabel');
    const voiceMicLabel = document.getElementById('voiceMicLabel');

    if (appHeaderTitle) appHeaderTitle.textContent = s.appName;
    if (appointmentsHeading) appointmentsHeading.textContent = s.appointments;
    if (quickServicesHeading) quickServicesHeading.textContent = s.quickServices;
    if (vitalsRecordHeading) vitalsRecordHeading.textContent = s.vitalsHeading;
    if (launchBtnText) launchBtnText.textContent = s.checkSymptoms;
    if (symptomTextArea) symptomTextArea.placeholder = s.placeholder;
    if (evaluateBtnLabel) evaluateBtnLabel.textContent = s.evaluateBtn;
    if (voiceMicLabel) voiceMicLabel.textContent = s.tapToSpeak;

    const dockLabels = {
      home: document.getElementById('dockLabelHome'),
      triage: document.getElementById('dockLabelTriage'),
      records: document.getElementById('dockLabelRecords'),
      facilities: document.getElementById('dockLabelPHCs'),
      profile: document.getElementById('dockLabelProfile'),
    };
    if (dockLabels.home) dockLabels.home.textContent = s.dockHome;
    if (dockLabels.triage) dockLabels.triage.textContent = s.dockTriage;
    if (dockLabels.records) dockLabels.records.textContent = s.dockRecords;
    if (dockLabels.facilities) dockLabels.facilities.textContent = s.dockPHCs;
    if (dockLabels.profile) dockLabels.profile.textContent = s.dockProfile;

    updateGreetingText();
  }

  function updateGreetingText() {
    const appGreeting = document.getElementById('appGreeting');
    if (!appGreeting) return;

    const s = i18n[state.currentLang] || i18n.en;
    if (!state.currentUser) {
      appGreeting.textContent = s.greetingGuest;
    } else {
      const name = (state.currentProfile && state.currentProfile.full_name) || 'User';
      appGreeting.textContent = `${s.greetingUser}${name}`;
    }
  }

  // 4. Patient Vitals Modal
  function setupVitalsModal() {
    const vitalsModal = document.getElementById('vitalsModal');
    const btnOpenVitalsModal = document.getElementById('btnOpenVitalsModal');
    const closeVitalsModalBtn = document.getElementById('closeVitalsModalBtn');
    const cancelVitalsBtn = document.getElementById('cancelVitalsBtn');
    const vitalsInputForm = document.getElementById('vitalsInputForm');

    if (btnOpenVitalsModal && vitalsModal) {
      btnOpenVitalsModal.addEventListener('click', () => {
        vitalsModal.classList.remove('hidden');
      });
    }

    const closeModal = () => {
      if (vitalsModal) vitalsModal.classList.add('hidden');
    };

    if (closeVitalsModalBtn) closeVitalsModalBtn.addEventListener('click', closeModal);
    if (cancelVitalsBtn) cancelVitalsBtn.addEventListener('click', closeModal);

    if (vitalsInputForm) {
      vitalsInputForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputBodyTemp = document.getElementById('inputBodyTemp');
        const inputBP = document.getElementById('inputBP');
        const inputSugar = document.getElementById('inputSugar');
        const inputHeartRate = document.getElementById('inputHeartRate');

        const temp = inputBodyTemp.value ? parseFloat(inputBodyTemp.value) : null;
        const bp = inputBP.value.trim() || null;
        const sugar = inputSugar.value ? parseInt(inputSugar.value, 10) : null;
        const hr = inputHeartRate.value ? parseInt(inputHeartRate.value, 10) : null;

        state.patientVitals = { temp, bp, sugar, hr };
        updateVitalsUI();
        closeModal();

        try {
          await fetch('/api/vitals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              temperature: temp,
              blood_pressure: bp,
              blood_glucose: sugar,
              heart_rate: hr
            })
          });
        } catch (err) {
          console.warn('Vitals sync skipped:', err);
        }
      });
    }
  }

  function updateVitalsUI() {
    const v = state.patientVitals;
    const valTempDisplay = document.getElementById('valTempDisplay');
    const valTempStatus = document.getElementById('valTempStatus');
    const valBPDisplay = document.getElementById('valBPDisplay');
    const valBPStatus = document.getElementById('valBPStatus');
    const valSugarDisplay = document.getElementById('valSugarDisplay');
    const valSugarStatus = document.getElementById('valSugarStatus');
    const valHRDisplay = document.getElementById('valHRDisplay');
    const valHRStatus = document.getElementById('valHRStatus');

    if (valTempDisplay && v.temp) {
      valTempDisplay.textContent = v.temp.toFixed(1);
      valTempStatus.textContent = v.temp > 100.4 ? 'Elevated (Fever)' : 'Within normal limits';
      valTempStatus.style.color = v.temp > 100.4 ? '#F59E0B' : '#10B981';
    }
    if (valBPDisplay && v.bp) {
      valBPDisplay.textContent = v.bp;
      valBPStatus.textContent = 'Clinically recorded';
      valBPStatus.style.color = '#10B981';
    }
    if (valSugarDisplay && v.sugar) {
      valSugarDisplay.textContent = v.sugar;
      valSugarStatus.textContent = v.sugar > 140 ? 'High baseline' : 'Normal fasting';
      valSugarStatus.style.color = v.sugar > 140 ? '#F59E0B' : '#10B981';
    }
    if (valHRDisplay && v.hr) {
      valHRDisplay.textContent = v.hr;
      valHRStatus.textContent = (v.hr >= 60 && v.hr <= 100) ? 'Normal resting pulse' : 'Review clinically';
      valHRStatus.style.color = (v.hr >= 60 && v.hr <= 100) ? '#10B981' : '#F59E0B';
    }
  }

  // 5. Voice Assistant (Whisper STT + Fallback)
  function setupVoiceAssistant() {
    const voiceMicBtn = document.getElementById('voiceMicBtn');
    const voiceModal = document.getElementById('voiceModal');
    const closeVoiceModalBtn = document.getElementById('closeVoiceModalBtn');
    const btnStopVoiceRecord = document.getElementById('btnStopVoiceRecord');
    const symptomTextArea = document.getElementById('symptomTextArea');

    if (voiceMicBtn && voiceModal) {
      voiceMicBtn.addEventListener('click', () => {
        voiceModal.classList.remove('hidden');
        startVoiceRecording();
      });
    }

    const closeVModal = () => {
      stopVoiceRecording(false);
      if (voiceModal) voiceModal.classList.add('hidden');
    };

    if (closeVoiceModalBtn) closeVoiceModalBtn.addEventListener('click', closeVModal);
    if (btnStopVoiceRecord) {
      btnStopVoiceRecord.addEventListener('click', () => {
        stopVoiceRecording(true);
        if (voiceModal) voiceModal.classList.add('hidden');
      });
    }

    // Voice Scenario Chips
    document.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const phrase = btn.dataset.phrase;
        if (phrase && symptomTextArea) {
          symptomTextArea.value = phrase;
          closeVModal();
          runTriageSafetyCheck();
        }
      });
    });
  }

  function startVoiceRecording() {
    state.isRecording = true;
    state.audioChunks = [];
    state.recordingSeconds = 0;

    const timer = document.getElementById('recordingTimer');
    const statusText = document.getElementById('voiceStatusText');
    const pulsingRing = document.getElementById('pulsingMicRing');

    if (pulsingRing) pulsingRing.classList.add('active');
    if (statusText) statusText.textContent = (i18n[state.currentLang] || i18n.en).listening;

    if (state.recordingTimerInterval) clearInterval(state.recordingTimerInterval);
    state.recordingTimerInterval = setInterval(() => {
      state.recordingSeconds++;
      let s = state.recordingSeconds;
      let m = Math.floor(s / 60);
      let sec = s % 60;
      if (timer) timer.textContent = `0${m}:${sec < 10 ? '0' : ''}${sec}`;
    }, 1000);

    // Browser Speech Recognition fallback for immediate text
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        state.speechRecognition = new SpeechRecognition();
        state.speechRecognition.lang = state.currentLang === 'hi' ? 'hi-IN' : (state.currentLang === 'mr' ? 'mr-IN' : 'en-IN');
        state.speechRecognition.continuous = true;
        state.speechRecognition.interimResults = false;

        state.speechRecognition.onresult = (e) => {
          const res = e.results[e.results.length - 1][0].transcript;
          const symptomTextArea = document.getElementById('symptomTextArea');
          if (symptomTextArea && res) {
            symptomTextArea.value = (symptomTextArea.value + ' ' + res).trim();
          }
        };
        state.speechRecognition.start();
      } catch (e) {
        console.warn('SpeechRecognition start err:', e);
      }
    }

    // Audio stream for backend Groq Whisper
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        state.mediaRecorder = new MediaRecorder(stream);
        state.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) state.audioChunks.push(e.data);
        };
        state.mediaRecorder.start();
      }).catch(err => {
        console.warn('Microphone access unavailable:', err);
      });
    }
  }

  function stopVoiceRecording(processServer = true) {
    state.isRecording = false;
    if (state.recordingTimerInterval) clearInterval(state.recordingTimerInterval);

    const pulsingRing = document.getElementById('pulsingMicRing');
    if (pulsingRing) pulsingRing.classList.remove('active');

    if (state.speechRecognition) {
      try { state.speechRecognition.stop(); } catch (e) {}
    }

    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      state.mediaRecorder.stop();
      if (processServer) {
        state.mediaRecorder.onstop = async () => {
          if (state.audioChunks.length === 0) return;
          const blob = new Blob(state.audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const b64 = reader.result;
            try {
              const res = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audio_base64: b64,
                  language: state.currentLang
                })
              });
              const data = await res.json();
              if (data.success && data.transcript) {
                const symptomTextArea = document.getElementById('symptomTextArea');
                if (symptomTextArea) {
                  symptomTextArea.value = data.transcript;
                }
              }
            } catch (e) {
              console.warn('Transcription failed:', e);
            }
          };
          reader.readAsDataURL(blob);
        };
      }
    }
  }

  // 6. Symptom Triage Engine
  function setupTriageEngine() {
    const evaluateSymptomBtn = document.getElementById('evaluateSymptomBtn');
    const clearSymptomBtn = document.getElementById('clearSymptomBtn');
    const followupYesBtn = document.getElementById('followupYesBtn');
    const followupNoBtn = document.getElementById('followupNoBtn');
    const symptomTextArea = document.getElementById('symptomTextArea');

    if (evaluateSymptomBtn) {
      evaluateSymptomBtn.addEventListener('click', runTriageSafetyCheck);
    }

    document.querySelectorAll('.scenario-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (symptomTextArea) {
          symptomTextArea.value = chip.dataset.text;
          runTriageSafetyCheck();
        }
      });
    });

    if (clearSymptomBtn) {
      clearSymptomBtn.addEventListener('click', () => {
        if (symptomTextArea) symptomTextArea.value = '';
        state.followups = [];
        state.followupIndex = 0;
        const followupDrawer = document.getElementById('followupDrawer');
        const emergencyAlertBanner = document.getElementById('emergencyAlertBanner');
        const recCard = document.getElementById('recommendedDoctorCard');
        if (followupDrawer) followupDrawer.classList.add('hidden');
        if (emergencyAlertBanner) emergencyAlertBanner.classList.add('hidden');
        if (recCard) recCard.classList.add('hidden');

        updateSpectrumGauge('HOME_CARE');
        const recActionBody = document.getElementById('recActionBody');
        const warningSignsUl = document.getElementById('warningSignsUl');
        const auditSourceTag = document.getElementById('auditSourceTag');
        if (recActionBody) recActionBody.textContent = 'Enter symptoms above to run deterministic red-flag checks and structured triage.';
        if (warningSignsUl) warningSignsUl.innerHTML = '<li>• Inability to keep oral fluids down or dehydration</li><li>• Rapid or labored breathing (grunting, chest indrawing)</li>';
        if (auditSourceTag) auditSourceTag.textContent = 'Source: DETERMINISTIC_VALIDATED';
      });
    }

    if (followupYesBtn && followupNoBtn) {
      followupYesBtn.addEventListener('click', () => handleFollowupChoice('Yes'));
      followupNoBtn.addEventListener('click', () => handleFollowupChoice('No'));
    }
  }

  async function runTriageSafetyCheck() {
    const symptomTextArea = document.getElementById('symptomTextArea');
    const text = symptomTextArea ? symptomTextArea.value.trim() : '';
    if (!text) {
      alert('Please enter or dictate symptoms first.');
      return;
    }

    state.symptomText = text;
    state.followups = [];
    state.followupIndex = 0;
    state.isEvaluating = true;

    const triageSpinner = document.getElementById('triageSpinner');
    const evaluateBtnLabel = document.getElementById('evaluateBtnLabel');
    const evaluateSymptomBtn = document.getElementById('evaluateSymptomBtn');

    if (triageSpinner) triageSpinner.classList.remove('hidden');
    if (evaluateBtnLabel) evaluateBtnLabel.textContent = (i18n[state.currentLang] || i18n.en).evaluating;
    if (evaluateSymptomBtn) evaluateSymptomBtn.disabled = true;

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          language: state.currentLang,
          session_id: state.sessionId,
          follow_ups: state.followups
        })
      });

      const data = await response.json();
      state.isEvaluating = false;
      if (triageSpinner) triageSpinner.classList.add('hidden');
      if (evaluateBtnLabel) evaluateBtnLabel.textContent = (i18n[state.currentLang] || i18n.en).evaluateBtn;
      if (evaluateSymptomBtn) evaluateSymptomBtn.disabled = false;

      if (!data.success) {
        throw new Error(data.error || 'Server evaluation error');
      }

      displayTriageResult(data.triage_result, data.summary_text);
    } catch (err) {
      console.warn('API fetch failed, falling back to local deterministic rule check:', err);
      state.isEvaluating = false;
      if (triageSpinner) triageSpinner.classList.add('hidden');
      if (evaluateBtnLabel) evaluateBtnLabel.textContent = (i18n[state.currentLang] || i18n.en).evaluateBtn;
      if (evaluateSymptomBtn) evaluateSymptomBtn.disabled = false;

      runClientSideDeterministicRules(text);
    }
  }

  function displayTriageResult(tr, summaryMemo) {
    const risk = tr.risk_level;
    updateSpectrumGauge(risk);

    const emergencyAlertBanner = document.getElementById('emergencyAlertBanner');
    const emergencyRuleReason = document.getElementById('emergencyRuleReason');
    const followupDrawer = document.getElementById('followupDrawer');
    const recActionBody = document.getElementById('recActionBody');
    const auditSourceTag = document.getElementById('auditSourceTag');
    const warningSignsUl = document.getElementById('warningSignsUl');
    const summaryPreBlock = document.getElementById('summaryPreBlock');

    if (risk === 'EMERGENCY') {
      if (emergencyAlertBanner) emergencyAlertBanner.classList.remove('hidden');
      if (emergencyRuleReason) emergencyRuleReason.textContent = tr.reasoning_summary || 'Critical clinical red flag detected. Zero network delay short-circuit.';
      if (followupDrawer) followupDrawer.classList.add('hidden');
    } else {
      if (emergencyAlertBanner) emergencyAlertBanner.classList.add('hidden');
      if (risk === 'VISIT_PHC') {
        showFollowupStep(0);
      }
    }

    if (recActionBody) recActionBody.innerHTML = tr.recommended_action || 'Follow clinical guidance.';
    if (auditSourceTag) auditSourceTag.textContent = `Source: ${tr.risk_source} • Rules: 2026.1`;

    if (warningSignsUl) {
      if (tr.warning_signs && tr.warning_signs.length > 0) {
        warningSignsUl.innerHTML = tr.warning_signs.map(ws => `<li>• ${ws}</li>`).join('');
      } else {
        warningSignsUl.innerHTML = '<li>• Monitor body temperature every 4 hours</li><li>• Seek immediate medical evaluation if fluid intake stops or breathing becomes labored</li>';
      }
    }

    if (summaryMemo && summaryPreBlock) {
      summaryPreBlock.textContent = summaryMemo;
    }

    matchAndShowRecommendedDoctor(risk, state.symptomText);
  }

  function runClientSideDeterministicRules(text) {
    const lower = text.toLowerCase();
    const isCardiac = lower.includes('chest') || lower.includes('heart') || lower.includes('सीने') || lower.includes('छाती') || lower.includes('पसीना');
    const isPediatricFever = lower.includes('child') || lower.includes('fever') || lower.includes('बच्चे') || lower.includes('ताप') || lower.includes('बुखार');

    let risk = 'HOME_CARE';
    let action = 'Rest and monitor symptoms at home. Maintain adequate hydration with boiled drinking water or ORS.';
    let source = 'DETERMINISTIC_OFFLINE_RULES';

    if (isCardiac) {
      risk = 'EMERGENCY';
      action = '<b>CRITICAL EMERGENCY:</b> Severe cardiac distress indicators matched. Call 108 or 112 immediately. Do not drive yourself.';
    } else if (isPediatricFever) {
      risk = 'VISIT_PHC';
      action = 'Take the patient to the nearest Primary Health Centre (PHC) today for in-person evaluation by a Medical Officer under IMNCI pediatric guidelines.';
    }

    const fallbackResult = {
      risk_level: risk,
      recommended_action: action,
      risk_source: source,
      reasoning_summary: isCardiac ? 'Emergency cardiovascular red-flag indicators detected.' : 'Clinical symptoms require in-person primary health centre assessment.',
      warning_signs: ['Inability to retain liquids or severe dehydration', 'Rapid or labored breathing', 'Drowsiness or reduced responsiveness']
    };

    displayTriageResult(fallbackResult, null);
    generateClientSideSummaryMemo(fallbackResult);
  }

  function showFollowupStep(idx) {
    const followupDrawer = document.getElementById('followupDrawer');
    const followupStepIndicator = document.getElementById('followupStepIndicator');
    const followupQuestionText = document.getElementById('followupQuestionText');

    if (!followupDrawer) return;

    if (idx >= fallbackQuestions.length) {
      followupDrawer.classList.add('hidden');
      return;
    }

    state.followupIndex = idx;
    const qObj = fallbackQuestions[idx];
    const qText = state.currentLang === 'hi' ? qObj.qHi : (state.currentLang === 'mr' ? qObj.qMr : qObj.qEn);

    if (followupStepIndicator) followupStepIndicator.textContent = `Safety Follow-up ${idx + 1} of ${fallbackQuestions.length}`;
    if (followupQuestionText) followupQuestionText.textContent = qText;
    followupDrawer.classList.remove('hidden');
  }

  function handleFollowupChoice(ans) {
    const qObj = fallbackQuestions[state.followupIndex];
    const qText = state.currentLang === 'hi' ? qObj.qHi : (state.currentLang === 'mr' ? qObj.qMr : qObj.qEn);

    state.followups.push({ question: qText, answer: ans });

    if (ans === 'Yes' && state.followupIndex === 0) {
      // Respiratory distress escalation
      updateSpectrumGauge('EMERGENCY');
      const emergencyAlertBanner = document.getElementById('emergencyAlertBanner');
      const emergencyRuleReason = document.getElementById('emergencyRuleReason');
      if (emergencyAlertBanner) emergencyAlertBanner.classList.remove('hidden');
      if (emergencyRuleReason) emergencyRuleReason.textContent = 'Respiratory distress confirmed during clinical follow-up. Short-circuiting to immediate emergency escalation.';
      const followupDrawer = document.getElementById('followupDrawer');
      if (followupDrawer) followupDrawer.classList.add('hidden');
      return;
    }

    showFollowupStep(state.followupIndex + 1);
  }

  function updateSpectrumGauge(riskLevel) {
    state.triageRisk = riskLevel;
    const spectrumPin = document.getElementById('spectrumPin');
    const triageSpectrumBadge = document.getElementById('triageSpectrumBadge');
    const spectrumExplanation = document.getElementById('spectrumExplanation');

    if (!spectrumPin || !triageSpectrumBadge || !spectrumExplanation) return;

    if (riskLevel === 'EMERGENCY') {
      spectrumPin.style.left = '83.3%';
      triageSpectrumBadge.textContent = 'EMERGENCY';
      triageSpectrumBadge.className = 'meter-badge red';
      spectrumExplanation.textContent = 'CRITICAL RED FLAG: Immediate ambulance or emergency hospital transfer required.';
      spectrumExplanation.style.borderLeftColor = 'var(--color-emergency)';
    } else if (riskLevel === 'VISIT_PHC') {
      spectrumPin.style.left = '50%';
      triageSpectrumBadge.textContent = 'VISIT PHC (TODAY)';
      triageSpectrumBadge.className = 'meter-badge amber';
      spectrumExplanation.textContent = 'Symptoms require clinical assessment by a Medical Officer at your nearest Primary Health Centre today.';
      spectrumExplanation.style.borderLeftColor = 'var(--color-warning)';
    } else {
      spectrumPin.style.left = '16.6%';
      triageSpectrumBadge.textContent = 'HOME CARE';
      triageSpectrumBadge.className = 'meter-badge green';
      spectrumExplanation.textContent = 'Mild baseline indicators. No immediate clinical red flags detected. Continue oral hydration.';
      spectrumExplanation.style.borderLeftColor = 'var(--color-safe)';
    }
  }

  // Haversine distance helper for sorting
  function calcDistKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 999;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10;
  }

  // 7. Transparent Doctor Recommendation Matching (Proximity + Specialty)
  function matchAndShowRecommendedDoctor(riskLevel, symptomText) {
    const textLower = (symptomText || '').toLowerCase();
    const userLat = state.userLocation.lat;
    const userLng = state.userLocation.lng;

    // Detect clinical domains
    const isPediatric = textLower.includes('child') || textLower.includes('बच्च') || textLower.includes('मुल') || textLower.includes('baby') || textLower.includes('infant') || textLower.includes('kid');
    const isCardiac = riskLevel === 'EMERGENCY' || textLower.includes('chest') || textLower.includes('heart') || textLower.includes('सीने') || textLower.includes('छातीत') || textLower.includes('palpitation') || textLower.includes('cardiac');
    const isDiabetes = textLower.includes('sugar') || textLower.includes('diabet') || textLower.includes('glucose') || textLower.includes('शुगर') || textLower.includes('मधुमेह') || textLower.includes('thirst');
    const isRespiratory = textLower.includes('cough') || textLower.includes('breath') || textLower.includes('asthma') || textLower.includes('phlegm') || textLower.includes('खोकला') || textLower.includes('खाँसी') || textLower.includes('दमा') || textLower.includes('सांस');
    const isOrthopedic = textLower.includes('bone') || textLower.includes('fracture') || textLower.includes('joint') || textLower.includes('knee') || textLower.includes('back pain') || textLower.includes('हाड') || textLower.includes('सांधे') || textLower.includes('हड्डी');
    const isMaternal = textLower.includes('pregnan') || textLower.includes('matern') || textLower.includes('period') || textLower.includes('menstrual') || textLower.includes('गर्भा') || textLower.includes('मासिक') || textLower.includes('प्रसूति');

    let specialtyTitle = 'General Medicine & Primary Care';
    let rationale = 'Matched based on reported symptoms and need for primary medical officer consultation under NHM guidelines.';
    let protocol = 'Protocol: MoHFW Primary Care Clinical Triage';
    let targetKeywords = ['General', 'Primary', 'Family'];

    if (isCardiac) {
      specialtyTitle = 'Cardiology & Emergency Care';
      rationale = 'Severe acute cardiovascular symptoms requiring immediate in-person ECG and hospital casualty transfer. Do not delay.';
      protocol = 'Protocol: Directorate of Health Services Emergency Casualty Handoff';
      targetKeywords = ['Cardiology', 'Emergency', 'Critical'];
    } else if (isPediatric) {
      specialtyTitle = 'Pediatrics & Maternal Child Health';
      rationale = 'Child symptom profile requires pediatric medical officer evaluation for dehydration and febrile infection management.';
      protocol = 'Protocol: WHO / UNICEF / MoHFW IMNCI Guidelines';
      targetKeywords = ['Pediatric', 'Child', 'Maternal'];
    } else if (isDiabetes) {
      specialtyTitle = 'Family Medicine & Diabetes Care';
      rationale = 'Glycemic and metabolic indicators require blood glucose tracking and personalized oral medication review.';
      protocol = 'Protocol: ICMR Guidelines for Management of Type 2 Diabetes in India';
      targetKeywords = ['Diabetes', 'Family Medicine'];
    } else if (isRespiratory) {
      specialtyTitle = 'Pulmonology & Chest Medicine';
      rationale = 'Respiratory symptoms require chest auscultation, SpO2 check, and sputum screening under national protocols.';
      protocol = 'Protocol: National Tuberculosis Elimination Program & NVBDCP';
      targetKeywords = ['Pulmonology', 'Chest', 'General'];
    } else if (isOrthopedic) {
      specialtyTitle = 'Orthopaedics & Joint Care';
      rationale = 'Musculoskeletal pain or trauma requires clinical joint mobility evaluation and radiological confirmation.';
      protocol = 'Protocol: National Health Mission Musculoskeletal Protocol';
      targetKeywords = ['Orthopaedics', 'Surgery', 'Trauma'];
    } else if (isMaternal) {
      specialtyTitle = 'Obstetrics & Gynaecology';
      rationale = 'Maternal health indicators require antenatal checkup, fetal monitoring, and maternal care handoff.';
      protocol = 'Protocol: Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA)';
      targetKeywords = ['Obstetrics', 'Gynaecology', 'Maternal'];
    }

    // Find candidates in verified doctors
    const doctors = state.verifiedDoctors && state.verifiedDoctors.length > 0 ? state.verifiedDoctors : [];
    
    // Filter candidates matching targetKeywords
    let candidates = doctors.filter(doc => {
      const spec = (doc.specialization || '').toLowerCase();
      return targetKeywords.some(kw => spec.includes(kw.toLowerCase()));
    });

    if (candidates.length === 0) {
      candidates = doctors;
    }

    // Sort candidates by distance from user's current GPS / locality if location is available
    if (userLat && userLng) {
      candidates.sort((a, b) => {
        const distA = calcDistKm(userLat, userLng, a.lat, a.lng);
        const distB = calcDistKm(userLat, userLng, b.lat, b.lng);
        return distA - distB;
      });
    }

    let matchedDoctor = candidates[0] || null;

    if (!matchedDoctor) {
      matchedDoctor = {
        id: 'DOC_DUTY_MO',
        name: 'Duty Medical Officer (Govt Primary Care)',
        specialization: specialtyTitle,
        qualifications: 'MBBS (Govt Medical Officer)',
        registration_number: 'NMC-VERIFIED',
        hospital: 'Nearest Government Primary Health Centre / Hospital',
        phone: '108',
        lat: userLat,
        lng: userLng
      };
    }

    const distKm = (userLat && userLng && matchedDoctor.lat && matchedDoctor.lng) 
      ? calcDistKm(userLat, userLng, matchedDoctor.lat, matchedDoctor.lng) 
      : null;
    matchedDoctor.distance_km = distKm !== null && distKm < 900 ? distKm : null;
    matchedDoctor.reason = rationale;
    matchedDoctor.protocol = protocol;
    state.currentRecommendedDoctor = matchedDoctor;

    const recCard = document.getElementById('recommendedDoctorCard');
    if (!recCard) return;

    const recDocBadgeTitle = document.getElementById('recDocBadgeTitle');
    const recDocSpecialtyBadge = document.getElementById('recDocSpecialtyBadge');
    const recDocInitials = document.getElementById('recDocInitials');
    const recDocVerifiedBadge = document.getElementById('recDocVerifiedBadge');
    const recDocName = document.getElementById('recDocName');
    const recDocSpecialty = document.getElementById('recDocSpecialty');
    const recDocQualifications = document.getElementById('recDocQualifications');
    const recDocHospital = document.getElementById('recDocHospital');
    const recDocReason = document.getElementById('recDocReason');
    const recDocCitation = document.getElementById('recDocCitation');
    const recDocCallBtn = document.getElementById('recDocCallBtn');
    const btnBookWithRecDoc = document.getElementById('btnBookWithRecDoc');

    if (recDocBadgeTitle) recDocBadgeTitle.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">assignment</span> Clinical Referral Guidance';
    if (recDocSpecialtyBadge) recDocSpecialtyBadge.textContent = specialtyTitle;
    if (recDocInitials) recDocInitials.textContent = matchedDoctor.name.replace(/Dr\.\s*/, '').slice(0, 2).toUpperCase();
    if (recDocVerifiedBadge) recDocVerifiedBadge.textContent = matchedDoctor.registration_number ? `✓ Verified (${matchedDoctor.registration_number})` : '✓ Verified Public Facility';
    if (recDocName) recDocName.textContent = matchedDoctor.name;
    if (recDocSpecialty) recDocSpecialty.textContent = matchedDoctor.specialization;
    if (recDocQualifications) recDocQualifications.textContent = `${matchedDoctor.qualifications} • ${matchedDoctor.medical_council || 'MMC'}`;
    if (recDocHospital) recDocHospital.textContent = matchedDoctor.distance_km != null ? `${matchedDoctor.hospital} • 📍 ${matchedDoctor.distance_km} km away` : matchedDoctor.hospital;
    if (recDocReason) recDocReason.textContent = rationale;
    if (recDocCitation) recDocCitation.textContent = protocol;
    if (recDocCallBtn) recDocCallBtn.href = `tel:${matchedDoctor.phone.replace(/[^0-9]/g, '')}`;

    if (btnBookWithRecDoc) {
      btnBookWithRecDoc.onclick = () => {
        openAppointmentModal({
          doctorId: matchedDoctor.id,
          facilityName: matchedDoctor.hospital,
          doctorName: matchedDoctor.name,
          reason: `Referral: ${specialtyTitle} (${state.symptomText})`
        });
      };
    }

    recCard.classList.remove('hidden');
  }

  function generateClientSideSummaryMemo(tr) {
    const summaryPreBlock = document.getElementById('summaryPreBlock');
    if (!summaryPreBlock) return;

    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 16);

    let answers = '  • None recorded';
    if (state.followups.length > 0) {
      answers = state.followups.map(f => `  • ${f.question}: ${f.answer}`).join('\n');
    }

    summaryPreBlock.textContent = 
`=== SWASTHASATHI HEALTHCARE REFERRAL SUMMARY ===
Date & Time: ${dateStr}
Session Language: ${state.currentLang.toUpperCase()}
Reported Symptoms: ${state.symptomText || 'None'}

Key Follow-Up Answers:
${answers}

Triage Risk Level: ${tr.risk_level}
Recommended Next Step: ${tr.recommended_action.replace(/<[^>]+>/g, '')}
Audit Source: ${tr.risk_source}

--------------------------------------------------
NOTE: Decision-support guidance only. Does not replace professional clinical diagnosis.
==================================================`;
  }

  // 8. Verified Doctors & Facilities Directory (Stitch Real Location & Hospital Discovery)
  function setupFacilitiesDirectory() {
    const btnDetectGPS = document.getElementById('btnDetectGPS');
    const currentLocationLabel = document.getElementById('currentLocationLabel');
    const locationSourceBadge = document.getElementById('locationSourceBadge');
    const locationSourceText = document.getElementById('locationSourceText');
    const locationActiveDot = document.getElementById('locationActiveDot');
    const manualLocationInput = document.getElementById('manualLocationInput');
    const btnSearchLocation = document.getElementById('btnSearchLocation');
    const manualSearchResults = document.getElementById('manualSearchResults');
    const quickCityChips = document.querySelectorAll('.quick-city-chip');
    const facFilterButtons = document.querySelectorAll('.fac-filter-btn');

    // 1. Device GPS Geolocation
    if (btnDetectGPS) {
      btnDetectGPS.addEventListener('click', () => {
        if (!navigator.geolocation) {
          alert('Device GPS geolocation is not supported by your browser. Please enter your city or PIN code below.');
          return;
        }
        btnDetectGPS.classList.add('detecting');
        btnDetectGPS.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;animation:spin 1s linear infinite;">sync</span><span>Locating...</span>';

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            state.userLocation.lat = lat;
            state.userLocation.lng = lng;
            state.userLocation.isExactGPS = true;
            state.userLocation.isManual = false;

            btnDetectGPS.classList.remove('detecting');
            btnDetectGPS.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">my_location</span><span>GPS Active</span>';

            // Reverse geocode to get real locality/city
            try {
              const revRes = await fetch(`/api/location/reverse?lat=${lat}&lng=${lng}`);
              if (revRes.ok) {
                const rev = await revRes.json();
                const locality = rev.locality || rev.suburb || rev.neighbourhood || '';
                const city = rev.city || rev.town || rev.district || rev.state || 'Detected Location';
                state.userLocation.name = locality ? `${locality}, ${city}` : city;
              } else {
                state.userLocation.name = `GPS Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
              }
            } catch (e) {
              state.userLocation.name = `GPS Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            }

            if (locationSourceText) locationSourceText.textContent = 'Live Device GPS (High Accuracy)';
            if (locationActiveDot) locationActiveDot.style.background = '#00A86B';
            if (currentLocationLabel) currentLocationLabel.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">place</span> ${state.userLocation.name}`;

            fetchFacilities();
          },
          (err) => {
            btnDetectGPS.classList.remove('detecting');
            btnDetectGPS.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">my_location</span><span>Use My Location</span>';
            console.warn('Geolocation error:', err);
            
            if (locationSourceText) locationSourceText.textContent = 'GPS Access Denied / Unavailable';
            if (locationActiveDot) locationActiveDot.style.background = '#EF4444';
            if (currentLocationLabel) currentLocationLabel.textContent = 'Search by City, Locality, or PIN code below';

            const errMsg = err.code === 1 
              ? 'Location permission was denied. Please use the search bar below to search your City or PIN code.' 
              : 'Unable to retrieve your location. Please search for your city or PIN code.';
            alert(errMsg);
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      });
    }

    // 2. Manual Search by City, Locality, or 6-digit PIN code
    const handleManualSearch = async () => {
      if (!manualLocationInput) return;
      const query = manualLocationInput.value.trim();
      if (!query) {
        manualLocationInput.focus();
        return;
      }

      if (btnSearchLocation) btnSearchLocation.textContent = 'Searching...';

      try {
        const res = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`);
        const results = await res.json();

        if (btnSearchLocation) btnSearchLocation.textContent = 'Search';

        if (!manualSearchResults) return;

        const items = Array.isArray(results) ? results : ((results && results.results) || []);

        if (!items || items.length === 0) {
          manualSearchResults.innerHTML = `<div style="padding:10px 14px;font-size:12px;color:var(--on-surface-variant);">No locations found for "${query}". Try a city name or 6-digit PIN code.</div>`;
          manualSearchResults.classList.remove('hidden');
          return;
        }

        // Render dropdown results
        manualSearchResults.innerHTML = items.slice(0, 5).map(item => `
          <div class="search-result-item" data-lat="${item.lat}" data-lng="${item.lng}" data-name="${item.display_name || item.name}">
            <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary);">pin_drop</span>
            <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              <b>${item.display_name || item.name}</b> <span style="font-size:11px;color:var(--on-surface-variant);">(${item.state || item.district || 'India'})</span>
              <div style="font-size:11px;color:var(--on-surface-variant);">${item.full_name || item.display_name}</div>
            </div>
          </div>
        `).join('');
        manualSearchResults.classList.remove('hidden');

        // Wire click on each result
        manualSearchResults.querySelectorAll('.search-result-item').forEach(el => {
          el.addEventListener('click', () => {
            const lat = parseFloat(el.dataset.lat);
            const lng = parseFloat(el.dataset.lng);
            const name = el.dataset.name;

            state.userLocation.lat = lat;
            state.userLocation.lng = lng;
            state.userLocation.name = name;
            state.userLocation.isExactGPS = false;
            state.userLocation.isManual = true;

            manualSearchResults.classList.add('hidden');
            manualLocationInput.value = '';

            if (locationSourceText) locationSourceText.textContent = `Manual Selection (${query})`;
            if (locationActiveDot) locationActiveDot.style.background = 'var(--primary)';
            if (currentLocationLabel) currentLocationLabel.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">place</span> ${name}`;

            fetchFacilities();
          });
        });
      } catch (err) {
        if (btnSearchLocation) btnSearchLocation.textContent = 'Search';
        console.error('Manual location search failed:', err);
      }
    };

    if (btnSearchLocation) {
      btnSearchLocation.addEventListener('click', handleManualSearch);
    }
    if (manualLocationInput) {
      manualLocationInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleManualSearch();
        }
      });
    }

    // Close search dropdown on outside click
    document.addEventListener('click', (e) => {
      if (manualSearchResults && !manualSearchResults.contains(e.target) && e.target !== manualLocationInput && e.target !== btnSearchLocation) {
        manualSearchResults.classList.add('hidden');
      }
    });

    // 3. Quick Pan-India City Switchers
    quickCityChips.forEach(chip => {
      chip.addEventListener('click', () => {
        quickCityChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const city = chip.dataset.city;
        const lat = parseFloat(chip.dataset.lat);
        const lng = parseFloat(chip.dataset.lng);

        state.userLocation.lat = lat;
        state.userLocation.lng = lng;
        state.userLocation.name = `${city}, India`;
        state.userLocation.isExactGPS = false;
        state.userLocation.isManual = true;

        if (locationSourceText) locationSourceText.textContent = `Selected City (${city})`;
        if (locationActiveDot) locationActiveDot.style.background = 'var(--primary)';
        if (currentLocationLabel) currentLocationLabel.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">place</span> ${city}, India`;

        fetchFacilities();
      });
    });

    // 4. Facility Category Filters (All, Hospitals, Clinics/PHCs, 24x7 Emergency)
    facFilterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        facFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.facilityFilter = btn.dataset.type;
        fetchFacilities();
      });
    });
  }

  async function fetchVerifiedDoctors() {
    try {
      if (window.SwasthaSupabase) {
        const docs = await window.SwasthaSupabase.getDoctors();
        if (docs && docs.length > 0) {
          state.verifiedDoctors = docs;
          return;
        }
      }
      const res = await fetch('/api/doctors');
      if (res.ok) {
        state.verifiedDoctors = await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch verified doctors:', e);
    }
  }

  async function fetchFacilities() {
    const listEl = document.getElementById('facilitiesDynamicList');
    if (!listEl) return;

    if (!state.userLocation.lat || !state.userLocation.lng) {
      listEl.innerHTML = `
        <div class="empty-state-box" style="text-align:center; padding:32px 16px; background:var(--surface-container-lowest); border:1px solid var(--outline-variant); border-radius:var(--radius-xl);">
          <span class="material-symbols-outlined" style="font-size:42px; color:var(--primary); margin-bottom:12px;">location_on</span>
          <h3 style="font-size:16px; font-weight:700; color:var(--on-surface);">Location Not Detected Yet</h3>
          <p style="font-size:13px; color:var(--on-surface-variant); max-width:400px; margin:8px auto 16px;">
            Tap <b>"Use My Location"</b> above to discover verified hospitals and clinics closest to you via GPS, or enter your City or 6-digit PIN code in the search bar.
          </p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `<div style="text-align:center; padding:24px; color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:24px;animation:spin 1s linear infinite;color:var(--primary);vertical-align:middle;margin-right:8px;">sync</span> Finding closest verified hospitals &amp; clinics to ${state.userLocation.name}...</div>`;

    const lat = state.userLocation.lat;
    const lng = state.userLocation.lng;
    const type = state.facilityFilter === 'EMERGENCY' ? 'ALL' : state.facilityFilter;
    const emergencyOnly = state.facilityFilter === 'EMERGENCY';

    const url = `/api/facilities?lat=${lat}&lng=${lng}&type=${type}&emergency=${emergencyOnly}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      state.facilities = data;
      renderFacilitiesList(data);
    } catch (err) {
      console.warn('Failed to fetch facilities:', err);
      listEl.innerHTML = `
        <div class="empty-state-box" style="text-align:center; padding:24px; background:var(--surface-container-lowest); border:1px solid var(--outline-variant); border-radius:var(--radius-xl);">
          <span class="material-symbols-outlined" style="font-size:32px; color:var(--error); margin-bottom:8px;">error</span>
          <p style="font-size:14px; font-weight:700; color:var(--on-surface);">Could not load nearby facilities</p>
          <p style="font-size:12px; color:var(--on-surface-variant);">Please check network connection or try searching another city.</p>
        </div>
      `;
    }
  }

  function renderFacilitiesList(list) {
    const listEl = document.getElementById('facilitiesDynamicList');
    if (!listEl) return;

    if (!list || list.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state-box" style="text-align:center; padding:32px 16px; background:var(--surface-container-lowest); border:1px solid var(--outline-variant); border-radius:var(--radius-xl);">
          <span class="material-symbols-outlined" style="font-size:38px; color:var(--on-surface-variant); margin-bottom:8px;">domain_disabled</span>
          <p class="empty-title" style="font-size:15px; font-weight:700; color:var(--on-surface); margin-bottom:4px;">No healthcare facilities found within search radius</p>
          <p class="empty-sub" style="font-size:13px; color:var(--on-surface-variant); max-width:360px; margin:0 auto 12px;">Try searching by a broader city or district name above, or call 108 for immediate 24x7 emergency ambulance dispatch.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = list.map(fac => {
      const isEmergency = fac.emergency_available;
      const dist = fac.distance_km !== undefined && fac.distance_km !== null ? `${fac.distance_km} km away` : 'Nearby';
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${fac.lat || ''},${fac.lng || ''}`;
      
      const docParts = (fac.doctors || '').split('•');
      const docName = docParts[0] ? docParts[0].trim() : 'Medical Officer On-Duty';

      return `
        <div class="hospital-card-stitch ${isEmergency ? 'emergency' : ''}">
          <div class="hospital-top-stitch">
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary);">verified</span>
                <span style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:0.04em;">
                  ${isEmergency ? '24×7 Casualty & Emergency Hospital' : (fac.type || 'Verified Healthcare Facility')}
                </span>
              </div>
              <h3 class="hospital-title-stitch">${fac.name}</h3>
            </div>
            <span class="distance-pill-stitch">
              <span class="material-symbols-outlined" style="font-size:13px;">near_me</span>
              ${dist}
            </span>
          </div>

          <p class="hospital-address-stitch">
            <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;color:var(--on-surface-variant);">place</span>
            ${fac.address || 'Address registered on OpenStreetMap'}
          </p>

          <div class="hospital-meta-row">
            <span class="material-symbols-outlined" style="font-size:14px;color:var(--on-surface-variant);">schedule</span>
            <span>OPD Hours: ${fac.hours || '8:00 AM - 8:00 PM'}</span>
            ${fac.phone ? `<span>• Tel: ${fac.phone}</span>` : ''}
          </div>

          <div class="hospital-actions-stitch">
            ${fac.phone ? `
              <a href="tel:${fac.phone}" class="btn-call-stitch ${isEmergency ? 'emergency' : ''}">
                <span class="material-symbols-outlined" style="font-size:15px;">call</span>
                Call
              </a>
            ` : ''}
            <button type="button" class="btn-cyan-primary btn-sm btn-book-this-fac" data-id="${fac.id}" data-name="${fac.name}" data-doc="${docName}" style="height:38px;padding:0 14px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;border-radius:var(--radius-md);">
              <span class="material-symbols-outlined" style="font-size:15px;">event</span>
              Book Visit
            </button>
            <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-directions-stitch">
              <span class="material-symbols-outlined" style="font-size:15px;">directions</span>
              Get Directions
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Wire up booking buttons on facility cards
    listEl.querySelectorAll('.btn-book-this-fac').forEach(btn => {
      btn.addEventListener('click', () => {
        openAppointmentModal({
          doctorId: btn.dataset.id,
          facilityName: btn.dataset.name,
          doctorName: btn.dataset.doc,
          reason: 'Primary OPD Consultation'
        });
      });
    });
  }

  // 9. Appointments Management System
  function setupAppointmentsSystem() {
    const btnBookNewConsultation = document.getElementById('btnBookNewConsultation');
    const btnBookApptEmpty = document.getElementById('btnBookApptEmpty');
    const btnProfileBookAppt = document.getElementById('btnProfileBookAppt');
    const appointmentModal = document.getElementById('appointmentModal');
    const closeAppointmentModalBtn = document.getElementById('closeAppointmentModalBtn');
    const cancelAppointmentBtn = document.getElementById('cancelAppointmentBtn');
    const appointmentForm = document.getElementById('appointmentForm');

    const openModal = () => openAppointmentModal();
    if (btnBookNewConsultation) btnBookNewConsultation.addEventListener('click', openModal);
    if (btnBookApptEmpty) btnBookApptEmpty.addEventListener('click', openModal);
    if (btnProfileBookAppt) btnProfileBookAppt.addEventListener('click', openModal);

    const closeModal = () => {
      if (appointmentModal) appointmentModal.classList.add('hidden');
    };

    if (closeAppointmentModalBtn) closeAppointmentModalBtn.addEventListener('click', closeModal);
    if (cancelAppointmentBtn) cancelAppointmentBtn.addEventListener('click', closeModal);

    // Slot Selection
    document.querySelectorAll('.slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedSlot = btn.dataset.slot;
      });
    });

    // Form Submission
    if (appointmentForm) {
      appointmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const facilitySelect = document.getElementById('apptFacilitySelect');
        const dateInput = document.getElementById('apptDateInput');
        const reasonInput = document.getElementById('apptReasonInput');
        const spinner = document.getElementById('apptSpinner');
        const alertBanner = document.getElementById('apptAlertBanner');

        const selectedOpt = facilitySelect.options[facilitySelect.selectedIndex];
        const facilityName = selectedOpt.dataset.facility || selectedOpt.text;
        const doctorId = facilitySelect.value;
        const dateVal = dateInput.value;
        const reasonVal = reasonInput.value.trim();

        if (!dateVal || !reasonVal) {
          if (alertBanner) {
            alertBanner.textContent = 'Please fill all required fields.';
            alertBanner.classList.remove('hidden');
          }
          return;
        }

        try {
          if (spinner) spinner.classList.remove('hidden');
          if (window.SwasthaSupabase) {
            await window.SwasthaSupabase.createAppointment({
              doctorId: doctorId,
              facilityName: facilityName,
              department: 'General OPD',
              date: dateVal,
              time: state.selectedSlot,
              reason: reasonVal,
              triageSummary: state.symptomText || null
            });
          }

          if (alertBanner) alertBanner.classList.add('hidden');
          closeModal();
          alert('✓ Appointment successfully confirmed! Details recorded in your profile under Supabase RLS.');
          await loadAppointments();
        } catch (err) {
          if (alertBanner) {
            alertBanner.textContent = err.message || 'Could not schedule appointment.';
            alertBanner.classList.remove('hidden');
          }
        } finally {
          if (spinner) spinner.classList.add('hidden');
        }
      });
    }
  }

  function openAppointmentModal(prefill = null) {
    const modal = document.getElementById('appointmentModal');
    const facilitySelect = document.getElementById('apptFacilitySelect');
    const dateInput = document.getElementById('apptDateInput');
    const reasonInput = document.getElementById('apptReasonInput');
    const alertBanner = document.getElementById('apptAlertBanner');

    if (!modal) return;
    if (alertBanner) alertBanner.classList.add('hidden');

    // Populate facilities/doctors dropdown
    if (facilitySelect) {
      facilitySelect.innerHTML = '';
      const list = (state.verifiedDoctors && state.verifiedDoctors.length > 0) ? state.verifiedDoctors : state.facilities;
      list.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.dataset.facility = item.hospital || item.name;
        opt.textContent = `${item.name} (${item.hospital || item.name})`;
        if (prefill && (prefill.doctorId === item.id || prefill.facilityName === (item.hospital || item.name))) {
          opt.selected = true;
        }
        facilitySelect.appendChild(opt);
      });
    }

    // Default Date to tomorrow
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      dateInput.min = new Date().toISOString().split('T')[0];
    }

    if (reasonInput && prefill && prefill.reason) {
      reasonInput.value = prefill.reason;
    } else if (reasonInput && state.symptomText) {
      reasonInput.value = `Triage follow-up: ${state.symptomText.slice(0, 80)}`;
    }

    modal.classList.remove('hidden');
  }

  async function loadAppointments() {
    if (!window.SwasthaSupabase) return;

    try {
      const appts = await window.SwasthaSupabase.getAppointments();
      state.appointments = appts || [];

      renderHomeAppointments(state.appointments);
      renderProfileAppointments(state.appointments);

      if (state.currentProfile && state.currentProfile.role === 'doctor') {
        renderDoctorAppointmentsQueue(state.appointments);
      }
    } catch (e) {
      console.warn('Error loading appointments:', e);
    }
  }

  function renderHomeAppointments(list) {
    const container = document.getElementById('homeAppointmentsContainer');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <span class="empty-icon"><span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);">calendar_month</span></span>
          <p class="empty-title">No upcoming consultations</p>
          <p class="empty-sub">Book an OPD consultation at your nearest Primary Health Centre (PHC) or verified clinic.</p>
          <button type="button" class="btn-cyan-primary btn-sm" id="btnBookApptEmptyInner" style="margin-top: 10px;">+ Book Consultation</button>
        </div>
      `;
      const btn = document.getElementById('btnBookApptEmptyInner');
      if (btn) btn.onclick = () => openAppointmentModal();
      return;
    }

    container.innerHTML = list.slice(0, 3).map(a => {
      const isCancelled = a.status === 'cancelled';
      return `
        <div class="appointment-item-card">
          <div class="appt-card-top">
            <span class="appt-date-badge"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle;">calendar_today</span> ${a.appointment_date} • ${a.appointment_time}</span>
            <span class="appt-status-tag ${a.status}">${a.status}</span>
          </div>
          <div class="appt-doctor-name"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">stethoscope</span> ${a.doctor_id ? a.doctor_id.replace('DOC_', '').replace(/_/g, ' ') : 'Medical Officer'}</div>
          <div class="appt-facility-name"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">local_hospital</span> ${a.facility_name}</div>
          <div class="appt-reason-text">Reason: ${a.reason}</div>
          ${!isCancelled ? `
            <div class="appt-actions-row">
              <button type="button" class="btn-appt-cancel" data-id="${a.id}">Cancel Visit</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-appt-cancel').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Cancel this scheduled consultation?')) {
          await window.SwasthaSupabase.updateAppointmentStatus(btn.dataset.id, 'cancelled');
          await loadAppointments();
        }
      });
    });
  }

  function renderProfileAppointments(list) {
    const container = document.getElementById('profileAppointmentsList');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <span class="empty-icon"><span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);">calendar_month</span></span>
          <p class="empty-title">No appointments scheduled</p>
          <p class="empty-sub">Book an OPD consultation with a verified medical officer or PHC facility.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(a => {
      const isCancelled = a.status === 'cancelled';
      return `
        <div class="appointment-item-card">
          <div class="appt-card-top">
            <span class="appt-date-badge"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle;">calendar_today</span> ${a.appointment_date} • ${a.appointment_time}</span>
            <span class="appt-status-tag ${a.status}">${a.status}</span>
          </div>
          <div class="appt-doctor-name"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">stethoscope</span> ${a.doctor_id ? a.doctor_id.replace('DOC_', '').replace(/_/g, ' ') : 'Medical Officer'}</div>
          <div class="appt-facility-name"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">local_hospital</span> ${a.facility_name}</div>
          <div class="appt-reason-text">Reason: ${a.reason}</div>
          ${!isCancelled ? `
            <div class="appt-actions-row">
              <button type="button" class="btn-appt-cancel" data-id="${a.id}">Cancel</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-appt-cancel').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Cancel this consultation?')) {
          await window.SwasthaSupabase.updateAppointmentStatus(btn.dataset.id, 'cancelled');
          await loadAppointments();
        }
      });
    });
  }

  function renderDoctorAppointmentsQueue(list) {
    const queueEl = document.getElementById('doctorAppointmentsQueue');
    const queueCountTag = document.getElementById('docQueueCountTag');
    if (!queueEl) return;

    const activeAppts = (list || []).filter(a => a.status !== 'cancelled');
    if (queueCountTag) queueCountTag.textContent = `${activeAppts.length} Scheduled`;

    if (activeAppts.length === 0) {
      queueEl.innerHTML = `
        <div class="empty-state-box">
          <span class="empty-icon"><span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);">stethoscope</span></span>
          <p class="empty-title">No active consultations in queue</p>
          <p class="empty-sub">Patient bookings for your OPD will appear here with clinical symptoms and referral urgency.</p>
        </div>
      `;
      return;
    }

    queueEl.innerHTML = activeAppts.map(a => `
      <div class="appointment-item-card">
        <div class="appt-card-top">
          <span class="appt-date-badge"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle;">calendar_today</span> ${a.appointment_date} • ${a.appointment_time}</span>
          <span class="appt-status-tag ${a.status}">${a.status}</span>
        </div>
        <div class="appt-doctor-name"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">person</span> Patient Case #${a.id.slice(-6)}</div>
        <div class="appt-facility-name"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">local_hospital</span> ${a.facility_name} • ${a.department || 'OPD'}</div>
        <div class="appt-reason-text">Symptoms: ${a.reason}</div>
        <div class="appt-actions-row">
          <button type="button" class="btn-appt-complete" data-id="${a.id}">✓ Complete Consultation</button>
          <button type="button" class="btn-appt-cancel" data-id="${a.id}">Cancel</button>
        </div>
      </div>
    `).join('');

    queueEl.querySelectorAll('.btn-appt-complete').forEach(btn => {
      btn.addEventListener('click', async () => {
        await window.SwasthaSupabase.updateAppointmentStatus(btn.dataset.id, 'completed');
        await loadAppointments();
      });
    });

    queueEl.querySelectorAll('.btn-appt-cancel').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Cancel this patient consultation?')) {
          await window.SwasthaSupabase.updateAppointmentStatus(btn.dataset.id, 'cancelled');
          await loadAppointments();
        }
      });
    });
  }

  // 10. Doctor Dashboard & Verification Status
  async function loadDoctorDashboard() {
    if (!state.currentProfile || state.currentProfile.role !== 'doctor') return;

    const name = state.currentProfile.full_name || 'Dr. Practitioner';
    const email = state.currentProfile.email;
    const docProfileName = document.getElementById('docProfileName');
    const docProfileEmail = document.getElementById('docProfileEmail');
    const docHeaderInitial = document.getElementById('docHeaderInitial');
    const docRegDisplay = document.getElementById('docRegDisplay');
    const docSpecialtyHospital = document.getElementById('docSpecialtyHospital');

    if (docProfileName) docProfileName.textContent = name;
    if (docProfileEmail) docProfileEmail.textContent = email;
    if (docHeaderInitial) docHeaderInitial.textContent = 'Dr';

    if (window.SwasthaSupabase) {
      state.doctorVerif = await window.SwasthaSupabase.getDoctorVerification();
      if (state.doctorVerif) {
        if (docRegDisplay) {
          docRegDisplay.textContent = `${state.doctorVerif.registration_number} • ${state.doctorVerif.medical_council || 'MMC'}`;
        }
        if (docSpecialtyHospital) {
          docSpecialtyHospital.textContent = `${state.doctorVerif.specialty || 'General Medicine'} • ${state.doctorVerif.hospital_affiliation || 'Government Health Facility'}`;
        }
      }
    }

    await loadAppointments();
  }

  // 11. Saved Recommendations & Preferences (Supabase RLS)
  async function loadSavedRecommendations() {
    const listEl = document.getElementById('savedRecommendationsList');
    const countEl = document.getElementById('profileRecsCount');
    if (!listEl) return;

    if (!window.SwasthaSupabase) return;

    try {
      const recs = await window.SwasthaSupabase.getSavedRecommendations();
      if (countEl) countEl.textContent = recs ? recs.length : 0;

      if (!recs || recs.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state-box">
            <span class="empty-icon"><span class="material-symbols-outlined" style="font-size:36px;color:var(--primary);">assignment</span></span>
            <p class="empty-title">No saved recommendations yet</p>
            <p class="empty-sub">Run an AI symptom triage to generate structured doctor recommendations and save them to your account.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = recs.map(r => {
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent';
        const risk = r.risk_level || 'VISIT_PHC';
        const docName = (r.doctors && r.doctors.name) || (r.recommended_doctor_id ? r.recommended_doctor_id.replace('DOC_', '').replace(/_/g, ' ') : 'Verified Clinical Specialist');
        return `
          <div class="saved-rec-item">
            <div class="saved-rec-top">
              <span class="saved-rec-risk ${risk}">${risk.replace('_', ' ')}</span>
              <span class="saved-rec-date"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle;">calendar_today</span> ${date}</span>
            </div>
            <p class="saved-rec-summary">${r.input_summary}</p>
            <span class="saved-rec-doc"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:middle;">stethoscope</span> ${docName} • ${r.recommendation_reason || 'Verified match'}</span>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.warn('Could not load saved recommendations:', e);
    }
  }

  async function handleSaveTriageRecommendation() {
    const doc = state.currentRecommendedDoctor;
    const summary = state.symptomText || 'Clinical Symptom Triage';
    const reason = (doc && doc.reason) || 'Recommended clinical follow-up under MoHFW guidelines.';
    const recData = {
      input_summary: summary,
      recommended_doctor_id: (doc && doc.id) || 'DOC_DUTY_MO',
      recommendation_reason: reason,
      risk_level: state.triageRisk
    };

    if (window.SwasthaSupabase) {
      await window.SwasthaSupabase.saveRecommendation(recData);
      loadSavedRecommendations();
    }

    const toast = document.getElementById('saveRecToast');
    if (toast) {
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 4000);
    }
  }

  async function loadUserPreferences() {
    // Basic preferences init
  }

  // 12. Clinical Guidelines Modal
  function setupClinicalGuidelines() {
    const closeBtn = document.getElementById('closeGuidelinesModalBtn');
    const closeBtnBottom = document.getElementById('btnCloseGuidelines');
    const modal = document.getElementById('guidelinesModal');

    const closeModal = () => {
      if (modal) modal.classList.add('hidden');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeBtnBottom) closeBtnBottom.addEventListener('click', closeModal);
  }

  async function openGuidelinesModal() {
    const modal = document.getElementById('guidelinesModal');
    const container = document.getElementById('guidelinesListContainer');
    if (!modal || !container) return;

    container.innerHTML = `<div style="text-align:center; padding:15px; color:#94A3B8;">Loading verified public health sources...</div>`;
    modal.classList.remove('hidden');

    try {
      const res = await fetch('/api/guidelines');
      const data = await res.json();
      const sources = data.sources || [];

      container.innerHTML = sources.map(s => `
        <div class="guideline-source-card">
          <span class="source-authority-tag">${s.authority}</span>
          <a href="${s.url}" target="_blank" rel="noopener" class="source-title-link">🔗 ${s.title}</a>
          <p class="source-summary">${s.key_recommendation}</p>
          <div class="source-footer-meta">
            <span>Clinical Review: <b>${s.review_date}</b></span>
            <span>Version: <b>2026.1</b></span>
          </div>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = `<div style="color:#FDA4AF; padding:10px;">Could not load guidelines.</div>`;
    }
  }

  // 13. Summary Handoff
  function setupSummaryHandoff() {
    const copySummaryBtn = document.getElementById('copySummaryBtn');
    const shareWhatsappBtn = document.getElementById('shareWhatsappBtn');
    const summaryPreBlock = document.getElementById('summaryPreBlock');
    const copyToast = document.getElementById('copyToast');

    if (copySummaryBtn && summaryPreBlock) {
      copySummaryBtn.addEventListener('click', () => {
        const text = summaryPreBlock.textContent;
        navigator.clipboard.writeText(text).then(() => {
          if (copyToast) {
            copyToast.classList.remove('hidden');
            copyToast.textContent = (i18n[state.currentLang] || i18n.en).copySuccess;
            setTimeout(() => copyToast.classList.add('hidden'), 3000);
          }
        }).catch(() => {
          alert('Referral summary copied to clipboard.');
        });
      });
    }

    if (shareWhatsappBtn && summaryPreBlock) {
      shareWhatsappBtn.addEventListener('click', () => {
        const text = summaryPreBlock.textContent;
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      });
    }
  }

  // 14. Authentication, Roles & Sandbox Demo Handlers
  function setupAuthHandlers() {
    const authModal = document.getElementById('authModal');
    const btnDesktopAuth = document.getElementById('btnDesktopAuth');
    const btnGuestBannerAuth = document.getElementById('btnGuestBannerAuth');
    const btnProfileAuthAction = document.getElementById('btnProfileAuthAction');
    const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    const btnModalContinueGuest = document.getElementById('btnModalContinueGuest');

    const tabBtnSignIn = document.getElementById('tabBtnSignIn');
    const tabBtnSignUp = document.getElementById('tabBtnSignUp');
    const formSignIn = document.getElementById('signInForm');
    const formSignUp = document.getElementById('signUpForm');
    const alertBox = document.getElementById('authAlertBox');

    // Role Selection Buttons in Sign Up
    const roleBtnPatient = document.getElementById('roleBtnPatient');
    const roleBtnDoctor = document.getElementById('roleBtnDoctor');
    const doctorSignupFields = document.getElementById('doctorSignupFields');
    const btnSubmitSignUpText = document.getElementById('btnSubmitSignUpText');
    let selectedSignUpRole = 'patient';

    if (roleBtnPatient && roleBtnDoctor) {
      roleBtnPatient.addEventListener('click', () => {
        roleBtnPatient.classList.add('active');
        roleBtnDoctor.classList.remove('active');
        selectedSignUpRole = 'patient';
        if (doctorSignupFields) doctorSignupFields.classList.add('hidden');
        if (btnSubmitSignUpText) btnSubmitSignUpText.textContent = 'Create Patient Account';
      });

      roleBtnDoctor.addEventListener('click', () => {
        roleBtnDoctor.classList.add('active');
        roleBtnPatient.classList.remove('active');
        selectedSignUpRole = 'doctor';
        if (doctorSignupFields) doctorSignupFields.classList.remove('hidden');
        if (btnSubmitSignUpText) btnSubmitSignUpText.textContent = 'Submit for Clinical Verification';
      });
    }

    const openModal = () => {
      if (alertBox) alertBox.classList.add('hidden');
      if (authModal) authModal.classList.remove('hidden');
    };

    const closeModal = () => {
      if (authModal) authModal.classList.add('hidden');
    };

    if (btnDesktopAuth) btnDesktopAuth.addEventListener('click', openModal);
    if (btnGuestBannerAuth) btnGuestBannerAuth.addEventListener('click', openModal);
    if (btnProfileAuthAction) btnProfileAuthAction.addEventListener('click', openModal);
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', closeModal);
    if (btnModalContinueGuest) btnModalContinueGuest.addEventListener('click', closeModal);

    // Tab switching
    if (tabBtnSignIn && tabBtnSignUp && formSignIn && formSignUp) {
      tabBtnSignIn.addEventListener('click', () => {
        tabBtnSignIn.classList.add('active');
        tabBtnSignUp.classList.remove('active');
        formSignIn.classList.remove('hidden');
        formSignUp.classList.add('hidden');
        if (alertBox) alertBox.classList.add('hidden');
      });

      tabBtnSignUp.addEventListener('click', () => {
        tabBtnSignUp.classList.add('active');
        tabBtnSignIn.classList.remove('active');
        formSignUp.classList.remove('hidden');
        formSignIn.classList.add('hidden');
        if (alertBox) alertBox.classList.add('hidden');
      });
    }

    // 1-Click Sandbox Demo Logins for Judges
    const btnDemoPatient = document.getElementById('btnDemoPatientLogin');
    const btnDemoDoctor = document.getElementById('btnDemoDoctorLogin');
    const btnDemoPending = document.getElementById('btnDemoPendingLogin');

    if (btnDemoPatient) {
      btnDemoPatient.addEventListener('click', async () => {
        if (window.SwasthaSupabase) {
          await window.SwasthaSupabase.signIn('patient.demo@swasthasathi.org', 'demo123');
          closeModal();
          switchView('profile');
        }
      });
    }

    if (btnDemoDoctor) {
      btnDemoDoctor.addEventListener('click', async () => {
        if (window.SwasthaSupabase) {
          await window.SwasthaSupabase.signIn('dr.shinde@swasthasathi.org', 'doctor123');
          closeModal();
          switchView('doctor-dashboard');
        }
      });
    }

    if (btnDemoPending) {
      btnDemoPending.addEventListener('click', async () => {
        if (window.SwasthaSupabase) {
          await window.SwasthaSupabase.signIn('dr.pending@swasthasathi.org', 'pending123');
          closeModal();
          switchView('doctor-pending');
        }
      });
    }

    // Sign In Submit
    if (formSignIn) {
      formSignIn.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signInEmail').value;
        const password = document.getElementById('signInPassword').value;
        const spinner = document.getElementById('authSignInSpinner');
        try {
          if (spinner) spinner.classList.remove('hidden');
          if (window.SwasthaSupabase) {
            const res = await window.SwasthaSupabase.signIn(email, password);
            closeModal();
            if (res.profile && res.profile.role === 'doctor') {
              switchView('doctor-dashboard');
            } else {
              switchView('profile');
            }
          }
        } catch (err) {
          showAuthAlert(err.message || 'Failed to sign in.');
        } finally {
          if (spinner) spinner.classList.add('hidden');
        }
      });
    }

    // Sign Up Submit
    if (formSignUp) {
      formSignUp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signUpName').value;
        const email = document.getElementById('signUpEmail').value;
        const password = document.getElementById('signUpPassword').value;
        const spinner = document.getElementById('authSignUpSpinner');

        let docDetails = null;
        if (selectedSignUpRole === 'doctor') {
          docDetails = {
            registrationNumber: document.getElementById('signUpRegNumber').value.trim() || 'MMC-PENDING',
            medicalCouncil: document.getElementById('signUpMedicalCouncil').value,
            qualification: document.getElementById('signUpQualification').value.trim() || 'MBBS',
            specialty: document.getElementById('signUpSpecialty').value.trim() || 'General Medicine',
            hospitalAffiliation: document.getElementById('signUpHospital').value.trim() || 'Primary Health Centre'
          };
        }

        try {
          if (spinner) spinner.classList.remove('hidden');
          if (window.SwasthaSupabase) {
            await window.SwasthaSupabase.signUp(email, password, name, selectedSignUpRole, docDetails);
            closeModal();
            if (selectedSignUpRole === 'doctor') {
              switchView('doctor-pending');
            } else {
              switchView('profile');
            }
          }
        } catch (err) {
          showAuthAlert(err.message || 'Failed to create account.');
        } finally {
          if (spinner) spinner.classList.add('hidden');
        }
      });
    }

    // Sign Out Buttons
    const btnProfileSignOut = document.getElementById('btnProfileSignOut');
    const btnDoctorSignOut = document.getElementById('btnDoctorSignOut');
    const btnPendingSignOut = document.getElementById('btnPendingSignOut');

    const doSignOut = async () => {
      if (window.SwasthaSupabase) {
        await window.SwasthaSupabase.signOut();
        switchView('home');
      }
    };

    if (btnProfileSignOut) btnProfileSignOut.addEventListener('click', doSignOut);
    if (btnDoctorSignOut) btnDoctorSignOut.addEventListener('click', doSignOut);
    if (btnPendingSignOut) btnPendingSignOut.addEventListener('click', doSignOut);

    function showAuthAlert(msg) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.className = 'auth-alert-banner';
      alertBox.classList.remove('hidden');
    }

    // Viewport Mode Switcher
    const btnViewportToggle = document.getElementById('btnViewportToggle');
    const viewportModeIcon = document.getElementById('viewportModeIcon');
    const viewportModeText = document.getElementById('viewportModeText');

    if (btnViewportToggle) {
      btnViewportToggle.addEventListener('click', () => {
        document.body.classList.toggle('desktop-mode');
        const isDesktop = document.body.classList.contains('desktop-mode');
        if (viewportModeIcon) viewportModeIcon.textContent = isDesktop ? '📱' : '💻';
        if (viewportModeText) viewportModeText.textContent = isDesktop ? 'Phone View' : 'Desktop View';
      });
    }

    // Desktop Nav Items
    document.querySelectorAll('.desktop-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.id === 'navLinkGuidelines') return;
        const view = btn.dataset.view;
        if (view) {
          window.location.hash = view;
          switchView(view);
        }
      });
    });

    const btnSaveTriageRec = document.getElementById('btnSaveTriageRec');
    if (btnSaveTriageRec) {
      btnSaveTriageRec.addEventListener('click', handleSaveTriageRecommendation);
    }
  }

  function handleAuthChange(event, session, profile, user) {
    state.currentUser = user || (session && session.user) || null;
    state.currentProfile = profile || null;

    const isGuest = !state.currentUser;
    const desktopAuthLabel = document.getElementById('desktopAuthLabel');
    const btnDesktopAuth = document.getElementById('btnDesktopAuth');
    const guestModeBanner = document.getElementById('guestModeBanner');
    const guestBannerPill = document.getElementById('guestBannerPill');
    const guestBannerDesc = document.getElementById('guestBannerDesc');
    const profileUserName = document.getElementById('profileUserName');
    const profileUserEmail = document.getElementById('profileUserEmail');
    const profileBadgeStatus = document.getElementById('profileBadgeStatus');
    const profileAvatarInitial = document.getElementById('profileAvatarInitial');
    const headerAvatarInitial = document.getElementById('headerAvatarInitial');
    const btnProfileAuthAction = document.getElementById('btnProfileAuthAction');
    const btnProfileSignOut = document.getElementById('btnProfileSignOut');
    const navLinkDoctorDashboard = document.getElementById('navLinkDoctorDashboard');
    const dockLabelProfile = document.getElementById('dockLabelProfile');

    updateGreetingText();

    if (isGuest) {
      if (desktopAuthLabel) desktopAuthLabel.textContent = 'Guest Mode • Sign In';
      if (btnDesktopAuth) {
        btnDesktopAuth.classList.remove('signed-in');
        btnDesktopAuth.classList.add('guest-state');
      }
      if (guestModeBanner) guestModeBanner.classList.remove('hidden');
      if (guestBannerPill) guestBannerPill.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle;">waving_hand</span> Guest Sandbox Active';
      if (profileUserName) profileUserName.textContent = 'Guest Citizen';
      if (profileUserEmail) profileUserEmail.textContent = 'guest@swasthasathi.org';
      if (profileBadgeStatus) profileBadgeStatus.textContent = 'Guest Sandbox • Read-Only';
      if (profileAvatarInitial) profileAvatarInitial.textContent = 'G';
      if (headerAvatarInitial) headerAvatarInitial.textContent = 'G';
      if (btnProfileAuthAction) btnProfileAuthAction.classList.remove('hidden');
      if (btnProfileSignOut) btnProfileSignOut.classList.add('hidden');
      if (navLinkDoctorDashboard) navLinkDoctorDashboard.classList.add('hidden');
      if (dockLabelProfile) dockLabelProfile.textContent = 'Profile';
    } else {
      const name = (profile && profile.full_name) || (state.currentUser.user_metadata && state.currentUser.user_metadata.full_name) || state.currentUser.email.split('@')[0];
      const role = (profile && profile.role) || (state.currentUser.user_metadata && state.currentUser.user_metadata.role) || 'patient';
      const isDoc = role === 'doctor';

      if (desktopAuthLabel) desktopAuthLabel.textContent = `${name} (${isDoc ? 'Clinician' : 'Patient'})`;
      if (btnDesktopAuth) {
        btnDesktopAuth.classList.add('signed-in');
        btnDesktopAuth.classList.remove('guest-state');
      }
      if (guestModeBanner) guestModeBanner.classList.add('hidden');

      if (profileUserName) profileUserName.textContent = name;
      if (profileUserEmail) profileUserEmail.textContent = state.currentUser.email;
      if (profileBadgeStatus) profileBadgeStatus.textContent = `${isDoc ? '🩺 Verified Doctor' : '👤 Patient'} • Supabase RLS Protected`;
      if (profileAvatarInitial) profileAvatarInitial.textContent = name.charAt(0).toUpperCase();
      if (headerAvatarInitial) headerAvatarInitial.textContent = name.charAt(0).toUpperCase();
      if (btnProfileAuthAction) btnProfileAuthAction.classList.add('hidden');
      if (btnProfileSignOut) btnProfileSignOut.classList.remove('hidden');

      if (navLinkDoctorDashboard) {
        navLinkDoctorDashboard.classList.toggle('hidden', !isDoc);
      }
      if (dockLabelProfile) {
        dockLabelProfile.textContent = isDoc ? 'Doctor OPD' : 'Profile';
      }
    }

    loadAppointments();
    loadSavedRecommendations();
  }

  // Self-execute on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
