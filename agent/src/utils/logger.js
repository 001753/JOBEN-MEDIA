'use strict';

const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Format konsol: berwarna, timestamped, readable
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Format file: JSON terstruktur untuk parsing
const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.json()
);

// Transport: daily rotating log file (agent utama)
const agentFileTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'agent-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',        // Simpan 14 hari
  maxSize: '20m',
  format: fileFormat,
  level: 'info',
});

// Transport: error log terpisah
const errorFileTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d',        // Error log disimpan lebih lama
  maxSize: '10m',
  format: fileFormat,
  level: 'error',
});

// Event: rotasi file berhasil
agentFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Log file rotated', { old: oldFilename, new: newFilename });
});

const logger = createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: 'joben-agent' },
  transports: [
    new transports.Console({
      format: consoleFormat,
      handleExceptions: true,
    }),
    agentFileTransport,
    errorFileTransport,
  ],
  exitOnError: false,
});

// Helper: log dengan konteks tambahan
logger.agent = (message, meta = {}) => logger.info(message, { ctx: 'agent', ...meta });
logger.scheduler = (message, meta = {}) => logger.info(message, { ctx: 'scheduler', ...meta });
logger.writer = (message, meta = {}) => logger.info(message, { ctx: 'writer', ...meta });
logger.publisher = (message, meta = {}) => logger.info(message, { ctx: 'publisher', ...meta });
logger.quality = (message, meta = {}) => logger.info(message, { ctx: 'quality', ...meta });
logger.gemini = (message, meta = {}) => logger.debug(message, { ctx: 'gemini', ...meta });
logger.rss = (message, meta = {}) => logger.debug(message, { ctx: 'rss', ...meta });
logger.strapi = (message, meta = {}) => logger.debug(message, { ctx: 'strapi', ...meta });
logger.r2 = (message, meta = {}) => logger.debug(message, { ctx: 'r2', ...meta });
logger.telegram = (message, meta = {}) => logger.debug(message, { ctx: 'telegram', ...meta });
logger.breaking = (message, meta = {}) => logger.warn(message, { ctx: 'breaking', ...meta });

// Stream untuk morgan (jika dipakai di dashboard)
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
