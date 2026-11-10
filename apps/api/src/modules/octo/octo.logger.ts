export const logger = {
  info: (context: string, message: string, data?: any) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] [INFO] [${context}] ${message}`, data ? JSON.stringify(data) : '');
    }
  },
  warn: (context: string, message: string, data?: any) => {
    console.warn(`[${new Date().toISOString()}] [WARN] [${context}] ${message}`, data ? JSON.stringify(data) : '');
  },
  error: (context: string, message: string, err?: any) => {
    console.error(`[${new Date().toISOString()}] [ERROR] [${context}] ${message}`, err || '');
  },
  debug: (context: string, message: string, data?: any) => {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      console.log(`[${new Date().toISOString()}] [DEBUG] [${context}] ${message}`, data ? JSON.stringify(data) : '');
    }
  },
};
