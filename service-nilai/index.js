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

// GET /nilai
app.get('/nilai', (req, res) => {
  const { role, sub } = req.user;

  if (role === 'mahasiswa') {
    const rows = db
      .prepare(`SELECT n.id, k.nama AS kelas, n.nilai, n.status
                FROM nilai n JOIN kelas k ON k.id = n.kelas_id
                WHERE n.mahasiswa_id = ?`)
      .all(sub);
    return res.json(rows);
  }

  if (role === 'dosen') {
    let sql = `SELECT n.id, k.id AS kelas_id, k.nama AS kelas, u.nim, u.nama AS mahasiswa, n.nilai, n.status
               FROM nilai n
               JOIN kelas k ON k.id = n.kelas_id
               JOIN users u ON u.id = n.mahasiswa_id
               WHERE k.dosen_id = ?`;
    const params = [sub];
    if (req.query.kelas_id) {
      sql += ' AND k.id = ?';
      params.push(req.query.kelas_id);
    }
    return res.json(db.prepare(sql).all(...params));
  }

  res.status(403).json({ error: 'Role tidak diizinkan' });
});

// PUT /nilai/:id
app.put('/nilai/:id', (req, res) => {
  if (req.user.role !== 'dosen') {
    return res.status(403).json({ error: 'Hanya dosen yang boleh mengubah nilai' });
  }
  const row = db
    .prepare('SELECT n.status, k.dosen_id FROM nilai n JOIN kelas k ON k.id = n.kelas_id WHERE n.id = ?')
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Nilai tidak ditemukan' });
  if (Number(row.dosen_id) !== Number(req.user.sub)) {
    return res.status(403).json({ error: 'Kelas bukan yang Anda ampu' });
  }
  if (row.status === 'final') {
    return res.status(409).json({ error: 'Nilai sudah final' });
  }

  const nilai = Number(req.body && req.body.nilai);
  if (Number.isNaN(nilai) || nilai < 0 || nilai > 100) {
    return res.status(400).json({ error: 'Nilai harus angka 0-100' });
  }

  db.prepare('UPDATE nilai SET nilai = ? WHERE id = ?').run(nilai, req.params.id);
  res.json({ message: 'Nilai diubah', id: Number(req.params.id), nilai });
});

// Ambil token service dari gateway
async function ambilTokenService() {
  const r = await fetch(`${process.env.GATEWAY_URL}/auth/service`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SERVICE_CLIENT_ID,
      client_secret: process.env.SERVICE_CLIENT_SECRET,
    }),
  });
  if (!r.ok) throw new Error('Gagal mengambil token service');
  return (await r.json()).access_token;
}

// POST /kelas/:id/finalisasi
app.post('/kelas/:id/finalisasi', async (req, res) => {
  if (req.user.role !== 'dosen') {
    return res.status(403).json({ error: 'Hanya dosen yang boleh finalisasi' });
  }
  const kelas = db.prepare('SELECT * FROM kelas WHERE id = ?').get(req.params.id);
  if (!kelas) return res.status(404).json({ error: 'Kelas tidak ditemukan' });
  if (Number(kelas.dosen_id) !== Number(req.user.sub)) {
    return res.status(403).json({ error: 'Kelas bukan yang Anda ampu' });
  }

  const rows = db
    .prepare(`SELECT u.nim, n.nilai FROM nilai n JOIN users u ON u.id = n.mahasiswa_id
              WHERE n.kelas_id = ? AND n.nilai IS NOT NULL`)
    .all(kelas.id);

  db.prepare("UPDATE nilai SET status = 'final' WHERE kelas_id = ?").run(kelas.id);

  try {
    const tokenService = await ambilTokenService();
    const payload = rows.map((r) => ({
      nim: r.nim,
      kelas_id: kelas.id,
      nama_kelas: kelas.nama,
      nilai: r.nilai,
    }));
    const r = await fetch(`${process.env.GATEWAY_URL}/transkrip/sinkron`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenService}`,
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`Sinkron ditolak (${r.status})`);
    res.json({ message: 'Finalisasi berhasil dan transkrip tersinkron', jumlah: rows.length });
  } catch (e) {
    db.prepare("UPDATE nilai SET status = 'draft' WHERE kelas_id = ?").run(kelas.id);
    res.status(502).json({ error: 'Finalisasi dibatalkan: ' + e.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Service Nilai jalan di port ${process.env.PORT}`);
});