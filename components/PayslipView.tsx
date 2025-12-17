import React from 'react';
import { Employee, CalculatedPayroll, CompanySettings } from '../types';
import { Printer, Calendar, Download } from 'lucide-react';

interface Props {
  employee: Employee;
  payroll: CalculatedPayroll;
  companySettings: CompanySettings;
  selectedYearMonth: string; // "YYYY-MM"
}

export const PayslipView: React.FC<Props> = ({ employee, payroll, companySettings, selectedYearMonth }) => {
  // Format Date from "2024-03" to "2024年 03月"
  const [year, month] = selectedYearMonth.split('-');
  const displayDate = `${year}年 ${month}月`;

  // Calculate Regular Salary for display
  const regularSalary = employee.baseSalary + employee.mealAllowance + employee.fuelAllowance + employee.attendanceBonus;
  // Calculate hourly rate for display
  const hourlyRate = Math.round(regularSalary / 240);
  
  // Construct Overtime Formula Strings
  const otFormulas = [];
  
  if (employee.otHoursWeekday > 0) {
      const f = Math.min(employee.otHoursWeekday, 2);
      const r = Math.max(0, employee.otHoursWeekday - 2);
      let str = `平${employee.otHoursWeekday}h`;
      if (r > 0) str += `(${f}×4/3 + ${r}×5/3)`;
      else str += `(${f}×4/3)`;
      otFormulas.push(str);
  }

  if (employee.otHoursRestDay > 0) {
      const f = Math.min(employee.otHoursRestDay, 2);
      const r = Math.max(0, employee.otHoursRestDay - 2);
      let str = `休${employee.otHoursRestDay}h`;
      if (r > 0) str += `(${f}×4/3 + ${r}×5/3)`;
      else str += `(${f}×4/3)`;
      otFormulas.push(str);
  }
  
  if (employee.otHoursHoliday > 0) {
     if (employee.otHoursHoliday <= 8) {
         otFormulas.push(`假${employee.otHoursHoliday}h(加發一日)`);
     } else {
         const extra = employee.otHoursHoliday - 8;
         otFormulas.push(`假${employee.otHoursHoliday}h(加發一日+${extra}h×4/3)`);
     }
  }
  
  const otDetails = otFormulas.length > 0 ? `時薪$${hourlyRate} × [${otFormulas.join(' + ')}]` : '';

  const handleExportCSV = () => {
    let csv = '\uFEFF'; // BOM
    csv += `公司名稱:,${companySettings.name}\n`;
    csv += `薪資月份:,${displayDate}\n`;
    csv += `員工姓名:,${employee.name},部門/職位:,${employee.department}/${employee.position}\n`;
    csv += `----------------\n`;
    csv += `[應發項目],金額\n`;
    csv += `本俸,${employee.baseSalary}\n`;
    if(employee.mealAllowance) csv += `伙食津貼,${employee.mealAllowance}\n`;
    if(employee.fuelAllowance) csv += `油資津貼,${employee.fuelAllowance}\n`;
    if(employee.attendanceBonus) csv += `全勤獎金,${employee.attendanceBonus}\n`;
    employee.customAllowances.forEach(a => {
        csv += `${a.name},${a.amount}\n`;
    });
    if(payroll.overtimePay > 0) csv += `加班費,${payroll.overtimePay}\n`;
    csv += `應發小計,${payroll.grossSalary}\n`;
    csv += `----------------\n`;
    csv += `[應扣項目],金額\n`;
    csv += `勞保費,${payroll.laborInsuranceEmp}\n`;
    csv += `健保費,${payroll.healthInsuranceEmp}\n`;
    employee.customDeductions.forEach(d => {
        csv += `${d.name},${d.amount}\n`;
    });
    csv += `應扣小計,${payroll.totalDeductions}\n`;
    csv += `----------------\n`;
    csv += `實發金額,${payroll.netPay}\n`;
    csv += `\n`;
    csv += `銀行帳號:,${employee.bankName} ${employee.bankAccount}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${employee.name}_${selectedYearMonth}_薪資單.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 no-print">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
          <Calendar className="mr-2 text-indigo-600" />
          薪資明細單
        </h2>
        <div className="flex gap-2">
            <button
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
            <Download size={18} className="mr-2" />
            匯出 CSV
            </button>
            <button
            onClick={() => window.print()}
            className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"
            >
            <Printer size={18} className="mr-2" />
            列印
            </button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="bg-white p-10 rounded-xl shadow-lg border border-slate-200 print:shadow-none print:border-none print:p-0">
        
        {/* Header */}
        <div className="border-b-4 border-slate-800 pb-6 mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-black text-slate-900 mb-2">{companySettings.name}</h1>
            <p className="text-slate-500">{companySettings.address}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">薪資月份</div>
            <div className="text-2xl font-bold text-indigo-600">{displayDate}</div>
          </div>
        </div>

        {/* Employee Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 p-6 bg-slate-50 rounded-lg border border-slate-100 print:bg-white print:border-slate-300">
          <div>
            <span className="block text-xs uppercase text-slate-400 font-bold mb-1">員工姓名</span>
            <span className="text-lg font-bold text-slate-900">{employee.name}</span>
          </div>
          <div>
            <span className="block text-xs uppercase text-slate-400 font-bold mb-1">部門 / 職位</span>
            <span className="text-base font-medium text-slate-800">{employee.department || '-'} / {employee.position || '-'}</span>
          </div>
          <div className="col-span-2">
             <span className="block text-xs uppercase text-slate-400 font-bold mb-1">銀行匯款資訊</span>
             <span className="text-base font-medium text-slate-800">
               {employee.bankName ? `${employee.bankName}` : '未設定'}
               {employee.bankAccount ? ` - ${employee.bankAccount}` : ''}
             </span>
          </div>
        </div>

        {/* Salary Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          
          {/* Earnings Column */}
          <div>
            <h3 className="text-xl font-black text-emerald-800 mb-4 border-b-2 border-emerald-100 pb-2">應發項目</h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr className="group">
                  <td className="py-3 text-slate-600">基本底薪</td>
                  <td className="py-3 text-right font-mono font-medium">{employee.baseSalary.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-3 text-slate-600">伙食津貼</td>
                  <td className="py-3 text-right font-mono font-medium">{employee.mealAllowance.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-3 text-slate-600">油資津貼</td>
                  <td className="py-3 text-right font-mono font-medium">{employee.fuelAllowance.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-3 text-slate-600">全勤獎金</td>
                  <td className="py-3 text-right font-mono font-medium">{employee.attendanceBonus.toLocaleString()}</td>
                </tr>
                
                {/* Overtime */}
                {(payroll.overtimePay > 0) && (
                   <tr className="bg-orange-50 print:bg-transparent">
                    <td className="py-3 pl-2 text-orange-800 font-bold">
                        加班費
                        <div className="text-xs font-normal text-orange-600 mt-1 font-mono">
                           {otDetails}
                        </div>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-orange-700">{payroll.overtimePay.toLocaleString()}</td>
                  </tr>
                )}

                {/* Custom Allowances */}
                {employee.customAllowances.map(a => (
                  <tr key={a.id}>
                    <td className="py-3 text-slate-600">{a.name}</td>
                    <td className="py-3 text-right font-mono font-medium">{a.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-4 font-bold text-slate-800 text-lg">應發小計</td>
                  <td className="pt-4 text-right font-bold text-lg font-mono text-emerald-600">{payroll.grossSalary.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deductions Column */}
          <div>
            <h3 className="text-xl font-black text-rose-800 mb-4 border-b-2 border-rose-100 pb-2">應扣項目</h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 text-slate-600">勞保費</td>
                  <td className="py-3 text-right font-mono font-medium text-rose-600">-{payroll.laborInsuranceEmp.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-3 text-slate-600">健保費</td>
                  <td className="py-3 text-right font-mono font-medium text-rose-600">-{payroll.healthInsuranceEmp.toLocaleString()}</td>
                </tr>
                
                {/* Custom Deductions */}
                {employee.customDeductions.map(d => (
                  <tr key={d.id}>
                    <td className="py-3 text-slate-600">{d.name}</td>
                    <td className="py-3 text-right font-mono font-medium text-rose-600">-{d.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-4 font-bold text-slate-800 text-lg">應扣小計</td>
                  <td className="pt-4 text-right font-bold text-lg font-mono text-rose-600">-{payroll.totalDeductions.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Net Pay */}
        <div className="mt-10 bg-slate-900 text-white p-8 rounded-xl flex flex-col md:flex-row justify-between items-center print:bg-white print:border-t-4 print:border-slate-900 print:text-black">
          <div className="mb-4 md:mb-0">
             <div className="text-slate-400 text-sm mb-1 print:text-slate-500">公司提撥 (僅供參考)</div>
             <div className="text-sm font-mono">
                勞退:{payroll.pensionCompany.toLocaleString()}
             </div>
          </div>
          <div className="text-center md:text-right">
            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1 print:text-slate-600">實發金額</div>
            <div className="text-5xl font-black tracking-tight">
              <span className="text-2xl align-top mr-1">NT$</span>
              {payroll.netPay.toLocaleString()}
            </div>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-slate-100 flex justify-between text-xs text-slate-400 print:text-slate-500">
            <div>確認無誤後請簽名：________________________</div>
            <div>Generated by {companySettings.name} Payroll System</div>
        </div>

      </div>
    </div>
  );
};