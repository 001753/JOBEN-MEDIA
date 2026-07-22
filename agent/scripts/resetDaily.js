'use strict';

/**
 * Reset Daily — Reset counter harian untuk Gemini keys dan state
 * Dipanggil otomatis setiap jam 00.00 WIB oleh scheduler
 * Bisa juga dijalankan manual: node scripts/resetDaily.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { todayWIB } = require('../src/utils/dateHelper');
const logger = require('../src/utils/logger');

async function resetDaily() {
  console.log('\n🔄 JOBEN NEWS — Reset Daily\n');

  const today = todayWIB();

  // Reset state.json
  const statePath = path.join(__dirname, '../data/state.json');
  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

    // Simpan total ever sebelum reset
    const totalEver = (state.totalPublishedEver || 0) + (state.articlesPublished || 0);

    const newState = {
      date: today,
      articlesPublished: 0,
      articlesTarget: 30,
      breakingPublished: 0,
      lastPublishedAt: null,
      nextScheduledAt: null,
      agentStatus: 'idle',
      queueLength: 0,
      errors24h: 0,
      apiKeyActive: state.apiKeyActive || 0,
      apiKeyTotal: state.apiKeyTotal || 0,
      lastResetAt: new Date().toISOString(),
      startedAt: state.startedAt,
      totalPublishedEver: totalEver,
    };

    fs.writeFileSync(statePath, JSON.stringify(newState, null, 2));
    console.log(`✅ state.json direset untuk tanggal ${today}`);
    console.log(`   Total artikel ever: ${totalEver}`);
  }

  // Reset Gemini key counters
  try {
    const { getInstance: getGemini } = require('../src/services/geminiPool');
    const gemini = getGemini();
    gemini.resetDailyCounters();
    console.log('✅ Gemini key daily counters direset');
  } catch (e) {
    console.log('⚠️  Gemini reset skip:', e.message);
  }

  console.log('\n✅ Reset harian selesai!\n');
}

resetDaily().catch(e => {
  console.error('❌ Reset daily gagal:', e.message);
  process.exit(1);
});
