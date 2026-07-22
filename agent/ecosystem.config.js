'use strict';

/**
 * PM2 Ecosystem Config — JOBEN NEWS AI Agent
 * Tiga proses yang berjalan bersamaan:
 * 1. joben-agent-scheduler  — Main scheduler (30 artikel/hari)
 * 2. joben-breaking-daemon  — Breaking news watcher (setiap 5 menit)
 * 3. joben-dashboard        — Control center Express API (port 4000)
 */

module.exports = {
  apps: [
    {
      name: 'joben-agent-scheduler',
      script: 'src/scheduler/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 5000,
      // Restart bersih jam 04.00 WIB setiap hari
      cron_restart: '0 4 * * *',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Jakarta',
      },
      error_file: 'logs/agent-error.log',
      out_file: 'logs/agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
    {
      name: 'joben-breaking-daemon',
      script: 'src/scheduler/breakingDaemon.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '128M',
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Jakarta',
      },
      error_file: 'logs/breaking-error.log',
      out_file: 'logs/breaking-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
    {
      name: 'joben-dashboard',
      script: 'src/dashboard/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '128M',
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        TZ: 'Asia/Jakarta',
      },
      error_file: 'logs/dashboard-error.log',
      out_file: 'logs/dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
