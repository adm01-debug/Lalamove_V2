import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type DriverRow = Database['public']['Tables']['drivers']['Row'];
type DriverStatus = Database['public']['Enums']['driver_status'];
type VehicleType = Database['public']['Enums']['vehicle_type'];

export interface DriverWithIncidents {
  id: string;
  lalamoveId: string | null;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  vehicleType: VehicleType;
  vehiclePlate: string | null;
  riskScore: number;
  riskLevel: string | null;
  status: DriverStatus;
  totalDeliveries: number;
  completedDeliveries: number;
  rating: number;
  whitelisted: boolean;
  blacklisted: boolean;
  blacklistReason: string | null;
  notes: string | null;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  incidentCount: number;
}

async function fetchDrivers(): Promise<DriverWithIncidents[]> {
  // Fetch drivers
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false });

  if (driversError) {
    console.error('Error fetching drivers:', driversError);
    throw driversError;
  }

  // Fetch incident counts per driver
  const { data: incidentCounts, error: incidentError } = await supabase
    .from('driver_incidents')
    .select('driver_id')
    .eq('resolved', false);

  if (incidentError) {
    console.error('Error fetching incidents:', incidentError);
  }

  // Count incidents per driver
  const incidentMap = new Map<string, number>();
  (incidentCounts || []).forEach(inc => {
    const count = incidentMap.get(inc.driver_id) || 0;
    incidentMap.set(inc.driver_id, count + 1);
  });

  return (drivers || []).map((driver): DriverWithIncidents => ({
    id: driver.id,
    lalamoveId: driver.lalamove_id,
    name: driver.name,
    phone: driver.phone,
    photoUrl: driver.photo_url,
    vehicleType: driver.vehicle_type,
    vehiclePlate: driver.vehicle_plate,
    riskScore: driver.risk_score ?? 5.0,
    riskLevel: driver.risk_level,
    status: driver.status,
    totalDeliveries: driver.total_deliveries ?? 0,
    completedDeliveries: driver.completed_deliveries ?? 0,
    rating: driver.rating ?? 5.0,
    whitelisted: driver.whitelisted ?? false,
    blacklisted: driver.blacklisted ?? false,
    blacklistReason: driver.blacklist_reason,
    notes: driver.notes,
    lastActiveAt: driver.last_active_at ? new Date(driver.last_active_at) : null,
    createdAt: new Date(driver.created_at),
    updatedAt: new Date(driver.updated_at),
    incidentCount: incidentMap.get(driver.id) || 0,
  }));
}

async function fetchDriverById(id: string): Promise<DriverWithIncidents | null> {
  const { data: driver, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching driver:', error);
    throw error;
  }

  if (!driver) return null;

  const { data: incidents } = await supabase
    .from('driver_incidents')
    .select('id')
    .eq('driver_id', id)
    .eq('resolved', false);

  return {
    id: driver.id,
    lalamoveId: driver.lalamove_id,
    name: driver.name,
    phone: driver.phone,
    photoUrl: driver.photo_url,
    vehicleType: driver.vehicle_type,
    vehiclePlate: driver.vehicle_plate,
    riskScore: driver.risk_score ?? 5.0,
    riskLevel: driver.risk_level,
    status: driver.status,
    totalDeliveries: driver.total_deliveries ?? 0,
    completedDeliveries: driver.completed_deliveries ?? 0,
    rating: driver.rating ?? 5.0,
    whitelisted: driver.whitelisted ?? false,
    blacklisted: driver.blacklisted ?? false,
    blacklistReason: driver.blacklist_reason,
    notes: driver.notes,
    lastActiveAt: driver.last_active_at ? new Date(driver.last_active_at) : null,
    createdAt: new Date(driver.created_at),
    updatedAt: new Date(driver.updated_at),
    incidentCount: incidents?.length || 0,
  };
}

export interface UpdateDriverInput {
  name?: string;
  phone?: string;
  photo_url?: string;
  vehicle_type?: VehicleType;
  vehicle_plate?: string;
  status?: DriverStatus;
  whitelisted?: boolean;
  blacklisted?: boolean;
  blacklist_reason?: string;
  notes?: string;
  risk_score?: number;
  risk_level?: string;
}

async function updateDriver(id: string, input: UpdateDriverInput): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .update(input)
    .eq('id', id);

  if (error) {
    console.error('Error updating driver:', error);
    throw error;
  }
}

async function addToWhitelist(id: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .update({
      whitelisted: true,
      blacklisted: false,
      status: 'WHITELIST' as DriverStatus,
      notes: reason || 'Adicionado à whitelist',
    })
    .eq('id', id);

  if (error) throw error;
}

async function removeFromWhitelist(id: string): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .update({
      whitelisted: false,
      status: 'APPROVED' as DriverStatus,
    })
    .eq('id', id);

  if (error) throw error;
}

async function addToBlacklist(id: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .update({
      blacklisted: true,
      whitelisted: false,
      status: 'BLACKLIST' as DriverStatus,
      blacklist_reason: reason,
    })
    .eq('id', id);

  if (error) throw error;
}

async function removeFromBlacklist(id: string): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .update({
      blacklisted: false,
      status: 'PENDING_APPROVAL' as DriverStatus,
      blacklist_reason: null,
    })
    .eq('id', id);

  if (error) throw error;
}

async function approveDriver(id: string): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .update({
      status: 'APPROVED' as DriverStatus,
    })
    .eq('id', id);

  if (error) throw error;
}

async function blockDriver(id: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .update({
      status: 'BLOCKED' as DriverStatus,
      notes: reason || 'Bloqueado manualmente',
    })
    .eq('id', id);

  if (error) throw error;
}

// Hooks
export function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: fetchDrivers,
    staleTime: 30000,
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: ['driver', id],
    queryFn: () => fetchDriverById(id),
    enabled: !!id,
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDriverInput }) =>
      updateDriver(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Motorista atualizado com sucesso.');
    },
    onError: (error) => {
      console.error('Error updating driver:', error);
      toast.error('Falha ao atualizar motorista.');
    },
  });
}

export function useAddToWhitelist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      addToWhitelist(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Motorista adicionado à whitelist.');
    },
    onError: (error) => {
      console.error('Error adding to whitelist:', error);
      toast.error('Falha ao adicionar à whitelist.');
    },
  });
}

export function useRemoveFromWhitelist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeFromWhitelist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Motorista removido da whitelist.');
    },
    onError: (error) => {
      console.error('Error removing from whitelist:', error);
      toast.error('Falha ao remover da whitelist.');
    },
  });
}

export function useAddToBlacklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      addToBlacklist(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Motorista adicionado à blacklist.');
    },
    onError: (error) => {
      console.error('Error adding to blacklist:', error);
      toast.error('Falha ao adicionar à blacklist.');
    },
  });
}

export function useRemoveFromBlacklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeFromBlacklist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Motorista removido da blacklist.');
    },
    onError: (error) => {
      console.error('Error removing from blacklist:', error);
      toast.error('Falha ao remover da blacklist.');
    },
  });
}

export function useApproveDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => approveDriver(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Motorista aprovado.');
    },
    onError: (error) => {
      console.error('Error approving driver:', error);
      toast.error('Falha ao aprovar motorista.');
    },
  });
}

export function useBlockDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      blockDriver(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Motorista bloqueado.');
    },
    onError: (error) => {
      console.error('Error blocking driver:', error);
      toast.error('Falha ao bloquear motorista.');
    },
  });
}
