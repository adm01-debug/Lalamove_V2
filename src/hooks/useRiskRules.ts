import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RiskRule {
  id: string;
  name: string;
  description: string | null;
  condition: {
    field: string;
    operator: string;
    value: number;
  };
  score_impact: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface RiskRuleInput {
  name: string;
  description?: string;
  condition: {
    field: string;
    operator: string;
    value: number;
  };
  score_impact: number;
  is_active?: boolean;
}

async function fetchRiskRules(): Promise<RiskRule[]> {
  const { data, error } = await supabase
    .from('risk_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map(rule => ({
    ...rule,
    condition: rule.condition as RiskRule['condition']
  }));
}

async function createRiskRule(input: RiskRuleInput): Promise<RiskRule> {
  const { data, error } = await supabase
    .from('risk_rules')
    .insert({
      name: input.name,
      description: input.description || null,
      condition: input.condition,
      score_impact: input.score_impact,
      is_active: input.is_active ?? true
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, condition: data.condition as RiskRule['condition'] };
}

async function updateRiskRule(id: string, input: Partial<RiskRuleInput>): Promise<RiskRule> {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.condition !== undefined) updateData.condition = input.condition;
  if (input.score_impact !== undefined) updateData.score_impact = input.score_impact;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;

  const { data, error } = await supabase
    .from('risk_rules')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { ...data, condition: data.condition as RiskRule['condition'] };
}

async function deleteRiskRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('risk_rules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function useRiskRules() {
  return useQuery({
    queryKey: ['risk-rules'],
    queryFn: fetchRiskRules,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useCreateRiskRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createRiskRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-rules'] });
    },
  });
}

export function useUpdateRiskRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RiskRuleInput> }) => 
      updateRiskRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-rules'] });
    },
  });
}

export function useDeleteRiskRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteRiskRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-rules'] });
    },
  });
}
