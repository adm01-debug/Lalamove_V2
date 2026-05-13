import { logger } from '@/utils/logger';
const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) logger.log(...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: any[]) => {
    // Erros sempre são logados, mas idealmente enviados para um serviço como Sentry
    console.error(...args);
  },
  info: (...args: any[]) => {
    if (isDev) logger.info(...args);
  },
  debug: (...args: any[]) => {
    if (isDev) logger.debug(...args);
  },
};
