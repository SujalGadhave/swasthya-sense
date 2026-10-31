import React, { useState, useEffect } from 'react';
import { api } from '../api/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useOffline } from '../context/OfflineContext.jsx';
import { getPatientDisplayName, getLocalizedVillage } from '../utils/patientNames.js';

const DANGER_SIGNS = {
  antenatal: [
    {
      id: 'severe_headache_visual_changes',
      icon: '🤕',
      label_en: 'Severe headache with blurred vision / visual changes',
      label_hi: 'तेज सिरदर्द और आंखों में धुंधलापन दिखना',
    },
    {
      id: 'vaginal_bleeding',
      icon: '🩸',
      label_en: 'Vaginal bleeding or spotting',
      label_hi: 'रक्तस्राव (खून बहना) या धब्बे दिखना',
    },
    {
      id: 'convulsions',
      icon: '🫨',
      label_en: 'Convulsions / loss of consciousness',
      label_hi: 'दौरे पड़ना या बेहोशी आना',
    },
    {
      id: 'reduced_fetal_movement',
      icon: '🤰',
      label_en: 'Marked reduction in fetal movement',
      label_hi: 'गर्भस्थ शिशु की हलचल में अत्यधिक कमी',
    },
    {
      id: 'high_fever_chills',
      icon: '🌡️',
      label_en: 'High fever with shivering / chills',
      label_hi: 'कंपकंपी के साथ तेज बुखार आना',
    },
  ],
  hypertension: [
    {
      id: 'chest_pain',
      icon: '🫀',
      label_en: 'Acute chest pain or pressure',
      label_hi: 'छाती में तेज दर्द या भारीपन/दबाव',
    },
    {
      id: 'shortness_of_breath',
      icon: '😮‍💨',
      label_en: 'Shortness of breath / severe breathing difficulty',
      label_hi: 'सांस लेने में अत्यधिक कठिनाई या घबराहट',
    },
    {
      id: 'sudden_numbness_weakness',
      icon: '⚡',
      label_en: 'Sudden weakness, facial droop, or limb numbness',
      label_hi: 'अंगों में अचानक कमजोरी या चेहरा सुन्न पड़ना',
    },
    {
      id: 'severe_dizziness',
      icon: '🫨',
      label_en: 'Severe persistent dizziness or fainting',
      label_hi: 'तेज चक्कर आना या गिर पड़ना',
    },
  ],
  diabetes: [
    {
      id: 'extreme_thirst_confusion',
      icon: '💧',
      label_en: 'Extreme thirst accompanied by confusion',
      label_hi: 'अत्यधिक प्यास और मानसिक भ्रम/घबराहट',
    },
    {
      id: 'fruity_breath_odor',
      icon: '🍏',
      label_en: 'Fruity or sweet acetone breath odor',
      label_hi: 'सांस से मीठी या फल जैसी गंध आना',
    },
    {
      id: 'unhealing_foot_wound',
      icon: '🦶',
      label_en: 'Unhealing foot ulcer, cut, or wound',
      label_hi: 'पैर पर घाव या छाला जो भर नहीं रहा',
    },
    {
      id: 'loss_of_consciousness',
      icon: '😴',
      label_en: 'Loss of consciousness / extreme stupor',
      label_hi: 'बेहोशी या अत्यधिक सुस्ती/सुध न रहना',
    },
  ],
};

const QUICK_OBSERVATION_PILLS = [
  { id: 'p1', hi: '💊 दवा नियमित ले रहे हैं', en: 'Taking medicines regularly' },
  { id: 'p2', hi: '🛌 आराम करने की सलाह दी', en: 'Advised rest and hydration' },
  { id: 'p3', hi: '⚠️ मरीज़ अस्वस्थ महसूस कर रहा है', en: 'Patient feels unwell' },
  { id: 'p4', hi: '🏥 PHC अस्पताल जाने को कहा', en: 'Advised in-person PHC referral' },
  { id: 'p5', hi: '💧 पर्याप्त पानी पीने को कहा', en: 'Advised drinking sufficient water' },
];

