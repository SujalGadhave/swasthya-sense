/**
 * Vernacular Voice Read-Aloud (Text-to-Speech) Helper
 *
 * Uses native browser SpeechSynthesis API:
 * - 100% client-side
 * - Zero external API latency
 * - Operates reliably in offline rural conditions
 *
 * Specially designed for frontline ASHA workers with low literacy
 * who need audio confirmation of patient risk status and emergency actions.
 */

import { getPatientDisplayName, getLocalizedVillage } from './patientNames.js';
import { getFlagExplanation } from '../components/FlagCard.jsx';

let activeUtterance = null;

export function speakText(text, lang = 'hi', onEndCallback) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return false;
  }

  // Cancel any ongoing speech to avoid queue pileup
  window.speechSynthesis.cancel();

  if (!text) return false;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  utterance.rate = 0.92; // Slightly measured pace for clear field comprehension
  utterance.pitch = 1.0;

  // Select appropriate voice if available in user's OS / browser
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    const targetCode = lang === 'hi' ? 'hi' : 'en';
    const matchedVoice =
      voices.find((v) =>
        v.lang.toLowerCase().startsWith(targetCode) &&
        (v.lang.toLowerCase().includes('in') || v.name.toLowerCase().includes('india') || v.name.toLowerCase().includes('hindi'))
      ) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(targetCode));

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
  }

  utterance.onend = () => {
    activeUtterance = null;
    if (onEndCallback) onEndCallback();
  };

  utterance.onerror = (e) => {
    console.warn('Speech synthesis playback ended or interrupted:', e);
    activeUtterance = null;
    if (onEndCallback) onEndCallback();
  };

  activeUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
}

export function isSpeechSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

/**
 * Constructs a compassionate, clear spoken script for a frontline ASHA worker.
 */
export function getPatientVoicePrompt(patient, lang = 'hi') {
  if (!patient) return '';
  const name = getPatientDisplayName(patient.pseudonym, lang);
  const cohort = patient.cohort === 'antenatal'
    ? (lang === 'hi' ? 'गर्भवती महिला' : 'Antenatal mother')
    : patient.cohort === 'hypertension'
    ? (lang === 'hi' ? 'उच्च रक्तचाप मरीज़' : 'Hypertension patient')
    : (lang === 'hi' ? 'मधुमेह मरीज़' : 'Diabetes patient');

  const village = getLocalizedVillage(patient.village_or_ward, lang);
  const clinicalFlag = patient.flags?.find((f) => f.type === 'clinical' && f.status === 'active');
  const overdueFlag = patient.flags?.find((f) => f.type !== 'clinical' && f.status === 'active');

  if (lang === 'hi') {
    if (clinicalFlag) {
      const expl = getFlagExplanation(clinicalFlag, 'hi');
      return `${name}, ${cohort}, ${village}। ध्यान दें: ${expl}। आशा कार्यकर्ता का अगला कदम: तुरंत सरकारी अस्पताल रेफर करें।`;
    }
    if (overdueFlag) {
      return `${name}, ${cohort}, ${village}। स्वास्थ्य जांच की तारीख निकल चुकी है। घर जाकर जांच पूरी करें।`;
    }
    return `${name}, ${cohort}, ${village}। सभी स्वास्थ्य जांच सामान्य हैं।`;
  } else {
    if (clinicalFlag) {
      return `${name}, ${cohort}, ${village}. Alert: ${clinicalFlag.explanation || 'Flagged for clinician review.'} ASHA action: Refer to Government PHC Doctor immediately.`;
    }
    if (overdueFlag) {
      return `${name}, ${cohort}, ${village}. Routine check-up is overdue. Complete home visit.`;
    }
    return `${name}, ${cohort}, ${village}. All check-ins up to date.`;
  }
}
