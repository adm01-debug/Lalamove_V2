import { logger } from '@/utils/logger';
const isDev = import.meta.env.DEV;

const loggerObj = {
  log: (...args: any[]) => {
    if (isDev) logger.log(...args);
  },
  warn: (...args: any[]) => {
    if (isDev) logger.warn(...args);
  },
  error: (...args: any[]) => {
    // Erros sempre são logados
    logger.error(...args);
  },
  info: (...args: any[]) => {
    if (isDev) logger.info(...args);
  },
  debug: (...args: any[]) => {
    if (isDev) logger.debug(...args);
  },
};

export const logger = loggerObj;
