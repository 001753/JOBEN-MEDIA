'use strict';

/**
 * testPublish.js — Test publish 1 artikel ke Strapi via CLI
 *
 * Usage:
 *   node scripts/testPublish.js
 *   node scripts/testPublish.js --dry-run   (tidak benar-benar publish)
 *   node scripts/testPublish.js --category "Artificial Intelligence"
 *
 * Requires:
 *   STRAPI_API_URL + STRAPI_API_TOKEN di .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');

const { getInstance: getStrapiClient } = require('../src/services/strapiClient');
const { getInstance: getR2Client }     = require('../src/services/r2Client');
const logger                           = require('../src/utils/logger');
const authorsConfig                    = require('../src/config/authors.json');

const isDryRun   = process.argv.includes('--dry-run');
const categoryArg = (() => {
  const idx = process.argv.indexOf('--category');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── Artikel dummy untuk test ─────────────────────────────
const DUMMY_ARTICLE = {
  title            : '[TEST] Artikel Uji Coba JOBEN NEWS AI Agent',
  slug             : `test-artikel-uji-coba-${Date.now()}`,
  excerpt          : 'Ini adalah artikel uji coba yang dibuat oleh script testPublish.js untuk memverifikasi koneksi ke Strapi CMS.',
  content          : [
    {
      type    : 'paragraph',
      children: [{ type: 'text', text: 'Artikel ini dibuat otomatis oleh script testPublish.js sebagai uji coba koneksi ke Strapi CMS. Jika artikel ini muncul di Strapi, berarti pipeline publish berfungsi dengan benar.' }],
    },
    {
      type    : 'heading',
      level   : 2,
      children: [{ type: 'text', text: 'Verifikasi Pipeline' }],
    },
    {
      type    : 'paragraph',
      children: [{ type: 'text', text: 'Pipeline yang diverifikasi: Strapi REST API → createArticle → publishedAt → editorial_status. Artikel ini bisa dihapus setelah test selesai.' }],
    },
    {
      type    : 'paragraph',
      children: [{ type: 'text', text: 'Waktu generate: ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB. Source: testPublish.js script.' }],
    },
  ],
  seo_title        : '[TEST] Artikel Uji Coba AI Agent',
  seo_description  : 'Artikel uji coba yang dibuat oleh script testPublish.js untuk verifikasi koneksi ke Strapi CMS.',
  focus_keyword    : 'test artikel',
  source_url       : 'https://jobenapp.cloud',
  source_attribution: 'JOBEN NEWS AI Agent Test, ' + new Date().toLocaleDateString('id-ID'),
  word_count       : 65,
  quality_score    : 75,
  content_type     : 'reguler',
  tags             : ['test', 'ai-agent'],
};

async function main() {
  console.log('\n========================================');
  console.log('  JOBEN NEWS — Test Publish ke Strapi');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (tidak publish)' : 'LIVE PUBLISH'}`);
  console.log('========================================\n');

  // Cek env
  if (!process.env.STRAPI_API_URL) {
    console.error('❌ STRAPI_API_URL belum diset di .env');
    process.exit(1);
  }
  if (!process.env.STRAPI_API_TOKEN) {
    console.error('❌ STRAPI_API_TOKEN belum diset di .env');
    process.exit(1);
  }

  console.log(`📡 Strapi URL : ${process.env.STRAPI_API_URL}`);
  console.log(`📝 Artikel    : ${DUMMY_ARTICLE.title}`);

  if (isDryRun) {
    console.log('\n✅ DRY RUN — Payload yang akan dikirim ke Strapi:');
    console.log(JSON.stringify(DUMMY_ARTICLE, null, 2));
    console.log('\n✅ DRY RUN selesai. Tidak ada data yang dikirim.');
    process.exit(0);
  }

  // Init services
  const strapiClient = getStrapiClient();

  try {
    // 1. Resolve kategori
    const category    = categoryArg || 'Berita';
    console.log(`\n🔍 Resolve kategori: "${category}"...`);
    const { categoryId } = await strapiClient.resolveCategory(category, null);
    console.log(`   ✅ Category ID: ${categoryId}`);

    // 2. Resolve author
    const authors     = Array.isArray(authorsConfig) ? authorsConfig : (authorsConfig.authors || []);
    const author      = authors[0];
    console.log(`\n👤 Author: ${author?.name || 'default'}`);

    // 3. Resolve tags
    console.log(`\n🏷️  Resolve tags: ${DUMMY_ARTICLE.tags.join(', ')}...`);
    const tagIds = await strapiClient.resolveOrCreateTags(DUMMY_ARTICLE.tags);
    console.log(`   ✅ Tag IDs: ${tagIds.join(', ')}`);

    // 4. Publish artikel
    console.log('\n📤 Publish artikel ke Strapi...');
    const result = await strapiClient.createArticle({
      title             : DUMMY_ARTICLE.title,
      slug              : DUMMY_ARTICLE.slug,
      excerpt           : DUMMY_ARTICLE.excerpt,
      content           : DUMMY_ARTICLE.content,
      cover             : null,
      author            : author?.strapiId || null,
      category          : categoryId,
      subcategory       : null,
      tags              : tagIds,
      seo               : { title: DUMMY_ARTICLE.seo_title, description: DUMMY_ARTICLE.seo_description },
      source_url        : DUMMY_ARTICLE.source_url,
      source_attribution: DUMMY_ARTICLE.source_attribution,
      publishedAt       : new Date().toISOString(),
      editorial_status  : 'published',
    });

    console.log('\n✅ BERHASIL publish ke Strapi!');
    console.log(`   Document ID : ${result.documentId || result.id}`);
    console.log(`   Title       : ${result.title}`);
    console.log(`   Slug        : ${result.slug}`);
    console.log(`\n🔗 Cek di Strapi admin: ${process.env.STRAPI_API_URL}/admin`);
    console.log('\n⚠️  Ingat: hapus artikel test ini dari Strapi setelah selesai.\n');

  } catch (err) {
    console.error(`\n❌ GAGAL: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
