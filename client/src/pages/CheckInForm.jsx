import React, { useState } from 'react';
import { api } from '../api/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

const DANGER_SIGNS = {
  antenatal: [
    {
      id: 'severe_headache_visual_changes',
      label_en: 'Severe headache with visual disturbance / blurring',
      label_hi: 'तेज सिरदर्द और आंखों में धुंधलापन (Severe headache with blurred vision)',
    },
    {
      id: 'vaginal_bleeding',
      label_en: 'Vaginal bleeding or spotting',
      label_hi: 'रक्तस्राव या धब्बे दिखना (Vaginal bleeding / spotting)',
    },
    {
      id: 'convulsions',
      label_en: 'Convulsions / loss of consciousness',
      label_hi: 'दौरे या बेहोशी (Convulsions / Fainting)',
    },
    {
      id: 'reduced_fetal_movement',
      label_en: 'Marked reduction in fetal movement',
      label_hi: 'गर्भस्थ शिशु की हलचल में अत्यधिक कमी (Reduced fetal movement)',
    },
    {
      id: 'high_fever_chills',
      label_en: 'High fever with chills',
      label_hi: 'कंपकंपी के साथ तेज बुखार (High fever with chills)',
    },
  ],
  hypertension: [
    {
      id: 'chest_pain',
      label_en: 'Acute chest pain or pressure',
      label_hi: 'छाती में तेज दर्द या दबाव (Chest pain or pressure)',
    },
    {
      id: 'shortness_of_breath',
      label_en: 'Shortness of breath / difficulty breathing',
      label_hi: 'सांस लेने में अत्यधिक कठिनाई (Shortness of breath)',
    },
    {
      id: 'sudden_numbness_weakness',
      label_en: 'Sudden weakness, facial droop, or limb numbness',
      label_hi: 'अंगों में अचानक कमजोरी या सुन्नपन (Sudden numbness / weakness)',
    },
    {
      id: 'severe_dizziness',
      label_en: 'Severe persistent dizziness or fainting',
      label_hi: 'चक्कर आना या बेहोश होना (Severe dizziness or fainting)',
    },
  ],
  diabetes: [
    {
      id: 'extreme_thirst_confusion',
      label_en: 'Extreme thirst accompanied by mental confusion',
      label_hi: 'अत्यधिक प्यास और मानसिक भ्रम (Extreme thirst with confusion)',
    },
    {
      id: 'fruity_breath_odor',
      label_en: 'Fruity or acetone breath odor',
      label_hi: 'सांस से मीठी या एसीटोन जैसी गंध (Fruity breath odor)',
    },
    {
      id: 'unhealing_foot_wound',
      label_en: 'Unhealing foot ulcer, cut, or discoloration',
      label_hi: 'पैर पर न भरने वाला घाव या छाला (Unhealing foot ulcer/wound)',
    },
    {
      id: 'loss_of_consciousness',
      label_en: 'Loss of consciousness / severe hypoglycemic stupor',
      label_hi: 'बेहोशी / अत्यधिक कम शुगर का दौरा (Severe hypoglycemia)',
    },
  ],
};

export default function CheckInForm({ patient, existingCheckInId, onClose, onSuccess }) {
  const { lang, t } = useLanguage();
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cohortDangerSigns = DANGER_SIGNS[patient.cohort] || DANGER_SIGNS.antenatal;

  const handleSymptomToggle = (symptomId) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptomId) ? prev.filter((s) => s !== symptomId) : [...prev, symptomId]
    );
  };

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

      const payload = {
        patient_id: patient.id || patient.patient_id,
        existing_check_in_id: existingCheckInId,
        channel,
        measurements,
        symptoms: selectedSymptoms,
        notes,
      };

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
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <h3>{t('checkin_modal_title')}</h3>
            <span className="modal-subtitle">
              Patient: <strong>{patient.pseudonym}</strong> ({patient.cohort?.toUpperCase()} · {patient.village_or_ward})
            </span>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="checkin-modal-form">
          {/* Channel selector */}
          <div className="form-row">
            <div className="form-group">
              <label>{t('interaction_channel')}</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="in_person">{t('channel_in_person')}</option>
                <option value="phone">{t('channel_phone')}</option>
              </select>
            </div>
          </div>

          {/* Vitals Section */}
          <div className="form-section">
            <h4 className="section-heading">{t('vital_measurements_heading')}</h4>
            <div className="form-grid-3">
              <div className="form-group">
                <label>{t('bp_systolic')}</label>
                <input
                  type="number"
                  placeholder="e.g. 120"
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t('bp_diastolic')}</label>
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t('heart_rate')}</label>
                <input
                  type="number"
                  placeholder="e.g. 72"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t('fasting_glucose')}</label>
                <input
                  type="number"
                  placeholder="e.g. 95"
                  value={fastingGlucose}
                  onChange={(e) => setFastingGlucose(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t('random_glucose')}</label>
                <input
                  type="number"
                  placeholder="e.g. 135"
                  value={randomGlucose}
                  onChange={(e) => setRandomGlucose(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t('weight_kg')}</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 58.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t('temperature_f')}</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 98.6"
                  value={temperatureF}
                  onChange={(e) => setTemperatureF(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Danger Signs Checklist */}
          <div className="form-section">
            <h4 className="section-heading">
              {t('danger_signs_heading')} ({patient.cohort?.toUpperCase()})
            </h4>
            <div className="danger-signs-checklist">
              {cohortDangerSigns.map((sign) => (
                <label key={sign.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedSymptoms.includes(sign.id)}
                    onChange={() => handleSymptomToggle(sign.id)}
                  />
                  <span>{lang === 'hi' ? sign.label_hi : sign.label_en}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label>{t('field_notes')}</label>
            <textarea
              rows="3"
              placeholder="Record any general patient comments, adherence notes, or caregiver observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              {t('cancel_btn')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Evaluating Rules & Saving...' : t('save_checkin_btn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
