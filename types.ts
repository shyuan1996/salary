
export interface Allowance {
  id: string;
  name: string;
  amount: number;
}

export interface Deduction {
  id: string;
  name: string;
  amount: number;
}

export interface Employee {
  id: string;
  name: string;
  position: string; // Optional in form, but string type here
  department: string; // Optional in form
  note?: string; // New field: 員工備註
  
  // Bank Details
  bankName: string;
  bankAccount: string;
  
  // Fixed Recurring Salary Components
  baseSalary: number;       // 本俸
  mealAllowance: number;    // 伙食津貼
  fuelAllowance: number;    // 油資津貼
  attendanceBonus: number;  // 全勤獎金
  
  // Insurance Calculation Setting
  useBaseSalaryForInsurance: boolean; // 是否僅用本俸計算勞健保
  
  // Overtime Hours (Input as total hours, system calculates split)
  otHoursWeekday: number;   // 平日加班總時數 (系統自動拆分 4/3, 5/3)
  otHoursRestDay: number;   // 休息日加班總時數 (系統自動拆分 4/3, 5/3)
  otHoursHoliday: number;   // 國定/例假日加班總時數 (2倍)

  dependents: number; // 扶養親屬人數 (for Health Insurance)
  
  customAllowances: Allowance[]; // 其他加給
  customDeductions: Deduction[]; // 其他應扣
  
  joinDate: string;
}

export interface CalculatedPayroll {
  employeeId: string;
  insuredSalary: number; // 勞保投保薪資
  insuredSalaryHealth: number; // 健保投保薪資
  insuredSalaryPension: number; // 勞退提繳工資
  
  // Employee Deductions
  laborInsuranceEmp: number; // 勞保自付
  healthInsuranceEmp: number; // 健保自付
  totalCustomDeductions: number; // 自訂扣款總額
  
  // Employer Costs
  laborInsuranceCo: number; // 勞保公司負擔 (70%)
  healthInsuranceCo: number; // 健保公司負擔 (60% * (1+0.58))
  pensionCompany: number; // 勞退 (6%)
  
  // Totals
  overtimePay: number; // 加班費總額
  grossSalary: number; // 應發金額 (Total Earnings)
  totalDeductions: number; // 扣款總額 (Total Deductions)
  netPay: number; // 實發金額
  
  totalCompanyCost: number; // 公司總支出 (Gross + Company Insurance + Pension)
}

export enum TabView {
  DASHBOARD = 'DASHBOARD',
  EMPLOYEES = 'EMPLOYEES',
  PAYSLIP = 'PAYSLIP',
}

export interface CompanySettings {
  name: string;
  address: string;
  googleSheetScriptUrl?: string; // New field for Google Apps Script Web App URL
}