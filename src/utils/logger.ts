import { captureError } from '@/services/errorMonitoring';

const isDev = import.meta.env.DEV;

const loggerObj = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (message: string, errorOrContext?: unknown, context?: Record<string, unknown>) => {
    if (isDev) {
      console.error(message, errorOrContext, context);
    } else {
      // Em produção: não imprime o payload (evita vazar dados sensíveis no console)
      // Envia para o serviço de monitoramento de erros
      const err = errorOrContext instanceof Error ? errorOrContext : new Error(message);
      captureError(err, { source: 'manual', metadata: context });
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
};

export const logger = loggerObj;