export default function CheckInForm({ patient, existingCheckInId, onClose, onSuccess }) {
  const { lang, t } = useLanguage();
  const { isOffline, queueCheckIn } = useOffline();

  const cohort = patient.cohort || 'antenatal';
  const isANC = cohort === 'antenatal';
  const isHTN = cohort === 'hypertension';
  const isDiabetes = cohort === 'diabetes';

  const [channel, setChannel] = useState('in_person');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [fastingGlucose, setFastingGlucose] = useState('');
  const [randomGlucose, setRandomGlucose] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [temperatureF, setTemperatureF] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [notes, setNotes] = useState('');
  const [showExtraVitals, setShowExtraVitals] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Voice dictation state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
    }
  }, []);

  const cohortDangerSigns = DANGER_SIGNS[cohort] || DANGER_SIGNS.antenatal;

  const handleSymptomToggle = (symptomId) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptomId) ? prev.filter((s) => s !== symptomId) : [...prev, symptomId]
    );
  };

  const handleAddQuickPill = (pillText) => {
    setNotes((prev) => (prev ? `${prev}. ${pillText}` : pillText));
  };

  const toggleVoiceDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(lang === 'hi' ? 'इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है।' : 'Speech recognition not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setNotes((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };

      recognition.onerror = (e) => {
        console.error('Speech recognition error:', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  // Instant Traffic Light Vitals Feedback
  const numSys = Number(systolic);
  const numDia = Number(diastolic);
  const isBPDanger = (numSys && numSys >= 140) || (numDia && numDia >= 90);
  const isBPNormal = numSys && numDia && numSys < 140 && numDia < 90 && numSys >= 90;

  const numGluc = Number(randomGlucose);
  const isSugarDanger = numGluc && numGluc >= 200;
  const isSugarNormal = numGluc && numGluc < 140 && numGluc >= 70;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const measurements = {};
      if (systolic) measurements.systolic = Number(systolic);
      if (diastolic) measurements.diastolic = Number(diastolic);
      if (fastingGlucose) measurements.fastingGlucose = Number(fastingGlucose);
      if (randomGlucose) measurements.randomGlucose = Number(randomGlucose);
      if (weightKg) measurements.weightKg = Number(weightKg);
      if (temperatureF) measurements.temperatureF = Number(temperatureF);
      if (heartRate) measurements.heartRate = Number(heartRate);

      const clientUuid = `chk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload = {
        client_uuid: clientUuid,
        patient_id: patient.id || patient.patient_id,
        existing_check_in_id: existingCheckInId,
        channel,
        measurements,
        symptoms: selectedSymptoms,
        notes,
      };

      if (isOffline) {
        const offlineResult = queueCheckIn(patient, payload);
        if (onSuccess) {
          onSuccess(offlineResult);
        }
        return;
      }

      const result = await api.checkins.submit(payload);
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to record check-in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container asha-checkin-modal">
        {/* Friendly Header with Cohort Icon */}
        <div className="modal-header asha-modal-header">
          <div className="asha-header-info">
            <span className="asha-patient-avatar">
              {isANC ? '🤰' : isHTN ? '🫀' : '🩸'}
            </span>
            <div>
              <h3>
                {lang === 'hi' ? 'जांच दर्ज करें' : 'Record Check-In'} ·{' '}
                <strong className="asha-patient-name">{getPatientDisplayName(patient.pseudonym, lang)}</strong>
              </h3>
              <span className="modal-subtitle">
                {isANC
                  ? (lang === 'hi' ? 'गर्भवती महिला (Antenatal)' : 'Antenatal Mother')
                  : isHTN
                  ? (lang === 'hi' ? 'उच्च रक्तचाप (Hypertension)' : 'Hypertension Patient')
                  : (lang === 'hi' ? 'मधुमेह (Diabetes)' : 'Diabetes Patient')}{' '}
                · 📍 {getLocalizedVillage(patient.village_or_ward, lang)}
              </span>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {/* Offline notice if in offline mode */}
        {isOffline && (
          <div className="offline-form-notice">
            📡 <strong>{lang === 'hi' ? 'ऑफ़लाइन मोड:' : 'Offline Mode:'}</strong>{' '}
            {lang === 'hi'
              ? 'यह जांच फोन में सुरक्षित सहेजी जाएगी। इंटरनेट आने पर सिंक करें।'
              : 'Saved locally on phone. Will sync when network is restored.'}
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="checkin-modal-form">
          {/* Channel selector (Home Visit vs Phone) with big touch tabs */}
          <div className="channel-select-pills">
            <button
              type="button"
              className={`channel-pill-btn ${channel === 'in_person' ? 'active' : ''}`}
              onClick={() => setChannel('in_person')}
            >
              🏠 {lang === 'hi' ? 'गृह भेंट (घर पर)' : 'Home Visit (In-Person)'}
            </button>
            <button
              type="button"
              className={`channel-pill-btn ${channel === 'phone' ? 'active' : ''}`}
              onClick={() => setChannel('phone')}
            >
              📞 {lang === 'hi' ? 'फोन पर बातचीत' : 'Phone Call'}
            </button>
          </div>

          {/* SECTION 1: DANGER SIGNS TAP-CARDS (MOST IMPORTANT FOR LOW LITERACY) */}
          <div className="asha-form-section">
            <div className="section-title-row">
              <h4 className="asha-section-title">
                ⚠️ {lang === 'hi' ? '1. क्या कोई खतरे का लक्षण दिखा?' : '1. Any Danger Signs Observed?'}
              </h4>
              {selectedSymptoms.length > 0 ? (
                <button
                  type="button"
                  className="btn-clear-signs"
                  onClick={() => setSelectedSymptoms([])}
                >
                  ✕ {lang === 'hi' ? 'सभी हटाएं' : 'Clear All'}
                </button>
              ) : (
                <span className="safe-pill-tag">
                  ✓ {lang === 'hi' ? 'सब सामान्य' : 'All Normal'}
                </span>
              )}
            </div>

            <div className="danger-cards-grid">
              {cohortDangerSigns.map((sign) => {
                const isSelected = selectedSymptoms.includes(sign.id);
                return (
                  <button
                    key={sign.id}
                    type="button"
                    className={`danger-touch-card ${isSelected ? 'selected-danger' : ''}`}
                    onClick={() => handleSymptomToggle(sign.id)}
                  >
                    <span className="danger-card-icon">{sign.icon}</span>
                    <span className="danger-card-text">
                      {lang === 'hi' ? sign.label_hi : sign.label_en}
                    </span>
                    <span className="danger-check-badge">
                      {isSelected ? '✓' : '+'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: COHORT-ADAPTIVE MINIMAL VITALS */}
          <div className="asha-form-section">
            <h4 className="asha-section-title">
              🩺 {lang === 'hi' ? '2. शारीरिक जांच (Vitals)' : '2. Key Vitals'}
            </h4>

            {/* Blood Pressure (Only for ANC & HTN) */}
            {(isANC || isHTN) && (
              <div className="vitals-group-box">
                <div className="vitals-box-header">
                  <strong>🫀 {lang === 'hi' ? 'रक्तचाप (Blood Pressure)' : 'Blood Pressure (BP)'}</strong>
                  {isBPDanger && (
                    <span className="traffic-pill pill-danger">
                      🔴 {lang === 'hi' ? 'खतरा! उच्च रक्तचाप' : 'Danger! High BP (≥140/90)'}
                    </span>
                  )}
                  {isBPNormal && (
                    <span className="traffic-pill pill-normal">
                      🟢 {lang === 'hi' ? 'सुरक्षित (सामान्य)' : 'Normal (<140/90)'}
                    </span>
                  )}
                </div>
                <div className="vitals-input-row">
                  <div className="vital-input-col">
                    <label>{lang === 'hi' ? 'ऊपर का बीपी (Systolic)' : 'Systolic (Upper)'}</label>
                    <input
                      type="number"
                      placeholder="e.g. 120"
                      value={systolic}
                      onChange={(e) => setSystolic(e.target.value)}
                      className={`asha-input ${isBPDanger ? 'input-alert' : ''}`}
                    />
                  </div>
                  <span className="slash-divider">/</span>
                  <div className="vital-input-col">
                    <label>{lang === 'hi' ? 'नीचे का बीपी (Diastolic)' : 'Diastolic (Lower)'}</label>
                    <input
                      type="number"
                      placeholder="e.g. 80"
                      value={diastolic}
                      onChange={(e) => setDiastolic(e.target.value)}
                      className={`asha-input ${isBPDanger ? 'input-alert' : ''}`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Glucose (Sugar) - Prominent for Diabetes */}
            {isDiabetes && (
              <div className="vitals-group-box">
                <div className="vitals-box-header">
                  <strong>🩸 {lang === 'hi' ? 'रक्त शर्करा (Blood Sugar / Glucose)' : 'Blood Sugar (Glucose)'}</strong>
                  {isSugarDanger && (
                    <span className="traffic-pill pill-danger">
                      🔴 {lang === 'hi' ? 'खतरा! बहुत अधिक शुगर' : 'Danger! High Sugar (≥200)'}
                    </span>
                  )}
                  {isSugarNormal && (
                    <span className="traffic-pill pill-normal">
                      🟢 {lang === 'hi' ? 'सुरक्षित (सामान्य)' : 'Normal (<140)'}
                    </span>
                  )}
                </div>
                <div className="vitals-input-row">
                  <div className="vital-input-col">
                    <label>{lang === 'hi' ? 'रैंडम शुगर (mg/dL)' : 'Random Glucose (mg/dL)'}</label>
                    <input
                      type="number"
                      placeholder="e.g. 130"
                      value={randomGlucose}
                      onChange={(e) => setRandomGlucose(e.target.value)}
                      className={`asha-input ${isSugarDanger ? 'input-alert' : ''}`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Weight (Essential for ANC & Diabetes) */}
            {(isANC || isDiabetes) && (
              <div className="vital-single-row">
                <label>⚖️ {lang === 'hi' ? 'वजन (Weight - किलोग्राम)' : 'Weight (kg)'}</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 58.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="asha-input"
                />
              </div>
            )}

            {/* Pulse (for HTN) */}
            {isHTN && (
              <div className="vital-single-row">
                <label>💓 {lang === 'hi' ? 'नाड़ी / धड़कन (Heart Rate - bpm)' : 'Pulse / Heart Rate (bpm)'}</label>
                <input
                  type="number"
                  placeholder="e.g. 74"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  className="asha-input"
                />
              </div>
            )}

            {/* Expandable Extra Vitals for full clinical completeness */}
            <div className="extra-vitals-accordion">
              <button
                type="button"
                className="btn-toggle-extra"
                onClick={() => setShowExtraVitals(!showExtraVitals)}
              >
                {showExtraVitals
                  ? (lang === 'hi' ? '▲ अन्य माप छिपाएं' : '▲ Hide Extra Vitals')
                  : (lang === 'hi' ? '▼ अन्य माप दर्ज करें (बुखार / खाली पेट शुगर)' : '▼ Add Extra Vitals (Temp / Fasting Sugar)')}
              </button>

              {showExtraVitals && (
                <div className="extra-vitals-grid">
                  <div className="vital-col">
                    <label>🌡️ {lang === 'hi' ? 'तापमान (°F)' : 'Temperature (°F)'}</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 98.6"
                      value={temperatureF}
                      onChange={(e) => setTemperatureF(e.target.value)}
                      className="asha-input"
                    />
                  </div>
                  <div className="vital-col">
                    <label>🥣 {lang === 'hi' ? 'खाली पेट शुगर (mg/dL)' : 'Fasting Glucose'}</label>
                    <input
                      type="number"
                      placeholder="e.g. 95"
                      value={fastingGlucose}
                      onChange={(e) => setFastingGlucose(e.target.value)}
                      className="asha-input"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: QUICK OBSERVATION PILLS + VOICE INPUT */}
          <div className="asha-form-section">
            <div className="section-title-row">
              <h4 className="asha-section-title">
                📝 {lang === 'hi' ? '3. अवलोकन व टिप्पणी (Notes)' : '3. Observations & Notes'}
              </h4>
              {speechSupported && (
                <button
                  type="button"
                  className={`btn-voice-dictation ${isListening ? 'listening-pulse' : ''}`}
                  onClick={toggleVoiceDictation}
                  title="Speak in Hindi to type notes automatically"
                >
                  {isListening
                    ? (lang === 'hi' ? '🔴 सुन रहे हैं... बोलिए' : '🔴 Listening...')
                    : (lang === 'hi' ? '🎙️ बोलकर लिखें' : '🎙️ Tap to Speak')}
                </button>
              )}
            </div>

            {/* Quick 1-Tap Observation Pills */}
            <div className="quick-pills-row">
              {QUICK_OBSERVATION_PILLS.map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  className="quick-note-pill"
                  onClick={() => handleAddQuickPill(lang === 'hi' ? pill.hi : pill.en)}
                >
                  + {lang === 'hi' ? pill.hi : pill.en}
                </button>
              ))}
            </div>

            <textarea
              rows="2"
              placeholder={lang === 'hi' ? 'टिप्पणी लिखें या ऊपर दिए गए विकल्पों को दबाएं...' : 'Write notes or tap quick observation options above...'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="asha-textarea"
            />
          </div>

          {/* Large Thumb-Friendly Submit Buttons */}
          <div className="asha-modal-actions">
            <button
              type="button"
              className="btn asha-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="btn asha-btn-submit"
              disabled={loading}
            >
              {loading
                ? (lang === 'hi' ? 'जांच सहेजी जा रही है...' : 'Evaluating & Saving...')
                : (lang === 'hi' ? '✅ जांच सुरक्षित करें' : '✅ Save Check-In')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
