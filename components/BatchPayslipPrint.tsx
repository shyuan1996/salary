import React from 'react';
import { Employee, CalculatedPayroll, CompanySettings } from '../types';

interface Props {
  employees: Employee[];
  payrolls: Map<string, CalculatedPayroll>;
  companySettings: CompanySettings;
  selectedYearMonth: string;
}

export const BatchPayslipPrint: React.FC<Props> = ({ employees, payrolls, companySettings, selectedYearMonth }) => {
  const [year, month] = selectedYearMonth.split('-');
  const displayDate = `${year}年 ${month}月`;

  const getFontSizeClass = (itemCount: number) => {
    if (itemCount > 10) return 'text-[8px] leading-tight';
    if (itemCount > 6) return 'text-[9px] leading-tight';
    return 'text-[10px] leading-normal';
  };

  return (
    <div className="print-container">
      <style>{`
        /* Global Table Styles (Applied to both Screen and Print) */
        .mini-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
        .mini-table th { text-align: left; padding: 1px 0; color: #64748b; font-weight: bold; border-bottom: 1px solid #e2e8f0; }
        .mini-table td { padding: 1px 0; border-bottom: 1px dashed #f1f5f9; vertical-align: bottom; }
        .mini-table td:first-child { text-align: left; }
        /* Force right alignment for the last column (numbers) */
        .mini-table td:last-child { text-align: right !important; font-family: monospace; }

        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; background-color: white; }
          .print-container { width: 210mm; min-height: 297mm; background: white; font-family: sans-serif; }
          
          /* 2x2 Grid Layout */
          .page-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            height: 297mm;
            page-break-after: always;
            box-sizing: border-box;
          }

          .payslip-cell {
            padding: 5mm 8mm; /* Tighter top/bottom padding, decent side padding */
            border-right: 1px dashed #94a3b8;
            border-bottom: 1px dashed #94a3b8;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            height: 148.5mm; /* Half of A4 height */
            box-sizing: border-box;
            overflow: hidden; /* Prevent overflow */
          }
          
          /* Remove borders for edges */
          .payslip-cell:nth-child(2n) { border-right: none; }
          .payslip-cell:nth-child(n+3) { border-bottom: none; }
        }

        /* Screen Preview Styles */
        @media screen {
            .print-container { 
                width: 210mm; 
                margin: 20px auto; 
                background: white; 
                box-shadow: 0 0 15px rgba(0,0,0,0.1); 
            }
            .page-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: 148.5mm 148.5mm;
                border-bottom: 4px solid #334155;
                margin-bottom: 20px;
            }
            .payslip-cell {
                height: 148.5mm;
                padding: 8mm; /* Screen padding */
                border: 1px dashed #cbd5e1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background-color: white;
            }
        }
      `}</style>

      {/* Chunk employees into groups of 4 for pagination */}
      {Array.from({ length: Math.ceil(employees.length / 4) }).map((_, pageIndex) => {
        const pageEmployees = employees.slice(pageIndex * 4, (pageIndex + 1) * 4);
        
        return (
          <div key={pageIndex} className="page-grid">
            {pageEmployees.map(emp => {
               const p = payrolls.get(emp.id);
               if(!p) return <div key={emp.id} className="payslip-cell" />;

               const earningsCount = 4 + emp.customAllowances.length + (p.overtimePay > 0 ? 1 : 0);
               const deductionsCount = 2 + emp.customDeductions.length;
               const totalItems = Math.max(earningsCount, deductionsCount);
               const fontClass = getFontSizeClass(totalItems);

               return (
                 <div key={emp.id} className="payslip-cell">
                    {/* Header */}
                    <div className="border-b-2 border-slate-800 pb-2 mb-2 flex-shrink-0">
                       <h1 className="text-lg font-black text-slate-800 tracking-wide leading-none">{companySettings.name}</h1>
                       <div className="flex justify-between items-end mt-1">
                          <div className="text-xs text-slate-600">
                             <div className="text-xl font-bold text-slate-900 leading-tight">{emp.name}</div>
                             <div className="text-[10px] leading-tight">
                               {emp.department} {emp.position}
                             </div>
                             {emp.note && <div className="text-[9px] text-slate-500 leading-tight">({emp.note})</div>}
                          </div>
                          <div className="text-right">
                             <div className="text-[9px] font-bold text-slate-400 uppercase leading-none">薪資月份</div>
                             <div className="text-base font-bold text-indigo-700 leading-tight">{displayDate}</div>
                          </div>
                       </div>
                    </div>

                    {/* Body */}
                    <div className={`flex-1 grid grid-cols-2 gap-4 items-start ${fontClass}`}>
                       {/* Earnings */}
                       <div className="border-r border-slate-200 pr-2 h-full">
                          <h3 className="text-[10px] font-bold text-emerald-800 mb-0.5 border-b border-emerald-100">應發項目</h3>
                          <table className="mini-table">
                             <tbody>
                                <tr><td>本俸</td><td>{emp.baseSalary.toLocaleString()}</td></tr>
                                {emp.mealAllowance > 0 && <tr><td>伙食津貼</td><td>{emp.mealAllowance.toLocaleString()}</td></tr>}
                                {emp.fuelAllowance > 0 && <tr><td>油資津貼</td><td>{emp.fuelAllowance.toLocaleString()}</td></tr>}
                                {emp.attendanceBonus > 0 && <tr><td>全勤獎金</td><td>{emp.attendanceBonus.toLocaleString()}</td></tr>}
                                {emp.customAllowances.map(a => (
                                   <tr key={a.id} className="text-emerald-700"><td>{a.name}</td><td>{a.amount.toLocaleString()}</td></tr>
                                ))}
                                {p.overtimePay > 0 && (
                                   <tr className="text-orange-700 font-bold"><td>加班費</td><td>{p.overtimePay.toLocaleString()}</td></tr>
                                )}
                             </tbody>
                          </table>
                       </div>

                       {/* Deductions */}
                       <div className="h-full">
                          <h3 className="text-[10px] font-bold text-rose-800 mb-0.5 border-b border-rose-100">應扣項目</h3>
                          <table className="mini-table">
                             <tbody>
                                <tr><td>勞保費(自)</td><td className="text-rose-600">-{p.laborInsuranceEmp.toLocaleString()}</td></tr>
                                <tr><td>健保費(自)</td><td className="text-rose-600">-{p.healthInsuranceEmp.toLocaleString()}</td></tr>
                                {emp.customDeductions.map(d => (
                                   <tr key={d.id} className="text-rose-600"><td>{d.name}</td><td>-{d.amount.toLocaleString()}</td></tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    </div>

                    {/* Footer Area */}
                    <div className="mt-auto flex-shrink-0">
                        {/* Summary Row - Increased Font Size */}
                        <div className="grid grid-cols-2 gap-4 text-sm font-bold border-t border-slate-200 pt-1 mb-2">
                           <div className="flex justify-between pr-2">
                              <span>應發合計</span>
                              <span>{p.grossSalary.toLocaleString()}</span>
                           </div>
                           <div className="flex justify-between text-rose-600">
                              <span>應扣合計</span>
                              <span>-{p.totalDeductions.toLocaleString()}</span>
                           </div>
                        </div>

                        {/* Net Pay Card */}
                        <div className="bg-slate-100 px-3 py-2 rounded flex justify-between items-end border border-slate-200">
                           <div className="text-[9px] text-slate-500 font-medium leading-tight">
                              <div>{emp.bankName}</div>
                              <div>{emp.bankAccount}</div>
                              <div className="text-slate-400 mt-0.5">提繳勞退: ${p.pensionCompany.toLocaleString()}</div>
                           </div>
                           <div className="text-right">
                              <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider leading-none">實發金額</div>
                              <div className="text-2xl font-black text-slate-900 leading-none mt-0.5">
                                 <span className="text-xs align-top mr-0.5 font-bold text-slate-500">$</span>{p.netPay.toLocaleString()}
                              </div>
                           </div>
                        </div>
                        
                        <div className="text-[9px] text-slate-400 mt-2 pt-2 border-t border-dashed border-slate-300 flex justify-between items-end">
                           <span>{new Date().toLocaleDateString()}</span>
                           <span className="text-[10px] text-slate-600 font-bold">員工簽名: ______________________</span>
                        </div>
                    </div>
                 </div>
               );
            })}
            
            {/* Fill empty cells to maintain grid structure on last page */}
            {Array.from({ length: 4 - pageEmployees.length }).map((_, i) => (
                <div key={`empty-${i}`} className="payslip-cell border-none" />
            ))}
          </div>
        );
      })}
    </div>
  );
};