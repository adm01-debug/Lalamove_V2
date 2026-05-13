import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type IncidentType = Database['public']['Enums']['incident_type'];
type IncidentSeverity = Database['public']['Enums']['incident_severity'];

export interface Incident {
  id: string;
  driverId: string;
  driverName?: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  orderId: string | null;
  reportedBy: string | null;
  evidenceUrls: string[] | null;
  resolved: boolean;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  createdAt: Date;
}

export interface CreateIncidentInput {
  driver_id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  order_id?: string;
  reported_by?: string;
  evidence_urls?: string[];
}

export interface UpdateIncidentInput {
  type?: IncidentType;
  severity?: IncidentSeverity;
  description?: string;
  resolved?: boolean;
  resolution_notes?: string;
}

async function fetchIncidents(): Promise<Incident[]> {
  const { data, error } = await supabase
    .from('driver_incidents')
    .select(`
      *,
      drivers (name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching incidents:', error);
    throw error;
  }

  return (data || []).map((inc): Incident => ({
    id: inc.id,
    driverId: inc.driver_id,
    driverName: (inc.drivers as { name: string } | null)?.name || 'Desconhecido',
    type: inc.type,
    severity: inc.severity,
    description: inc.description,
    orderId: inc.order_id,
    reportedBy: inc.reported_by,
    evidenceUrls: inc.evidence_urls,
    resolved: inc.resolved ?? false,
    resolvedAt: inc.resolved_at ? new Date(inc.resolved_at) : null,
    resolutionNotes: inc.resolution_notes,
    createdAt: new Date(inc.created_at),
  }));
}

async function fetchIncidentsByDriver(driverId: string): Promise<Incident[]> {
  const { data, error } = await supabase
    .from('driver_incidents')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching driver incidents:', error);
    throw error;
  }

  return (data || []).map((inc): Incident => ({
    id: inc.id,
    driverId: inc.driver_id,
    type: inc.type,
    severity: inc.severity,
    description: inc.description,
    orderId: inc.order_id,
    reportedBy: inc.reported_by,
    evidenceUrls: inc.evidence_urls,
    resolved: inc.resolved ?? false,
    resolvedAt: inc.resolved_at ? new Date(inc.resolved_at) : null,
    resolutionNotes: inc.resolution_notes,
    createdAt: new Date(inc.created_at),
  }));
}

async function createIncident(input: CreateIncidentInput): Promise<Incident> {
  const { data, error } = await supabase
    .from('driver_incidents')
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error('Error creating incident:', error);
    throw error;
  }

  // Recalculate driver risk score
  await recalculateDriverRiskScore(input.driver_id);

  return {
    id: data.id,
    driverId: data.driver_id,
    type: data.type,
    severity: data.severity,
    description: data.description,
    orderId: data.order_id,
    reportedBy: data.reported_by,
    evidenceUrls: data.evidence_urls,
    resolved: data.resolved ?? false,
    resolvedAt: data.resolved_at ? new Date(data.resolved_at) : null,
    resolutionNotes: data.resolution_notes,
    createdAt: new Date(data.created_at),
  };
}

async function updateIncident(id: string, input: UpdateIncidentInput): Promise<void> {
  const updateData: Record<string, unknown> = { ...input };
  
  if (input.resolved) {
    updateData.resolved_at = new Date().toISOString();
  }

  const { data: incident, error } = await supabase
    .from('driver_incidents')
    .update(updateData)
    .eq('id', id)
    .select('driver_id')
    .single();

  if (error) {
    console.error('Error updating incident:', error);
    throw error;
  }

  // Recalculate driver risk score
  if (incident) {
    await recalculateDriverRiskScore(incident.driver_id);
  }
}

async function deleteIncident(id: string): Promise<void> {
  // First get the driver_id
  const { data: incident } = await supabase
    .from('driver_incidents')
    .select('driver_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('driver_incidents')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting incident:', error);
    throw error;
  }

  // Recalculate driver risk score
  if (incident) {
    await recalculateDriverRiskScore(incident.driver_id);
  }
}

async function resolveIncident(id: string, notes: string): Promise<void> {
  const { data: incident, error } = await supabase
    .from('driver_incidents')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes,
    })
    .eq('id', id)
    .select('driver_id')
    .single();

  if (error) {
    console.error('Error resolving incident:', error);
    throw error;
  }

  // Recalculate driver risk score
  if (incident) {
    await recalculateDriverRiskScore(incident.driver_id);
  }
}

async function recalculateDriverRiskScore(driverId: string): Promise<void> {

  // Get unresolved incidents
  const { data: incidents, error: incError } = await supabase
    .from('driver_incidents')
    .select('severity')
    .eq('driver_id', driverId)
    .eq('resolved', false);

  if (incError) {
    console.error('Error fetching incidents for recalc:', incError);
    return;
  }

  // Calculate score impact based on severity
  const severityScores: Record<IncidentSeverity, number> = {
    LOW: 0.5,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3,
  };

  let incidentImpact = 0;
  for (const inc of (incidents || [])) {
    incidentImpact += severityScores[inc.severity] || 1;
  }

  // Get current driver
  const { data: driver } = await supabase
    .from('drivers')
    .select('total_deliveries, completed_deliveries, rating')
    .eq('id', driverId)
    .single();

  if (!driver) return;

  // Base score calculation
  let baseScore = 5; // Start at medium

  // Adjust for experience
  if (driver.total_deliveries === 0) {
    baseScore += 2;
  } else if (driver.total_deliveries < 10) {
    baseScore += 1;
  } else if (driver.total_deliveries > 100) {
    baseScore -= 1;
  }

  // Adjust for success rate
  const successRate = driver.total_deliveries > 0
    ? (driver.completed_deliveries / driver.total_deliveries) * 100
    : 100;
  
  if (successRate < 85) {
    baseScore += 2;
  } else if (successRate < 95) {
    baseScore += 1;
  } else if (successRate >= 99) {
    baseScore -= 1;
  }

  // Adjust for rating
  if (driver.rating < 3) {
    baseScore += 2;
  } else if (driver.rating < 4) {
    baseScore += 1;
  } else if (driver.rating >= 4.8) {
    baseScore -= 1;
  }

  // Add incident impact
  const finalScore = Math.max(0, Math.min(10, baseScore + incidentImpact));

  // Determine risk level
  let riskLevel: string;
  if (finalScore < 3) riskLevel = 'LOW';
  else if (finalScore < 5) riskLevel = 'MEDIUM';
  else if (finalScore < 8) riskLevel = 'HIGH';
  else riskLevel = 'CRITICAL';

  // Update driver
  await supabase
    .from('drivers')
    .update({
      risk_score: finalScore,
      risk_level: riskLevel,
      last_evaluated_at: new Date().toISOString(),
    })
    .eq('id', driverId);
}

// Hooks
export function useIncidents() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    staleTime: 30000,
  });
}

export function useDriverIncidents(driverId: string) {
  return useQuery({
    queryKey: ['incidents', 'driver', driverId],
    queryFn: () => fetchIncidentsByDriver(driverId),
    enabled: !!driverId,
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createIncident,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Incidente registrado com sucesso.');
    },
    onError: (error) => {
      console.error('Error creating incident:', error);
      toast.error('Falha ao registrar incidente.');
    },
  });
}

export function useUpdateIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIncidentInput }) =>
      updateIncident(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Incidente atualizado com sucesso.');
    },
    onError: (error) => {
      console.error('Error updating incident:', error);
      toast.error('Falha ao atualizar incidente.');
    },
  });
}

export function useDeleteIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteIncident,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Incidente excluído com sucesso.');
    },
    onError: (error) => {
      console.error('Error deleting incident:', error);
      toast.error('Falha ao excluir incidente.');
    },
  });
}

export function useResolveIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      resolveIncident(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Incidente resolvido com sucesso.');
    },
    onError: (error) => {
      console.error('Error resolving incident:', error);
      toast.error('Falha ao resolver incidente.');
    },
  });
}
