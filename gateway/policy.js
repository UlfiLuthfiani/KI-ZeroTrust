const db = require('./db');

function jamAkses() {
  const h = new Date().getHours();
  return h >= Number(process.env.JAM_MULAI) && h < Number(process.env.JAM_SELESAI);
}

const allow = (reason) => ({ allow: true, reason });
const deny = (reason) => ({ allow: false, reason });

function decide({ user, method, path, query }) {
  const sub = user.sub;
  const role = user.role;
  let m;

  // GET /nilai
  if (method === 'GET' && path === '/nilai') {
    if (role === 'mahasiswa') return allow('mahasiswa melihat nilai miliknya');
    if (role === 'dosen') {
      if (query.kelas_id) {
        const k = db.prepare('SELECT dosen_id FROM kelas WHERE id = ?').get(query.kelas_id);
        if (!k || Number(k.dosen_id) !== Number(sub)) return deny('kelas bukan yang diampu dosen');
      }
      return allow('dosen melihat nilai kelas yang diampu');
    }
    return deny(`role ${role} tidak boleh melihat nilai`);
  }

  // PUT /nilai/:id
  if (method === 'PUT' && (m = path.match(/^\/nilai\/(\d+)$/))) {
    if (role !== 'dosen') return deny('hanya dosen yang boleh mengubah nilai');
    const row = db
      .prepare('SELECT n.status, k.dosen_id FROM nilai n JOIN kelas k ON k.id = n.kelas_id WHERE n.id = ?')
      .get(m[1]);
    if (!row) return deny('nilai tidak ditemukan');
    if (Number(row.dosen_id) !== Number(sub)) return deny('kelas bukan yang diampu dosen');
    if (row.status === 'final') return deny('nilai sudah final');
    if (!jamAkses()) return deny('di luar jam akses');
    return allow('dosen mengubah nilai kelas yang diampu');
  }

  // POST /kelas/:id/finalisasi
  if (method === 'POST' && (m = path.match(/^\/kelas\/(\d+)\/finalisasi$/))) {
    if (role !== 'dosen') return deny('hanya dosen yang boleh finalisasi');
    const k = db.prepare('SELECT dosen_id FROM kelas WHERE id = ?').get(m[1]);
    if (!k) return deny('kelas tidak ditemukan');
    if (Number(k.dosen_id) !== Number(sub)) return deny('kelas bukan yang diampu dosen');
    if (!jamAkses()) return deny('di luar jam akses');
    return allow('dosen memfinalisasi kelas yang diampu');
  }

  // GET /transkrip/:nim
  if (method === 'GET' && (m = path.match(/^\/transkrip\/([^/]+)$/))) {
    if (role === 'admin') return allow('admin melihat semua transkrip');
    if (role === 'mahasiswa') {
      const u = db.prepare('SELECT nim FROM users WHERE id = ?').get(sub);
      if (u && u.nim === m[1]) return allow('mahasiswa melihat transkrip sendiri');
      return deny('NIM bukan milik mahasiswa ini');
    }
    return deny(`role ${role} tidak boleh melihat transkrip`);
  }

  // POST /transkrip/sinkron
  if (method === 'POST' && path === '/transkrip/sinkron') {
    if (role === 'service') return allow('token service valid');
    return deny('hanya token service yang boleh sinkron');
  }

  return deny('endpoint tidak dikenal (default deny)');
}

module.exports = { decide };