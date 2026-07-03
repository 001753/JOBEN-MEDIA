---
name: Strapi v5 upload & Next.js quirks
description: Upload image to R2 bypass; populate[content]=true 400 error; BlocksRenderer use client
---

## Strapi v5 Upload Service — bypass saat bootstrap

Strapi's internal upload service (`strapi.plugin('upload').service('upload').upload()`) tidak bisa dipakai selama bootstrap karena membutuhkan `file.path` (string) yang divalidasi via `fs.stat()` di pipeline internal. Passing `stream: fs.createReadStream(path)` saja tidak cukup.

**Solusi terbukti:** Upload langsung ke R2 dengan `@aws-sdk/client-s3` (`PutObjectCommand`), lalu buat file record manual via `strapi.db.query('plugin::upload.file').create({ data: {...} })`.

**Why:** Strapi upload pipeline mengexpect temp file di disk; AWS SDK sudah tersedia sebagai transitive dependency dari `@strapi/provider-upload-aws-s3`.

**How to apply:** Gunakan pattern ini di seed scripts atau bootstrap code yang perlu upload gambar ke R2.

---

## Strapi v5 API — `populate[content]=true` menyebabkan 400

Field `content` (Blocks/rich text) di Strapi v5 adalah JSON scalar, bukan relasi. Memanggil `populate[content]=true` menghasilkan HTTP 400 Bad Request dari Strapi API.

**Why:** Blocks field tidak bisa di-populate (bukan entity relation).

**How to apply:** Jangan tambahkan `populate[content]=true` ke query string. Blocks content sudah include secara default di response.

---

## Next.js App Router — BlocksRenderer butuh `'use client'`

`BlocksRenderer` dari `@strapi/blocks-react-renderer` adalah Client Component. Jika custom `BlocksRenderer` wrapper tidak punya `'use client'`, Next.js akan error: "Functions cannot be passed directly to Client Components".

**Why:** Props `blocks` dan `modifiers` berisi JSX functions yang tidak bisa di-serialize untuk dikirim dari Server Component ke Client Component.

**How to apply:** Selalu tambahkan `'use client'` di top of `components/BlocksRenderer.js`.
