import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, 
  LayoutDashboard, 
  PlusCircle, 
  Search, 
  Bot,
  Building2,
  Trash2,
  Edit,
  ArrowRight,
  Settings,
  Calendar,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  Download,
  Printer,
  Table2,
  X
} from 'lucide-react';

import { Employee, TabView, CalculatedPayroll, CompanySettings } from './types';
import { 
  calculateLaborInsurance, 
  calculateHealthInsurance, 
  calculatePension, 
  getLaborInsuredSalary, 
  getHealthInsuredSalary,
  getPensionInsuredSalary,
  calculateLaborInsuranceEmployer,
  calculateHealthInsuranceEmployer,
  calculateOvertimePay,
  getOvertimeBreakdownText,
  LABOR_BRACKETS,
  LABOR_INSURANCE_RATE,
  LABOR_EMPLOYEE_SHARE,
  LABOR_EMPLOYER_SHARE,
  HEALTH_BRACKETS,
  HEALTH_INSURANCE_RATE,
  HEALTH_EMPLOYEE_SHARE,
  HEALTH_EMPLOYER_SHARE,
  AVG_DEPENDENTS_EMPLOYER,
  PENSION_BRACKETS
} from './utils/taiwanLaborRules';
import { EmployeeForm } from './components/EmployeeForm';
import { PayslipView } from './components/PayslipView';
import { AIAssistant } from './components/AIAssistant';
import { BatchPayslipPrint } from './components/BatchPayslipPrint';

// Initial Data Structure (Fallback)
const initialEmployees: Employee[] = [
  {
    id: '1',
    name: '範例員工-王小明',
    position: '資深工程師',
    department: '研發部',
    bankName: '中國信託',
    bankAccount: '1234-5678-0000',
    baseSalary: 60000,
    mealAllowance: 3000,
    fuelAllowance: 1000,
    attendanceBonus: 2000,
    useBaseSalaryForInsurance: false,
    otHoursWeekday: 3, 
    otHoursRestDay: 0,
    otHoursHoliday: 0,
    dependents: 0,
    joinDate: '2023-01-15',
    customAllowances: [{ id: 'a1', name: '專案獎金', amount: 5000 }],
    customDeductions: [],
    note: ''
  }
];

