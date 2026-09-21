import { apiClient } from './client'
import type { FeeInputs } from '@/utils/feeCalculator'
export interface FeeScenario { month: string; inputs: FeeInputs; updated_at: string; updated_by?: string }
export interface FeeSource { source_url: string; captured_at: string; updated_at?: string; sheets: {name:string;gid:string;cells:{cell:string;value?:string|number|boolean|null;formula?:string|null}[]}[] }
const base='/api/v1/admin/fee-calculator'
export const feeCalculatorAPI={
  context:()=>apiClient.get<{total:number;by_grade:Record<string,number>;as_of:string}>(`${base}/context`).then(r=>r.data),
  scenarios:()=>apiClient.get<FeeScenario[]>(`${base}/scenarios`).then(r=>r.data),
  save:(month:string,inputs:FeeInputs,expected_updated_at:string|null)=>apiClient.put<FeeScenario>(`${base}/scenarios/${month}`,{inputs,expected_updated_at}).then(r=>r.data),
  source:()=>apiClient.get<FeeSource|null>(`${base}/source`).then(r=>r.data),
}
