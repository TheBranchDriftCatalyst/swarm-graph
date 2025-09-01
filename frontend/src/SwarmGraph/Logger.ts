// Lightweight structured logger for the graph UI
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function now() {
  return new Date().toISOString();
}

function emit(level: LogLevel, event: string, payload?: any) {
  try {
    const out = { ts: now(), level, event, payload };
    // keep it readable in console but structured
    if (level === 'error') console.error('GRAPH', out);
    else if (level === 'warn') console.warn('GRAPH', out);
    else if (level === 'info') console.info('GRAPH', out);
    else console.debug('GRAPH', out);
  } catch (e) {
    // fallback
    console.log('GRAPH', event, payload);
  }
}

export const Logger = {
  debug: (event: string, payload?: any) => emit('debug', event, payload),
  info: (event: string, payload?: any) => emit('info', event, payload),
  warn: (event: string, payload?: any) => emit('warn', event, payload),
  error: (event: string, payload?: any) => emit('error', event, payload),
};

export default Logger;
