import React, { createContext, useContext, useState } from 'react';

const LanguageContext = createContext(null);

export const translations = {
  en: {
    // Safety Banner
    safety_banner: '⚠️ PROTOTYPE ONLY — Synthetic Data. Illustrative rules require clinician approval. Not a diagnostic tool.',
    
    // Brand & Navigation
    brand_title: 'Swasthya Sense',
    brand_subtitle: 'Frontline Early-Warning Prototype',
    nav_call_list: "📋 Today's Call List",
    nav_registry: '👥 Patient Registry',
    nav_clinician_queue: '🩺 Escalation Review Queue',
    nav_supervisor_overview: '📊 Overview & Schedules',
    nav_audit_trail: '📜 Audit Trail',
    nav_messages: '💬 Simulated Messages',
    sign_out: 'Sign Out',
    demo_role_label: 'Demo Role:',

    // Roles
    role_worker: '👩‍⚕️ ASHA (Worker)',
    role_clinician: '🩺 Doctor (Clinician)',
    role_supervisor: '📋 Supervisor (In-Charge)',

    // Worker Dashboard
    worker_dash_title: 'Frontline Health Worker Dashboard',
    worker_dash_subtitle: "Today's Prioritized Morning Follow-Up Call List (Urgency-Ranked)",
    refresh_list: '🔄 Refresh List',
    metric_assigned: 'Assigned Patients',
    metric_clinical_alerts: '🚨 Clinical Alerts',
    metric_overdue: '⚠️ Overdue Follow-ups',
    metric_due_soon: '📅 Due Soon',
    
    filter_label: 'Filter Call List:',
    filter_all: 'All Cases',
    filter_concerning: '🚨 Concerning Clinical Alerts',
    filter_overdue: '⚠️ Overdue Follow-Ups',
    filter_escalated: '↗ Active Escalations',

    // Priorities
    priority_clinical: 'Clinical Alert',
    priority_r3: 'Repeated Missed Follow-up',
    priority_r2: 'Overdue Follow-up',
    priority_r1: 'Visit Due Soon',
    priority_routine: 'Routine Follow-up',

    // Patient card labels
    due_date_label: 'Due Date:',
    days_overdue: 'days overdue',
    in_days: 'In',
    day_s: 'day(s)',
    consent_yes: '✓ Consent: YES',
    consent_no: '✕ Consent: DECLINED',
    flags_triggered_title: 'Clinical & Safety Flags:',
    record_checkin_btn: '📝 Record Check-In',
    view_timeline_btn: '📊 View Timeline & Consent',
    escalate_btn: '🏥 Refer to Govt Hospital & Doctor',
    acknowledge_btn: '✓ Mark Acknowledged',
    escalation_status_label: 'Escalation Status:',
    no_scheduled_checkin: 'No scheduled check-in',
    years_label: 'yrs',

    // Check-in Modal
    checkin_modal_title: 'Record Follow-Up Check-In',
    interaction_channel: 'Interaction Channel',
    channel_in_person: '🏠 In-Person (Home / Village Visit)',
    channel_phone: '📞 Phone / Telephonic Check-In',
    vital_measurements_heading: 'Vital Measurements',
    bp_systolic: 'Systolic BP (mmHg)',
    bp_diastolic: 'Diastolic BP (mmHg)',
    heart_rate: 'Heart Rate (bpm)',
    fasting_glucose: 'Fasting Glucose (mg/dL)',
    random_glucose: 'Random Glucose (mg/dL)',
    weight_kg: 'Weight (kg)',
    temperature_f: 'Temperature (°F)',
    danger_signs_heading: 'Protocol Danger Signs Checklist',
    field_notes: 'Field Observation & Visit Notes',
    cancel_btn: 'Cancel',
    save_checkin_btn: 'Save & Evaluate Check-In',

    // Clinician Queue
    clinician_queue_title: 'Clinician Review & Escalation Queue',
    clinician_queue_subtitle: 'Medical Officer Review of High-Risk Flags Escalated by Frontline Workers',
    pending_review: 'Pending Medical Review',
    reviewed_cases: 'Active / Reviewed Cases',
    total_escalations: 'Total Escalations in Queue',
    review_case_btn: '🩺 Review Case & Record Decision',
    update_notes_btn: 'Update Clinical Notes',

    // Notice & Disclaimer
    disclaimer_flag_text: '⚠️ Prototype — Flagged for clinician review. Thresholds illustrative only.',

    // Minimalist ASHA Simple Mode
    asha_greeting: 'Namaste, Sunita Didi',
    asha_tagline: 'Ward 3 · Primary Health Centre Sitapur',
    asha_mode_simple: '✨ Simple ASHA Mode',
    asha_mode_detailed: '📊 Detailed View',
    today_work_heading: "Today's Priorities (आज का काम)",
    urgent_bucket_title: '1. Refer to Doctor (खतरे के मरीज़)',
    urgent_bucket_sub: 'Danger signs or severe high BP/Sugar',
    overdue_bucket_title: '2. Missed Visits (छूटे हुए)',
    overdue_bucket_sub: 'Overdue visits — visit doorstep today',
    routine_bucket_title: '3. Routine Visits (नियमित जांच)',
    routine_bucket_sub: 'Scheduled check-ups for this week',
    cohort_antenatal_label: '🤰 Pregnant Mother (ANC)',
    cohort_hypertension_label: '🫀 Blood Pressure (HTN)',
    cohort_diabetes_label: '🩸 Sugar / Diabetes',
    action_home_visit: '🏠 Record Check-In',
    action_call: '📞 Call',
    action_escalate: '🩺 Send to Doctor',
    action_whatsapp: '💬 Message',
    vitals_normal: '🟢 Normal (Safe)',
    vitals_high_danger: '🔴 Danger! Consult Doctor',
    voice_speak_btn: '🎙️ Tap to Speak (Hindi Voice)',
    voice_listening: '🔴 Listening... speak now',
    quick_notes_heading: 'Quick Observations (Tap to add):',
    pill_taking_meds: 'Taking medicines regularly',
    pill_advised_rest: 'Advised rest & hydration',
    pill_unwell: 'Patient reported feeling unwell',
    pill_advised_phc: 'Advised to visit PHC doctor',
    danger_signs_simple_heading: 'Danger Signs (Tap any that apply):',
    danger_signs_none: '✓ No danger signs observed (All Normal)',
  },

  hi: {
    // Safety Banner
    safety_banner: '⚠️ केवल प्रोटोटाइप — सिंथेटिक डेटा। नियम सांकेतिक हैं और डॉक्टर की मंजूरी आवश्यक है। नैदानिक उपकरण नहीं।',
    
    // Brand & Navigation
    brand_title: 'स्वास्थ्य सेंस',
    brand_subtitle: 'आशा कार्यकर्ता प्रारंभिक चेतावनी प्रोटोटाइप',
    nav_call_list: '📋 आज की कॉल सूची',
    nav_registry: '👥 मरीज़ रजिस्टर',
    nav_clinician_queue: '🩺 डॉक्टर समीक्षा कतार',
    nav_supervisor_overview: '📊 अवलोकन और प्रोटोकॉल',
    nav_audit_trail: '📜 ऑडिट लॉग',
    nav_messages: '💬 सिम्युलेटेड संदेश',
    sign_out: 'लॉग आउट',
    demo_role_label: 'डेमो रोल:',

    // Roles
    role_worker: '👩‍⚕️ आशा (कार्यकर्ता)',
    role_clinician: '🩺 डॉक्टर (चिकित्सा अधिकारी)',
    role_supervisor: '📋 प्रभारी (सुपरवाइजर)',

    // Worker Dashboard
    worker_dash_title: 'आशा कार्यकर्ता डैशबोर्ड (Health Worker)',
    worker_dash_subtitle: 'आज की प्राथमिकता-आधारित सुबह की फॉलो-अप कॉल सूची (प्राथमिकता अनुसार)',
    refresh_list: '🔄 सूची रीफ्रेश करें',
    metric_assigned: 'आवंटित मरीज़',
    metric_clinical_alerts: '🚨 चिकित्सा अलर्ट (Urgent)',
    metric_overdue: '⚠️ विलंबित जांच (Overdue)',
    metric_due_soon: '📅 शीघ्र देय (Due Soon)',
    
    filter_label: 'कॉल सूची फ़िल्टर:',
    filter_all: 'सभी मामले',
    filter_concerning: '🚨 गंभीर चिकित्सा अलर्ट',
    filter_overdue: '⚠️ विलंबित फॉलो-अप',
    filter_escalated: '↗ डॉक्टर को भेजे गए केस',

    // Priorities
    priority_clinical: 'आपातकालीन अलर्ट',
    priority_r3: 'बार-बार छूटी जांच',
    priority_r2: 'समय सीमा पार (विलंबित)',
    priority_r1: 'शीघ्र देय जांच',
    priority_routine: 'नियमित फॉलो-अप',

    // Patient card labels
    due_date_label: 'नियत तारीख:',
    days_overdue: 'दिन विलंबित',
    in_days: 'अगले',
    day_s: 'दिनों में',
    consent_yes: '✓ सहमति: हाँ',
    consent_no: '✕ सहमति: अस्वीकृत',
    flags_triggered_title: 'जोखिम लक्षण संकेत:',
    record_checkin_btn: '📝 जांच दर्ज करें',
    view_timeline_btn: '📊 इतिहास व सहमति देखें',
    escalate_btn: '🏥 सरकारी अस्पताल / डॉक्टर को रेफर करें',
    acknowledge_btn: '✓ स्वीकार किया',
    escalation_status_label: 'डॉक्टर रेफरल स्थिति:',
    no_scheduled_checkin: 'कोई निर्धारित जांच नहीं',
    years_label: 'वर्ष',

    // Check-in Modal
    checkin_modal_title: 'फॉलो-अप जांच दर्ज करें (Check-In)',
    interaction_channel: 'सम्पर्क का माध्यम',
    channel_in_person: '🏠 गृह भेंट (घर पर मुलाकात)',
    channel_phone: '📞 फ़ोन पर बातचीत',
    vital_measurements_heading: 'शारीरिक माप (Vitals)',
    bp_systolic: 'सिस्टोलिक बीपी (Systolic BP)',
    bp_diastolic: 'डायस्टोलिक बीपी (Diastolic BP)',
    heart_rate: 'हृदय गति (Heart Rate - bpm)',
    fasting_glucose: 'खाली पेट शुगर (Fasting Glucose)',
    random_glucose: 'खाना खाने के बाद शुगर (Random Glucose)',
    weight_kg: 'वजन (Weight - kg)',
    temperature_f: 'तापमान (Temperature - °F)',
    danger_signs_heading: 'प्रोटोकॉल खतरे के संकेत (Danger Signs Checklist)',
    field_notes: 'आशा कार्यकर्ता अवलोकन व टिप्पणी (Notes)',
    cancel_btn: 'रद्द करें',
    save_checkin_btn: 'जांच सहेजें और नियम जांचें',

    // Clinician Queue
    clinician_queue_title: 'चिकित्सा अधिकारी (Doctor) समीक्षा कतार',
    clinician_queue_subtitle: 'आशा कार्यकर्ताओं द्वारा भेजे गए उच्च जोखिम मामलों की डॉक्टर द्वारा समीक्षा',
    pending_review: 'डॉक्टर समीक्षा हेतु लंबित',
    reviewed_cases: 'सक्रिय / समीक्षित मामले',
    total_escalations: 'कतार में कुल केस',
    review_case_btn: '🩺 केस की समीक्षा करें व निर्देश दें',
    update_notes_btn: 'डॉक्टर नोट्स अपडेट करें',

    // Notice & Disclaimer
    disclaimer_flag_text: '⚠️ प्रोटोटाइप — डॉक्टर की समीक्षा के लिए चिन्हित। सीमाएं केवल सांकेतिक हैं।',

    // Minimalist ASHA Simple Mode
    asha_greeting: 'नमस्ते, सुनीता दीदी',
    asha_tagline: 'वार्ड 3 · प्राथमिक स्वास्थ्य केंद्र (PHC) सीतापुर',
    asha_mode_simple: '✨ सरल आशा मोड',
    asha_mode_detailed: '📊 विस्तृत मोड',
    today_work_heading: 'आज का काम (Today\'s Tasks)',
    urgent_bucket_title: '1. डॉक्टर को दिखाएं (खतरे के मरीज़)',
    urgent_bucket_sub: 'खतरे के लक्षण या अत्यधिक बढ़ा हुआ बीपी / शुगर',
    overdue_bucket_title: '2. छूटे हुए मरीज़ (घर जाकर मिलें)',
    overdue_bucket_sub: 'जांच की तारीख निकल चुकी है, आज घर जाएं',
    routine_bucket_title: '3. नियमित जांच (सब सामान्य)',
    routine_bucket_sub: 'इस सप्ताह की सामान्य फॉलो-अप जांच',
    cohort_antenatal_label: '🤰 गर्भवती महिला (ANC)',
    cohort_hypertension_label: '🫀 उच्च रक्तचाप (बीपी)',
    cohort_diabetes_label: '🩸 मधुमेह (शुगर)',
    action_home_visit: '🏠 जांच दर्ज करें',
    action_call: '📞 फोन करें',
    action_escalate: '🩺 डॉक्टर को भेजें',
    action_whatsapp: '💬 व्हाट्सएप',
    vitals_normal: '🟢 सामान्य (सुरक्षित)',
    vitals_high_danger: '🔴 खतरा! डॉक्टर को दिखाएं',
    voice_speak_btn: '🎙️ बोलकर लिखें (हिंदी में बोलें)',
    voice_listening: '🔴 सुन रहे हैं... बोलिए',
    quick_notes_heading: 'त्वरित टिप्पणी (दबाकर जोड़ें):',
    pill_taking_meds: 'दवा समय पर ले रहे हैं',
    pill_advised_rest: 'आराम करने की सलाह दी',
    pill_unwell: 'मरीज़ की तबीयत ठीक नहीं है',
    pill_advised_phc: 'PHC अस्पताल जाने को कहा',
    danger_signs_simple_heading: 'खतरे के लक्षण (यदि कोई दिखे तो दबाएं):',
    danger_signs_none: '✓ कोई खतरे का लक्षण नहीं है (सब ठीक)',
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('swasthya_lang') || 'hi');

  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('swasthya_lang', newLang);
  };

  const toggleLang = () => {
    const next = lang === 'en' ? 'hi' : 'en';
    setLang(next);
  };

  const t = (key, defaultText = '') => {
    return translations[lang]?.[key] || translations.en?.[key] || defaultText || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

