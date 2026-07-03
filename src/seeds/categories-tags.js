'use strict';

/**
 * Seed: Kategori & Tag awal JOBEN NEWS (Media Teknologi)
 * Idempotent — skip jika sudah ada, tidak hapus data existing.
 */

const TOP_CATEGORIES = [
  { name: 'Berita',                       slug: 'berita',                    description: 'Berita teknologi terkini dari dalam dan luar negeri' },
  { name: 'Artificial Intelligence (AI)', slug: 'artificial-intelligence',   description: 'Perkembangan AI, machine learning, dan kecerdasan buatan' },
  { name: 'Startup',                      slug: 'startup',                   description: 'Ekosistem startup, pendanaan, dan inovasi bisnis teknologi' },
  { name: 'Software Development',         slug: 'software-development',      description: 'Dunia pengembangan perangkat lunak, coding, dan rekayasa' },
  { name: 'Cyber Security',               slug: 'cyber-security',            description: 'Keamanan siber, privasi digital, dan ancaman online' },
  { name: 'Gadget',                        slug: 'gadget',                    description: 'Review dan berita gadget terbaru: smartphone, laptop, dan wearable' },
  { name: 'Kripto & Blockchain',          slug: 'kripto-blockchain',         description: 'Bitcoin, Ethereum, DeFi, NFT, dan ekosistem blockchain' },
  { name: 'Teknologi Masa Depan',         slug: 'teknologi-masa-depan',      description: 'Inovasi masa depan: quantum computing, robotika, IoT, dan lainnya' },
  { name: 'Tutorial',                     slug: 'tutorial',                  description: 'Panduan dan tips teknologi untuk semua level' },
  { name: 'Opini',                        slug: 'opini',                     description: 'Analisis mendalam, editorial, dan perspektif para pakar teknologi' },
];

// Sub-kategori: key = slug parent
const SUB_CATEGORIES = {
  'berita': [
    { name: 'Nasional',      slug: 'nasional' },
    { name: 'Global',        slug: 'global' },
    { name: 'Industri',      slug: 'industri' },
    { name: 'Regulasi',      slug: 'regulasi' },
    { name: 'Startup Berita', slug: 'startup-berita' },
    { name: 'Rilis Produk',  slug: 'rilis-produk' },
  ],
  'artificial-intelligence': [
    { name: 'Generative AI',            slug: 'generative-ai' },
    { name: 'AI Agent',                 slug: 'ai-agent' },
    { name: 'Large Language Model (LLM)', slug: 'large-language-model' },
    { name: 'Machine Learning',         slug: 'machine-learning' },
    { name: 'Computer Vision',          slug: 'computer-vision' },
    { name: 'Robotics AI',              slug: 'robotics-ai' },
    { name: 'AI Open Source',           slug: 'ai-open-source' },
    { name: 'AI Bisnis',                slug: 'ai-bisnis' },
    { name: 'Prompt Engineering',       slug: 'prompt-engineering' },
  ],
  'startup': [
    { name: 'Pendanaan',     slug: 'pendanaan' },
    { name: 'Unicorn',       slug: 'unicorn' },
    { name: 'Venture Capital', slug: 'venture-capital' },
    { name: 'IPO',           slug: 'ipo' },
    { name: 'SaaS',          slug: 'saas' },
    { name: 'Fintech',       slug: 'fintech' },
    { name: 'E-Commerce',    slug: 'e-commerce' },
    { name: 'Founder Story', slug: 'founder-story' },
  ],
  'software-development': [
    { name: 'Web Development',    slug: 'web-development' },
    { name: 'Mobile Development', slug: 'mobile-development' },
    { name: 'Backend',            slug: 'backend' },
    { name: 'Frontend',           slug: 'frontend' },
    { name: 'DevOps',             slug: 'devops' },
    { name: 'Cloud',              slug: 'cloud' },
    { name: 'Database',           slug: 'database' },
    { name: 'API',                slug: 'api' },
    { name: 'Open Source',        slug: 'open-source' },
    { name: 'Framework',          slug: 'framework' },
  ],
  'cyber-security': [
    { name: 'Data Breach',      slug: 'data-breach' },
    { name: 'Malware',          slug: 'malware' },
    { name: 'Ransomware',       slug: 'ransomware' },
    { name: 'Vulnerability',    slug: 'vulnerability' },
    { name: 'Bug Bounty',       slug: 'bug-bounty' },
    { name: 'Digital Privacy',  slug: 'digital-privacy' },
    { name: 'Hacking Ethics',   slug: 'hacking-ethics' },
    { name: 'Security Tips',    slug: 'security-tips' },
  ],
  'gadget': [
    { name: 'Smartphone',    slug: 'smartphone' },
    { name: 'Laptop',        slug: 'laptop' },
    { name: 'Tablet',        slug: 'tablet' },
    { name: 'Smartwatch',    slug: 'smartwatch' },
    { name: 'Wearable',      slug: 'wearable' },
    { name: 'Smart Home',    slug: 'smart-home' },
    { name: 'Review Gadget', slug: 'review-gadget' },
    { name: 'Aksesori',      slug: 'aksesori' },
  ],
  'kripto-blockchain': [
    { name: 'Bitcoin',         slug: 'bitcoin' },
    { name: 'Ethereum',        slug: 'ethereum' },
    { name: 'Altcoin',         slug: 'altcoin' },
    { name: 'Blockchain',      slug: 'blockchain' },
    { name: 'Web3',            slug: 'web3' },
    { name: 'DeFi',            slug: 'defi' },
    { name: 'NFT',             slug: 'nft' },
    { name: 'Stablecoin',      slug: 'stablecoin' },
    { name: 'Exchange',        slug: 'exchange' },
    { name: 'Regulasi Kripto', slug: 'regulasi-kripto' },
  ],
  'teknologi-masa-depan': [
    { name: 'Quantum Computing',         slug: 'quantum-computing' },
    { name: 'Robot Humanoid',            slug: 'robot-humanoid' },
    { name: 'Space Technology',          slug: 'space-technology' },
    { name: 'Autonomous Vehicle',        slug: 'autonomous-vehicle' },
    { name: 'Internet of Things (IoT)',  slug: 'internet-of-things' },
    { name: 'Smart City',                slug: 'smart-city' },
    { name: 'Green Technology',          slug: 'green-technology' },
    { name: 'Biotechnology',             slug: 'biotechnology' },
    { name: 'Semiconductor',             slug: 'semiconductor' },
    { name: 'AR / VR / Mixed Reality',   slug: 'ar-vr-mixed-reality' },
  ],
  'tutorial': [
    { name: 'Tutorial AI',      slug: 'tutorial-ai' },
    { name: 'Programming',      slug: 'programming' },
    { name: 'Linux',            slug: 'linux' },
    { name: 'Windows',          slug: 'windows' },
    { name: 'Android',          slug: 'android' },
    { name: 'iPhone',           slug: 'iphone' },
    { name: 'Tutorial Cloud',   slug: 'tutorial-cloud' },
    { name: 'Networking',       slug: 'networking' },
    { name: 'Produktivitas',    slug: 'produktivitas' },
  ],
  'opini': [
    { name: 'Editorial',     slug: 'editorial' },
    { name: 'Analisis',      slug: 'analisis' },
    { name: 'Tren Industri', slug: 'tren-industri' },
    { name: 'Perspektif',    slug: 'perspektif' },
    { name: 'Kolom Pakar',   slug: 'kolom-pakar' },
  ],
};

