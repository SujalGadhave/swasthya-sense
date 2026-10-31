/**
 * Synthetic Patient Names & Indian Localization Dictionary
 *
 * Translates cold technical pseudonyms (e.g. 'Patient-ANC-01') into warm,
 * realistic Indian names recognizable to rural frontline ASHA workers and judges,
 * while strictly adhering to synthetic data privacy governance.
 */

export const PATIENT_NAMES = {
  // Antenatal Care (ANC) cohort
  'Patient-ANC-01': { hi: 'प्रिया शर्मा', en: 'Priya Sharma' },
  'Patient-ANC-02': { hi: 'सुनीता देवी', en: 'Sunita Devi' },
  'Patient-ANC-03': { hi: 'मीना कुमारी', en: 'Meena Kumari' },
  'Patient-ANC-04': { hi: 'पूजा यादव', en: 'Pooja Yadav' },
  'Patient-ANC-05': { hi: 'रेखा वर्मा', en: 'Rekha Verma' },
  'Patient-ANC-06': { hi: 'अनिता सिंह', en: 'Anita Singh' },
  'Patient-ANC-07': { hi: 'कविता गुप्ता', en: 'Kavita Gupta' },
  'Patient-ANC-08': { hi: 'आरती पटेल', en: 'Aarti Patel' },
  'Patient-ANC-09': { hi: 'राधा देवी', en: 'Radha Devi' },
  'Patient-ANC-10': { hi: 'गीता रानी', en: 'Geeta Rani' },
  'Patient-ANC-11': { hi: 'सुमन मौर्य', en: 'Suman Maurya' },
  'Patient-ANC-12': { hi: 'लक्ष्मी बाई', en: 'Laxmi Bai' },
  'Patient-ANC-13': { hi: 'किरण बाला', en: 'Kiran Bala' },
  'Patient-ANC-14': { hi: 'मंजू देवी', en: 'Manju Devi' },
  'Patient-ANC-15': { hi: 'सीमा पाल', en: 'Seema Pal' },
  'Patient-ANC-16': { hi: 'आशा रानी', en: 'Asha Rani' },
  'Patient-ANC-17': { hi: 'नीलम कुमारी', en: 'Neelam Kumari' },
  'Patient-ANC-18': { hi: 'ममता यादव', en: 'Mamta Yadav' },
  'Patient-ANC-19': { hi: 'उर्मिला देवी', en: 'Urmila Devi' },
  'Patient-ANC-20': { hi: 'शांति देवी', en: 'Shanti Devi' },
  'Patient-ANC-21': { hi: 'रुक्मिणी बाई', en: 'Rukmini Bai' },
  'Patient-ANC-22': { hi: 'संगीता शर्मा', en: 'Sangeeta Sharma' },
  'Patient-ANC-23': { hi: 'पुष्पा देवी', en: 'Pushpa Devi' },
  'Patient-ANC-24': { hi: 'काजल वर्मा', en: 'Kajal Verma' },
  'Patient-ANC-25': { hi: 'रीना कुमारी', en: 'Reena Kumari' },

  // Hypertension (HTN) cohort
  'Patient-HTN-01': { hi: 'राजेश वर्मा', en: 'Rajesh Verma' },
  'Patient-HTN-02': { hi: 'सुरेश चंद', en: 'Suresh Chand' },
  'Patient-HTN-03': { hi: 'महेश कुमार', en: 'Mahesh Kumar' },
  'Patient-HTN-04': { hi: 'रमेश लाल', en: 'Ramesh Lal' },
  'Patient-HTN-05': { hi: 'हरीश चंद्र', en: 'Harish Chandra' },
  'Patient-HTN-06': { hi: 'ओम प्रकाश', en: 'Om Prakash' },
  'Patient-HTN-07': { hi: 'विनोद शर्मा', en: 'Vinod Sharma' },
  'Patient-HTN-08': { hi: 'राम किशोर', en: 'Ram Kishore' },
  'Patient-HTN-09': { hi: 'जगदीश प्रसाद', en: 'Jagdish Prasad' },
  'Patient-HTN-10': { hi: 'प्रेम सिंह', en: 'Prem Singh' },
  'Patient-HTN-11': { hi: 'सत्यनारायण', en: 'Satyanarayan' },
  'Patient-HTN-12': { hi: 'ईश्वर दास', en: 'Ishwar Das' },
  'Patient-HTN-13': { hi: 'भगवान दास', en: 'Bhagwan Das' },
  'Patient-HTN-14': { hi: 'किशोरी लाल', en: 'Kishori Lal' },
  'Patient-HTN-15': { hi: 'दौलत राम', en: 'Daulat Ram' },
  'Patient-HTN-16': { hi: 'शिव कुमार', en: 'Shiv Kumar' },
  'Patient-HTN-17': { hi: 'नारायण दत्त', en: 'Narayan Dutt' },
  'Patient-HTN-18': { hi: 'गिरधारी लाल', en: 'Girdhari Lal' },
  'Patient-HTN-19': { hi: 'राधेश्याम', en: 'Radheshyam' },
  'Patient-HTN-20': { hi: 'बनवारी लाल', en: 'Banwari Lal' },

  // Diabetes (DB) cohort
  'Patient-DB-01': { hi: 'अमित कुमार', en: 'Amit Kumar' },
  'Patient-DB-02': { hi: 'दिनेश लाल', en: 'Dinesh Lal' },
  'Patient-DB-03': { hi: 'संतोष यादव', en: 'Santosh Yadav' },
  'Patient-DB-04': { hi: 'मनोज तिवारी', en: 'Manoj Tiwari' },
  'Patient-DB-05': { hi: 'विजय सिंह', en: 'Vijay Singh' },
  'Patient-DB-06': { hi: 'सुनील मौर्य', en: 'Sunil Maurya' },
  'Patient-DB-07': { hi: 'संजय गुप्ता', en: 'Sanjay Gupta' },
  'Patient-DB-08': { hi: 'राकेश पाल', en: 'Rakesh Pal' },
  'Patient-DB-09': { hi: 'कमलेश कुमार', en: 'Kamlesh Kumar' },
  'Patient-DB-10': { hi: 'प्रदीप वर्मा', en: 'Pradeep Verma' },
  'Patient-DB-11': { hi: 'सतीश चंद्र', en: 'Satish Chandra' },
  'Patient-DB-12': { hi: 'अशोक कुमार', en: 'Ashok Kumar' },
  'Patient-DB-13': { hi: 'विकास चंद', en: 'Vikas Chand' },
  'Patient-DB-14': { hi: 'दीपक शर्मा', en: 'Deepak Sharma' },
  'Patient-DB-15': { hi: 'पंकज यादव', en: 'Pankaj Yadav' },
  'Patient-DB-16': { hi: 'अनिल कुमार', en: 'Anil Kumar' },
  'Patient-DB-17': { hi: 'राजीव सिंह', en: 'Rajeev Singh' },
  'Patient-DB-18': { hi: 'ज्ञान चंद', en: 'Gyan Chand' },
  'Patient-DB-19': { hi: 'चंद्रभान', en: 'Chandrabhan' },
  'Patient-DB-20': { hi: 'महेन्द्र पाल', en: 'Mahendra Pal' },
};

