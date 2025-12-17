import { Employee } from "../types";

/**
 * Taiwan Labor Standards Act & Insurance Rules
 * Updated based on 115 (2026) Labor Insurance Table & 114 (2025) Health Insurance Table provided.
 */

// Labor Insurance (Ordinary 11.5% + Employment 1%) = 12.5% total
// Split: Employer 70%, Employee 20%, Govt 10%
export const LABOR_INSURANCE_RATE = 0.125; 
export const LABOR_EMPLOYEE_SHARE = 0.20;
export const LABOR_EMPLOYER_SHARE = 0.70;

// Health Insurance 5.17%
// Split: Employer 60%, Employee 30%, Govt 10%
export const HEALTH_INSURANCE_RATE = 0.0517;
export const HEALTH_EMPLOYEE_SHARE = 0.30;
export const HEALTH_EMPLOYER_SHARE = 0.60;
export const AVG_DEPENDENTS_EMPLOYER = 0.58; 

// Pension
export const PENSION_RATE = 0.06;

// Specific Labor Insurance Brackets (Max 45,800)
export const LABOR_BRACKETS = [
  11100, 12540, 13500, 15840, 16500, 17280, 17880, 19047, 20008, 
  21009, 22000, 23100, 24000, 25250, 26400, 27600, 28500, 29500, 
  30300, 31800, 33300, 34800, 36300, 38200, 40100, 42000, 43900, 45800
];

// Health Insurance Brackets (Effective 114/1/1)
// Level 1 starts at 28,590. Max Level 59 at 313,000.
export const HEALTH_BRACKETS = [
  28590, 28800, 30300, 31800, 33300, 34800, 36300, 38200, 40100, 42000,
  43900, 45800, 48200, 50600, 53000, 55400, 57800, 60800, 63800, 66800,
  69800, 72800, 76500, 80200, 83900, 87600, 92100, 96600, 101100, 105600,
  110100, 115500, 120500, 125500, 131700, 137900, 144100, 150000, 156400,
  162800, 169200, 175600, 182000, 189500, 197000, 204500, 212000, 219500,
  228200, 236900, 245600, 254300, 263000, 273000, 283000, 293000, 303000, 313000
];

// Pension Brackets (Based on provided OCR, up to 150,000)
// This is often similar to Labor Insurance but continues higher.
export const PENSION_BRACKETS = [
  1500, 3000, 4500, 6000, 7500, 
  8700, 9900, 11100, 12540, 13500, 
  15840, 16500, 17280, 17880, 19047, 
  20008, 21009, 22000, 23100, 24000, 
  25250, 26400, 27600, 28590, 29500, 
  30300, 31800, 33300, 34800, 36300, 
  38200, 40100, 42000, 43900, 45800,
  48200, 50600, 53000, 55400, 57800,
  60800, 63800, 66800, 69800, 72800,
  76500, 80200, 83900, 87600, 92100,
  96600, 101100, 105600, 110100, 115500,
  120900, 126300, 131700, 137100, 142500, 
  147900, 150000
];

export const getLaborInsuredSalary = (salary: number): number => {
    if (salary <= LABOR_BRACKETS[0]) return LABOR_BRACKETS[0];
    for (const bracket of LABOR_BRACKETS) {
      if (salary <= bracket) return bracket;
    }
    return LABOR_BRACKETS[LABOR_BRACKETS.length - 1]; // Cap at 45800
};

export const getHealthInsuredSalary = (salary: number): number => {
    if (salary <= HEALTH_BRACKETS[0]) return HEALTH_BRACKETS[0];
    for (const bracket of HEALTH_BRACKETS) {
      if (salary <= bracket) return bracket;
    }
    return HEALTH_BRACKETS[HEALTH_BRACKETS.length - 1];
};

export const getPensionInsuredSalary = (salary: number): number => {
    if (salary <= PENSION_BRACKETS[0]) return PENSION_BRACKETS[0];
    for (const bracket of PENSION_BRACKETS) {
        if (salary <= bracket) return bracket;
    }
    return PENSION_BRACKETS[PENSION_BRACKETS.length - 1]; // Cap at 150000
};

