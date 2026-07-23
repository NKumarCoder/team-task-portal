const isDev = process.env.NODE_ENV === 'development';
const DEBUG_FLAG = typeof window !== 'undefined' ? (window as any).DEBUG_PORTAL || isDev : isDev;

export const logger = {
  log: (...args: any[]) => {
    if (DEBUG_FLAG) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (DEBUG_FLAG) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
  info: (...args: any[]) => {
    if (DEBUG_FLAG) {
      console.info(...args);
    }
  }
};
