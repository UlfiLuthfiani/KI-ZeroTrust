# Sistem Nilai - Zero Trust Security

## Arsitektur
- **API Gateway (port 3000)**: PEP, Policy Engine (`policy.js`), login/token, audit log
- **Service Nilai (port 3001)**: data nilai dan kelas
- **Service Transkrip (port 3002)**: data transkrip
- **Database**: SQLite (`db/sistem_nilai.db`), dipakai bersama

## Cara menjalankan
Prasyarat: Node.js 18+.

1. Install dependensi di tiap folder:
   ```
   cd gateway && npm install
   cd ../service-nilai && npm install
   cd ../service-transkrip && npm install
   ```
2. Buat file `.env` di tiap folder. `JWT_SECRET` dan `GATEWAY_SECRET` harus sama di ketiganya.
3. Isi data awal (dari folder `gateway`):
   ```
   node seed.js
   ```
4. Jalankan di tiga terminal terpisah:
   ```
   cd gateway && node index.js
   cd service-nilai && node index.js
   cd service-transkrip && node index.js
   ```

### Contoh .env
`gateway/.env`:
```
PORT=3000
JWT_SECRET=isi-secret-acak
GATEWAY_SECRET=isi-secret-acak-lain
ACCESS_TTL=10m
SERVICE_TTL=5m
REFRESH_HARI=1
JAM_MULAI=7
JAM_SELESAI=21
```
`service-nilai/.env`:
```
PORT=3001
JWT_SECRET=sama-dengan-gateway
GATEWAY_SECRET=sama-dengan-gateway
GATEWAY_URL=http://localhost:3000
SERVICE_CLIENT_ID=service-nilai
SERVICE_CLIENT_SECRET=rahasia-service-nilai
```
`service-transkrip/.env`:
```
PORT=3002
JWT_SECRET=sama-dengan-gateway
GATEWAY_SECRET=sama-dengan-gateway
```

## Akun dan device ID (data seed)
| Username | Password | Role | NIM | Device ID |
| admin | admin123 | admin | - | DEV-ADMIN-01 |
| dosen1 | dosen123 | dosen (kelas Keamanan Informasi) | - | DEV-DOSEN-01 |
| dosen2 | dosen123 | dosen (kelas Basis Data) | - | DEV-DOSEN-02 |
| mhs1 | mhs123 | mahasiswa | 247006111001 | DEV-MHS-01 |
| mhs2 | mhs123 | mahasiswa | 247006111002 | DEV-MHS-02 |
| mhs3 | mhs123 | mahasiswa | 247006111003 | DEV-MHS-03 |

Service client: `service-nilai` / `rahasia-service-nilai`.

## Endpoint
Semua lewat gateway (`http://localhost:3000`). Header wajib selain `/auth/*`:
`Authorization: Bearer <access_token>` dan `X-Device-ID: <device>`.

| Endpoint | Siapa | Kondisi |
| POST /auth/login | semua user | kredensial valid dan device terdaftar |
| POST /auth/refresh, /auth/logout | semua user | refresh token valid dan belum dicabut |
| POST /auth/service | Service Nilai | client ID dan secret valid |
| GET /nilai | mahasiswa, dosen | mahasiswa: miliknya; dosen: kelas yang diampu |
| PUT /nilai/:id | dosen | kelas diampu, belum final, dalam jam akses |
| POST /kelas/:id/finalisasi | dosen | kelas diampu, dalam jam akses, lalu sinkron transkrip |
| GET /transkrip/:nim | mahasiswa, admin | mahasiswa: NIM sendiri; admin: semua |
| POST /transkrip/sinkron | Service Nilai | hanya token service |

## Pengujian
Gunakan curl atau Postman. Untuk melihat audit log, dari folder `gateway` jalankan `node cek-audit.js`.
Untuk demo jam akses, ubah `JAM_MULAI` dan `JAM_SELESAI` di `gateway/.env`, lalu restart gateway.