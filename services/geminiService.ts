import { GoogleGenAI } from "@google/genai";
import { Employee, CalculatedPayroll } from "../types";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const askPayrollAssistant = async (
  question: string,
  currentEmployee?: Employee,
  payrollData?: CalculatedPayroll
): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "請先設定 Gemini API Key (API Key missing).";

  const modelId = "gemini-2.5-flash"; // Good for fast text reasoning

  let context = "你是一個專業的台灣人資顧問 (HR Consultant)。請根據台灣的《勞動基準法》以及相關勞健保規定回答問題。";
  
  if (currentEmployee && payrollData) {
    context += `
      目前正在查看的員工資料如下：
      姓名: ${currentEmployee.name}
      職位: ${currentEmployee.position}
      底薪: ${currentEmployee.baseSalary}
      加給/津貼: ${currentEmployee.customAllowances.map(a => a.name + ": " + a.amount).join(', ')}
      扶養親屬: ${currentEmployee.dependents} 人
      
      本月薪資試算結果:
      勞保投保薪資: ${payrollData.insuredSalary}
      健保投保薪資: ${payrollData.insuredSalaryHealth}
      勞保自付額: ${payrollData.laborInsuranceEmp}
      健保自付額: ${payrollData.healthInsuranceEmp}
      實發金額 (Net Pay): ${payrollData.netPay}
    `;
  }

  const prompt = `
    ${context}
    
    使用者問題: "${question}"
    
    請用繁體中文回答，語氣專業且友善。如果是關於計算的問題，請解釋計算邏輯。
    如果涉及法規，請簡單引用相關概念。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "抱歉，我目前無法回答這個問題。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "發生錯誤，請稍後再試。";
  }
};