// --- Employee Share Calculations ---

export const calculateLaborInsurance = (salary: number): number => {
  const insuredSalary = getLaborInsuredSalary(salary);
  return Math.round(insuredSalary * LABOR_INSURANCE_RATE * LABOR_EMPLOYEE_SHARE);
};

export const calculateHealthInsurance = (salary: number, dependents: number): number => {
  const insuredSalary = getHealthInsuredSalary(salary);
  const singleShare = Math.round(insuredSalary * HEALTH_INSURANCE_RATE * HEALTH_EMPLOYEE_SHARE);
  const chargeableCount = 1 + Math.min(dependents, 3);
  return singleShare * chargeableCount;
};

// --- Employer Share Calculations ---

export const calculateLaborInsuranceEmployer = (salary: number): number => {
  const insuredSalary = getLaborInsuredSalary(salary);
  return Math.round(insuredSalary * LABOR_INSURANCE_RATE * LABOR_EMPLOYER_SHARE);
};

export const calculateHealthInsuranceEmployer = (salary: number): number => {
  const insuredSalary = getHealthInsuredSalary(salary);
  return Math.round(insuredSalary * HEALTH_INSURANCE_RATE * HEALTH_EMPLOYER_SHARE * (1 + AVG_DEPENDENTS_EMPLOYER));
};

export const calculatePension = (salaryForPension: number): number => {
    // Note: salaryForPension is already determined by the app logic (base vs gross)
    const insuredSalary = getPensionInsuredSalary(salaryForPension);
    return Math.round(insuredSalary * PENSION_RATE);
}

// --- Overtime Calculations ---
export const calculateOvertimePay = (
    regularSalary: number, 
    weekdayHours: number, 
    restDayHours: number,
    holidayHours: number
): number => {
  const hourlyRate = regularSalary / 240;
  let total = 0;

  if (weekdayHours > 0) {
    const firstTwo = Math.min(weekdayHours, 2);
    const remaining = Math.max(0, weekdayHours - 2);
    total += hourlyRate * firstTwo * (4/3);
    total += hourlyRate * remaining * (5/3);
  }

  if (restDayHours > 0) {
    const firstTwo = Math.min(restDayHours, 2);
    const remaining = Math.max(0, restDayHours - 2);
    total += hourlyRate * firstTwo * (4/3);
    total += hourlyRate * remaining * (5/3);
  }

  if (holidayHours > 0) {
    total += hourlyRate * 8;
    if (holidayHours > 8) {
        const extra = holidayHours - 8;
        total += hourlyRate * extra * (4/3); 
    }
  }

  return Math.ceil(total);
};

export const getOvertimeBreakdownText = (emp: Employee): string => {
  const parts = [];
  
  if (emp.otHoursWeekday > 0) {
    const f = Math.min(emp.otHoursWeekday, 2);
    const r = Math.max(0, emp.otHoursWeekday - 2);
    let breakdown = `2h×1.33`;
    if (r > 0) breakdown += ` + ${r}h×1.66`;
    else breakdown = `${f}h×1.33`;
    parts.push(`平日${emp.otHoursWeekday}h[${breakdown}]`);
  }

  if (emp.otHoursRestDay > 0) {
     const f = Math.min(emp.otHoursRestDay, 2);
     const r = Math.max(0, emp.otHoursRestDay - 2);
     let breakdown = `2h×1.33`;
     if (r > 0) breakdown += ` + ${r}h×1.66`;
     else breakdown = `${f}h×1.33`;
     parts.push(`休${emp.otHoursRestDay}h[${breakdown}]`);
  }

  if (emp.otHoursHoliday > 0) {
    let breakdown = '';
    if (emp.otHoursHoliday <= 8) breakdown = '加發一日';
    else breakdown = `加發一日+${emp.otHoursHoliday-8}h×1.33`;
    parts.push(`假${emp.otHoursHoliday}h[${breakdown}]`);
  }

  if (parts.length === 0) return '-';
  return parts.join(', ');
};