/**
import { logger } from '@/utils/logger';
 * Circuit Breaker Pattern Utility
 * Previne falhas em cascata ao lidar com integrações instáveis.
 */

interface CircuitBreakerOptions {
  failureThreshold: number; // Número de falhas antes de abrir o circuito
  cooldownPeriod: number;    // Tempo em ms para esperar antes de tentar novamente (half-open)
  name: string;
}

const registry: Record<string, {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
}> = {};

export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions
): Promise<T> {
  const { name, failureThreshold, cooldownPeriod } = options;
  
  if (!registry[name]) {
    registry[name] = { failures: 0, lastFailure: 0, state: 'CLOSED' };
  }

  const circuit = registry[name];

  // Verifica se o circuito está aberto
  if (circuit.state === 'OPEN') {
    if (Date.now() - circuit.lastFailure > cooldownPeriod) {
      circuit.state = 'HALF-OPEN';
    } else {
      throw new Error(`Circuit Breaker [${name}] is OPEN. Integration temporarily disabled.`);
    }
  }

  try {
    const result = await fn();
    
    // Se teve sucesso, reseta
    circuit.failures = 0;
    circuit.state = 'CLOSED';
    
    return result;
  } catch (error) {
    circuit.failures++;
    circuit.lastFailure = Date.now();
    
    if (circuit.failures >= failureThreshold) {
      circuit.state = 'OPEN';
      logger.error(`Circuit Breaker [${name}] OPENED due to repeated failures.`);
    }
    
    throw error;
  }
}
