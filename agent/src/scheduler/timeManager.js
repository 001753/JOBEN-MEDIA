'use strict';

/**
 * Time Manager — Manajemen jadwal publish artikel
 *
 * Logika:
 * - Jam aktif: 06.00 - 23.00 WIB
 * - 30 artikel dalam 17 jam aktif = ~34 menit per artikel
 * - Variasi ±10 menit (jitter) agar tidak mecanikal
 * - Distribusi merata, tidak cluster di waktu tertentu
 */

const logger = require('../utils/logger');
const { currentHourWIB, todayWIB } = require('../utils/dateHelper');

class TimeManager {
  constructor(settings) {
    this.settings = settings;
    this._lastPublishTime = null;
    this._todaySlots = [];
    this._slotIndex = 0;
  }

  /**
   * Cek apakah sekarang dalam jam aktif agent
   * @returns {boolean}
   */
  isActiveHour() {
    const hour = currentHourWIB();
    const start = this.settings.agent.activeHours?.start ?? 6;
    const end = this.settings.agent.activeHours?.end ?? 23;
    return hour >= start && hour < end;
  }

  /**
   * Hitung target artikel hari ini (weekday vs weekend)
   * @returns {number}
   */
  getDailyTarget() {
    const dayOfWeek = new Date().getDay(); // 0=Sunday, 6=Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    return isWeekend
      ? (this.settings.agent.weekendTarget || 20)
      : (this.settings.agent.weekdayTarget || 30);
  }

  /**
   * Hitung interval berikutnya sebelum generate artikel lagi (dalam ms)
   * @param {number} articlesPublishedToday
   * @returns {number} ms
   */
  getNextIntervalMs(articlesPublishedToday = 0) {
    const target = this.getDailyTarget();
    const start = this.settings.agent.activeHours?.start ?? 6;
    const end = this.settings.agent.activeHours?.end ?? 23;
    const activeMinutes = (end - start) * 60;

    // Interval dasar
    const baseIntervalMin = Math.floor(activeMinutes / target);

    // Sesuaikan jika sudah banyak artikel (atau belum)
    const hour = currentHourWIB();
    const minutesElapsed = Math.max(0, (hour - start) * 60 + new Date().getMinutes());
    const expectedByNow = Math.floor((minutesElapsed / activeMinutes) * target);
    const deficit = expectedByNow - articlesPublishedToday;

    let adjustedInterval = baseIntervalMin;
    if (deficit > 2) {
      // Tertinggal banyak → percepat
      adjustedInterval = Math.max(15, baseIntervalMin - deficit * 3);
    } else if (deficit < -2) {
      // Terlalu cepat → perlambat
      adjustedInterval = Math.min(60, baseIntervalMin + 10);
    }

    // Tambah jitter agar tidak mecanikal
    const jitter = this.settings.scheduler.intervalMinJitter || 10;
    const jitterMin = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
    const finalInterval = Math.max(10, adjustedInterval + jitterMin);

    return finalInterval * 60 * 1000; // Convert ke ms
  }

  /**
   * Dapatkan waktu publish berikutnya untuk artikel yang akan dibuat
   * Digunakan sebagai publishedAt di Strapi (bisa masa depan untuk distribusi merata)
   * @returns {string} ISO string WIB
   */
  getNextPublishSlot() {
    // Publish langsung (tidak delay ke masa depan)
    // Bisa dikembangkan untuk schedule ke depan jika diperlukan
    return new Date().toISOString();
  }

  /**
   * Cek apakah sudah waktunya generate artikel berikutnya
   * @param {number} articlesPublishedToday
   * @returns {boolean}
   */
  shouldPublishNow(articlesPublishedToday = 0) {
    if (!this.isActiveHour()) return false;

    const target = this.getDailyTarget();
    if (articlesPublishedToday >= target) return false;

    if (!this._lastPublishTime) return true;

    const elapsed = Date.now() - this._lastPublishTime;
    const intervalMs = this.getNextIntervalMs(articlesPublishedToday);

    return elapsed >= intervalMs;
  }

  /**
   * Catat waktu publish terakhir
   */
  recordPublish() {
    this._lastPublishTime = Date.now();
  }

  /**
   * Hitung berapa lama sampai publish berikutnya (untuk dashboard)
   * @param {number} articlesPublishedToday
   * @returns {Object}
   */
  getNextPublishInfo(articlesPublishedToday = 0) {
    if (!this.isActiveHour()) {
      const start = this.settings.agent.activeHours?.start ?? 6;
      const now = new Date();
      const next = new Date(now);
      next.setHours(start, 0, 0, 0);
      if (now.getHours() >= start) {
        next.setDate(next.getDate() + 1);
      }
      return {
        active: false,
        nextAt: next.toISOString(),
        reason: 'Di luar jam aktif',
      };
    }

    const target = this.getDailyTarget();
    if (articlesPublishedToday >= target) {
      return {
        active: false,
        nextAt: null,
        reason: `Target harian tercapai (${articlesPublishedToday}/${target})`,
      };
    }

    const intervalMs = this.getNextIntervalMs(articlesPublishedToday);
    const elapsed = this._lastPublishTime ? Date.now() - this._lastPublishTime : intervalMs;
    const remaining = Math.max(0, intervalMs - elapsed);
    const nextAt = new Date(Date.now() + remaining).toISOString();

    return {
      active: true,
      nextAt,
      remainingMs: remaining,
      intervalMin: Math.round(intervalMs / 60000),
    };
  }

  /**
   * Hitung estimasi waktu selesai target hari ini
   */
  getEstimatedCompletion(articlesPublishedToday = 0) {
    const target = this.getDailyTarget();
    const remaining = target - articlesPublishedToday;
    if (remaining <= 0) return 'Target tercapai';

    const intervalMs = this.getNextIntervalMs(articlesPublishedToday);
    const estimatedMs = remaining * intervalMs;
    const done = new Date(Date.now() + estimatedMs);

    const end = this.settings.agent.activeHours?.end ?? 23;
    const endToday = new Date();
    endToday.setHours(end, 0, 0, 0);

    if (done > endToday) {
      return `Belum tercapai hari ini (${remaining} artikel tersisa)`;
    }

    return `~${done.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB`;
  }
}

module.exports = TimeManager;