const VILLAGE_WARD_NAMES = {
  'Ward 1 (Rampur)': { hi: 'वार्ड 1 (रामपुर)', en: 'Ward 1 (Rampur)' },
  'Ward 2 (Kalyanpur)': { hi: 'वार्ड 2 (कल्याणपुर)', en: 'Ward 2 (Kalyanpur)' },
  'Ward 3 (Sitapur)': { hi: 'वार्ड 3 (सीतापुर)', en: 'Ward 3 (Sitapur)' },
  'Ward 4 (Govindpur)': { hi: 'वार्ड 4 (गोविंदपुर)', en: 'Ward 4 (Govindpur)' },
};

/**
 * Returns the human synthetic name for a patient.
 */
export function getPatientDisplayName(pseudonym, lang = 'hi') {
  if (!pseudonym) return '';
  const match = PATIENT_NAMES[pseudonym];
  if (match) {
    return lang === 'hi' ? match.hi : match.en;
  }
  return pseudonym;
}

/**
 * Returns localized village or ward name.
 */
export function getLocalizedVillage(villageOrWard, lang = 'hi') {
  if (!villageOrWard) return '';
  if (lang !== 'hi') return villageOrWard;
  const match = VILLAGE_WARD_NAMES[villageOrWard];
  if (match) return match.hi;
  return villageOrWard.replace('Ward', 'वार्ड');
}

/**
 * Returns localized age band (e.g. '20-24 वर्ष').
 */
export function getLocalizedAgeBand(ageBand, lang = 'hi') {
  if (!ageBand) return '';
  if (lang === 'hi') {
    return ageBand.replace(/yrs?/gi, 'वर्ष');
  }
  return ageBand;
}
