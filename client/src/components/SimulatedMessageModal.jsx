import React, { useState, useEffect } from 'react';
import { api } from '../api/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function SimulatedMessageModal({ patient, onClose }) {
  const { lang } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState('whatsapp'); // whatsapp | sms
  const [msgLang, setMsgLang] = useState(lang || 'en');
  const [loading, setLoading] = useState(true);

  const patientId = patient.id || patient.patient_id;
  const isConsented = patient.consent_status === 'consented';

  useEffect(() => {
    setLoading(true);
    api.messages.getAll(`patient_id=${patientId}`)
      .then((res) => setMessages(res.messages || []))
      .catch((err) => console.error('Failed to load patient messages:', err))
      .finally(() => setLoading(false));
  }, [patientId]);

  // Find latest message if available or generate default template
  const latestMessage = messages[0];

  const getTemplateText = () => {
    if (!isConsented) {
      return msgLang === 'hi'
        ? '[संदेश अवरुद्ध] स्वचालित अनुस्मारक दबा दिया गया: मरीज़ ने स्वचालित संदेश भेजने की सहमति अस्वीकार की है।'
        : '[MESSAGE SUPPRESSED] Reminder dispatch blocked: Patient has declined automated messaging consent in their registry profile.';
    }

    const dueDate = patient.due_date || 'Upcoming';
    if (msgLang === 'hi') {
      return `नमस्ते। स्वास्थ्या सेंस अनुस्मारक: आपकी नियमित ${patient.cohort?.toUpperCase() || ''} स्वास्थ्य जांच ${dueDate} को देय है। आपकी आशा कार्यकर्ता सुनीता देवी आपसे संपर्क करेंगी। कृपया अपने पिछले पर्चे तैयार रखें। (स्वास्थ्या सेंस प्रोटोटाइप)`;
    }
    return `Namaste. Swasthya Sense reminder: Your routine ${patient.cohort?.toUpperCase() || ''} health check-up is scheduled on ${dueDate}. Your ASHA worker Sunita Devi will be in touch. Please keep your previous health records ready. (Swasthya Sense Prototype)`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container message-modal-container">
        <div className="modal-header">
          <div>
            <h3>📱 Patient Simulated Messaging Preview</h3>
            <span className="modal-subtitle">
              Patient: <strong>{patient.pseudonym}</strong> ({patient.cohort?.toUpperCase()} · {patient.village_or_ward})
            </span>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {/* Consent Status Policy Banner */}
        <div className={`message-consent-banner ${isConsented ? 'banner-consented' : 'banner-suppressed'}`}>
          {isConsented ? (
            <div>
              <strong>✓ Active Patient Consent:</strong> Automated follow-up reminders are simulated according to the cohort schedule.
            </div>
          ) : (
            <div>
              <strong>🛡️ Privacy Protection Active (No Consent):</strong> Patient has opted out of automated messaging. In compliance with patient autonomy safeguards, reminder dispatch is strictly suppressed.
            </div>
          )}
        </div>

        {/* Channel & Language Switcher Controls */}
        <div className="preview-controls-row">
          <div className="channel-toggle-group">
            <button
              className={`channel-btn ${channel === 'whatsapp' ? 'active whatsapp' : ''}`}
              onClick={() => setChannel('whatsapp')}
            >
              🟢 WhatsApp Preview
            </button>
            <button
              className={`channel-btn ${channel === 'sms' ? 'active sms' : ''}`}
              onClick={() => setChannel('sms')}
            >
              💬 Standard SMS Preview
            </button>
          </div>

          <div className="msg-lang-toggle">
            <button
              className={`lang-pill ${msgLang === 'en' ? 'active' : ''}`}
              onClick={() => setMsgLang('en')}
            >
              English
            </button>
            <button
              className={`lang-pill ${msgLang === 'hi' ? 'active' : ''}`}
              onClick={() => setMsgLang('hi')}
            >
              हिंदी
            </button>
          </div>
        </div>

        {/* Simulated Phone UI Screen */}
        <div className="simulated-phone-frame">
          {channel === 'whatsapp' ? (
            <div className="whatsapp-screen">
              <div className="whatsapp-header">
                <span className="wa-back">←</span>
                <div className="wa-avatar">🌿</div>
                <div className="wa-contact-info">
                  <span className="wa-name">Swasthya Sense (PHC Care)</span>
                  <span className="wa-status">
                    To: {patient.pseudonym} · [Synthetic Contact Token]
                  </span>
                </div>
              </div>

              <div className="whatsapp-chat-area">
                <div className="wa-date-chip">TODAY</div>

                <div className={`wa-bubble ${isConsented ? 'bubble-in' : 'bubble-blocked'}`}>
                  <p className="wa-message-text">{getTemplateText()}</p>
                  <div className="wa-message-meta">
                    <span className="wa-time">09:15 AM</span>
                    {isConsented ? (
                      <span className="wa-check" title="Delivered via simulated gateway">✓✓</span>
                    ) : (
                      <span className="wa-blocked-icon" title="Suppressed by consent rule">🛡️ Blocked</span>
                    )}
                  </div>
                </div>

                <div className="wa-encryption-note">
                  🔒 Messages to synthetic tokens are simulated for hackathon demonstration. No real SMS/WhatsApp gateways are connected.
                </div>
              </div>
            </div>
          ) : (
            <div className="sms-screen">
              <div className="sms-header">
                <span className="sms-sender">Govt PHC Health Alert</span>
                <span className="sms-recipient">To: {patient.pseudonym}</span>
              </div>
              <div className="sms-body">
                <div className={`sms-bubble ${isConsented ? 'sms-valid' : 'sms-blocked'}`}>
                  <p>{getTemplateText()}</p>
                  <span className="sms-time">09:15 AM · SMS via Simulated Carrier</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Database log records if any */}
        {messages.length > 0 && (
          <div className="history-log-summary">
            <strong>Database Audit:</strong> {messages.length} dispatch event(s) recorded in <code>simulated_messages</code> table (Status: <code>{latestMessage.status}</code>).
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
