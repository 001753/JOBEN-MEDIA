'use strict';

/**
 * Seed: Artikel "Juli 2026: Banjir HP Baru, Tapi Dompet Makin Tipis"
 * Idempotent — skip jika sudah ada dan lengkap.
 * Jika artikel ada tapi belum punya cover, coba upload gambar.
 */

const path = require('path');
const fs   = require('fs');

const SLUG = 'juli-2026-banjir-hp-baru-tapi-dompet-makin-tipis';

const CONTENT_BLOCKS = [
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Kalau kamu lagi nabung buat ganti HP bulan ini, selamat—Juli 2026 ini emang lagi rame-ramenya peluncuran smartphone baru. Tapi sebelum kalap checkout, ada baiknya kamu tahu dulu kenapa harga gadget belakangan ini kok kayaknya makin "gila" aja. Yuk kita bahas satu-satu.' }],
  },
  {
    type: 'heading',
    level: 2,
    children: [{ type: 'text', text: 'Serbuan HP Baru dari Berbagai Merek' }],
  },
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Jujur aja, tiap buka linimasa belakangan ini rasanya capek juga ngikutin berapa banyak HP baru yang rilis. Oppo, misalnya, udah lebih dulu gerak dengan resmi meluncurkan Reno16 Series di Indonesia pada 3 Juli kemarin. Ada tiga varian sekaligus—Reno16 F, Reno16, dan Reno16 Pro—dengan pembenahan di sisi kamera, performa, baterai, sampai fitur AI ala ColorOS terbaru. Buat kamu yang doyan segmen menengah premium, ini salah satu opsi yang layak dilirik.' }],
  },
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Nggak mau kalah, Realme juga baru aja memperkenalkan P4 Series (P4x dan P4 Lite) yang menyasar anak muda dan gamer mobile. Baterainya gede banget, sampai 8.000mAh, plus refresh rate 120Hz dan fitur "AI Gaming Partner" yang katanya bisa bantu ngatur pengaturan game secara otomatis. Kalau kamu tipe yang main game seharian dan males bolak-balik nyari colokan, ini menarik sih.' }],
  },
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Yang bikin makin heboh, Samsung dikabarkan bakal segera merilis Galaxy Z Fold 8 dan Z Flip 8 secara global, dan biasanya Indonesia kebagian jatah beberapa minggu setelahnya—jadi kalau kamu penggemar HP lipat, siap-siap aja. Di sisi lain ada juga Nothing Phone (4) yang katanya bakal bawa chipset Snapdragon kelas atas dan antarmuka Glyph generasi baru. Beberapa merek lain kayak Vivo, Xiaomi, Motorola, sampai iQoo juga udah bocor spesifikasinya di berbagai sertifikasi, tinggal menunggu tanggal rilis resminya.' }],
  },
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Intinya, kalau kamu lagi bingung mau beli HP yang mana bulan ini, wajar. Pilihannya emang lagi banyak-banyaknya.' }],
  },
  {
    type: 'heading',
    level: 2,
    children: [{ type: 'text', text: 'Tapi Kok Harga Laptop dan GPU Ikutan Naik?' }],
  },
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Nah, ini bagian yang bikin geleng-geleng kepala. Kalau kamu ngikutin dunia PC dan gaming, mungkin udah ngerasain sendiri: harga komponen komputer belakangan ini kok makin susah dijangkau ya?' }],
  },
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Penyebabnya ternyata bukan cuma inflasi biasa, tapi karena stok chip memori (RAM dan sejenisnya) banyak "dibajak" duluan sama industri AI. Perusahaan-perusahaan raksasa AI butuh chip dalam jumlah masif buat bangun data center mereka, jadi otomatis pasokan buat konsumen biasa kayak kita jadi seret. AMD bahkan udah resmi menaikkan harga GPU Kit—kombinasi chip GPU dan RAM GDDR6—sekitar 10 persen ke mitra-mitra distributornya mulai bulan ini. Efeknya bakal kerasa juga ke harga kartu grafis yang dijual ke konsumen dalam beberapa minggu ke depan.' }],
  },
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Apple pun nggak luput. Lini iPad dan Mac mereka ikut naik harga karena biaya pengadaan RAM dan SSD yang membengkak. Jadi kalau kamu udah lama incar MacBook atau iPad baru, mungkin ini saat yang tepat buat mulai pantau harga—atau justru buru-buru beli sebelum makin naik lagi.' }],
  },
  {
    type: 'heading',
    level: 2,
    children: [{ type: 'text', text: 'Jadi, Apa yang Harus Dilakukan?' }],
  },
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Kalau kamu sekadar mau ganti HP, sekarang justru waktu yang seru karena opsinya banyak dan kompetisi bikin fitur makin kaya. Tapi kalau rencananya mau rakit PC atau upgrade laptop, ada baiknya jangan buru-buru—atau justru sebaliknya, segera ambil keputusan sebelum harga makin merangkak naik. Semua tergantung kebutuhan dan seberapa sabar dompetmu menunggu situasi pasar mereda.' }],
  },
  {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Yang jelas, tren "semua serba AI" ini nggak cuma mengubah software di HP kita, tapi ternyata juga ikut menentukan berapa yang harus kita bayar buat perangkat keras. Menarik buat diikuti terus di bulan-bulan mendatang.' }],
  },
  {
    type: 'paragraph',
    children: [
      { type: 'text', text: 'Sumber: ', bold: true },
      { type: 'text', text: 'Selular.ID, Murdockcruz' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Upload gambar cover langsung ke R2 via AWS SDK, lalu buat file record di DB
// ─────────────────────────────────────────────────────────────────────────────
async function uploadCover(strapi) {
  const imagePath = path.join(__dirname, '../../attached_assets/covers/gadget-juli-2026.jpg');
  if (!fs.existsSync(imagePath)) {
    strapi.log.warn('[Seed] File gambar cover tidak ditemukan, artikel dibuat tanpa gambar.');
    return null;
  }

  const endpoint   = process.env.R2_ENDPOINT;
  const bucket     = process.env.R2_BUCKET_NAME;
  const publicUrl  = process.env.R2_PUBLIC_URL;
  const accessKey  = process.env.R2_ACCESS_KEY_ID;
  const secretKey  = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !publicUrl || !accessKey || !secretKey) {
    strapi.log.warn('[Seed] Konfigurasi R2 tidak lengkap, skip upload gambar.');
    return null;
  }

  try {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const crypto = require('crypto');

    const fileBuffer = fs.readFileSync(imagePath);
    const stats      = fs.statSync(imagePath);
    const hash       = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const key        = `${hash}.jpg`;

    const client = new S3Client({
      endpoint,
      region:      'auto',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });

    await client.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        fileBuffer,
      ContentType: 'image/jpeg',
    }));

    strapi.log.info(`[Seed] Gambar berhasil diupload ke R2: ${key}`);

    // Buat file record di Strapi upload DB
    const fileRecord = await strapi.db.query('plugin::upload.file').create({
      data: {
        name:            'gadget-juli-2026.jpg',
        alternativeText: 'Berbagai smartphone baru diluncurkan pada Juli 2026',
        caption:         'Ilustrasi peluncuran smartphone baru Juli 2026 (Selular.ID)',
        hash,
        ext:             '.jpg',
        mime:            'image/jpeg',
        size:            Math.round((stats.size / 1024) * 100) / 100,
        url:             `${publicUrl}/${key}`,
        provider:        'aws-s3',
        width:           1200,
        height:          630,
      },
    });

    strapi.log.info(`[Seed] File record dibuat, id=${fileRecord.id}`);
    return fileRecord.id;
  } catch (err) {
    strapi.log.warn(`[Seed] Gagal upload gambar: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main seed function
// ─────────────────────────────────────────────────────────────────────────────
async function seedArticleJuli2026(strapi) {
  try {
    // ── Idempotency check ────────────────────────────────────────────────────
    const existing = await strapi.db.query('api::article.article').findOne({
      where: { slug: SLUG },
      populate: ['cover_image'],
    });

    if (existing) {
      if (!existing.cover_image) {
        strapi.log.info('[Seed] Artikel Juli 2026 ada tapi belum punya cover, mencoba upload...');
        const uploadedId = await uploadCover(strapi);
        if (uploadedId) {
          await strapi.db.query('api::article.article').update({
            where: { id: existing.id },
            data: { cover_image: uploadedId },
          });
          strapi.log.info('[Seed] ✅ Cover berhasil ditambahkan ke artikel.');
        }
      } else {
        strapi.log.info('[Seed] Artikel Juli 2026 sudah lengkap, skip.');
      }
      return;
    }

    // ── Upload gambar cover ──────────────────────────────────────────────────
    const coverImageId = await uploadCover(strapi);

    // ── Cari sub-kategori "Smartphone" (child of Gadget) ────────────────────
    const category = await strapi.db.query('api::category.category').findOne({
      where: { slug: 'smartphone' },
    });

    // ── Cari tags relevan ────────────────────────────────────────────────────
    const tagNames = ['Samsung', 'Apple', 'NVIDIA', 'Android', 'iOS'];
    const tags = await strapi.db.query('api::tag.tag').findMany({
      where: { name: { $in: tagNames } },
      select: ['id', 'name'],
    });

    // ── Buat artikel ─────────────────────────────────────────────────────────
    const articleData = {
      title:            'Juli 2026: Banjir HP Baru, Tapi Dompet Makin Tipis Gara-Gara Harga Komponen Meroket',
      slug:             SLUG,
      excerpt:          'Juli 2026 jadi bulan penuh peluncuran smartphone baru dari Oppo, Realme, Samsung, hingga Nothing Phone. Tapi di balik pesta gadget ini, harga komponen seperti RAM dan GPU justru makin meroket gara-gara industri AI borong chip duluan.',
      editorial_status: 'published',
      publishedAt:      new Date().toISOString(),
      is_breaking_news: false,
      content:          CONTENT_BLOCKS,
    };

    if (category)       articleData.category     = category.id;
    if (tags.length)    articleData.tags          = tags.map((t) => t.id);
    if (coverImageId)   articleData.cover_image   = coverImageId;

    await strapi.db.query('api::article.article').create({ data: articleData });
    strapi.log.info('[Seed] ✅ Artikel Juli 2026 berhasil dibuat dan dipublikasikan.');
  } catch (err) {
    strapi.log.error(`[Seed] Gagal membuat artikel Juli 2026: ${err.message}`);
  }
}

module.exports = { seedArticleJuli2026 };
