import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  LayoutDashboard, 
  FileText, 
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
  Save
} from 'lucide-react';

import { Employee, TabView, CalculatedPayroll, CompanySettings } from './types';
import { 
  calculateLaborInsurance, 
  calculateHealthInsurance, 
  calculatePension, 
  getLaborInsuredSalary, 
  getHealthInsuredSalary,
  calculateLaborInsuranceEmployer,
  calculateHealthInsuranceEmployer,
  calculateOvertimePay,
  getOvertimeBreakdownText
} from './utils/taiwanLaborRules';
import { EmployeeForm } from './components/EmployeeForm';
import { PayslipView } from './components/PayslipView';
import { AIAssistant } from './components/AIAssistant';

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
    customDeductions: []
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
      syncFromCloud();
    }
  }, [companySettings.googleSheetScriptUrl]); // Only run when URL is set/changed

  // 3. Save to Local Storage on Change
  useEffect(() => {
    localStorage.setItem(DB_KEY_EMPLOYEES, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem(DB_KEY_SETTINGS, JSON.stringify(companySettings));
  }, [companySettings]);

  // -- Cloud Functions --

  const syncFromCloud = async () => {
    if (!companySettings.googleSheetScriptUrl) return;
    
    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch(companySettings.googleSheetScriptUrl);
      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      if (data.status === 'success') {
         if (data.employees) setEmployees(data.employees);
         // Do not overwrite settings completely, only if needed, to preserve local URL state if logic differs
         // For now, we only sync employees from cloud to keep it simple, or sync both
         setLastSyncTime(new Date().toLocaleTimeString());
      } else {
         throw new Error('Invalid data format');
      }
    } catch (error) {
      console.error("Cloud Load Error:", error);
      setSyncError("無法從 Google Sheets 讀取資料");
    } finally {
      setIsSyncing(false);
    }
  };

  const syncToCloud = async (newEmployees: Employee[], newSettings: CompanySettings) => {
    if (!newSettings.googleSheetScriptUrl) return;

    setIsSyncing(true);
    setSyncError(null);
    
    try {
      // Google Apps Script requires text/plain to avoid CORS preflight issues
      const payload = JSON.stringify({
        employees: newEmployees,
        settings: newSettings
      });

      const response = await fetch(newSettings.googleSheetScriptUrl, {
        method: 'POST',
        body: payload,
      });

      const result = await response.json();
      if (result.status === 'success') {
        setLastSyncTime(new Date().toLocaleTimeString());
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error("Cloud Save Error:", error);
      setSyncError("無法儲存至 Google Sheets (請檢查網路或網址)");
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
      
      const laborEmp = calculateLaborInsurance(insuranceBasisSalary);
      const healthEmp = calculateHealthInsurance(insuranceBasisSalary, emp.dependents);
      const totalCustomDeductions = emp.customDeductions.reduce((s, d) => s + d.amount, 0);
      const totalDeductions = laborEmp + healthEmp + totalCustomDeductions;
      
      const laborCo = calculateLaborInsuranceEmployer(insuranceBasisSalary);
      const healthCo = calculateHealthInsuranceEmployer(insuranceBasisSalary);
      const pension = calculatePension(insuranceBasisSalary);

      const netPay = grossSalary - totalDeductions;
      const totalCompanyCost = grossSalary + laborCo + healthCo + pension;
      
      map.set(emp.id, {
        employeeId: emp.id,
        insuredSalary,
        insuredSalaryHealth,
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
  }, [employees]);

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

    // Trigger Cloud Save
    syncToCloud(newEmployees, companySettings);
  };

  const handleDelete = (id: string) => {
    const newEmployees = employees.filter(e => e.id !== id);
    setEmployees(newEmployees);
    setDeleteConfirmId(null);
    if (selectedEmployeeId === id) setSelectedEmployeeId(null);

    // Trigger Cloud Save
    syncToCloud(newEmployees, companySettings);
  };

  const handleSettingsChange = (newSettings: CompanySettings) => {
    setCompanySettings(newSettings);
    // If URL changed, maybe trigger a sync?
  };

  const inputStyle = "px-3 py-1.5 bg-white text-black border border-black rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none";

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      
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
            ) : companySettings.googleSheetScriptUrl ? (
              <Cloud size={12} className="text-emerald-500"/>
            ) : (
              <CloudOff size={12} className="text-slate-600"/>
            )}
          </div>
          {companySettings.googleSheetScriptUrl ? (
             <div className="text-slate-500">
               {syncError ? <span className="text-rose-500">{syncError}</span> : `已連線至 Google Sheets`}
               {lastSyncTime && <div className="mt-1 opacity-70">最後更新: {lastSyncTime}</div>}
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
               </p>
               <input 
                 type="text" 
                 placeholder="https://script.google.com/macros/s/..../exec" 
                 value={companySettings.googleSheetScriptUrl || ''} 
                 onChange={e => handleSettingsChange({...companySettings, googleSheetScriptUrl: e.target.value})} 
                 className={`${inputStyle} w-full font-mono text-xs mb-2`}
               />
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
              {/* Top Cards (Same as before) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="text-slate-500 text-xs font-bold uppercase mb-2">應發薪資總額</div>
                  <div className="text-2xl font-black text-slate-800">
                    ${Array.from(payrolls.values()).reduce((sum, p: CalculatedPayroll) => sum + p.grossSalary, 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                   <div className="text-slate-500 text-xs font-bold uppercase mb-2">公司負擔勞健保</div>
                   <div className="text-2xl font-black text-slate-800">
                    ${Array.from(payrolls.values()).reduce((sum, p: CalculatedPayroll) => sum + p.laborInsuranceCo + p.healthInsuranceCo, 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                     勞保 ${Array.from(payrolls.values()).reduce((sum, p: CalculatedPayroll) => sum + p.laborInsuranceCo, 0).toLocaleString()} / 
                     健保 ${Array.from(payrolls.values()).reduce((sum, p: CalculatedPayroll) => sum + p.healthInsuranceCo, 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                   <div className="text-slate-500 text-xs font-bold uppercase mb-2">公司提撥勞退 (6%)</div>
                   <div className="text-2xl font-black text-slate-800">
                    ${Array.from(payrolls.values()).reduce((sum, p: CalculatedPayroll) => sum + p.pensionCompany, 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-indigo-600 p-6 rounded-xl shadow-lg shadow-indigo-200 text-white">
                   <div className="text-indigo-200 text-xs font-bold uppercase mb-2">人事總支出成本</div>
                   <div className="text-3xl font-black">
                    ${Array.from(payrolls.values()).reduce((sum, p: CalculatedPayroll) => sum + p.totalCompanyCost, 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">全員薪資明細表 ({selectedYearMonth})</h3>
                  <button onClick={() => window.print()} className="text-sm text-slate-500 hover:text-slate-800 flex items-center">
                    <FileText size={16} className="mr-1"/> 列印報表
                  </button>
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
                        <th className="px-4 py-3 text-right font-black border-l border-slate-200 bg-indigo-50 text-indigo-700">實發金額</th>
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
                              {emp.name} <span className="text-slate-400 font-normal ml-1 text-xs">{emp.position}</span>
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
                            <td className="px-4 py-3 text-right font-mono font-black text-indigo-600 bg-indigo-50/50 border-l border-slate-100">{p.netPay.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500 border-l border-slate-100">{p.laborInsuranceCo.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">{p.healthInsuranceCo.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">{p.pensionCompany.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 border-l border-slate-100">{p.totalCompanyCost.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
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
                    <button 
                      onClick={() => { setSelectedEmployeeId(null); setIsEditing(true); }}
                      className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md font-bold"
                    >
                      <PlusCircle size={20} className="mr-2" />
                      新增員工
                    </button>
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
                               </div>
                               <div className="text-right">
                                  <div className="text-xs text-slate-400 uppercase">實發金額</div>
                                  <div className="text-xl font-black text-indigo-600 font-mono">${p.netPay.toLocaleString()}</div>
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
