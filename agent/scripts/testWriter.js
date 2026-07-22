'use strict';

/**
 * Test Writer — Generate 1 artikel end-to-end dari CLI
 * Jalankan: node scripts/testWriter.js [--category=AI] [--breaking] [--dry-run]
 *
 * Flags:
 *   --category=X    Kategori artikel (default: Artificial Intelligence)
 *   --breaking      Mode breaking news (artikel pendek)
 *   --dry-run       Generate tapi tidak publish ke Strapi
 *   --save          Simpan output ke file JSON
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');

const { getInstance: getGemini } = require('../src/services/geminiPool');
const { getInstance: getRss } = require('../src/services/rssReader');
const logger = require('../src/utils/logger');
const prompts = require('../src/config/prompts');
const authorsConfig = require('../src/config/authors.json');
const categoriesConfig = require('../src/config/categories.json');
const { countWords } = require('../src/utils/wordCount');
const { slugify } = require('../src/utils/slugify');
const { nowISO } = require('../src/utils/dateHelper');

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const CATEGORY = getArg('category') || 'Artificial Intelligence';
const IS_BREAKING = hasFlag('breaking');
const DRY_RUN = hasFlag('dry-run') || !process.env.STRAPI_API_TOKEN;
const SAVE_OUTPUT = hasFlag('save');

async function testWriter() {
  console.log('\n✍️  JOBEN NEWS — Test Writer\n');
  console.log('='.repeat(50));
  console.log(`Kategori: ${CATEGORY}`);
  console.log(`Mode: ${IS_BREAKING ? 'Breaking News' : 'Reguler'}`);
  console.log(`Dry run: ${DRY_RUN ? 'Ya (tidak publish)' : 'Tidak (akan publish)'}`);
  console.log('='.repeat(50));

  const gemini = getGemini();
  const rss = getRss();

  // Step 1: Fetch RSS
  console.log('\n📡 Step 1: Fetch RSS feeds...');
  const startFetch = Date.now();
  const rssItems = await rss.fetchAll({ breakingOnly: IS_BREAKING });
  const formattedItems = rss.formatForPrompt(rssItems, 30);
  console.log(`  → ${rssItems.length} items, ${Date.now() - startFetch}ms`);

  if (rssItems.length === 0) {
    console.log('  ⚠️  Tidak ada RSS item ditemukan');
    return;
  }

  // Step 2: Trend Scout
  console.log('\n🔍 Step 2: Analisis tren (Gemini)...');
  const startTrend = Date.now();

  const trendResponse = await gemini.generateText({
    systemPrompt: prompts.trendScout.system,
    userPrompt: prompts.trendScout.user(formattedItems),
    useSearch: true,
  });

  let topics;
  try {
    topics = gemini.parseJsonResponse(trendResponse);
    console.log(`  → ${topics.length} topik ditemukan, ${Date.now() - startTrend}ms`);
    topics.forEach((t, i) => console.log(`  ${i + 1}. [${t.category}] ${t.topic}`));
  } catch (e) {
    console.log('  ❌ Gagal parse topik:', e.message);
    console.log('  Raw response:', trendResponse.substring(0, 500));
    return;
  }

  // Pilih topik sesuai kategori
  let selectedTopic = topics.find(t => t.category === CATEGORY) || topics[0];
  console.log(`\n  ✅ Topik terpilih: "${selectedTopic.topic}"`);

  // Dapatkan author untuk kategori
  const authorId = authorsConfig.categoryMapping[CATEGORY] || 'A01';
  const author = authorsConfig.authors.find(a => a.id === authorId) || authorsConfig.authors[0];
  const category = categoriesConfig.categories.find(c => c.name === CATEGORY) || categoriesConfig.categories[0];
  const subcategory = category.subcategories[0];

  // Cari source snippets yang relevan
  const relevantSources = formattedItems
    .filter((item, i) => selectedTopic.source_indices?.includes(i + 1))
    .slice(0, 3);

  const sourceSnippets = relevantSources.map(s =>
    `[${s.source}] ${s.title}\n${s.description}\nURL: ${s.url}`
  ).join('\n\n---\n\n');

  // Step 3: Write Article
  console.log('\n✍️  Step 3: Generate artikel (Gemini)...');
  const startWrite = Date.now();

  const systemPrompt = prompts.writer.system(author);
  const userPrompt = prompts.writer.user(
    selectedTopic.topic,
    CATEGORY,
    subcategory?.name || 'Umum',
    selectedTopic.indonesia_angle || '',
    sourceSnippets || 'Tidak ada sumber spesifik — gunakan pengetahuan umum dan search grounding.',
    IS_BREAKING ? 'breaking' : 'reguler'
  );

  const articleResponse = await gemini.generateText({
    systemPrompt,
    userPrompt,
    useSearch: true,
  });

  let article;
  try {
    article = gemini.parseJsonResponse(articleResponse);
    const wordCount = countWords(article.content);
    article.word_count = wordCount;
    console.log(`  → Artikel generated, ${Date.now() - startWrite}ms`);
    console.log(`  📊 Judul: "${article.title}"`);
    console.log(`  📊 Slug: ${article.slug}`);
    console.log(`  📊 Word count: ${wordCount}`);
    console.log(`  📊 Excerpt: ${article.excerpt?.substring(0, 80)}...`);
    console.log(`  📊 SEO title: ${article.seo_title}`);
    console.log(`  📊 Tags: ${article.tags?.join(', ')}`);
  } catch (e) {
    console.log('  ❌ Gagal parse artikel:', e.message);
    console.log('  Raw response:', articleResponse.substring(0, 1000));
    return;
  }

  // Step 4: Save output
  if (SAVE_OUTPUT) {
    const outputFile = path.join(__dirname, `../data/test-article-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(article, null, 2));
    console.log(`\n💾 Output disimpan ke: ${outputFile}`);
  }

  // Step 5: Gemini Pool Stats
  const poolSummary = gemini.getSummary();
  console.log(`\n🔑 Gemini Pool: ${poolSummary.active} aktif, ${poolSummary.totalUsed} request dipakai`);

  console.log('\n' + '='.repeat(50));
  console.log('✅ Test writer selesai!\n');

  if (DRY_RUN) {
    console.log('ℹ️  Dry run mode — artikel tidak dipublish ke Strapi.');
    console.log('   Gunakan --dry-run=false dan isi STRAPI_API_TOKEN untuk publish.\n');
  }
}

testWriter().catch(e => {
  console.error('\n❌ Test writer gagal:', e.message);
  console.error(e.stack);
  process.exit(1);
});
