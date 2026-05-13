import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DriverMetrics {
  totalDrivers: number;
  byRiskLevel: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  byStatus: {
    approved: number;
    pending: number;
    blocked: number;
    whitelist: number;
    blacklist: number;
  };
  avgRiskScore: number;
  whitelistCount: number;
  blacklistCount: number;
}

export interface ApprovalMetrics {
  totalApprovals: number;
  pending: number;
  approved: number;
  rejected: number;
  autoApprovalRate: number;
  avgResponseTimeMinutes: number;
  todayApprovals: number;
  todayRejections: number;
}

export interface IncidentMetrics {
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  bySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  byType: Record<string, number>;
  avgResolutionTimeHours: number;
}

async function fetchDriverMetrics(): Promise<DriverMetrics> {
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('status, risk_score, risk_level, whitelisted, blacklisted');

  if (error) throw error;

  const byRiskLevel = { low: 0, medium: 0, high: 0, critical: 0 };
  const byStatus = { approved: 0, pending: 0, blocked: 0, whitelist: 0, blacklist: 0 };
  let totalScore = 0;
  let whitelistCount = 0;
  let blacklistCount = 0;

  for (const d of (drivers || [])) {
    // Risk level
    const level = (d.risk_level || 'MEDIUM').toLowerCase();
    if (level in byRiskLevel) byRiskLevel[level as keyof typeof byRiskLevel]++;

    // Status
    switch (d.status) {
      case 'APPROVED': byStatus.approved++; break;
      case 'PENDING_APPROVAL': byStatus.pending++; break;
      case 'BLOCKED': byStatus.blocked++; break;
      case 'WHITELIST': byStatus.whitelist++; break;
      case 'BLACKLIST': byStatus.blacklist++; break;
    }

    totalScore += d.risk_score || 5;
    if (d.whitelisted) whitelistCount++;
    if (d.blacklisted) blacklistCount++;
  }

  return {
    totalDrivers: drivers?.length || 0,
    byRiskLevel,
    byStatus,
    avgRiskScore: drivers?.length ? totalScore / drivers.length : 0,
    whitelistCount,
    blacklistCount,
  };
}

async function fetchApprovalMetrics(): Promise<ApprovalMetrics> {
  const { data: approvals, error } = await supabase
    .from('driver_approval_queue')
    .select('status, requested_at, reviewed_at');

  if (error) throw error;

  let pending = 0, approved = 0, rejected = 0;
  let totalResponseTime = 0;
  let reviewedCount = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let todayApprovals = 0, todayRejections = 0;

  for (const a of (approvals || [])) {
    switch (a.status) {
      case 'PENDING': pending++; break;
      case 'APPROVED': 
        approved++; 
        if (a.reviewed_at && new Date(a.reviewed_at) >= today) todayApprovals++;
        break;
      case 'REJECTED': 
        rejected++; 
        if (a.reviewed_at && new Date(a.reviewed_at) >= today) todayRejections++;
        break;
    }

    if (a.reviewed_at && a.requested_at) {
      const diff = new Date(a.reviewed_at).getTime() - new Date(a.requested_at).getTime();
      totalResponseTime += diff / 60000; // minutes
      reviewedCount++;
    }
  }

  // Estimate auto-approval rate (drivers that never went to queue / total)
  const { count: totalDrivers } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true });

  const { count: driversInQueue } = await supabase
    .from('driver_approval_queue')
    .select('driver_id', { count: 'exact', head: true });

  const autoApprovalRate = totalDrivers && driversInQueue !== null
    ? ((totalDrivers - driversInQueue) / totalDrivers) * 100
    : 0;

  return {
    totalApprovals: approvals?.length || 0,
    pending,
    approved,
    rejected,
    autoApprovalRate: Math.max(0, autoApprovalRate),
    avgResponseTimeMinutes: reviewedCount > 0 ? totalResponseTime / reviewedCount : 0,
    todayApprovals,
    todayRejections,
  };
}

async function fetchIncidentMetrics(): Promise<IncidentMetrics> {
  const { data: incidents, error } = await supabase
    .from('driver_incidents')
    .select('type, severity, resolved, resolved_at, created_at');

  if (error) throw error;

  let openIncidents = 0, resolvedIncidents = 0;
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
  const byType: Record<string, number> = {};
  let totalResolutionTime = 0;
  let resolvedCount = 0;

  for (const inc of (incidents || [])) {
    if (inc.resolved) {
      resolvedIncidents++;
      if (inc.resolved_at && inc.created_at) {
        const diff = new Date(inc.resolved_at).getTime() - new Date(inc.created_at).getTime();
        totalResolutionTime += diff / 3600000; // hours
        resolvedCount++;
      }
    } else {
      openIncidents++;
    }

    const sev = inc.severity.toLowerCase();
    if (sev in bySeverity) bySeverity[sev as keyof typeof bySeverity]++;

    byType[inc.type] = (byType[inc.type] || 0) + 1;
  }

  return {
    totalIncidents: incidents?.length || 0,
    openIncidents,
    resolvedIncidents,
    bySeverity,
    byType,
    avgResolutionTimeHours: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
  };
}

export function useDriverMetrics() {
  return useQuery({
    queryKey: ['metrics', 'drivers'],
    queryFn: fetchDriverMetrics,
    staleTime: 60000,
  });
}

export function useApprovalMetrics() {
  return useQuery({
    queryKey: ['metrics', 'approvals'],
    queryFn: fetchApprovalMetrics,
    staleTime: 60000,
  });
}

export function useIncidentMetrics() {
  return useQuery({
    queryKey: ['metrics', 'incidents'],
    queryFn: fetchIncidentMetrics,
    staleTime: 60000,
  });
}
