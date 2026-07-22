'use strict';

/**
 * Seed Authors — Upload 10 author persona ke Strapi
 * Jalankan: node scripts/seedAuthors.js
 *
 * Script ini:
 * 1. Baca authors.json (10 persona)
 * 2. Cek apakah author sudah ada di Strapi (skip jika ada)
 * 3. Buat author baru via Strapi REST API
 * 4. Update authors.json dengan Strapi ID yang didapat
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');

const { getInstance: getStrapi } = require('../src/services/strapiClient');
const logger = require('../src/utils/logger');

const AUTHORS_FILE = path.join(__dirname, '../src/config/authors.json');

async function seedAuthors() {
  console.log('\n👥 JOBEN NEWS — Seed Authors ke Strapi\n');
  console.log('='.repeat(50));

  const strapi = getStrapi();
  const authorsConfig = JSON.parse(fs.readFileSync(AUTHORS_FILE, 'utf8'));
  const authors = authorsConfig.authors;

  console.log(`📋 ${authors.length} author akan di-seed...\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const author of authors) {
    process.stdout.write(`  [${author.id}] ${author.name}... `);

    try {
      // Cek apakah sudah ada
      const existing = await strapi.findAuthor(author.slug);

      if (existing) {
        // Update Strapi ID di local config
        author.strapiId = existing.id;
        author.strapiDocId = existing.documentId;
        console.log(`✓ Sudah ada (id: ${existing.id})`);
        skipped++;
        continue;
      }

      // Buat author baru
      const created_author = await strapi.createAuthor({
        name: author.name,
        slug: author.slug,
        bio: author.bio,
        role: author.title,
        expertise: author.expertise,
        // Avatar akan di-update setelah generate dengan Imagen 3 (Fase 1 lanjut)
      });

      // Simpan Strapi ID
      author.strapiId = created_author.id;
      author.strapiDocId = created_author.documentId;

      console.log(`✅ Dibuat (id: ${created_author.id})`);
      created++;

      // Jeda kecil agar tidak flood API
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      logger.error(`Gagal seed author ${author.name}`, { error: err.message });
      failed++;
    }
  }

  // Simpan kembali authors.json dengan Strapi IDs
  authorsConfig.authors = authors;
  fs.writeFileSync(AUTHORS_FILE, JSON.stringify(authorsConfig, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Selesai: ${created} dibuat, ${skipped} dilewati, ${failed} gagal`);
  console.log('💾 authors.json diperbarui dengan Strapi IDs\n');

  if (failed > 0) {
    console.log('⚠️  Beberapa author gagal di-seed. Periksa koneksi Strapi dan API token.');
    process.exit(1);
  }
}

seedAuthors().catch(e => {
  console.error('\n❌ seedAuthors gagal:', e.message);
  process.exit(1);
});
