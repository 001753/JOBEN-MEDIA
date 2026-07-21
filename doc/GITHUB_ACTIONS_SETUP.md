# Setup GitHub Actions — Auto Deploy ke cPanel

Setiap `git push` ke branch `main` akan otomatis:
1. Build Strapi admin panel (production)
2. Build Next.js (production)
3. Commit hasil build ke repo
4. SSH ke cPanel → `git pull` → `npm install` → restart kedua app

---

## Secrets yang Wajib Dikonfigurasi di GitHub

Buka: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

### A. Strapi Security Keys (sama dengan yang di cPanel)

| Secret Name | Nilai |
|---|---|
| `APP_KEYS` | 4 key dipisah koma (sama persis dengan cPanel) |
| `API_TOKEN_SALT` | (sama dengan cPanel) |
| `ADMIN_JWT_SECRET` | (sama dengan cPanel) |
| `JWT_SECRET` | (sama dengan cPanel) |
| `TRANSFER_TOKEN_SALT` | (sama dengan cPanel) |

### B. Next.js Build Config

| Secret Name | Nilai |
|---|---|
| `STRAPI_API_URL` | `https://cms.news.jobenapp.cloud` |
| `STRAPI_API_TOKEN` | API token read-only dari Strapi Admin |
| `REVALIDATION_SECRET` | (sama dengan yang di Strapi & cPanel) |
| `NEXT_PUBLIC_SITE_URL` | `https://news.jobenapp.cloud` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` (kosongkan jika belum ada) |

### C. SSH ke cPanel

| Secret Name | Nilai |
|---|---|
| `CPANEL_SSH_HOST` | Hostname SSH server (misal: `server123.jobenapp.cloud` atau IP) |
| `CPANEL_SSH_USER` | Username cPanel Anda |
| `CPANEL_SSH_PRIVATE_KEY` | Isi private key SSH (lihat §Cara Buat SSH Key di bawah) |
| `CPANEL_SSH_PORT` | Port SSH (biasanya `22`, beberapa host pakai `21098`) |
| `CPANEL_APP_PATH` | Path absolut ke repo di server, misal `/home/namauser/joben-media` |

---

## Cara Buat SSH Key untuk GitHub Actions

**Di terminal lokal / Replit:**
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key -N ""
```

Ini menghasilkan dua file:
- `deploy_key` → **private key** → salin isinya ke secret `CPANEL_SSH_PRIVATE_KEY`
- `deploy_key.pub` → **public key** → tambahkan ke cPanel

**Tambahkan public key ke cPanel:**
1. Login cPanel → **SSH Access** (atau **Manage SSH Keys**)
2. Klik **Import Key** atau **Add Key**
3. Paste isi `deploy_key.pub`
4. Klik **Authorize** pada key tersebut

---

## Verifikasi Setup SSH

Test koneksi dari mesin lokal:
```bash
ssh -i deploy_key -p 22 namauser@server123.jobenapp.cloud "echo OK"
```

Jika berhasil tampil `OK`, berarti SSH credentials sudah benar.

---

## Cara cPanel Mengetahui Repo mana yang di-pull

Pastikan di server cPanel sudah ada clone repo GitHub:
```bash
# (lakukan sekali di awal via SSH atau cPanel Terminal)
cd ~
git clone https://github.com/001753/JOBEN-MEDIA.git joben-media
# Atau nama folder sesuai CPANEL_APP_PATH Anda
```

Kemudian setup Git agar bisa pull tanpa password (gunakan HTTPS dengan token atau SSH):
```bash
# Opsi 1: HTTPS dengan GitHub token (di dalam folder repo)
git remote set-url origin https://<GITHUB_USERNAME>:<GITHUB_PAT>@github.com/001753/JOBEN-MEDIA.git

# Opsi 2: SSH (lebih aman, butuh SSH key di akun GitHub)
git remote set-url origin git@github.com:001753/JOBEN-MEDIA.git
```

---

## Alur Kerja Sehari-hari

```
Developer (Replit)
      │
      │  1. Edit kode di Replit
      │  2. Test di Replit (port 5000 untuk frontend, 3001 untuk CMS)
      │  3. git add, git commit, git push origin main
      ▼
GitHub (repository)
      │
      │  4. GitHub Actions otomatis berjalan (~5-10 menit):
      │     a. Build Strapi admin panel
      │     b. Build Next.js production
      │     c. Commit build artifacts ke repo
      │     d. SSH ke cPanel
      ▼
cPanel (production)
      │
      │  5. git pull (ambil kode + build terbaru)
      │  6. npm install --production
      │  7. touch tmp/restart.txt (restart Strapi)
      │  8. touch frontend/tmp/restart.txt (restart Next.js)
      ▼
Live: https://news.jobenapp.cloud ✅
```

---

## Monitoring & Troubleshooting

**Cek status workflow:**
GitHub repo → **Actions** tab → pilih run terbaru

**Jika build Next.js gagal (Strapi tidak bisa diakses saat build):**
- Pastikan `cms.news.jobenapp.cloud` sudah live dan bisa diakses publik
- Cek `STRAPI_API_TOKEN` di GitHub Secrets masih valid

**Jika SSH deploy gagal:**
- Test koneksi SSH manual (lihat §Verifikasi Setup SSH)
- Pastikan `CPANEL_APP_PATH` sudah benar (path absolut)
- Pastikan repo sudah di-clone di server (§Cara cPanel mengetahui repo)

**Restart manual via SSH (darurat):**
```bash
ssh namauser@server123.jobenapp.cloud
cd ~/joben-media
touch tmp/restart.txt         # restart Strapi
touch frontend/tmp/restart.txt  # restart Next.js
```
