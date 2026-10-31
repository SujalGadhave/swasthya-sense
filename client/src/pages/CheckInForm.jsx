import React, { useState } from 'react';
import { api } from '../api/api.js';

const DANGER_SIGNS = {
  antenatal: [
    { id: 'severe_headache_visual_changes', label: 'Severe headache with visual disturbance / blurring' },
    { id: 'vaginal_bleeding', label: 'Vaginal bleeding or spotting' },
    { id: 'convulsions', label: 'Convulsions / loss of consciousness' },
    { id: 'reduced_fetal_movement', label: 'Marked reduction in fetal movement' },
    { id: 'high_fever_chills', label: 'High fever with chills' },
  ],
  hypertension: [
    { id: 'chest_pain', label: 'Acute chest pain or pressure' },
    { id: 'shortness_of_breath', label: 'Shortness of breath / difficulty breathing' },
    { id: 'sudden_numbness_weakness', label: 'Sudden weakness, facial droop, or limb numbness' },
    { id: 'severe_dizziness', label: 'Severe persistent dizziness or fainting' },
  ],
  diabetes: [
    { id: 'extreme_thirst_confusion', label: 'Extreme thirst accompanied by mental confusion' },
    { id: 'fruity_breath_odor', label: 'Fruity or acetone breath odor' },
    { id: 'unhealing_foot_wound', label: 'Unhealing foot ulcer, cut, or discoloration' },
    { id: 'loss_of_consciousness', label: 'Loss of consciousness / severe hypoglycemic stupor' },
  ],
};

export default function CheckInForm({ patient, existingCheckInId, onClose, onSuccess }) {
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
            <h3>Record Follow-Up Check-In</h3>
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
              <label>Interaction Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="in_person">🏠 In-Person (Home / Village Visit)</option>
                <option value="phone">📞 Phone / Telephonic Check-In</option>
              </select>
            </div>
          </div>

          {/* Vitals Section */}
          <div className="form-section">
            <h4 className="section-heading">Vital Measurements</h4>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Systolic BP (mmHg)</label>
                <input
                  type="number"
                  placeholder="e.g. 120"
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Heart Rate (bpm)</label>
                <input
                  type="number"
                  placeholder="e.g. 72"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Fasting Glucose (mg/dL)</label>
                <input
                  type="number"
                  placeholder="e.g. 95"
                  value={fastingGlucose}
                  onChange={(e) => setFastingGlucose(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Random Glucose (mg/dL)</label>
                <input
                  type="number"
                  placeholder="e.g. 135"
                  value={randomGlucose}
                  onChange={(e) => setRandomGlucose(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 58.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Temperature (°F)</label>
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
              Protocol Danger Signs ({patient.cohort} Cohort Checklist)
            </h4>
            <div className="danger-signs-checklist">
              {cohortDangerSigns.map((sign) => (
                <label key={sign.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedSymptoms.includes(sign.id)}
                    onChange={() => handleSymptomToggle(sign.id)}
                  />
                  <span>{sign.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label>Field Observation & Visit Notes</label>
            <textarea
              rows="3"
              placeholder="Record any general patient comments, adherence notes, or caregiver observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Evaluating Rules & Saving...' : 'Save & Evaluate Check-In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
