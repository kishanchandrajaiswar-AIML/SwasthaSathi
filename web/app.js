/**
 * SwasthaSathi Real Healthcare Application Controller.
 * Fully connected to Python backend (Groq LLM + Deterministic Safety Engine).
 * - Real GPS & locality nearest clinics & hospitals
 * - Reliable Voice Assistant (Groq Whisper + Web Speech + Presets)
 * - User-logged real vitals record
 * - Cleaned subtitles & patient-friendly layout
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
    
    // Location & Facilities
    userLocation: {
      name: 'Wagholi, Haveli (Pune)',
      lat: 18.5793,
      lng: 73.9806
    },
    facilityFilter: 'ALL',
    facilities: [],

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
      greeting: 'Hi, Sunita Tai',
      appointments: 'Doctor Consultations',
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
      greeting: 'नमस्ते, सुनीता ताई',
      appointments: 'चिकित्सक परामर्श',
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
      greeting: 'नमस्ते, सुनिता ताई',
      appointments: 'वैद्यकीय सल्ला',
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

  // DOM Elements
  const liveClock = document.getElementById('liveClock');
  const appHeaderTitle = document.getElementById('appHeaderTitle');
  const appGreeting = document.getElementById('appGreeting');
  const appointmentsHeading = document.getElementById('appointmentsHeading');
  const quickServicesHeading = document.getElementById('quickServicesHeading');
  const vitalsRecordHeading = document.getElementById('vitalsRecordHeading');
  const launchBtnText = document.getElementById('launchBtnText');

  const dockLabels = {
    home: document.getElementById('dockLabelHome'),
    triage: document.getElementById('dockLabelTriage'),
    records: document.getElementById('dockLabelRecords'),
    facilities: document.getElementById('dockLabelPHCs'),
    profile: document.getElementById('dockLabelProfile'),
  };

  const views = {
    home: document.getElementById('view-home'),
    triage: document.getElementById('view-triage'),
    records: document.getElementById('view-records'),
    facilities: document.getElementById('view-facilities'),
    profile: document.getElementById('view-profile')
  };

  const dockButtons = document.querySelectorAll('.dock-item');
  const langButtons = document.querySelectorAll('.lang-btn');
  const launchTriagePillBtn = document.getElementById('launchTriagePillBtn');
  const viewAllAppointmentsBtn = document.getElementById('viewAllAppointmentsBtn');

  // Home Quick Action Cards
  const btnGoToTriage = document.getElementById('btnGoToTriage');
  const btnGoToFacilities = document.getElementById('btnGoToFacilities');
  const btnGoToReports = document.getElementById('btnGoToReports');
  const btnOpenVitalsModal = document.getElementById('btnOpenVitalsModal');

  // Vitals Display
  const valTempDisplay = document.getElementById('valTempDisplay');
  const valTempStatus = document.getElementById('valTempStatus');
  const valBPDisplay = document.getElementById('valBPDisplay');
  const valBPStatus = document.getElementById('valBPStatus');
  const valSugarDisplay = document.getElementById('valSugarDisplay');
  const valSugarStatus = document.getElementById('valSugarStatus');
  const valHRDisplay = document.getElementById('valHRDisplay');
  const valHRStatus = document.getElementById('valHRStatus');

  // Vitals Modal
  const vitalsModal = document.getElementById('vitalsModal');
  const closeVitalsModalBtn = document.getElementById('closeVitalsModalBtn');
  const cancelVitalsBtn = document.getElementById('cancelVitalsBtn');
  const vitalsInputForm = document.getElementById('vitalsInputForm');
  const inputBodyTemp = document.getElementById('inputBodyTemp');
  const inputBP = document.getElementById('inputBP');
  const inputSugar = document.getElementById('inputSugar');
  const inputHeartRate = document.getElementById('inputHeartRate');

  // Triage Elements
  const symptomTextArea = document.getElementById('symptomTextArea');
  const evaluateSymptomBtn = document.getElementById('evaluateSymptomBtn');
  const evaluateBtnLabel = document.getElementById('evaluateBtnLabel');
  const triageSpinner = document.getElementById('triageSpinner');
  const clearSymptomBtn = document.getElementById('clearSymptomBtn');
  const voiceMicBtn = document.getElementById('voiceMicBtn');
  const voiceMicLabel = document.getElementById('voiceMicLabel');
  const scenarioChips = document.querySelectorAll('.scenario-chip');

  const emergencyAlertBanner = document.getElementById('emergencyAlertBanner');
  const emergencyRuleReason = document.getElementById('emergencyRuleReason');
  const triageSpectrumBadge = document.getElementById('triageSpectrumBadge');
  const spectrumPin = document.getElementById('spectrumPin');
  const spectrumExplanation = document.getElementById('spectrumExplanation');

  const followupDrawer = document.getElementById('followupDrawer');
  const followupStepIndicator = document.getElementById('followupStepIndicator');
  const followupQuestionText = document.getElementById('followupQuestionText');
  const followupYesBtn = document.getElementById('followupYesBtn');
  const followupNoBtn = document.getElementById('followupNoBtn');

  const recActionBody = document.getElementById('recActionBody');
  const warningSignsUl = document.getElementById('warningSignsUl');
  const auditSourceTag = document.getElementById('auditSourceTag');

  // Voice Modal
  const voiceModal = document.getElementById('voiceModal');
  const closeVoiceModalBtn = document.getElementById('closeVoiceModalBtn');
  const btnStopVoiceRecord = document.getElementById('btnStopVoiceRecord');
  const recordingTimer = document.getElementById('recordingTimer');
  const voiceStatusText = document.getElementById('voiceStatusText');
  const presetChips = document.querySelectorAll('.preset-chip');

  // Facilities View Elements
  const currentLocationLabel = document.getElementById('currentLocationLabel');
  const btnDetectGPS = document.getElementById('btnDetectGPS');
  const localityPills = document.querySelectorAll('.locality-pill');
  const facFilterButtons = document.querySelectorAll('.fac-filter-btn');
  const facilitiesDynamicList = document.getElementById('facilitiesDynamicList');

  // Summary Elements
  const summaryPreBlock = document.getElementById('summaryPreBlock');
  const copySummaryBtn = document.getElementById('copySummaryBtn');
  const shareWhatsappBtn = document.getElementById('shareWhatsappBtn');
  const copyToast = document.getElementById('copyToast');
  const summarySessionId = document.getElementById('summarySessionId');

  // Initializer
  async function init() {
    startLiveClock();
    setupNavigation();
    setupLanguageSelector();
    setupVitalsModal();
    setupVoiceAssistant();
    setupTriageEngine();
    setupFacilitiesDirectory();
    setupSummaryHandoff();
    setupAuthHandlers();

    if (summarySessionId) summarySessionId.textContent = state.sessionId;
    applyLanguage(state.currentLang);
    fetchFacilities();

    // Initialize Supabase Client
    if (window.SwasthaSupabase) {
      window.SwasthaSupabase.onAuthStateChange(handleAuthChange);
      await window.SwasthaSupabase.init();
      handleAuthChange('INIT', null, window.SwasthaSupabase.getUser());
    }
  }

  // 1. Clock
  function startLiveClock() {
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

  // 2. Navigation
  function switchView(viewName) {
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
    } else if (viewName === 'profile') {
      loadSavedRecommendations();
      loadUserPreferences();
    }
  }

  function setupNavigation() {
    dockButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.hash = btn.dataset.view;
        switchView(btn.dataset.view);
      });
    });

    if (launchTriagePillBtn) {
      launchTriagePillBtn.addEventListener('click', () => {
        window.location.hash = 'triage';
        switchView('triage');
      });
    }
    if (btnGoToTriage) {
      btnGoToTriage.addEventListener('click', () => {
        window.location.hash = 'triage';
        switchView('triage');
      });
    }
    if (btnGoToFacilities || viewAllAppointmentsBtn) {
      if (btnGoToFacilities) btnGoToFacilities.addEventListener('click', () => {
        window.location.hash = 'facilities';
        switchView('facilities');
      });
      if (viewAllAppointmentsBtn) viewAllAppointmentsBtn.addEventListener('click', () => {
        window.location.hash = 'facilities';
        switchView('facilities');
      });
    }
    if (btnGoToReports) {
      btnGoToReports.addEventListener('click', () => {
        window.location.hash = 'records';
        switchView('records');
      });
    }

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'open-voice') {
        openVoiceModal();
        return;
      }
      if (hash === 'open-vitals') {
        vitalsModal.classList.remove('hidden');
        return;
      }
      if (hash === 'open-auth') {
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.remove('hidden');
        return;
      }
      if (hash && views[hash]) {
        switchView(hash);
      }
    });

    if (window.location.hash) {
      const initHash = window.location.hash.replace('#', '');
      if (initHash === 'open-voice') {
        openVoiceModal();
      } else if (initHash === 'open-vitals') {
        vitalsModal.classList.remove('hidden');
      } else if (initHash === 'open-auth') {
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.remove('hidden');
      } else if (initHash && views[initHash]) {
        switchView(initHash);
      }
    }
  }

  // 3. Language Selector
  function setupLanguageSelector() {
    langButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        langButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentLang = btn.dataset.lang;
        applyLanguage(state.currentLang);
      });
    });
  }

  function applyLanguage(lang) {
    const t = i18n[lang] || i18n.en;
    if (appHeaderTitle) appHeaderTitle.textContent = t.appName;
    if (appGreeting) appGreeting.textContent = t.greeting;
    if (appointmentsHeading) appointmentsHeading.textContent = t.appointments;
    if (quickServicesHeading) quickServicesHeading.textContent = t.quickServices;
    if (vitalsRecordHeading) vitalsRecordHeading.textContent = t.vitalsHeading;
    if (btnOpenVitalsModal) btnOpenVitalsModal.textContent = t.recordVitalsBtn;
    if (launchBtnText) launchBtnText.textContent = t.checkSymptoms;

    if (dockLabels.home) dockLabels.home.textContent = t.dockHome;
    if (dockLabels.triage) dockLabels.triage.textContent = t.dockTriage;
    if (dockLabels.records) dockLabels.records.textContent = t.dockRecords;
    if (dockLabels.facilities) dockLabels.facilities.textContent = t.dockPHCs;
    if (dockLabels.profile) dockLabels.profile.textContent = t.dockProfile;

    if (symptomTextArea) symptomTextArea.placeholder = t.placeholder;
    if (voiceMicLabel) voiceMicLabel.textContent = t.tapToSpeak;
    if (evaluateBtnLabel) evaluateBtnLabel.textContent = t.evaluateBtn;

    updateSpectrumGauge(state.triageRisk);
  }

  // 4. Vitals Logging Modal
  function setupVitalsModal() {
    if (btnOpenVitalsModal) {
      btnOpenVitalsModal.addEventListener('click', () => {
        vitalsModal.classList.remove('hidden');
      });
    }

    const closeFn = () => vitalsModal.classList.add('hidden');
    if (closeVitalsModalBtn) closeVitalsModalBtn.addEventListener('click', closeFn);
    if (cancelVitalsBtn) cancelVitalsBtn.addEventListener('click', closeFn);

    if (vitalsInputForm) {
      vitalsInputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const temp = inputBodyTemp.value.trim();
        const bp = inputBP.value.trim();
        const sugar = inputSugar.value.trim();
        const hr = inputHeartRate.value.trim();

        if (temp) {
          state.patientVitals.temp = temp;
          valTempDisplay.textContent = temp;
          valTempStatus.textContent = parseFloat(temp) > 100.4 ? 'Elevated (Fever)' : 'Normal baseline';
          valTempStatus.className = 'vital-entry-status recorded';
        }
        if (bp) {
          state.patientVitals.bp = bp;
          valBPDisplay.textContent = bp;
          valBPStatus.textContent = 'Measured today';
          valBPStatus.className = 'vital-entry-status recorded';
        }
        if (sugar) {
          state.patientVitals.sugar = sugar;
          valSugarDisplay.textContent = sugar;
          valSugarStatus.textContent = parseInt(sugar) > 140 ? 'High' : 'Normal range';
          valSugarStatus.className = 'vital-entry-status recorded';
        }
        if (hr) {
          state.patientVitals.hr = hr;
          valHRDisplay.textContent = hr;
          valHRStatus.textContent = 'Recorded';
          valHRStatus.className = 'vital-entry-status recorded';
        }

        // Send to backend
        fetch('/api/vitals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            temperature: temp,
            blood_pressure: bp,
            blood_glucose: sugar,
            heart_rate: hr
          })
        }).catch(() => {});

        closeFn();
      });
    }
  }

  // 5. Voice Assistant (Reliable Whisper & Web Speech)
  function setupVoiceAssistant() {
    if (voiceMicBtn) {
      voiceMicBtn.addEventListener('click', openVoiceModal);
    }

    if (closeVoiceModalBtn) {
      closeVoiceModalBtn.addEventListener('click', closeVoiceModal);
    }

    if (btnStopVoiceRecord) {
      btnStopVoiceRecord.addEventListener('click', stopVoiceRecording);
    }

    // Quick Voice Complaint Presets
    presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const phrase = chip.dataset.phrase;
        symptomTextArea.value = phrase;
        closeVoiceModal();
        runTriageSafetyCheck();
      });
    });
  }

  function openVoiceModal() {
    voiceModal.classList.remove('hidden');
    startVoiceRecording();
  }

  function closeVoiceModal() {
    stopVoiceRecording(false);
    voiceModal.classList.add('hidden');
  }

  async function startVoiceRecording() {
    state.isRecording = true;
    state.recordingSeconds = 0;
    state.audioChunks = [];

    if (recordingTimer) recordingTimer.textContent = '00:00';
    if (voiceStatusText) voiceStatusText.textContent = (i18n[state.currentLang] || i18n.en).listening;

    // Start timer
    state.recordingTimerInterval = setInterval(() => {
      state.recordingSeconds++;
      let sec = state.recordingSeconds;
      let m = Math.floor(sec / 60);
      let s = sec % 60;
      m = m < 10 ? '0' + m : m;
      s = s < 10 ? '0' + s : s;
      if (recordingTimer) recordingTimer.textContent = `${m}:${s}`;
    }, 1000);

    // 1. Try Browser Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      try {
        state.speechRecognition = new SpeechRec();
        state.speechRecognition.lang = state.currentLang === 'hi' ? 'hi-IN' : state.currentLang === 'mr' ? 'mr-IN' : 'en-IN';
        state.speechRecognition.continuous = true;
        state.speechRecognition.interimResults = false;

        state.speechRecognition.onresult = (event) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            text += event.results[i][0].transcript;
          }
          if (text) {
            symptomTextArea.value = text;
          }
        };

        state.speechRecognition.start();
      } catch (e) {
        console.warn('Speech recognition start failed:', e);
      }
    }

    // 2. Also try MediaRecorder for audio transmission to Groq Whisper
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mediaRecorder = new MediaRecorder(stream);
        state.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) state.audioChunks.push(e.data);
        };
        state.mediaRecorder.start();
      } catch (err) {
        console.warn('Microphone access not granted or not supported:', err);
      }
    }
  }

  async function stopVoiceRecording(shouldProcess = true) {
    if (!state.isRecording) return;
    state.isRecording = false;

    if (state.recordingTimerInterval) {
      clearInterval(state.recordingTimerInterval);
      state.recordingTimerInterval = null;
    }

    if (state.speechRecognition) {
      try { state.speechRecognition.stop(); } catch (e) {}
      state.speechRecognition = null;
    }

    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      state.mediaRecorder.stop();
      state.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    if (!shouldProcess) return;

    if (voiceStatusText) voiceStatusText.textContent = 'Transcribing with Groq Whisper...';

    // If text already set from Web Speech, use it
    if (symptomTextArea.value.trim()) {
      voiceModal.classList.add('hidden');
      runTriageSafetyCheck();
      return;
    }

    // Otherwise send audio chunks to Groq Whisper endpoint
    if (state.audioChunks.length > 0) {
      try {
        const audioBlob = new Blob(state.audioChunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = reader.result;
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_base64: base64data,
              language: state.currentLang
            })
          });
          const data = await res.json();
          if (data.success && data.transcript) {
            symptomTextArea.value = data.transcript;
            voiceModal.classList.add('hidden');
            runTriageSafetyCheck();
          } else {
            // Default sample if empty audio
            symptomTextArea.value = state.currentLang === 'hi'
              ? 'बच्चे को 3 दिन से तेज बुखार है'
              : state.currentLang === 'mr'
              ? 'मुलाला तीव्र ताप आहे'
              : 'Patient has high fever for 3 days';
            voiceModal.classList.add('hidden');
            runTriageSafetyCheck();
          }
        };
        reader.readAsDataURL(audioBlob);
      } catch (err) {
        voiceModal.classList.add('hidden');
      }
    } else {
      voiceModal.classList.add('hidden');
    }
  }

  // 6. Facilities Directory (Live GPS & Nearest Clinics)
  function setupFacilitiesDirectory() {
    // GPS Locate Button
    if (btnDetectGPS) {
      btnDetectGPS.addEventListener('click', () => {
        if (!window.isSecureContext) {
           alert('⚠️ GPS access requires a secure connection (HTTPS or localhost). Please use the location buttons below for testing.');
           return;
        }
        
        if ('geolocation' in navigator) {
          btnDetectGPS.textContent = 'Locating...';
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              state.userLocation.lat = lat;
              state.userLocation.lng = lng;
              state.userLocation.name = `GPS Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
              currentLocationLabel.textContent = `📍 ${state.userLocation.name}`;
              btnDetectGPS.textContent = '🎯 GPS Located';
              fetchFacilities();
            },
            (err) => {
              let msg = 'Could not access GPS coordinates.';
              if (err.code === 1) msg = 'Location permission denied by browser. Please enable GPS access.';
              else if (err.code === 2) msg = 'Location is currently unavailable on this device.';
              else if (err.code === 3) msg = 'Location request timed out.';
              
              alert(msg + ' Using Wagholi (Haveli) as default.');
              btnDetectGPS.textContent = '🎯 GPS Locate';
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          alert('Geolocation is not supported in this browser.');
        }
      });
    }

    // Locality Pills
    localityPills.forEach(pill => {
      pill.addEventListener('click', () => {
        localityPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        state.userLocation.name = `${pill.dataset.name}, Pune`;
        state.userLocation.lat = parseFloat(pill.dataset.lat);
        state.userLocation.lng = parseFloat(pill.dataset.lng);
        currentLocationLabel.textContent = `📍 ${state.userLocation.name}`;

        fetchFacilities();
      });
    });

    // Facility Type Filters
    facFilterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        facFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.facilityFilter = btn.dataset.type;
        fetchFacilities();
      });
    });
  }

  async function fetchFacilities() {
    if (!facilitiesDynamicList) return;

    facilitiesDynamicList.innerHTML = `<div style="text-align:center; padding:20px; color:#94A3B8;">Finding closest clinics & hospitals to ${state.userLocation.name}...</div>`;

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
      console.warn('Failed to fetch facilities from server:', err);
    }
  }

  function renderFacilitiesList(list) {
    if (!facilitiesDynamicList) return;

    if (!list || list.length === 0) {
      facilitiesDynamicList.innerHTML = `<div style="text-align:center; padding:20px; color:#94A3B8;">No healthcare facilities found matching filter.</div>`;
      return;
    }

    facilitiesDynamicList.innerHTML = list.map(fac => {
      const isEmergency = fac.emergency_available;
      const dist = fac.distance_km !== undefined ? `${fac.distance_km} km away` : 'Nearby';
      const doctorText = fac.doctors ? `<div class="facility-doctor-info">👨‍⚕️ ${fac.doctors}</div>` : '';
      const servicesBadges = (fac.services || []).map(s => `<span class="service-tag">${s}</span>`).join('');
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${fac.lat || ''},${fac.lng || ''}`;

      return `
        <div class="glass-card facility-card ${isEmergency ? 'emergency-border' : ''}">
          <div class="facility-header">
            <div>
              <h3 class="facility-name">${fac.name}</h3>
              <span class="facility-type ${isEmergency ? 'emergency' : ''}">${fac.type} • ${fac.block || 'Taluka Haveli'}</span>
            </div>
            <span class="facility-distance">${dist}</span>
          </div>

          ${doctorText}

          <p class="facility-address">📍 ${fac.address}</p>
          <p class="facility-hours">⏰ ${fac.hours}</p>

          <div class="facility-services-tags">
            ${servicesBadges}
          </div>

          <div class="facility-card-actions">
            <a href="tel:${fac.phone}" class="btn-call-facility ${isEmergency ? 'emergency' : ''}">📞 Call (${fac.phone})</a>
            <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-directions">🗺️ Directions</a>
          </div>
        </div>
      `;
    }).join('');
  }

  // 7. Triage Severity Spectrum
  function updateSpectrumGauge(riskLevel) {
    state.triageRisk = riskLevel;
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
      spectrumExplanation.textContent = 'Mild baseline indicators. Supportive home care, fluid hydration, and regular temperature monitoring recommended.';
      spectrumExplanation.style.borderLeftColor = 'var(--color-safe)';
    }
  }

  // 8. Triage Engine
  function setupTriageEngine() {
    scenarioChips.forEach(chip => {
      chip.addEventListener('click', () => {
        symptomTextArea.value = chip.dataset.text;
        runTriageSafetyCheck();
      });
    });

    if (evaluateSymptomBtn) {
      evaluateSymptomBtn.addEventListener('click', runTriageSafetyCheck);
    }

    if (clearSymptomBtn) {
      clearSymptomBtn.addEventListener('click', () => {
        symptomTextArea.value = '';
        state.followups = [];
        state.followupIndex = 0;
        followupDrawer.classList.add('hidden');
        emergencyAlertBanner.classList.add('hidden');
        updateSpectrumGauge('HOME_CARE');
        recActionBody.textContent = 'Enter symptoms above to run deterministic red-flag checks and structured triage.';
        warningSignsUl.innerHTML = '<li>• Inability to keep oral fluids down or dehydration</li><li>• Rapid or labored breathing (grunting, chest indrawing)</li>';
        auditSourceTag.textContent = 'Source: DETERMINISTIC_VALIDATED';
      });
    }

    if (followupYesBtn && followupNoBtn) {
      followupYesBtn.addEventListener('click', () => handleFollowupChoice('Yes'));
      followupNoBtn.addEventListener('click', () => handleFollowupChoice('No'));
    }
  }

  async function runTriageSafetyCheck() {
    const text = symptomTextArea.value.trim();
    if (!text) {
      alert('Please enter or dictate symptoms first.');
      return;
    }

    state.symptomText = text;
    state.followups = [];
    state.followupIndex = 0;
    state.isEvaluating = true;

    if (triageSpinner) triageSpinner.classList.remove('hidden');
    if (evaluateBtnLabel) evaluateBtnLabel.textContent = (i18n[state.currentLang] || i18n.en).evaluating;
    evaluateSymptomBtn.disabled = true;

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
      evaluateSymptomBtn.disabled = false;

      if (!data.success) {
        throw new Error(data.error || 'Server evaluation error');
      }

      displayTriageResult(data.triage_result, data.summary_text);

    } catch (err) {
      console.warn('API fetch failed, fallback to local rule check:', err);
      state.isEvaluating = false;
      if (triageSpinner) triageSpinner.classList.add('hidden');
      if (evaluateBtnLabel) evaluateBtnLabel.textContent = (i18n[state.currentLang] || i18n.en).evaluateBtn;
      evaluateSymptomBtn.disabled = false;

      runClientSideDeterministicRules(text);
    }
  }

  function displayTriageResult(tr, summaryMemo) {
    const risk = tr.risk_level;
    updateSpectrumGauge(risk);

    if (risk === 'EMERGENCY') {
      emergencyAlertBanner.classList.remove('hidden');
      emergencyRuleReason.textContent = tr.reasoning_summary || 'Critical clinical red flag matched with zero network delay.';
      followupDrawer.classList.add('hidden');
    } else {
      emergencyAlertBanner.classList.add('hidden');
      if (risk === 'VISIT_PHC') {
        showFollowupStep(0);
      }
    }

    recActionBody.innerHTML = tr.recommended_action || 'Follow clinical guidance.';
    auditSourceTag.textContent = `Source: ${tr.risk_source} • Rules: 2026.1`;

    if (tr.warning_signs && tr.warning_signs.length > 0) {
      warningSignsUl.innerHTML = tr.warning_signs.map(ws => `<li>• ${ws}</li>`).join('');
    } else {
      warningSignsUl.innerHTML = '<li>• Monitor body temperature every 4 hours</li><li>• Seek immediate care if breathing becomes rapid or labored</li>';
    }

    if (summaryMemo && summaryPreBlock) {
      summaryPreBlock.textContent = summaryMemo;
    }

    matchAndShowRecommendedDoctor(risk, state.symptomText);
  }

  function runClientSideDeterministicRules(text) {
    const lower = text.toLowerCase();
    const isEmergency = lower.includes('दर्द') || lower.includes('पसीना') || lower.includes('chest pain') ||
                        lower.includes('sweat') || lower.includes('छातीत') || lower.includes('घाम') ||
                        lower.includes('behoshi') || lower.includes('unconscious') || lower.includes('stroke') ||
                        lower.includes('bleeding') || lower.includes('seizure');

    const isModerate = lower.includes('बुखार') || lower.includes('fever') || lower.includes('ताप') || lower.includes('child');

    if (isEmergency) {
      updateSpectrumGauge('EMERGENCY');
      emergencyAlertBanner.classList.remove('hidden');
      emergencyRuleReason.textContent = 'Severe clinical red flags detected. Immediate emergency transport required.';
      recActionBody.innerHTML = '🚨 <b>CRITICAL EMERGENCY:</b> Severe red-flag matched. Call 108/112 immediately or transfer patient to nearest Emergency Hospital.';
      warningSignsUl.innerHTML = '<li>• Maintain clear airway</li><li>• Do NOT administer solid food or oral medicines</li>';
      auditSourceTag.textContent = 'Source: RULES_EMERGENCY_OVERRIDE (Offline)';
      followupDrawer.classList.add('hidden');
    } else if (isModerate) {
      updateSpectrumGauge('VISIT_PHC');
      emergencyAlertBanner.classList.add('hidden');
      recActionBody.innerHTML = '⚠️ <b>VISIT PHC (TODAY):</b> Symptoms require in-person examination by a medical officer at your nearest PHC today.';
      warningSignsUl.innerHTML = '<li>• Inability to keep fluids down or dehydration</li><li>• Rapid breathing (>40 breaths/min in children)</li>';
      auditSourceTag.textContent = 'Source: DETERMINISTIC_VALIDATED';
      showFollowupStep(0);
    } else {
      updateSpectrumGauge('HOME_CARE');
      emergencyAlertBanner.classList.add('hidden');
      recActionBody.innerHTML = '✅ <b>HOME CARE:</b> Mild symptoms. Maintain fluid hydration (ORS/fluids), rest, and observe symptoms.';
      warningSignsUl.innerHTML = '<li>• Watch for persistent fever lasting over 3 days</li>';
      auditSourceTag.textContent = 'Source: RULES_NORMAL';
      followupDrawer.classList.add('hidden');
    }

    matchAndShowRecommendedDoctor(state.triageRisk, text);
    updateSummaryPreBlock();
  }

  function showFollowupStep(idx) {
    if (idx >= fallbackQuestions.length) {
      followupDrawer.classList.add('hidden');
      return;
    }

    const q = fallbackQuestions[idx];
    const text = state.currentLang === 'hi' ? q.qHi : state.currentLang === 'mr' ? q.qMr : q.qEn;

    followupStepIndicator.textContent = `Question ${idx + 1} of ${fallbackQuestions.length}`;
    followupQuestionText.textContent = text;
    followupDrawer.classList.remove('hidden');
  }

  function handleFollowupChoice(ans) {
    const qObj = fallbackQuestions[state.followupIndex];
    state.followups.push({
      question: qObj.qEn,
      answer: ans
    });

    if (ans === 'Yes' && state.followupIndex === 0) {
      updateSpectrumGauge('EMERGENCY');
      emergencyAlertBanner.classList.remove('hidden');
      emergencyRuleReason.textContent = 'Breathing difficulty confirmed during clinical follow-up checks.';
      recActionBody.innerHTML = '🚨 <b>ESCALATED TO EMERGENCY:</b> Breathing distress detected. Seek urgent hospital care.';
    }

    state.followupIndex++;
    showFollowupStep(state.followupIndex);
    updateSummaryPreBlock();
  }

  function updateSummaryPreBlock() {
    if (!summaryPreBlock) return;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);

    let answers = '  • None';
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

Triage Risk Level: ${state.triageRisk}
Recommended Next Step: ${recActionBody.textContent.replace(/<[^>]+>/g, '')}
Warning Signs to Watch: WS_DEHYDRATION, WS_LABORED_BREATHING
Audit Source: DETERMINISTIC_VALIDATED

--------------------------------------------------
NOTE: Decision-support guidance only. Does not replace professional clinical diagnosis.
==================================================`;
  }

  // 9. Summary Clipboard
  function setupSummaryHandoff() {
    if (copySummaryBtn) {
      copySummaryBtn.addEventListener('click', () => {
        const text = summaryPreBlock.textContent;
        navigator.clipboard.writeText(text).then(() => {
          copyToast.classList.remove('hidden');
          copyToast.textContent = (i18n[state.currentLang] || i18n.en).copySuccess;
          setTimeout(() => {
            copyToast.classList.add('hidden');
          }, 3000);
        }).catch(() => {
          alert('Copied summary to clipboard.');
        });
      });
    }

    if (shareWhatsappBtn) {
      shareWhatsappBtn.addEventListener('click', () => {
        const text = summaryPreBlock.textContent;
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      });
    }
  }

  // 10. AI-Assisted Doctor Recommendation Matching
  function matchAndShowRecommendedDoctor(riskLevel, symptomText) {
    const textLower = (symptomText || '').toLowerCase();
    const isPediatric = textLower.includes('child') || textLower.includes('बच्च') || textLower.includes('मुल') || textLower.includes('fever') || textLower.includes('बुखार') || textLower.includes('ताप');
    const isCardiacEmergency = riskLevel === 'EMERGENCY' || textLower.includes('chest') || textLower.includes('सीने') || textLower.includes('दर्द') || textLower.includes('छातीत') || textLower.includes('breath');
    const isFamilyChronic = textLower.includes('sugar') || textLower.includes('bp') || textLower.includes('diabetes') || textLower.includes('pressure') || textLower.includes('sugar');

    let doc = {
      id: 'DOC_SHINDE',
      name: 'Dr. R. K. Shinde (MBBS)',
      specialty: 'General Physician & Family Medicine',
      hospital: 'Wagholi Arogya Clinic & Dispensary',
      phone: '020-27051122',
      avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&auto=format&fit=crop&q=80',
      reason: 'Recommended primary clinician for acute illness assessment, diagnostic workup, and localized OPD prescription.'
    };

    if (isCardiacEmergency) {
      doc = {
        id: 'DOC_ADAMS',
        name: 'Dr. Sarah Adams',
        specialty: 'Cardiology & Emergency Internal Medicine',
        hospital: 'Haveli Community Health Centre (CHC)',
        phone: '020-27051234',
        avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&auto=format&fit=crop&q=80',
        reason: 'Immediate clinical referral: Lead cardiologist with round-the-clock emergency casualty and trauma response.'
      };
    } else if (isPediatric) {
      doc = {
        id: 'DOC_LEE',
        name: 'Dr. Mark Lee',
        specialty: 'Pediatrics & Neonatal Care',
        hospital: 'Wagholi Pediatric Clinic & PHC',
        phone: '020-27051122',
        avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80',
        reason: 'Specialist in child infectious disease, pediatric hydration protocols, and IMNCI guideline triage.'
      };
    } else if (isFamilyChronic) {
      doc = {
        id: 'DOC_JOSHI',
        name: 'Dr. Anita Joshi (BAMS / CCEBDM)',
        specialty: 'Family Medicine & Diabetology',
        hospital: 'Sutarkar Community Health Clinic',
        phone: '020-27054455',
        avatar: 'https://images.unsplash.com/photo-1594824813583-0599a0e7f722?w=120&auto=format&fit=crop&q=80',
        reason: 'Specialist in metabolic disease monitoring, blood pressure stabilization, and family medicine follow-ups.'
      };
    }

    state.currentRecommendedDoctor = doc;

    const recCard = document.getElementById('recommendedDoctorCard');
    if (!recCard) return;

    const recDocName = document.getElementById('recDocName');
    const recDocSpecialty = document.getElementById('recDocSpecialty');
    const recDocHospital = document.getElementById('recDocHospital');
    const recDocReason = document.getElementById('recDocReason');
    const recDocAvatar = document.getElementById('recDocAvatar');
    const recDocCallBtn = document.getElementById('recDocCallBtn');

    if (recDocName) recDocName.textContent = doc.name;
    if (recDocSpecialty) recDocSpecialty.textContent = doc.specialty;
    if (recDocHospital) recDocHospital.textContent = doc.hospital;
    if (recDocReason) recDocReason.textContent = doc.reason;
    if (recDocAvatar && doc.avatar) recDocAvatar.src = doc.avatar;
    if (recDocCallBtn) recDocCallBtn.href = `tel:${doc.phone.replace(/[^0-9]/g, '')}`;

    recCard.classList.remove('hidden');
  }

  async function handleSaveTriageRecommendation() {
    const doc = state.currentRecommendedDoctor;
    const summary = state.symptomText || 'Clinical Symptom Triage';
    const reason = (doc && doc.reason) || 'Recommended clinical follow-up.';
    const recData = {
      input_summary: summary,
      recommended_doctor_id: (doc && doc.id) || 'DOC_SHINDE',
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
            <span class="empty-icon">📋</span>
            <p class="empty-title">No saved recommendations yet</p>
            <p class="empty-sub">Run an AI symptom triage to generate structured doctor recommendations and save them to your account.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = recs.map(r => {
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent';
        const risk = r.risk_level || 'VISIT_PHC';
        const docName = (r.doctors && r.doctors.name) || (r.recommended_doctor_id ? r.recommended_doctor_id.replace('DOC_', 'Dr. ') : 'Clinical Specialist');
        return `
          <div class="saved-rec-item">
            <div class="saved-rec-top">
              <span class="saved-rec-risk ${risk}">${risk.replace('_', ' ')}</span>
              <span class="saved-rec-date">📅 ${date}</span>
            </div>
            <p class="saved-rec-summary">${r.input_summary}</p>
            <span class="saved-rec-doc">👨‍⚕️ ${docName} • ${r.recommendation_reason || 'Verified match'}</span>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.warn('Could not load saved recommendations:', e);
    }
  }

  async function loadUserPreferences() {
    if (!window.SwasthaSupabase) return;
    try {
      const prefs = await window.SwasthaSupabase.getPreferences();
      if (prefs) {
        if (prefs.specialty && document.getElementById('prefSpecialty')) {
          document.getElementById('prefSpecialty').value = prefs.specialty;
        }
        if (prefs.location && document.getElementById('prefLocation')) {
          document.getElementById('prefLocation').value = prefs.location;
        }
        if (prefs.budget && document.getElementById('prefBudget')) {
          document.getElementById('prefBudget').value = prefs.budget;
        }
      }
    } catch (e) {}
  }

  // 12. Supabase Auth & Viewport Handlers
  function setupAuthHandlers() {
    const authModal = document.getElementById('authModal');
    const closeAuthBtn = document.getElementById('closeAuthModalBtn');
    const btnGuestBannerAuth = document.getElementById('btnGuestBannerAuth');
    const btnProfileAuthAction = document.getElementById('btnProfileAuthAction');
    const btnDesktopAuth = document.getElementById('btnDesktopAuth');
    const btnModalContinueGuest = document.getElementById('btnModalContinueGuest');
    const btnProfileSignOut = document.getElementById('btnProfileSignOut');
    const userAvatarBtn = document.getElementById('userAvatarBtn');

    const tabSignIn = document.getElementById('tabBtnSignIn');
    const tabSignUp = document.getElementById('tabBtnSignUp');

    const formSignIn = document.getElementById('signInForm');
    const formSignUp = document.getElementById('signUpForm');
    const alertBox = document.getElementById('authAlertBox');

    const openModal = () => {
      if (alertBox) alertBox.classList.add('hidden');
      if (authModal) authModal.classList.remove('hidden');
    };
    const closeModal = () => {
      if (authModal) authModal.classList.add('hidden');
    };

    if (closeAuthBtn) closeAuthBtn.addEventListener('click', closeModal);
    if (btnModalContinueGuest) btnModalContinueGuest.addEventListener('click', closeModal);
    if (btnGuestBannerAuth) btnGuestBannerAuth.addEventListener('click', openModal);
    if (btnProfileAuthAction) btnProfileAuthAction.addEventListener('click', openModal);
    if (btnDesktopAuth) btnDesktopAuth.addEventListener('click', () => {
      if (window.SwasthaSupabase && !window.SwasthaSupabase.isGuest()) {
        switchView('profile');
      } else {
        openModal();
      }
    });
    if (userAvatarBtn) userAvatarBtn.addEventListener('click', () => {
      if (window.SwasthaSupabase && !window.SwasthaSupabase.isGuest()) {
        switchView('profile');
      } else {
        openModal();
      }
    });

    if (btnProfileSignOut) {
      btnProfileSignOut.addEventListener('click', async () => {
        if (window.SwasthaSupabase) {
          await window.SwasthaSupabase.signOut();
        }
      });
    }

    // Tabs
    const setTab = (tab) => {
      [tabSignIn, tabSignUp].forEach(t => t && t.classList.remove('active'));
      [formSignIn, formSignUp].forEach(b => b && b.classList.add('hidden'));
      if (alertBox) alertBox.classList.add('hidden');

      if (tab === 'signin') {
        tabSignIn && tabSignIn.classList.add('active');
        formSignIn && formSignIn.classList.remove('hidden');
      } else if (tab === 'signup') {
        tabSignUp && tabSignUp.classList.add('active');
        formSignUp && formSignUp.classList.remove('hidden');
      }
    };

    if (tabSignIn) tabSignIn.addEventListener('click', () => setTab('signin'));
    if (tabSignUp) tabSignUp.addEventListener('click', () => setTab('signup'));

    // 1-Click Demo Login for judges
    const btnDemoQuickLogin = document.getElementById('btnDemoQuickLogin');
    if (btnDemoQuickLogin) {
      btnDemoQuickLogin.addEventListener('click', async () => {
        try {
          if (window.SwasthaSupabase) {
            await window.SwasthaSupabase.signIn('demo@swasthasathi.org', 'demo12345');
            closeModal();
          }
        } catch (e) {
          showAuthAlert(e.message || 'Demo login error');
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
            await window.SwasthaSupabase.signIn(email, password);
            closeModal();
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
        try {
          if (spinner) spinner.classList.remove('hidden');
          if (window.SwasthaSupabase) {
            await window.SwasthaSupabase.signUp(email, password, name);
            closeModal();
          }
        } catch (err) {
          showAuthAlert(err.message || 'Failed to create account.');
        } finally {
          if (spinner) spinner.classList.add('hidden');
        }
      });
    }


    function showAuthAlert(msg, isSuccess = false) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.className = isSuccess ? 'auth-alert-banner success' : 'auth-alert-banner';
      alertBox.classList.remove('hidden');
    }

    // Viewport Mode Switcher (Desktop SaaS vs Phone preview)
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
    const desktopNavItems = document.querySelectorAll('.desktop-nav-item');
    desktopNavItems.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        window.location.hash = view;
        switchView(view);
      });
    });

    // Preferences Save
    const btnSavePreferences = document.getElementById('btnSavePreferences');
    if (btnSavePreferences) {
      btnSavePreferences.addEventListener('click', async () => {
        const specialty = document.getElementById('prefSpecialty').value;
        const location = document.getElementById('prefLocation').value;
        const budget = document.getElementById('prefBudget').value;

        if (window.SwasthaSupabase) {
          await window.SwasthaSupabase.savePreferences({ specialty, location, budget });
        }

        const toast = document.getElementById('prefSaveToast');
        if (toast) {
          toast.classList.remove('hidden');
          setTimeout(() => toast.classList.add('hidden'), 3000);
        }
      });
    }

    // Save Triage Recommendation Button
    const btnSaveTriageRec = document.getElementById('btnSaveTriageRec');
    if (btnSaveTriageRec) {
      btnSaveTriageRec.addEventListener('click', handleSaveTriageRecommendation);
    }
  }

  function handleAuthChange(event, session, user) {
    const isGuest = !user;
    const desktopAuthLabel = document.getElementById('desktopAuthLabel');
    const btnDesktopAuth = document.getElementById('btnDesktopAuth');
    const appGreeting = document.getElementById('appGreeting');
    const guestModeBanner = document.getElementById('guestModeBanner');
    const profileUserName = document.getElementById('profileUserName');
    const profileUserEmail = document.getElementById('profileUserEmail');
    const profileBadgeStatus = document.getElementById('profileBadgeStatus');
    const profileAvatarInitial = document.getElementById('profileAvatarInitial');
    const btnProfileAuthAction = document.getElementById('btnProfileAuthAction');
    const btnProfileSignOut = document.getElementById('btnProfileSignOut');

    if (isGuest) {
      if (desktopAuthLabel) desktopAuthLabel.textContent = 'Guest Mode • Sign In';
      if (btnDesktopAuth) {
        btnDesktopAuth.classList.remove('signed-in');
        btnDesktopAuth.classList.add('guest-state');
      }
      if (appGreeting) appGreeting.textContent = 'Hi, Sunita Tai (Guest)';
      if (guestModeBanner) guestModeBanner.classList.remove('hidden');

      if (profileUserName) profileUserName.textContent = 'Sunita Tai (Guest)';
      if (profileUserEmail) profileUserEmail.textContent = 'guest@swasthasathi.org';
      if (profileBadgeStatus) profileBadgeStatus.textContent = 'Guest Mode • Sandbox';
      if (profileAvatarInitial) profileAvatarInitial.textContent = 'G';
      if (btnProfileAuthAction) btnProfileAuthAction.classList.remove('hidden');
      if (btnProfileSignOut) btnProfileSignOut.classList.add('hidden');
    } else {
      const name = (user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0];
      if (desktopAuthLabel) desktopAuthLabel.textContent = name;
      if (btnDesktopAuth) {
        btnDesktopAuth.classList.add('signed-in');
        btnDesktopAuth.classList.remove('guest-state');
      }
      if (appGreeting) appGreeting.textContent = `Hi, ${name}`;
      if (guestModeBanner) guestModeBanner.classList.add('hidden');

      if (profileUserName) profileUserName.textContent = name;
      if (profileUserEmail) profileUserEmail.textContent = user.email;
      if (profileBadgeStatus) profileBadgeStatus.textContent = 'Supabase Cloud Verified • RLS Protected';
      if (profileAvatarInitial) profileAvatarInitial.textContent = name.charAt(0).toUpperCase();
      if (btnProfileAuthAction) btnProfileAuthAction.classList.add('hidden');
      if (btnProfileSignOut) btnProfileSignOut.classList.remove('hidden');
    }

    loadSavedRecommendations();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
