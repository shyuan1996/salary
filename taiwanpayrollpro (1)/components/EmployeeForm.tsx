import React, { useState, useEffect } from 'react';
import { Employee, Allowance, Deduction } from '../types';
import { Plus, Trash2, Save, X, Calculator, Info, AlertTriangle, Table2 } from 'lucide-react';
import { 
  calculateOvertimePay, 
  LABOR_BRACKETS, 
  HEALTH_BRACKETS, 
  LABOR_INSURANCE_RATE,
  LABOR_EMPLOYEE_SHARE,
  LABOR_EMPLOYER_SHARE,
  HEALTH_INSURANCE_RATE,
  HEALTH_EMPLOYEE_SHARE,
  HEALTH_EMPLOYER_SHARE,
  AVG_DEPENDENTS_EMPLOYER
} from '../utils/taiwanLaborRules';

interface Props {
  initialData?: Employee;
  onSave: (employee: Employee) => void;
  onCancel: () => void;
}

export const EmployeeForm: React.FC<Props> = ({ initialData, onSave, onCancel }) => {
  // Basic Info
  const [name, setName] = useState(initialData?.name || '');
  const [department, setDepartment] = useState(initialData?.department || '');
  const [position, setPosition] = useState(initialData?.position || '');
  const [joinDate, setJoinDate] = useState(initialData?.joinDate || new Date().toISOString().split('T')[0]);
  const [dependents, setDependents] = useState(initialData?.dependents.toString() || '0');
  
  // Bank Info
  const [bankName, setBankName] = useState(initialData?.bankName || '');
  const [bankAccount, setBankAccount] = useState(initialData?.bankAccount || '');

  // Fixed Salary Components
  const [baseSalary, setBaseSalary] = useState(initialData?.baseSalary.toString() || '30000');
  const [mealAllowance, setMealAllowance] = useState(initialData?.mealAllowance.toString() || '3000');
  const [fuelAllowance, setFuelAllowance] = useState(initialData?.fuelAllowance.toString() || '0');
  const [attendanceBonus, setAttendanceBonus] = useState(initialData?.attendanceBonus.toString() || '0');
  
  // Insurance Setting
  const [useBaseSalaryForInsurance, setUseBaseSalaryForInsurance] = useState(initialData?.useBaseSalaryForInsurance || false);
  const [showInsuranceTable, setShowInsuranceTable] = useState(false);

  // Overtime Inputs (Total Hours)
  const [otWeekday, setOtWeekday] = useState(initialData?.otHoursWeekday.toString() || '0');
  const [otRestDay, setOtRestDay] = useState(initialData?.otHoursRestDay.toString() || '0');
  const [otHoliday, setOtHoliday] = useState(initialData?.otHoursHoliday.toString() || '0');

  // Custom Lists
  const [customAllowances, setCustomAllowances] = useState<Allowance[]>(initialData?.customAllowances || []);
  const [customDeductions, setCustomDeductions] = useState<Deduction[]>(initialData?.customDeductions || []);

  // Calculated Preview
  const [previewOT, setPreviewOT] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [regularSalary, setRegularSalary] = useState(0);

  useEffect(() => {
    const base = parseInt(baseSalary) || 0;
    const meal = parseInt(mealAllowance) || 0;
    const fuel = parseInt(fuelAllowance) || 0;
    const bonus = parseInt(attendanceBonus) || 0;
    
    const totalRegular = base + meal + fuel + bonus;
    setRegularSalary(totalRegular);

    const rate = totalRegular / 240; // Precise rate
    setHourlyRate(rate);

    const wd = parseFloat(otWeekday) || 0;
    const rd = parseFloat(otRestDay) || 0;
    const hd = parseFloat(otHoliday) || 0;
    
    setPreviewOT(calculateOvertimePay(totalRegular, wd, rd, hd));
  }, [baseSalary, mealAllowance, fuelAllowance, attendanceBonus, otWeekday, otRestDay, otHoliday]);

  // List Handlers
  const addAllowance = () => setCustomAllowances([...customAllowances, { id: Date.now().toString(), name: '', amount: 0 }]);
  const updateAllowance = (id: string, field: keyof Allowance, value: any) => setCustomAllowances(customAllowances.map(a => a.id === id ? { ...a, [field]: value } : a));
  const removeAllowance = (id: string) => setCustomAllowances(customAllowances.filter(a => a.id !== id));
  
  const addDeduction = () => setCustomDeductions([...customDeductions, { id: Date.now().toString(), name: '', amount: 0 }]);
  const updateDeduction = (id: string, field: keyof Deduction, value: any) => setCustomDeductions(customDeductions.map(d => d.id === id ? { ...d, [field]: value } : d));
  const removeDeduction = (id: string) => setCustomDeductions(customDeductions.filter(d => d.id !== id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEmployee: Employee = {
      id: initialData?.id || Date.now().toString(),
      name,
      position,
      department,
      joinDate,
      bankName,
      bankAccount,
      dependents: parseInt(dependents) || 0,
      baseSalary: parseInt(baseSalary) || 0,
      mealAllowance: parseInt(mealAllowance) || 0,
      fuelAllowance: parseInt(fuelAllowance) || 0,
      attendanceBonus: parseInt(attendanceBonus) || 0,
      useBaseSalaryForInsurance,
      otHoursWeekday: parseFloat(otWeekday) || 0,
      otHoursRestDay: parseFloat(otRestDay) || 0,
      otHoursHoliday: parseFloat(otHoliday) || 0,
      customAllowances: customAllowances.filter(a => a.name && a.amount),
      customDeductions: customDeductions.filter(d => d.name && d.amount),
    };
    onSave(newEmployee);
  };

  const inputStyle = "w-full px-4 py-2 bg-white text-black border border-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition placeholder-gray-500";
  const sectionTitle = "text-lg font-bold text-slate-800 border-l-4 border-indigo-500 pl-3 mb-4";

  // Helper to generate hour options
  const generateHourOptions = (maxHours: number) => {
    const options = [];
    for (let i = 0; i <= maxHours; i += 0.5) {
      options.push(i);
    }
    return options;
  };

  // Detailed breakdown component
  const DetailedBreakdown = () => {
    const wd = parseFloat(otWeekday) || 0;
    const rd = parseFloat(otRestDay) || 0;
    const hd = parseFloat(otHoliday) || 0;

    // Fix: JSX namespace might not be available, use React.ReactNode instead
    let lines: React.ReactNode[] = [];
    let subtotal = 0;

    // Hourly Rate
    lines.push(
      <div key="rate" className="text-slate-600 mb-1">
        時薪 = {regularSalary} / 240 = <span className="font-mono font-bold text-slate-800">{hourlyRate.toFixed(4)}...</span>
      </div>
    );

    // Weekday
    if (wd > 0) {
      const f = Math.min(wd, 2);
      const r = Math.max(0, wd - 2);
      const sum1 = hourlyRate * f * (4/3);
      const sum2 = hourlyRate * r * (5/3);
      subtotal += sum1 + sum2;
      lines.push(
        <div key="wd" className="text-slate-700 mt-2">
          <strong>平日 ({wd}h):</strong><br/>
          前2h: {hourlyRate.toFixed(2)} × {f} × 4/3 = {sum1.toFixed(3)}<br/>
          {r > 0 && <>後續: {hourlyRate.toFixed(2)} × {r} × 5/3 = {sum2.toFixed(3)}</>}
        </div>
      );
    }

    // Rest Day
    if (rd > 0) {
      const f = Math.min(rd, 2);
      const r = Math.max(0, rd - 2);
      const sum1 = hourlyRate * f * (4/3);
      const sum2 = hourlyRate * r * (5/3);
      subtotal += sum1 + sum2;
      lines.push(
        <div key="rd" className="text-slate-700 mt-2">
          <strong>休息日 ({rd}h):</strong><br/>
          前2h: {hourlyRate.toFixed(2)} × {f} × 4/3 = {sum1.toFixed(3)}<br/>
          {r > 0 && <>後續: {hourlyRate.toFixed(2)} × {r} × 5/3 = {sum2.toFixed(3)}</>}
        </div>
      );
    }

    // Holiday
    if (hd > 0) {
      let sum = 0;
      let text = "";
      if (hd <= 8) {
          sum = hourlyRate * 8;
          text = `8h (加發一日) = ${sum.toFixed(3)}`;
      } else {
          const extra = hd - 8;
          const s1 = hourlyRate * 8;
          const s2 = hourlyRate * extra * (4/3);
          sum = s1 + s2;
          text = `8h (加發一日 ${s1.toFixed(2)}) + 超時 ${extra}h × 4/3 (${s2.toFixed(2)})`;
      }
      subtotal += sum;
      lines.push(
        <div key="hd" className="text-slate-700 mt-2">
           <strong>國定假日 ({hd}h):</strong><br/>
           {text}
        </div>
      );
    }

    lines.push(
       <div key="total" className="mt-3 pt-2 border-t border-orange-200 font-bold text-orange-900">
          總計 (未捨入): {subtotal.toFixed(4)} <br/>
          最終四捨五入: {Math.round(subtotal).toLocaleString()}
       </div>
    );

    return <div className="text-xs bg-white/50 p-3 rounded mt-2 font-mono">{lines}</div>;
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 relative">
      
      {/* Insurance Table Modal */}
      {showInsuranceTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
               <h3 className="text-xl font-bold text-slate-800 flex items-center">
                 <Table2 className="mr-2"/> 勞健保負擔金額對照表
               </h3>
               <button onClick={() => setShowInsuranceTable(false)} className="p-2 hover:bg-slate-200 rounded-full"><X/></button>
            </div>
            <div className="p-6 overflow-y-auto">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Labor Insurance */}
                  <div>
                     <h4 className="font-bold text-rose-700 mb-2">勞工保險 (普通+就業)</h4>
                     <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm text-center">
                           <thead className="bg-rose-50 text-rose-900 font-bold">
                              <tr>
                                 <th className="p-2 border-b">投保薪資</th>
                                 <th className="p-2 border-b">員工負擔 (20%)</th>
                                 <th className="p-2 border-b">公司負擔 (70%)</th>
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
                     <h4 className="font-bold text-emerald-700 mb-2">全民健保</h4>
                     <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm text-center">
                           <thead className="bg-emerald-50 text-emerald-900 font-bold">
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
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {initialData ? '編輯員工資料' : '新增員工'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">請填寫完整的薪資與人事資料</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition">
          <X size={28} className="text-slate-500" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Basic Info */}
        <section>
          <h3 className={sectionTitle}>基本資料</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">員工姓名 *</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">部門</label>
              <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">職位</label>
              <input type="text" value={position} onChange={e => setPosition(e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">入職日期</label>
              <input type="date" value={joinDate} onChange={e => setJoinDate(e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">扶養親屬 (健保)</label>
              <select value={dependents} onChange={e => setDependents(e.target.value)} className={inputStyle}>
                {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} 人</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
             <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">匯款銀行</label>
                <input type="text" placeholder="例如: 中國信託 (822)" value={bankName} onChange={e => setBankName(e.target.value)} className={inputStyle} />
             </div>
             <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">匯款帳號</label>
                <input type="text" placeholder="例如: 1234-5678-9012" value={bankAccount} onChange={e => setBankAccount(e.target.value)} className={inputStyle} />
             </div>
          </div>
        </section>

        {/* Salary */}
        <section>
          <h3 className={sectionTitle}>經常性薪資 (每月固定)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">本俸 (底薪)</label>
              <input type="number" min="0" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">伙食津貼</label>
              <input type="number" min="0" value={mealAllowance} onChange={e => setMealAllowance(e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">油資津貼</label>
              <input type="number" min="0" value={fuelAllowance} onChange={e => setFuelAllowance(e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">全勤獎金</label>
              <input type="number" min="0" value={attendanceBonus} onChange={e => setAttendanceBonus(e.target.value)} className={inputStyle} />
            </div>
          </div>
          
          <div className="mt-4 flex items-center">
            <input 
              type="checkbox" 
              id="useBaseOnly" 
              checked={useBaseSalaryForInsurance} 
              onChange={e => setUseBaseSalaryForInsurance(e.target.checked)}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 mr-2 cursor-pointer"
            />
            <label htmlFor="useBaseOnly" className="text-slate-700 font-bold cursor-pointer select-none mr-4">
              勞健保計算僅使用本俸投保 (若未勾選，將使用 經常性薪資總額 投保)
            </label>
            <button 
              type="button" 
              onClick={() => setShowInsuranceTable(true)} 
              className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold hover:bg-indigo-100 transition"
            >
               <Table2 size={16}/> 查看級距表
            </button>
          </div>
        </section>

        {/* Overtime Calculator */}
        <section className="bg-orange-50 p-6 rounded-lg border border-orange-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-orange-800 flex items-center">
              <Calculator size={20} className="mr-2" /> 加班費計算 (本月)
            </h3>
            <div className="text-orange-700 font-bold bg-white px-3 py-1 rounded border border-orange-200">
              預估加班費: NT$ {previewOT.toLocaleString()}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Weekday */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">平日加班總時數</label>
              <select 
                value={otWeekday} 
                onChange={e => setOtWeekday(e.target.value)} 
                className={inputStyle}
              >
                {generateHourOptions(4).map(h => (
                  <option key={h} value={h}>{h} 小時</option>
                ))}
              </select>
            </div>

            {/* Rest Day */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">休息日加班總時數</label>
              <select 
                value={otRestDay} 
                onChange={e => setOtRestDay(e.target.value)} 
                className={inputStyle}
              >
                {generateHourOptions(12).map(h => (
                  <option key={h} value={h}>{h} 小時</option>
                ))}
              </select>
            </div>

            {/* Holiday */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                 例假/國定假日 
                 {(parseFloat(otHoliday) > 0) && (
                    <span className="ml-1 text-xs text-red-500 inline-block align-middle"><AlertTriangle size={12}/> 非必要不可加班</span>
                 )}
              </label>
              <select 
                value={otHoliday} 
                onChange={e => setOtHoliday(e.target.value)} 
                className={inputStyle}
              >
                 {generateHourOptions(12).map(h => (
                  <option key={h} value={h}>{h} 小時</option>
                ))}
              </select>
            </div>

          </div>
          
          <DetailedBreakdown />
          
        </section>

        {/* Custom Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Allowances */}
          <section>
             <div className="flex justify-between items-center mb-4">
                <h3 className={sectionTitle.replace('mb-4', 'mb-0')}>其他加給</h3>
                <button type="button" onClick={addAllowance} className="text-sm font-bold text-indigo-600 flex items-center hover:bg-indigo-50 px-2 py-1 rounded">
                   <Plus size={16} className="mr-1"/> 新增項目
                </button>
             </div>
             <div className="space-y-3">
               {customAllowances.map(item => (
                 <div key={item.id} className="flex gap-2">
                   <input type="text" placeholder="項目名稱" value={item.name} onChange={e => updateAllowance(item.id, 'name', e.target.value)} className={`${inputStyle} flex-1`} />
                   <input type="number" placeholder="金額" value={item.amount} onChange={e => updateAllowance(item.id, 'amount', parseInt(e.target.value)||0)} className={`${inputStyle} w-32`} />
                   <button type="button" onClick={() => removeAllowance(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>
                 </div>
               ))}
               {customAllowances.length === 0 && <div className="text-slate-400 text-sm italic py-2">無額外加給</div>}
             </div>
          </section>

          {/* Deductions */}
          <section>
             <div className="flex justify-between items-center mb-4">
                <h3 className={`${sectionTitle.replace('mb-4', 'mb-0')} border-rose-500`}>其他應扣</h3>
                <button type="button" onClick={addDeduction} className="text-sm font-bold text-rose-600 flex items-center hover:bg-rose-50 px-2 py-1 rounded">
                   <Plus size={16} className="mr-1"/> 新增項目
                </button>
             </div>
             <div className="space-y-3">
               {customDeductions.map(item => (
                 <div key={item.id} className="flex gap-2">
                   <input type="text" placeholder="項目名稱" value={item.name} onChange={e => updateDeduction(item.id, 'name', e.target.value)} className={`${inputStyle} flex-1`} />
                   <input type="number" placeholder="金額" value={item.amount} onChange={e => updateDeduction(item.id, 'amount', parseInt(e.target.value)||0)} className={`${inputStyle} w-32`} />
                   <button type="button" onClick={() => removeDeduction(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>
                 </div>
               ))}
               {customDeductions.length === 0 && <div className="text-slate-400 text-sm italic py-2">無額外應扣</div>}
             </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
          <button type="button" onClick={onCancel} className="px-6 py-3 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-bold">
            放棄修改
          </button>
          <button type="submit" className="px-8 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-bold shadow-lg flex items-center">
            <Save size={20} className="mr-2" /> 儲存員工資料
          </button>
        </div>

      </form>
    </div>
  );
};