/**
 * AegisTV Logger — Lightweight logging utility
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] || 1;

const colors = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(level, module, message, data) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const color = colors[level];
  const prefix = `${colors.dim}[${timestamp()}]${colors.reset} ${color}[${level.toUpperCase()}]${colors.reset} ${colors.bold}[${module}]${colors.reset}`;
  console.log(`${prefix} ${message}`);
  if (data) console.log(`${colors.dim}  └─ ${JSON.stringify(data, null, 2)}${colors.reset}`);
}

module.exports = {
  debug: (mod, msg, data) => log('debug', mod, msg, data),
  info: (mod, msg, data) => log('info', mod, msg, data),
  warn: (mod, msg, data) => log('warn', mod, msg, data),
  error: (mod, msg, data) => log('error', mod, msg, data),
};