const DB_KEY_EMPLOYEES = 'taiwan_payroll_employees_v1';
const DB_KEY_SETTINGS = 'taiwan_payroll_settings_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabView>(TabView.DASHBOARD);
  
  // -- State Management --
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: '祥鉞餐飲設備股份有限公司',
    address: '台中市北屯區水景街8號',
    googleSheetScriptUrl: ''
  });

  // -- UI State --
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYearMonth, setSelectedYearMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isPrintingBatch, setIsPrintingBatch] = useState(false);
  const [showInsuranceTable, setShowInsuranceTable] = useState(false);
  
  // Draggable Modal State
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  // Pension setting state (Session based)
  const [useBaseSalaryForPension] = useState(false);

  // -- Sync State --
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncError, setSyncError] = useState<string | null>(null);

  // 1. Initial Load (Local Storage)
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(DB_KEY_SETTINGS);
      if (savedSettings) {
        setCompanySettings(JSON.parse(savedSettings));
      }
      
      const savedEmployees = localStorage.getItem(DB_KEY_EMPLOYEES);
      if (savedEmployees) {
        setEmployees(JSON.parse(savedEmployees));
      }
    } catch (e) {
      console.error("Failed to load local data", e);
    }
  }, []);

  // 2. Auto-Sync from Cloud on Start (if URL exists)
  useEffect(() => {
    if (companySettings.googleSheetScriptUrl) {
      // Only sync on mount if URL exists
    }
  }, []); 

  // 3. Save to Local Storage on Change
  useEffect(() => {
    localStorage.setItem(DB_KEY_EMPLOYEES, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem(DB_KEY_SETTINGS, JSON.stringify(companySettings));
  }, [companySettings]);

  // -- Draggable Modal Logic --
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingModal) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setModalPosition({
        x: dragStartRef.current.initialX + dx,
        y: dragStartRef.current.initialY + dy
      });
    };

    const handleMouseUp = () => {
      setIsDraggingModal(false);
    };

    if (isDraggingModal) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingModal]);

  const handleModalMouseDown = (e: React.MouseEvent) => {
    setIsDraggingModal(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: modalPosition.x,
      initialY: modalPosition.y
    };
  };

  // -- Cloud Functions --

  const validateUrl = (url: string) => {
    if (!url) return false;
    if (!url.includes('script.google.com')) return false;
    if (!url.endsWith('/exec')) return false;
    return true;
  }

  const syncFromCloud = async () => {
    if (!companySettings.googleSheetScriptUrl) return;
    if (!validateUrl(companySettings.googleSheetScriptUrl)) {
        setSyncError("網址錯誤：請確認網址結尾為 /exec");
        return;
    }
    
    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch(companySettings.googleSheetScriptUrl);
      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      if (data.status === 'success') {
         if (data.employees && Array.isArray(data.employees)) {
            setEmployees(data.employees);
            setLastSyncTime(new Date().toLocaleTimeString());
         }
      } else {
         throw new Error(data.message || 'Invalid data format');
      }
    } catch (error) {
      console.error("Cloud Load Error:", error);
      setSyncError("讀取失敗：請檢查權限是否設為「所有人」");
    } finally {
      setIsSyncing(false);
    }
  };

  const syncToCloud = async (newEmployees: Employee[], newSettings: CompanySettings) => {
    if (!newSettings.googleSheetScriptUrl) return;
    if (!validateUrl(newSettings.googleSheetScriptUrl)) {
        setSyncError("網址錯誤：請確認網址結尾為 /exec");
        return;
    }

    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const response = await fetch(newSettings.googleSheetScriptUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8', 
        },
        body: JSON.stringify({
          employees: newEmployees,
          settings: newSettings
        }),
      });

      const result = await response.json();
      if (result.status === 'success') {
        setLastSyncTime(new Date().toLocaleTimeString());
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error("Cloud Save Error:", error);
      setSyncError("儲存失敗：請檢查網址或權限設定");
    } finally {
      setIsSyncing(false);
    }
  };

  // Analyze Custom Columns
  const allCustomAllowanceNames = useMemo(() => {
    const names = new Set<string>();
    employees.forEach(e => e.customAllowances.forEach(a => names.add(a.name)));
    return Array.from(names);
  }, [employees]);

  const allCustomDeductionNames = useMemo(() => {
    const names = new Set<string>();
    employees.forEach(e => e.customDeductions.forEach(d => names.add(d.name)));
    return Array.from(names);
  }, [employees]);

  // Core Payroll Calculation
  const payrolls = useMemo<Map<string, CalculatedPayroll>>(() => {
    const map = new Map<string, CalculatedPayroll>();
    employees.forEach(emp => {
      const regularSalary = emp.baseSalary + emp.mealAllowance + emp.fuelAllowance + emp.attendanceBonus;
      const overtimePay = calculateOvertimePay(regularSalary, emp.otHoursWeekday, emp.otHoursRestDay, emp.otHoursHoliday);
      const fixedMonthlyTotal = regularSalary + emp.customAllowances.reduce((s, c) => s + c.amount, 0);
      const grossSalary = fixedMonthlyTotal + overtimePay;

      const insuranceBasisSalary = emp.useBaseSalaryForInsurance ? emp.baseSalary : fixedMonthlyTotal;
      const insuredSalary = getLaborInsuredSalary(insuranceBasisSalary);
      const insuredSalaryHealth = getHealthInsuredSalary(insuranceBasisSalary);
      
      // Pension Logic: Use Checkbox State OR Employee Specific Flag
      const pensionBasisSalary = (useBaseSalaryForPension || emp.useBaseSalaryForInsurance) ? emp.baseSalary : fixedMonthlyTotal;
      const insuredSalaryPension = getPensionInsuredSalary(pensionBasisSalary);
      
      const laborEmp = calculateLaborInsurance(insuranceBasisSalary);
      const healthEmp = calculateHealthInsurance(insuranceBasisSalary, emp.dependents);
      const totalCustomDeductions = emp.customDeductions.reduce((s, d) => s + d.amount, 0);
      const totalDeductions = laborEmp + healthEmp + totalCustomDeductions;
      
      const laborCo = calculateLaborInsuranceEmployer(insuranceBasisSalary);
      const healthCo = calculateHealthInsuranceEmployer(insuranceBasisSalary);
      
      const pension = calculatePension(pensionBasisSalary);

      const netPay = grossSalary - totalDeductions;
      
      // Update: Total Company Cost = Net Pay + Company Insurance + Pension
      // Previously: (Gross - laborEmp - healthEmp) + laborCo + healthCo + pension
      // New Requirement: Deduct ALL employee deductions (Labor + Health + Custom). 
      // This is mathematically equivalent to: Net Pay + LaborCo + HealthCo + Pension.
      // Explanation: Net Pay is what company pays to employee. Statutory costs are what company pays to govt. 
      // Custom deductions (like fines, loan repayment) are kept by company (reducing cost) or paid to 3rd party (pass-through).
      // Assuming "Cost" means "Total Cash Outflow from Company specific to this employee's employment", 
      // if deduction is kept by company, it reduces cost. If deduction is pass through, it is neutral (but Net Pay reflects it).
      // Using Net Pay + Employer Statutory Costs satisfies "Deduct all deductions from Cost".
      const totalCompanyCost = netPay + laborCo + healthCo + pension;
      
      map.set(emp.id, {
        employeeId: emp.id,
        insuredSalary,
        insuredSalaryHealth,
        insuredSalaryPension,
        laborInsuranceEmp: laborEmp,
        healthInsuranceEmp: healthEmp,
        totalCustomDeductions,
        laborInsuranceCo: laborCo,
        healthInsuranceCo: healthCo,
        pensionCompany: pension,
        overtimePay,
        grossSalary,
        totalDeductions,
        netPay,
        totalCompanyCost
      });
    });
    return map;
  }, [employees, useBaseSalaryForPension]); // Recalculate when pension checkbox toggles

  const filteredEmployees = employees.filter(e => 
    e.name.includes(searchQuery) || e.department.includes(searchQuery)
  );

  const currentEmployee = selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId) : null;
  const currentPayroll = selectedEmployeeId ? payrolls.get(selectedEmployeeId) : null;

  // -- Actions --

  const handleSaveEmployee = (emp: Employee) => {
    let newEmployees;
    if (employees.find(e => e.id === emp.id)) {
      newEmployees = employees.map(e => e.id === emp.id ? emp : e);
    } else {
      newEmployees = [...employees, emp];
    }
    setEmployees(newEmployees);
    setIsEditing(false);
    setSelectedEmployeeId(emp.id); 
    if(activeTab === TabView.DASHBOARD) setActiveTab(TabView.EMPLOYEES);
    syncToCloud(newEmployees, companySettings);
  };

  const handleDelete = (id: string) => {
    const newEmployees = employees.filter(e => e.id !== id);
    setEmployees(newEmployees);
    setDeleteConfirmId(null);
    if (selectedEmployeeId === id) setSelectedEmployeeId(null);
    syncToCloud(newEmployees, companySettings);
  };

  const handleSettingsChange = (newSettings: CompanySettings) => {
    setCompanySettings(newSettings);
  };

  const handleExportExcel = () => {
    // Generate Totals
    let totalBase = 0;
    let totalMeal = 0;
    let totalFuel = 0;
    let totalBonus = 0;
    const totalCustomAllowances: Record<string, number> = {};
    allCustomAllowanceNames.forEach(n => totalCustomAllowances[n] = 0);
    let totalOvertimePay = 0;
    let totalGross = 0;
    let totalLaborEmp = 0;
    let totalHealthEmp = 0;
    const totalCustomDeductions: Record<string, number> = {};
    allCustomDeductionNames.forEach(n => totalCustomDeductions[n] = 0);
    let totalDeductionsSum = 0;
    let totalNet = 0;
    let totalLaborCo = 0;
    let totalHealthCo = 0;
    let totalPension = 0;
    let totalCost = 0;

    employees.forEach(emp => {
      const p = payrolls.get(emp.id)!;
      totalBase += emp.baseSalary;
      totalMeal += emp.mealAllowance;
      totalFuel += emp.fuelAllowance;
      totalBonus += emp.attendanceBonus;
      allCustomAllowanceNames.forEach(name => {
          totalCustomAllowances[name] += emp.customAllowances.find(a => a.name === name)?.amount || 0;
      });
      totalOvertimePay += p.overtimePay;
      totalGross += p.grossSalary;
      totalLaborEmp += p.laborInsuranceEmp;
      totalHealthEmp += p.healthInsuranceEmp;
      allCustomDeductionNames.forEach(name => {
          totalCustomDeductions[name] += emp.customDeductions.find(d => d.name === name)?.amount || 0;
      });
      totalDeductionsSum += p.totalDeductions;
      totalNet += p.netPay;
      totalLaborCo += p.laborInsuranceCo;
      totalHealthCo += p.healthInsuranceCo;
      totalPension += p.pensionCompany;
      totalCost += p.totalCompanyCost;
    });

    // Build HTML Table with Styles
    let rows = '';
    employees.forEach(emp => {
      const p = payrolls.get(emp.id)!;
      const fixedAllowances = emp.mealAllowance + emp.fuelAllowance + emp.attendanceBonus;
      rows += `
        <tr>
          <td style="text-align:left;">${emp.name}</td>
          <td style="text-align:left;">${emp.department}/${emp.position}</td>
          <td>${emp.baseSalary}</td>
          <td>${fixedAllowances}</td>
          ${allCustomAllowanceNames.map(name => `<td style="color:#059669;">${emp.customAllowances.find(a => a.name === name)?.amount || 0}</td>`).join('')}
          <td style="background-color:#fff7ed; color:#c2410c;">${p.overtimePay}</td>
          <td style="font-weight:bold;">${p.grossSalary}</td>
          <td style="color:#e11d48;">-${p.laborInsuranceEmp}</td>
          <td style="color:#e11d48;">-${p.healthInsuranceEmp}</td>
          ${allCustomDeductionNames.map(name => `<td style="color:#e11d48;">-${emp.customDeductions.find(d => d.name === name)?.amount || 0}</td>`).join('')}
          <td style="color:#9f1239; font-weight:bold;">-${p.totalDeductions}</td>
          <td style="background-color:#ecfdf5; color:#059669; font-weight:bold;">${p.netPay}</td>
          <td style="color:#64748b;">${p.laborInsuranceCo}</td>
          <td style="color:#64748b;">${p.healthInsuranceCo}</td>
          <td style="color:#64748b;">${p.pensionCompany}</td>
          <td style="font-weight:bold;">${p.totalCompanyCost}</td>
        </tr>
      `;
    });

    const totalRow = `
      <tr style="background-color: #f1f5f9; font-weight: bold;">
         <td colspan="2">總計</td>
         <td>${totalBase}</td>
         <td>${totalMeal + totalFuel + totalBonus}</td>
         ${allCustomAllowanceNames.map(n => `<td style="color:#059669;">${totalCustomAllowances[n]}</td>`).join('')}
         <td style="color:#c2410c;">${totalOvertimePay}</td>
         <td>${totalGross}</td>
         <td style="color:#be123c;">-${totalLaborEmp}</td>
         <td style="color:#be123c;">-${totalHealthEmp}</td>
         ${allCustomDeductionNames.map(n => `<td style="color:#be123c;">${totalCustomDeductions[n]}</td>`).join('')}
         <td style="color:#9f1239;">-${totalDeductionsSum}</td>
         <td style="background-color:#d1fae5; color:#065f46;">${totalNet}</td>
         <td>${totalLaborCo}</td>
         <td>${totalHealthCo}</td>
         <td>${totalPension}</td>
         <td>${totalCost}</td>
      </tr>
    `;

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          body { font-family: "Microsoft JhengHei", sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #cbd5e1; padding: 5px; text-align: right; vertical-align: middle; }
          th { background-color: #f1f5f9; text-align: center; font-weight: bold; height: 40px; color: #334155; }
        </style>
      </head>
      <body>
        <h3>${companySettings.name} - 薪資總表 (${selectedYearMonth})</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 120px;">姓名</th>
              <th style="width: 150px;">部門/職位</th>
              <th>本俸</th>
              <th>伙食/油資/全勤</th>
              ${allCustomAllowanceNames.map(n => `<th style="color:#059669;">${n}</th>`).join('')}
              <th style="background-color:#fff7ed; color:#9a3412;">加班費</th>
              <th>應發總額</th>
              <th style="color:#e11d48;">勞保(自)</th>
              <th style="color:#e11d48;">健保(自)</th>
              ${allCustomDeductionNames.map(n => `<th style="color:#e11d48;">${n}</th>`).join('')}
              <th style="color:#9f1239;">應扣總額</th>
              <th style="background-color:#ecfdf5; color:#047857;">實發金額</th>
              <th style="color:#475569;">勞保(公)</th>
              <th style="color:#475569;">健保(公)</th>
              <th style="color:#475569;">勞退(6%)</th>
              <th>公司總成本(扣除應扣總額)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            ${totalRow}
          </tfoot>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${companySettings.name}_薪資總表_${selectedYearMonth}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchPrint = () => {
    setIsPrintingBatch(true);
    // Wait for render then print
    setTimeout(() => {
       window.print();
       // Optional: setIsPrintingBatch(false) after print logic if desired, 
       // but keeping it open allows user to review what they printed. 
       // We can add a close button in the view.
    }, 500);
  };

  const inputStyle = "px-3 py-1.5 bg-white text-black border border-black rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none";

  // If we are in batch print mode, render only the print view
  if (isPrintingBatch) {
    return (
      <div className="bg-white min-h-screen">
        <div className="no-print p-4 flex justify-between items-center bg-slate-800 text-white sticky top-0 z-50">
           <span className="font-bold text-lg">全員薪資單列印預覽 (A4 - 4人/頁)</span>
           <div className="flex gap-4">
              <button 
                onClick={() => window.print()} 
                className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded flex items-center"
              >
                <Printer size={20} className="mr-2"/> 立即列印
              </button>
              <button 
                onClick={() => setIsPrintingBatch(false)} 
                className="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded"
              >
                關閉預覽
              </button>
           </div>
        </div>
        <BatchPayslipPrint 
          employees={filteredEmployees.length > 0 ? filteredEmployees : employees} 
          payrolls={payrolls}
          companySettings={companySettings}
          selectedYearMonth={selectedYearMonth}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">

      {/* Insurance Table Modal (Shared) */}
      {showInsuranceTable && (
        <div className="fixed inset-0 z-50 flex no-print pointer-events-none">
          <div 
             className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col absolute pointer-events-auto"
             style={{ 
               transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)`,
               left: 'calc(50% - 32rem)',
               top: '10%',
               boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
             }}
          >
            <div 
              className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 cursor-move"
              onMouseDown={handleModalMouseDown}
            >
               <h3 className="text-xl font-bold text-slate-800 flex items-center pointer-events-none">
                 <Table2 className="mr-2"/> 勞健保與勞退分級表
               </h3>
               <button onClick={() => setShowInsuranceTable(false)} className="p-2 hover:bg-slate-200 rounded-full"><X/></button>
            </div>
            <div className="p-6 overflow-y-auto">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Labor Insurance */}
                  <div>
                     <h4 className="font-bold text-rose-700 mb-2 border-b-2 border-rose-200 pb-1">勞工保險</h4>
                     <div className="overflow-x-auto border rounded-lg h-96">
                        <table className="w-full text-sm text-center">
                           <thead className="bg-rose-50 text-rose-900 font-bold sticky top-0">
                              <tr>
                                 <th className="p-2 border-b">投保薪資</th>
                                 <th className="p-2 border-b">自付(20%)</th>
                                 <th className="p-2 border-b">公司(70%)</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {LABOR_BRACKETS.map(salary => (
                                 <tr key={salary} className="hover:bg-slate-50">
                                    <td className="p-1.5 font-mono">{salary.toLocaleString()}</td>
                                    <td className="p-1.5 text-rose-600 font-medium">
                                       {Math.round(salary * LABOR_INSURANCE_RATE * LABOR_EMPLOYEE_SHARE)}
                                    </td>
                                    <td className="p-1.5 text-slate-500">
                                       {Math.round(salary * LABOR_INSURANCE_RATE * LABOR_EMPLOYER_SHARE)}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>

                  {/* Health Insurance */}
                  <div>
                     <h4 className="font-bold text-emerald-700 mb-2 border-b-2 border-emerald-200 pb-1">全民健保</h4>
                     <div className="overflow-x-auto border rounded-lg h-96">
                        <table className="w-full text-sm text-center">
                           <thead className="bg-emerald-50 text-emerald-900 font-bold sticky top-0">
                              <tr>
                                 <th className="p-2 border-b">投保薪資</th>
                                 <th className="p-2 border-b">本人負擔</th>
                                 <th className="p-2 border-b">公司負擔</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {HEALTH_BRACKETS.map(salary => {
                                 const single = Math.round(salary * HEALTH_INSURANCE_RATE * HEALTH_EMPLOYEE_SHARE);
                                 const company = Math.round(salary * HEALTH_INSURANCE_RATE * HEALTH_EMPLOYER_SHARE * (1 + AVG_DEPENDENTS_EMPLOYER));
                                 return (
                                 <tr key={salary} className="hover:bg-slate-50">
                                    <td className="p-1.5 font-mono">{salary.toLocaleString()}</td>
                                    <td className="p-1.5 text-emerald-600 font-medium">
                                       {single}
                                    </td>
                                    <td className="p-1.5 text-slate-500">
                                       {company}
                                    </td>
                                 </tr>
                              )})}
                           </tbody>
                        </table>
                     </div>
                  </div>

                  {/* Pension */}
                  <div>
                     <h4 className="font-bold text-indigo-700 mb-2 border-b-2 border-indigo-200 pb-1">勞工退休金(6%)</h4>
                     <div className="overflow-x-auto border rounded-lg h-96">
                        <table className="w-full text-sm text-center">
                           <thead className="bg-indigo-50 text-indigo-900 font-bold sticky top-0">
                              <tr>
                                 <th className="p-2 border-b">月提繳工資</th>
                                 <th className="p-2 border-b">公司提繳</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {PENSION_BRACKETS.map(salary => (
                                 <tr key={salary} className="hover:bg-slate-50">
                                    <td className="p-1.5 font-mono">{salary.toLocaleString()}</td>
                                    <td className="p-1.5 text-indigo-600 font-medium">
                                       {Math.round(salary * 0.06)}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>

               </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar */}
      <nav className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col no-print">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <Building2 className="text-indigo-500" />
          <span className="font-bold text-xl text-white tracking-tight">TaiwanHR</span>
        </div>

        <div className="flex-1 py-6 space-y-2 px-4">
          <button 
            onClick={() => { setActiveTab(TabView.DASHBOARD); setIsEditing(false); }}
            className={`w-full flex items-center p-3 rounded-lg transition ${activeTab === TabView.DASHBOARD ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          >
            <LayoutDashboard size={20} className="mr-3" />
            薪資總覽
          </button>
          
          <button 
            onClick={() => { setActiveTab(TabView.EMPLOYEES); setIsEditing(false); }}
            className={`w-full flex items-center p-3 rounded-lg transition ${activeTab === TabView.EMPLOYEES ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          >
            <Users size={20} className="mr-3" />
            員工管理
          </button>
        </div>

        {/* Sync Status in Sidebar */}
        <div className="px-6 py-4 border-t border-slate-800 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-400">資料同步狀態</span>
            {isSyncing ? (
              <RefreshCw size={12} className="animate-spin text-indigo-400"/>
            ) : companySettings.googleSheetScriptUrl && !syncError ? (
              <Cloud size={12} className="text-emerald-500"/>
            ) : (
              <CloudOff size={12} className="text-slate-600"/>
            )}
          </div>
          {companySettings.googleSheetScriptUrl ? (
             <div className="text-slate-500">
               {syncError ? (
                 <span className="text-rose-500 flex items-center gap-1">
                   <AlertTriangle size={12}/> {syncError}
                 </span>
               ) : (
                 `已連線至 Google Sheets`
               )}
               {lastSyncTime && !syncError && <div className="mt-1 opacity-70">最後更新: {lastSyncTime}</div>}
             </div>
          ) : (
             <div className="text-slate-600 italic">尚未設定雲端連結</div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800">
           <button 
             onClick={() => setShowAi(true)}
             className="w-full flex items-center justify-center p-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:opacity-90 transition shadow-lg shadow-indigo-900/50"
           >
             <Bot size={20} className="mr-2" />
             AI 人資顧問
           </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10 no-print shadow-sm">
          <div>
             <h1 className="text-2xl font-bold text-slate-800">
              {activeTab === TabView.DASHBOARD && '公司薪資成本總覽'}
              {activeTab === TabView.EMPLOYEES && '員工與薪資管理'}
              {activeTab === TabView.PAYSLIP && '薪資單預覽'}
            </h1>
            <div className="text-xs text-slate-500 mt-1">{companySettings.name}</div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Manual Sync Button */}
             {companySettings.googleSheetScriptUrl && (
               <button 
                 onClick={() => syncFromCloud()} 
                 disabled={isSyncing}
                 className="p-2 text-slate-500 hover:text-indigo-600 transition disabled:opacity-50"
                 title="從雲端重新讀取"
               >
                 <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
               </button>
             )}

             {/* Date Selector */}
             <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200">
               <Calendar size={16} className="text-slate-900"/>
               <span className="text-xs font-bold text-slate-900 mr-1">發薪年月:</span>
               <input 
                 type="month" 
                 value={selectedYearMonth}
                 onChange={(e) => setSelectedYearMonth(e.target.value)}
                 className="bg-transparent border-none outline-none text-sm font-bold text-slate-900 cursor-pointer"
                 style={{ colorScheme: 'light' }}
               />
             </div>

             {/* Settings Toggle */}
             <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`flex items-center px-3 py-1.5 rounded-lg transition ${isSettingsOpen ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
               <Settings size={18} className="mr-1"/> 設定
             </button>
          </div>
        </header>

        {/* Company Settings Panel (Inline) */}
        {isSettingsOpen && (
          <div className="bg-slate-100 px-8 py-6 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in no-print">
            <div className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-600 mb-1">公司名稱</label>
                 <input 
                    type="text" 
                    value={companySettings.name} 
                    onChange={e => handleSettingsChange({...companySettings, name: e.target.value})} 
                    className={inputStyle + " w-full"} 
                 />
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-600 mb-1">公司地址</label>
                 <input 
                    type="text" 
                    value={companySettings.address} 
                    onChange={e => handleSettingsChange({...companySettings, address: e.target.value})} 
                    className={inputStyle + " w-full"} 
                 />
               </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm">
               <div className="flex items-center mb-2">
                 <Cloud className="text-indigo-500 mr-2" size={18} />
                 <h3 className="font-bold text-slate-800 text-sm">Google Sheets 雲端同步設定</h3>
               </div>
               <p className="text-xs text-slate-500 mb-3">
                 將資料儲存在您私人的 Google 試算表中。請輸入「Apps Script 網頁應用程式網址」。
                 <br/><span className="text-orange-600">注意：每次修改 GAS 程式碼後，必須選擇「新增部署」才能生效。</span>
               </p>
               <input 
                 type="text" 
                 placeholder="https://script.google.com/macros/s/..../exec" 
                 value={companySettings.googleSheetScriptUrl || ''} 
                 onChange={e => handleSettingsChange({...companySettings, googleSheetScriptUrl: e.target.value})} 
                 className={`${inputStyle} w-full font-mono text-xs mb-2 ${syncError ? 'border-red-500 bg-red-50' : ''}`}
               />
               {syncError && (
                 <div className="text-xs text-rose-600 mb-2 font-bold">{syncError}</div>
               )}
               <div className="flex justify-end">
                 <button 
                   onClick={() => syncFromCloud()}
                   disabled={!companySettings.googleSheetScriptUrl || isSyncing}
                   className="flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
                 >
                   {isSyncing ? '連線中...' : '測試連線並下載資料'}
                 </button>
               </div>
            </div>
          </div>
        )}

        <div className="p-8 pb-20">
          
          {/* DASHBOARD */}
          {activeTab === TabView.DASHBOARD && (
            <div className="space-y-8 animate-fade-in">
              {/* Top Cards - Updated Layout to 5 Columns or Responsive Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <div className="text-slate-500 text-xs font-bold uppercase mb-2">應發薪資總額</div>
                  <div className="text-2xl font-black text-slate-800">
                    ${Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.grossSalary, 0).toLocaleString()}
                  </div>
                </div>
                
                {/* NEW CARD: Net Pay Total */}
                <div className="bg-emerald-600 p-5 rounded-xl shadow-lg shadow-emerald-200 text-white">
                  <div className="text-emerald-100 text-xs font-bold uppercase mb-2">實發金額總額</div>
                  <div className="text-2xl font-black">
                    ${Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.netPay, 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                   <div className="text-slate-500 text-xs font-bold uppercase mb-2">公司負擔勞健保</div>
                   <div className="text-xl font-black text-slate-800">
                    ${Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.laborInsuranceCo + p.healthInsuranceCo, 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                     勞 ${Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.laborInsuranceCo, 0).toLocaleString()} / 
                     健 ${Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.healthInsuranceCo, 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-indigo-600 p-5 rounded-xl shadow-lg shadow-indigo-200 text-white">
                   <div className="text-indigo-200 text-xs font-bold uppercase mb-2">人事總支出成本</div>
                   <div className="text-2xl font-black">
                    ${Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.totalCompanyCost, 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-indigo-300 mt-1">
                    *已扣除所有應扣項目
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-slate-800">全員薪資明細表 ({selectedYearMonth})</h3>
                  </div>
                  
                  <div className="flex items-center gap-4">
                     <button 
                        onClick={() => setShowInsuranceTable(true)} 
                        className="text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-lg flex items-center font-bold transition border border-slate-300"
                     >
                        <Table2 size={16} className="mr-1"/> 級距表
                     </button>
                     <button 
                        onClick={handleExportExcel} 
                        className="text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center font-bold transition border border-emerald-200"
                     >
                        <Download size={16} className="mr-1"/> 匯出報表 (Excel)
                     </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 sticky left-0 bg-slate-50 z-20">姓名/職位</th>
                        <th className="px-4 py-3 text-right">本俸</th>
                        <th className="px-4 py-3 text-right">伙食/油資/全勤</th>
                        {allCustomAllowanceNames.map(name => (
                          <th key={name} className="px-4 py-3 text-right text-emerald-600">{name}</th>
                        ))}
                        <th className="px-4 py-3 text-left bg-orange-50 text-orange-800 min-w-[200px]">加班費結構/金額</th>
                        <th className="px-4 py-3 text-right font-black border-l border-slate-200">應發總額</th>
                        <th className="px-4 py-3 text-right text-rose-600">勞保(自)</th>
                        <th className="px-4 py-3 text-right text-rose-600">健保(自)</th>
                        {allCustomDeductionNames.map(name => (
                          <th key={name} className="px-4 py-3 text-right text-rose-600">{name}</th>
                        ))}
                        <th className="px-4 py-3 text-right text-rose-800 font-bold border-l border-slate-200">應扣總額</th>
                        <th className="px-4 py-3 text-right font-black border-l border-slate-200 bg-emerald-50 text-emerald-700">實發金額</th>
                        <th className="px-4 py-3 text-right text-slate-500 border-l border-slate-200">勞保(公)</th>
                        <th className="px-4 py-3 text-right text-slate-500">健保(公)</th>
                        <th className="px-4 py-3 text-right text-slate-500">勞退(6%)</th>
                        <th className="px-4 py-3 text-right text-slate-800 font-bold border-l border-slate-200">公司總成本</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employees.map(emp => {
                        const p = payrolls.get(emp.id)!;
                        const fixedAllowances = emp.mealAllowance + emp.fuelAllowance + emp.attendanceBonus;
                        const otText = getOvertimeBreakdownText(emp);
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 sticky left-0 bg-white hover:bg-slate-50 font-medium text-slate-900 border-r border-slate-100 z-10">
                              {emp.name} 
                              <span className="text-slate-400 font-normal ml-1 text-xs">{emp.position}</span>
                              {emp.note && <div className="text-[10px] text-indigo-500 italic mt-0.5">{emp.note}</div>}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600">{emp.baseSalary.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600">{fixedAllowances.toLocaleString()}</td>
                            {allCustomAllowanceNames.map(name => {
                              const item = emp.customAllowances.find(a => a.name === name);
                              return (
                                <td key={name} className="px-4 py-3 text-right font-mono text-emerald-600">
                                  {item ? item.amount.toLocaleString() : '-'}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-left bg-orange-50/50 text-xs">
                               {p.overtimePay > 0 ? (
                                 <div className="flex flex-col">
                                   <span className="font-mono font-bold text-orange-600 text-sm mb-1">${p.overtimePay.toLocaleString()}</span>
                                   <span className="text-orange-800 font-medium text-[10px] leading-tight opacity-80">{otText}</span>
                                 </div>
                               ) : (
                                 <span className="text-slate-300">-</span>
                               )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 border-l border-slate-100">{p.grossSalary.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-rose-600">-{p.laborInsuranceEmp.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-rose-600">-{p.healthInsuranceEmp.toLocaleString()}</td>
                            {allCustomDeductionNames.map(name => {
                              const item = emp.customDeductions.find(d => d.name === name);
                              return (
                                <td key={name} className="px-4 py-3 text-right font-mono text-rose-600">
                                  {item ? `-${item.amount.toLocaleString()}` : '-'}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-right font-mono font-bold text-rose-800 border-l border-slate-100">-{p.totalDeductions.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 bg-emerald-50/50 border-l border-slate-100">{p.netPay.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500 border-l border-slate-100">{p.laborInsuranceCo.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">{p.healthInsuranceCo.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">{p.pensionCompany.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 border-l border-slate-100">{p.totalCompanyCost.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                       <tr>
                          <td className="px-4 py-3 sticky left-0 bg-slate-100 border-r border-slate-300 z-10">總計</td>
                          <td className="px-4 py-3 text-right font-mono">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + employees.find(e => e.id === p.employeeId)!.baseSalary, 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => {
                              const e = employees.find(x => x.id === p.employeeId)!;
                              return sum + e.mealAllowance + e.fuelAllowance + e.attendanceBonus;
                          }, 0).toLocaleString()}</td>
                          {allCustomAllowanceNames.map(name => (
                             <td key={name} className="px-4 py-3 text-right font-mono text-emerald-700">
                                {employees.reduce((sum: number, e) => sum + (e.customAllowances.find(a => a.name === name)?.amount || 0), 0).toLocaleString()}
                             </td>
                          ))}
                          <td className="px-4 py-3 text-right font-mono text-orange-700">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.overtimePay, 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono font-black border-l border-slate-300">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.grossSalary, 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-rose-700">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.laborInsuranceEmp, 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-rose-700">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.healthInsuranceEmp, 0).toLocaleString()}</td>
                          {allCustomDeductionNames.map(name => (
                             <td key={name} className="px-4 py-3 text-right font-mono text-rose-700">
                                {employees.reduce((sum: number, e) => sum + (e.customDeductions.find(d => d.name === name)?.amount || 0), 0).toLocaleString()}
                             </td>
                          ))}
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-800 border-l border-slate-300">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.totalDeductions, 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono font-black bg-emerald-100 text-emerald-800 border-l border-slate-300">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.netPay, 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600 border-l border-slate-300">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.laborInsuranceCo, 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.healthInsuranceCo, 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.pensionCompany, 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono font-black border-l border-slate-300">{Array.from(payrolls.values()).reduce((sum: number, p: CalculatedPayroll) => sum + p.totalCompanyCost, 0).toLocaleString()}</td>
                       </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* EMPLOYEES: List & Form */}
          {activeTab === TabView.EMPLOYEES && (
            <div className="space-y-6 animate-fade-in">
              {isEditing ? (
                <EmployeeForm 
                  initialData={currentEmployee || undefined}
                  onSave={handleSaveEmployee}
                  onCancel={() => { setIsEditing(false); setSelectedEmployeeId(null); }}
                />
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
                      <input 
                        type="text" 
                        placeholder="搜尋姓名..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-64 placeholder-gray-500"
                      />
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={handleBatchPrint}
                        className="flex items-center px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition shadow-md font-bold"
                      >
                        <Printer size={20} className="mr-2" />
                        列印全員薪資單
                      </button>
                      <button 
                        onClick={() => { setSelectedEmployeeId(null); setIsEditing(true); }}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md font-bold"
                      >
                        <PlusCircle size={20} className="mr-2" />
                        新增員工
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEmployees.map(emp => {
                      const p = payrolls.get(emp.id)!;
                      return (
                        <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition group overflow-hidden">
                          <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                               <div>
                                 <h3 className="text-lg font-bold text-slate-900">{emp.name}</h3>
                                 <p className="text-slate-500 text-sm">{emp.department || '未分派'} / {emp.position || '職員'}</p>
                                 {emp.note && <div className="text-xs text-indigo-500 mt-1 italic">{emp.note}</div>}
                               </div>
                               <div className="text-right">
                                  <div className="text-xs text-slate-400 uppercase">實發金額</div>
                                  <div className="text-xl font-black text-emerald-600 font-mono">${p.netPay.toLocaleString()}</div>
                               </div>
                            </div>
                            
                            <div className="space-y-2 mb-6">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">本俸 + 津貼</span>
                                <span className="font-mono">${(p.grossSalary - p.overtimePay).toLocaleString()}</span>
                              </div>
                              {p.overtimePay > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-orange-600 font-bold">加班費</span>
                                  <span className="font-mono text-orange-600 font-bold">+${p.overtimePay.toLocaleString()}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">扣款合計</span>
                                <span className="font-mono text-rose-600">-${p.totalDeductions.toLocaleString()}</span>
                              </div>
                            </div>

                            {deleteConfirmId === emp.id ? (
                               <div className="bg-red-50 p-3 rounded-lg flex items-center justify-between">
                                  <span className="text-red-700 text-sm font-bold">確定刪除?</span>
                                  <div className="flex gap-2">
                                    <button onClick={() => handleDelete(emp.id)} className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">是</button>
                                    <button onClick={() => setDeleteConfirmId(null)} className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded hover:bg-slate-300">否</button>
                                  </div>
                               </div>
                            ) : (
                              <div className="flex gap-2 border-t border-slate-100 pt-4">
                                <button 
                                  onClick={() => { setSelectedEmployeeId(emp.id); setIsEditing(true); }}
                                  className="flex-1 flex items-center justify-center py-2 bg-slate-50 text-slate-700 rounded hover:bg-slate-100 font-medium text-sm"
                                >
                                  <Edit size={16} className="mr-2"/> 編輯資料
                                </button>
                                <button 
                                  onClick={() => { setSelectedEmployeeId(emp.id); setActiveTab(TabView.PAYSLIP); }}
                                  className="flex-1 flex items-center justify-center py-2 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 font-medium text-sm"
                                >
                                  薪資單 <ArrowRight size={16} className="ml-1"/>
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirmId(emp.id)}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* PAYSLIP VIEW */}
          {activeTab === TabView.PAYSLIP && currentEmployee && currentPayroll && (
             <div className="animate-fade-in">
               <button 
                 onClick={() => setActiveTab(TabView.EMPLOYEES)}
                 className="mb-6 text-slate-500 hover:text-slate-800 flex items-center no-print font-medium"
               >
                 <ArrowRight className="mr-2 rotate-180" size={18} /> 返回員工列表
               </button>
               <PayslipView 
                  employee={currentEmployee} 
                  payroll={currentPayroll} 
                  companySettings={companySettings} 
                  selectedYearMonth={selectedYearMonth}
               />
               <div className="mt-8 text-center no-print">
                 <button 
                    onClick={() => setShowAi(true)}
                    className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
                 >
                   <Bot size={18} className="mr-2" />
                   對這份薪資單有疑問？詢問 AI 顧問
                 </button>
               </div>
             </div>
          )}
        </div>
      </main>

      {/* AI Assistant Overlay */}
      <AIAssistant 
        isOpen={showAi} 
        onClose={() => setShowAi(false)} 
        currentEmployee={currentEmployee || undefined}
        payrollData={currentPayroll || undefined}
      />
      
    </div>
  );
}