const TAGS = [
  'OpenAI', 'Google', 'Microsoft', 'Apple', 'NVIDIA', 'Meta', 'Tesla', 'Samsung',
  'xAI', 'Anthropic', 'DeepSeek', 'ChatGPT', 'Gemini', 'Claude', 'Copilot',
  'GitHub', 'Docker', 'Kubernetes', 'Raspberry Pi', 'Arduino',
  'Bitcoin', 'Ethereum', 'Solana', 'XRP',
  'iOS', 'Linux', 'Windows', 'Android',
];

/**
 * Seed idempotent: buat kategori & tag jika belum ada.
 * Dipanggil dari bootstrap di src/index.js.
 */
async function seedCategoriesAndTags(strapi) {
  const catQuery = strapi.db.query('api::category.category');
  const tagQuery = strapi.db.query('api::tag.tag');

  // ── 1. Buat top-level categories ──────────────────────────────────────────
  const parentMap = {}; // slug → id

  for (const cat of TOP_CATEGORIES) {
    const existing = await catQuery.findOne({ where: { slug: cat.slug } });
    if (existing) {
      parentMap[cat.slug] = existing.id;
      continue;
    }
    const created = await catQuery.create({ data: cat });
    parentMap[cat.slug] = created.id;
    strapi.log.info(`[Seed] Kategori dibuat: ${cat.name}`);
  }

  // ── 2. Buat sub-categories ─────────────────────────────────────────────────
  for (const [parentSlug, subs] of Object.entries(SUB_CATEGORIES)) {
    const parentId = parentMap[parentSlug];
    if (!parentId) continue;

    for (const sub of subs) {
      const existing = await catQuery.findOne({ where: { slug: sub.slug } });
      if (existing) continue;
      await catQuery.create({ data: { ...sub, parent: parentId } });
      strapi.log.info(`[Seed] Sub-kategori dibuat: ${sub.name} (parent: ${parentSlug})`);
    }
  }

  // ── 3. Buat tags ───────────────────────────────────────────────────────────
  for (const name of TAGS) {
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const existing = await tagQuery.findOne({ where: { slug } });
    if (existing) continue;
    await tagQuery.create({ data: { name, slug } });
    strapi.log.info(`[Seed] Tag dibuat: ${name}`);
  }

  strapi.log.info('[Seed] Selesai: kategori & tag berhasil di-seed.');
}

module.exports = { seedCategoriesAndTags };
