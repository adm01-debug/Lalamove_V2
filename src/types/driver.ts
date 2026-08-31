// =============================================
// DRIVER TYPES - Baseado no projeto Claude
// =============================================

// Enums de Status
export enum DriverStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  // Compatibilidade com sistema atual
  APPROVED = 'APPROVED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  BLOCKED = 'BLOCKED',
  WHITELIST = 'WHITELIST',
  BLACKLIST = 'BLACKLIST'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum DeliveryOutcome {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  DAMAGED = 'DAMAGED',
  STOLEN = 'STOLEN',
  LATE = 'LATE',
  WRONG_ADDRESS = 'WRONG_ADDRESS',
  CUSTOMER_UNAVAILABLE = 'CUSTOMER_UNAVAILABLE'
}

export enum ApprovalPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL'
}

export enum IncidentType {
  DELAY = 'DELAY',
  DAMAGE = 'DAMAGE',
  THEFT = 'THEFT',
  RUDE_BEHAVIOR = 'RUDE_BEHAVIOR',
  WRONG_DELIVERY = 'WRONG_DELIVERY',
  NO_SHOW = 'NO_SHOW',
  UNSAFE_DRIVING = 'UNSAFE_DRIVING',
  // Compatibilidade com sistema atual
  ROUTE_DEVIATION = 'ROUTE_DEVIATION',
  LONG_STOP = 'LONG_STOP',
  LATE_DELIVERY = 'LATE_DELIVERY',
  CUSTOMER_COMPLAINT = 'CUSTOMER_COMPLAINT',
  OTHER = 'OTHER'
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// =============================================
// INTERFACES DE ESTATÍSTICAS
// =============================================

export interface DriverStats {
  totalDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  cancelledDeliveries: number;
  successRate: number;
  failureRate: number;
  incidentCount: number;
  avgDelayMinutes: number;
  lastDeliveryAt?: Date;
}

// =============================================
// INTERFACES DE ANÁLISE DE RISCO
// =============================================

export interface RiskFactor {
  factor: string;
  score: number;
  weight: number;
  description: string;
}

export interface RiskAnalysis {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  reasons: string[];
}

export interface DriverEvaluationResult {
  approved: boolean;
  requiresManualApproval: boolean;
  autoBlocked: boolean;
  riskAnalysis: RiskAnalysis;
  recommendation: string;
  actionRequired?: string;
}

// =============================================
// INTERFACES DE AVALIAÇÃO
// =============================================

export interface DriverEvaluation {
  id: string;
  driverId: string;
  orderId?: string;
  triggeredBy: string;
  approved: boolean;
  requiresManual: boolean;
  autoBlocked: boolean;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  riskReasons: string[];
  totalDeliveries: number;
  completedDeliveries: number;
  failureRate: number;
  incidentCount: number;
  recommendation?: string;
  actionRequired?: string;
  evaluatedAt: Date;
  createdAt: Date;
}

export interface CreateEvaluationInput {
  driverId: string;
  orderId?: string;
  triggeredBy?: string;
  approved: boolean;
  requiresManual?: boolean;
  autoBlocked?: boolean;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  riskReasons?: string[];
  totalDeliveries?: number;
  completedDeliveries?: number;
  failureRate?: number;
  incidentCount?: number;
  recommendation?: string;
  actionRequired?: string;
}

// =============================================
// INTERFACES DE APROVAÇÃO
// =============================================

export interface ApprovalRequest {
  driverId: string;
  orderId: string;
  reason: string;
  priority: ApprovalPriority;
  requestedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalDecision {
  approvalId: string;
  decision: 'APPROVED' | 'REJECTED';
  decidedBy: string;
  notes?: string;
  actionTaken?: string;
}

// =============================================
// HELPERS
// =============================================

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'bg-green-100 text-green-800',
  [RiskLevel.MEDIUM]: 'bg-yellow-100 text-yellow-800',
  [RiskLevel.HIGH]: 'bg-orange-100 text-orange-800',
  [RiskLevel.CRITICAL]: 'bg-red-100 text-red-800'
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'Baixo',
  [RiskLevel.MEDIUM]: 'Médio',
  [RiskLevel.HIGH]: 'Alto',
  [RiskLevel.CRITICAL]: 'Crítico'
};

export const PRIORITY_COLORS: Record<ApprovalPriority, string> = {
  [ApprovalPriority.LOW]: 'bg-slate-100 text-slate-800',
  [ApprovalPriority.MEDIUM]: 'bg-blue-100 text-blue-800',
  [ApprovalPriority.HIGH]: 'bg-yellow-100 text-yellow-800',
  [ApprovalPriority.URGENT]: 'bg-orange-100 text-orange-800',
  [ApprovalPriority.CRITICAL]: 'bg-red-100 text-red-800'
};

export const OUTCOME_LABELS: Record<DeliveryOutcome, string> = {
  [DeliveryOutcome.SUCCESS]: 'Sucesso',
  [DeliveryOutcome.FAILED]: 'Falhou',
  [DeliveryOutcome.DAMAGED]: 'Danificado',
  [DeliveryOutcome.STOLEN]: 'Roubado',
  [DeliveryOutcome.LATE]: 'Atrasado',
  [DeliveryOutcome.WRONG_ADDRESS]: 'Endereço Errado',
  [DeliveryOutcome.CUSTOMER_UNAVAILABLE]: 'Cliente Indisponível'
};

export const OUTCOME_COLORS: Record<DeliveryOutcome, string> = {
  [DeliveryOutcome.SUCCESS]: 'bg-green-100 text-green-800',
  [DeliveryOutcome.FAILED]: 'bg-red-100 text-red-800',
  [DeliveryOutcome.DAMAGED]: 'bg-orange-100 text-orange-800',
  [DeliveryOutcome.STOLEN]: 'bg-red-100 text-red-800',
  [DeliveryOutcome.LATE]: 'bg-yellow-100 text-yellow-800',
  [DeliveryOutcome.WRONG_ADDRESS]: 'bg-orange-100 text-orange-800',
  [DeliveryOutcome.CUSTOMER_UNAVAILABLE]: 'bg-yellow-100 text-yellow-800'
};
