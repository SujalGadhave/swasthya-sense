import defaultRulesConfig from './rules.json' with { type: 'json' };

/**
 * Pure function to evaluate patient state, check-in data, and schedule against declarative rules.
 * All thresholds and danger sign definitions are sourced solely from rulesConfig.
 *
 * @param {Object} params
 * @param {Object} [params.checkIn] - Current check-in under evaluation (measurements, symptoms, due_date, completed_at)
 * @param {Object} [params.patient] - Patient metadata (cohort, pseudonym, etc.)
 * @param {Array<Object>} [params.pastCheckIns=[]] - Historical completed check-ins sorted descending by date
 * @param {Object} [params.schedule] - Follow-up schedule config { interval_days, grace_period_days, reminder_lead_time_days }
 * @param {Object} [params.rulesConfig=defaultRulesConfig] - Sourced rules definition
 * @param {Date|string} [params.referenceDate=new Date()] - Date to evaluate against (enables deterministic testing)
 * @returns {Array<Object>} Evaluated flags
 */
export function evaluateRules({
  checkIn = null,
  patient = {},
  pastCheckIns = [],
  schedule = null,
  rulesConfig = defaultRulesConfig,
  referenceDate = new Date()
}) {
  const flags = [];
  const ref = new Date(referenceDate);
  const version = rulesConfig.version || 1;

  const ruleMap = new Map((rulesConfig.rules || []).map(r => [r.id, r]));

  // -------------------------------------------------------------
  // SCHEDULE / ATTENDANCE RULES (R1, R2, R3)
  // -------------------------------------------------------------
  if (schedule && checkIn && checkIn.due_date && !checkIn.completed_at) {
    const due = new Date(checkIn.due_date);
    const diffTime = ref.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const leadTime = schedule.reminder_lead_time_days ?? 2;
    const gracePeriod = schedule.grace_period_days ?? 3;
    const intervalDays = schedule.interval_days ?? 30;

    // R3: Repeated missed follow-up (> 2x interval, or consecutive missed)
    const ruleR3 = ruleMap.get('R3');
    const consecutiveMissedCount = pastCheckIns.filter(c => !c.completed_at).length;

    if (diffDays > (intervalDays * 2)) {
      if (ruleR3) {
        flags.push({
          rule_id: 'R3',
          type: ruleR3.type,
          severity: ruleR3.severity,
          rule_version: version,
          explanation: ruleR3.explanationTemplate.replace(
            '{missedReason}',
            `overdue by ${diffDays} days (>2x schedule interval of ${intervalDays} days)`
          ),
          triggering_values: {
            daysOverdue: diffDays,
            intervalDays,
            threshold: intervalDays * 2
          }
        });
      }
    } else if (consecutiveMissedCount >= 2) {
      if (ruleR3) {
        flags.push({
          rule_id: 'R3',
          type: ruleR3.type,
          severity: ruleR3.severity,
          rule_version: version,
          explanation: ruleR3.explanationTemplate.replace(
            '{missedReason}',
            `${consecutiveMissedCount} consecutive missed follow-up visits`
          ),
          triggering_values: {
            consecutiveMissedCount,
            threshold: 2
          }
        });
      }
    } else if (diffDays > gracePeriod) {
      // R2: Overdue beyond grace period
      const ruleR2 = ruleMap.get('R2');
      if (ruleR2) {
        flags.push({
          rule_id: 'R2',
          type: ruleR2.type,
          severity: ruleR2.severity,
          rule_version: version,
          explanation: ruleR2.explanationTemplate
            .replace('{daysOverdue}', String(diffDays))
            .replace('{gracePeriod}', String(gracePeriod)),
          triggering_values: {
            daysOverdue: diffDays,
            gracePeriod
          }
        });
      }
    } else if (diffDays <= 0 && Math.abs(diffDays) <= leadTime) {
      // R1: Due soon (within lead time)
      const ruleR1 = ruleMap.get('R1');
      if (ruleR1) {
        const daysUntilDue = Math.abs(diffDays);
        flags.push({
          rule_id: 'R1',
          type: ruleR1.type,
          severity: ruleR1.severity,
          rule_version: version,
          explanation: ruleR1.explanationTemplate
            .replace('{daysUntilDue}', String(daysUntilDue))
            .replace('{dueDate}', checkIn.due_date),
          triggering_values: {
            daysUntilDue,
            dueDate: checkIn.due_date,
            leadTime
          }
        });
      }
    }
  }

  // If no check-in measurements/symptoms to evaluate, return schedule flags
  if (!checkIn) {
    return flags;
  }

  const measurements = typeof checkIn.measurements === 'string'
    ? JSON.parse(checkIn.measurements || '{}')
    : (checkIn.measurements || {});

  const symptoms = Array.isArray(checkIn.symptoms)
    ? checkIn.symptoms
    : (typeof checkIn.symptoms === 'string' ? JSON.parse(checkIn.symptoms || '[]') : []);

  // -------------------------------------------------------------
  // R7: DATA QUALITY / PLAUSIBLE RANGE CHECK
  // -------------------------------------------------------------
  const ruleR7 = ruleMap.get('R7');
  if (ruleR7 && ruleR7.plausibleRanges) {
    for (const [metric, range] of Object.entries(ruleR7.plausibleRanges)) {
      const val = measurements[metric];
      if (val !== undefined && val !== null && val !== '') {
        const numVal = Number(val);
        if (!isNaN(numVal) && (numVal < range.min || numVal > range.max)) {
          flags.push({
            rule_id: 'R7',
            type: ruleR7.type,
            severity: ruleR7.severity,
            rule_version: version,
            explanation: ruleR7.explanationTemplate
              .replace('{metric}', metric)
              .replace('{value}', String(numVal))
              .replace('{min}', String(range.min))
              .replace('{max}', String(range.max)),
            triggering_values: {
              metric,
              value: numVal,
              plausibleMin: range.min,
              plausibleMax: range.max
            }
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // R4: BLOOD PRESSURE THRESHOLD
  // -------------------------------------------------------------
  const ruleR4 = ruleMap.get('R4');
  if (ruleR4 && ruleR4.thresholds) {
    const sys = Number(measurements.systolic);
    const dia = Number(measurements.diastolic);
    const thSys = ruleR4.thresholds.systolic;
    const thDia = ruleR4.thresholds.diastolic;

    if (!isNaN(sys) && !isNaN(dia)) {
      if (sys >= thSys || dia >= thDia) {
        flags.push({
          rule_id: 'R4',
          type: ruleR4.type,
          severity: ruleR4.severity,
          rule_version: version,
          explanation: ruleR4.explanationTemplate
            .replace('{systolic}', String(sys))
            .replace('{diastolic}', String(dia))
            .replace('{thresholdSystolic}', String(thSys))
            .replace('{thresholdDiastolic}', String(thDia)),
          triggering_values: {
            systolic: sys,
            diastolic: dia,
            thresholdSystolic: thSys,
            thresholdDiastolic: thDia
          }
        });
      }
    }
  }

  // -------------------------------------------------------------
  // R5: RISING BLOOD PRESSURE TREND (Across 3 consecutive readings)
  // -------------------------------------------------------------
  const ruleR5 = ruleMap.get('R5');
  if (ruleR5 && ruleR5.thresholds) {
    const requiredReadings = ruleR5.thresholds.consecutiveReadings || 3;
    const currentSys = Number(measurements.systolic);

    if (!isNaN(currentSys)) {
      const pastSysReadings = [];
      for (const past of pastCheckIns) {
        if (!past.measurements) continue;
        const pastM = typeof past.measurements === 'string'
          ? JSON.parse(past.measurements)
          : past.measurements;
        const pastSys = Number(pastM.systolic);
        if (!isNaN(pastSys)) {
          pastSysReadings.push(pastSys);
        }
        if (pastSysReadings.length === requiredReadings - 1) break;
      }

      if (pastSysReadings.length === requiredReadings - 1) {
        // pastSysReadings are ordered newest to oldest: [reading(t-1), reading(t-2)]
        // chronological sequence: [reading(t-2), reading(t-1), currentSys]
        const fullSequence = [...pastSysReadings].reverse().concat([currentSys]);
        let isStrictlyRising = true;
        for (let i = 1; i < fullSequence.length; i++) {
          if (fullSequence[i] <= fullSequence[i - 1]) {
            isStrictlyRising = false;
            break;
          }
        }

        if (isStrictlyRising) {
          flags.push({
            rule_id: 'R5',
            type: ruleR5.type,
            severity: ruleR5.severity,
            rule_version: version,
            explanation: ruleR5.explanationTemplate.replace('{readings}', fullSequence.join(', ')),
            triggering_values: {
              systolicTrend: fullSequence,
              consecutiveCount: requiredReadings
            }
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // R6: DANGER-SIGN SYMPTOM REPORTED
  // -------------------------------------------------------------
  const ruleR6 = ruleMap.get('R6');
  if (ruleR6 && ruleR6.dangerSigns) {
    const cohort = patient.cohort || 'antenatal';
    const cohortDangerSigns = ruleR6.dangerSigns[cohort] || [];

    for (const symptom of symptoms) {
      if (cohortDangerSigns.includes(symptom)) {
        flags.push({
          rule_id: 'R6',
          type: ruleR6.type,
          severity: ruleR6.severity,
          rule_version: version,
          explanation: ruleR6.explanationTemplate.replace('{symptomName}', symptom.replace(/_/g, ' ')),
          triggering_values: {
            reportedSymptom: symptom,
            cohort
          }
        });
      }
    }
  }

  // -------------------------------------------------------------
  // R8: BLOOD GLUCOSE OUT OF BOUNDS (For Diabetes Cohort)
  // -------------------------------------------------------------
  const ruleR8 = ruleMap.get('R8');
  if (ruleR8 && ruleR8.thresholds && patient.cohort === 'diabetes') {
    const fasting = measurements.fastingGlucose !== undefined ? Number(measurements.fastingGlucose) : NaN;
    const random = measurements.randomGlucose !== undefined ? Number(measurements.randomGlucose) : NaN;

    if (!isNaN(fasting)) {
      const minF = ruleR8.thresholds.fastingMin;
      const maxF = ruleR8.thresholds.fastingMax;
      if (fasting < minF || fasting > maxF) {
        flags.push({
          rule_id: 'R8',
          type: ruleR8.type,
          severity: ruleR8.severity,
          rule_version: version,
          explanation: ruleR8.explanationTemplate
            .replace('{metric}', 'fasting')
            .replace('{value}', String(fasting))
            .replace('{min}', String(minF))
            .replace('{max}', String(maxF)),
          triggering_values: {
            glucoseType: 'fasting',
            value: fasting,
            min: minF,
            max: maxF
          }
        });
      }
    }

    if (!isNaN(random)) {
      const minR = ruleR8.thresholds.randomMin;
      const maxR = ruleR8.thresholds.randomMax;
      if (random < minR || random > maxR) {
        flags.push({
          rule_id: 'R8',
          type: ruleR8.type,
          severity: ruleR8.severity,
          rule_version: version,
          explanation: ruleR8.explanationTemplate
            .replace('{metric}', 'post-meal/random')
            .replace('{value}', String(random))
            .replace('{min}', String(minR))
            .replace('{max}', String(maxR)),
          triggering_values: {
            glucoseType: 'random',
            value: random,
            min: minR,
            max: maxR
          }
        });
      }
    }
  }

  // -------------------------------------------------------------
  // R9: GESTATIONAL WEIGHT ANOMALY (Antenatal cohort)
  // -------------------------------------------------------------
  const ruleR9 = ruleMap.get('R9');
  if (ruleR9 && ruleR9.thresholds && patient.cohort === 'antenatal') {
    const currentWeight = Number(measurements.weightKg);
    if (!isNaN(currentWeight)) {
      let previousWeight = null;
      for (const past of pastCheckIns) {
        if (!past.measurements) continue;
        const pastM = typeof past.measurements === 'string'
          ? JSON.parse(past.measurements)
          : past.measurements;
        const pw = Number(pastM.weightKg);
        if (!isNaN(pw)) {
          previousWeight = pw;
          break;
        }
      }

      if (previousWeight !== null) {
        const delta = Math.round((currentWeight - previousWeight) * 10) / 10;
        const maxGain = ruleR9.thresholds.maxFortnightGainKg || 2.0;
        const maxLoss = ruleR9.thresholds.maxLossKg || 1.0;

        if (delta > maxGain || delta < -maxLoss) {
          flags.push({
            rule_id: 'R9',
            type: ruleR9.type,
            severity: ruleR9.severity,
            rule_version: version,
            explanation: ruleR9.explanationTemplate
              .replace('{weightChange}', delta > 0 ? `+${delta}` : String(delta))
              .replace('{threshold}', String(delta > 0 ? maxGain : maxLoss)),
            triggering_values: {
              currentWeight,
              previousWeight,
              deltaKg: delta,
              threshold: delta > 0 ? maxGain : maxLoss
            }
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // R10: CARDIORESPIRATORY DECOMPENSATION (SpO2 / Heart Rate)
  // -------------------------------------------------------------
  const ruleR10 = ruleMap.get('R10');
  if (ruleR10 && ruleR10.thresholds) {
    const spo2 = measurements.spo2 !== undefined ? Number(measurements.spo2) : NaN;
    const hr = measurements.heartRate !== undefined ? Number(measurements.heartRate) : NaN;

    if (!isNaN(spo2) && spo2 < ruleR10.thresholds.spo2Min) {
      flags.push({
        rule_id: 'R10',
        type: ruleR10.type,
        severity: ruleR10.severity,
        rule_version: version,
        explanation: ruleR10.explanationTemplate
          .replace('{metric}', 'SpO2 Oxygen Saturation')
          .replace('{value}', `${spo2}%`),
        triggering_values: {
          metric: 'spo2',
          value: spo2,
          threshold: ruleR10.thresholds.spo2Min
        }
      });
    }

    if (!isNaN(hr)) {
      if (hr > ruleR10.thresholds.heartRateMax || hr < ruleR10.thresholds.heartRateMin) {
        flags.push({
          rule_id: 'R10',
          type: ruleR10.type,
          severity: ruleR10.severity,
          rule_version: version,
          explanation: ruleR10.explanationTemplate
            .replace('{metric}', 'Heart Rate / Pulse')
            .replace('{value}', `${hr} bpm`),
          triggering_values: {
            metric: 'heartRate',
            value: hr,
            min: ruleR10.thresholds.heartRateMin,
            max: ruleR10.thresholds.heartRateMax
          }
        });
      }
    }
  }

  return flags;
}
