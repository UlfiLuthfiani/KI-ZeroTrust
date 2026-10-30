require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'db', 'sistem_nilai.db'));
const app = express();
app.use(express.json());

// Verifikasi ulang: gateway secret + token
app.use((req, res, next) => {
  if (req.headers['x-gateway-secret'] !== process.env.GATEWAY_SECRET) {
    return res.status(403).json({ error: 'Akses langsung ditolak (gateway secret salah)' });
  }
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ada' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
  }
  next();
});

// GET /transkrip/:nim
app.get('/transkrip/:nim', (req, res) => {
  const { role, sub } = req.user;
  if (role === 'mahasiswa') {
    const u = db.prepare('SELECT nim FROM users WHERE id = ?').get(sub);
    if (!u || u.nim !== req.params.nim) {
      return res.status(403).json({ error: 'NIM bukan milik Anda' });
    }
  } else if (role !== 'admin') {
    return res.status(403).json({ error: 'Role tidak diizinkan' });
  }
  const rows = db
    .prepare('SELECT kelas_id, nama_kelas, nilai FROM transkrip WHERE nim = ?')
    .all(req.params.nim);
  res.json({ nim: req.params.nim, transkrip: rows });
});

// POST /transkrip/sinkron (hanya token service)
app.post('/transkrip/sinkron', (req, res) => {
  if (req.user.role !== 'service') {
    return res.status(403).json({ error: 'Hanya token service yang boleh sinkron' });
  }
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const stmt = db.prepare(`
    INSERT INTO transkrip (nim, kelas_id, nama_kelas, nilai) VALUES (?,?,?,?)
    ON CONFLICT(nim, kelas_id) DO UPDATE SET nilai = excluded.nilai
  `);
  for (const it of items) {
    stmt.run(it.nim, it.kelas_id, it.nama_kelas, it.nilai);
  }
  res.json({ message: 'Sinkron berhasil', jumlah: items.length });
});

app.listen(process.env.PORT, () => {
  console.log(`Service Transkrip jalan di port ${process.env.PORT}`);
});