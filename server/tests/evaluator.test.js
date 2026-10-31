import { describe, it, expect } from 'vitest';
import { evaluateRules } from '../src/rules/evaluator.js';
import rulesConfig from '../src/rules/rules.json' with { type: 'json' };

describe('Swasthya Sense — Rule Evaluator', () => {
  const schedule = {
    interval_days: 30,
    grace_period_days: 3,
    reminder_lead_time_days: 2
  };

  const patient = {
    cohort: 'hypertension',
    pseudonym: 'Patient-Alpha'
  };

  it('R1: Flags visit due soon within reminder lead time', () => {
    const flags = evaluateRules({
      checkIn: { due_date: '2026-11-02', completed_at: null },
      schedule,
      rulesConfig,
      referenceDate: '2026-10-31'
    });

    expect(flags).toHaveLength(1);
    expect(flags[0].rule_id).toBe('R1');
    expect(flags[0].type).toBe('reminder');
    expect(flags[0].explanation).toContain('Visit due soon');
  });

  it('R2: Flags overdue visit beyond grace period', () => {
    const flags = evaluateRules({
      checkIn: { due_date: '2026-10-25', completed_at: null },
      schedule,
      rulesConfig,
      referenceDate: '2026-10-31' // 6 days overdue > 3 days grace
    });

    expect(flags).toHaveLength(1);
    expect(flags[0].rule_id).toBe('R2');
    expect(flags[0].type).toBe('reminder');
    expect(flags[0].triggering_values.daysOverdue).toBe(6);
  });

  it('R3: Flags repeatedly missed visit exceeding 2x interval', () => {
    const flags = evaluateRules({
      checkIn: { due_date: '2026-08-01', completed_at: null },
      schedule, // interval is 30, 2x is 60. Overdue ~91 days.
      rulesConfig,
      referenceDate: '2026-10-31'
    });

    expect(flags).toHaveLength(1);
    expect(flags[0].rule_id).toBe('R3');
    expect(flags[0].type).toBe('reminder');
    expect(flags[0].explanation).toContain('Repeated missed follow-up');
  });

  it('R4: Flags high blood pressure at/above configured thresholds', () => {
    const flags = evaluateRules({
      checkIn: {
        measurements: { systolic: 145, diastolic: 92 }
      },
      patient,
      rulesConfig
    });

    const r4 = flags.find(f => f.rule_id === 'R4');
    expect(r4).toBeDefined();
    expect(r4.type).toBe('clinical');
    expect(r4.explanation.toLowerCase()).toContain('flagged for clinician review');
    expect(r4.triggering_values.systolic).toBe(145);
  });

  it('R5: Flags rising systolic BP trend over 3 consecutive readings', () => {
    const pastCheckIns = [
      { measurements: { systolic: 136 } }, // reading (t-1)
      { measurements: { systolic: 128 } }  // reading (t-2)
    ];

    const flags = evaluateRules({
      checkIn: {
        measurements: { systolic: 145 } // current: 128 -> 136 -> 145 (strictly rising)
      },
      patient,
      pastCheckIns,
      rulesConfig
    });

    const r5 = flags.find(f => f.rule_id === 'R5');
    expect(r5).toBeDefined();
    expect(r5.type).toBe('clinical');
    expect(r5.explanation).toContain('Systolic blood pressure rose consistently');
    expect(r5.triggering_values.systolicTrend).toEqual([128, 136, 145]);
  });

  it('R6: Flags danger signs for cohort (e.g. antenatal visual changes)', () => {
    const antenatalPatient = { cohort: 'antenatal' };
    const flags = evaluateRules({
      checkIn: {
        symptoms: ['severe_headache_visual_changes'],
        measurements: { systolic: 120, diastolic: 80 }
      },
      patient: antenatalPatient,
      rulesConfig
    });

    const r6 = flags.find(f => f.rule_id === 'R6');
    expect(r6).toBeDefined();
    expect(r6.type).toBe('clinical');
    expect(r6.severity).toBe('urgent');
    expect(r6.explanation).toContain('severe headache visual changes');
  });

  it('R7: Flags physiologically implausible values (data quality check)', () => {
    const flags = evaluateRules({
      checkIn: {
        measurements: { systolic: 310, diastolic: 80 } // systolic max is 260
      },
      patient,
      rulesConfig
    });

    const r7 = flags.find(f => f.rule_id === 'R7');
    expect(r7).toBeDefined();
    expect(r7.explanation).toContain('Possible data-entry error');
  });

  it('R8: Flags glucose out of bounds for diabetes cohort', () => {
    const diabetesPatient = { cohort: 'diabetes' };
    const flags = evaluateRules({
      checkIn: {
        measurements: { fastingGlucose: 165 } // normal max is 140
      },
      patient: diabetesPatient,
      rulesConfig
    });

    const r8 = flags.find(f => f.rule_id === 'R8');
    expect(r8).toBeDefined();
    expect(r8.type).toBe('clinical');
    expect(r8.explanation).toContain('fasting');
    expect(r8.triggering_values.value).toBe(165);
  });
});
