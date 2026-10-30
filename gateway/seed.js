const bcrypt = require('bcryptjs');
const db = require('./db');

db.exec(`
DELETE FROM audit_log; DELETE FROM refresh_tokens; DELETE FROM transkrip;
DELETE FROM nilai; DELETE FROM kelas; DELETE FROM devices;
DELETE FROM service_clients; DELETE FROM users;
`);

db.exec("DELETE FROM sqlite_sequence");

const addUser = db.prepare(
  'INSERT INTO users (username, password_hash, nama, role, nim) VALUES (?,?,?,?,?)'
);
const addDevice = db.prepare('INSERT INTO devices (user_id, device_id) VALUES (?,?)');

function user(username, password, nama, role, nim, device) {
  const id = addUser.run(username, bcrypt.hashSync(password, 10), nama, role, nim)
    .lastInsertRowid;
  addDevice.run(id, device);
  return id;
}

user('admin', 'admin123', 'Admin Prodi', 'admin', null, 'DEV-ADMIN-01');
const dosen1 = user('dosen1', 'dosen123', 'Dosen Satu', 'dosen', null, 'DEV-DOSEN-01');
const dosen2 = user('dosen2', 'dosen123', 'Dosen Dua', 'dosen', null, 'DEV-DOSEN-02');
const mhs1 = user('mhs1', 'mhs123', 'Mahasiswa Satu', 'mahasiswa', '247006111001', 'DEV-MHS-01');
const mhs2 = user('mhs2', 'mhs123', 'Mahasiswa Dua', 'mahasiswa', '247006111002', 'DEV-MHS-02');
const mhs3 = user('mhs3', 'mhs123', 'Mahasiswa Tiga', 'mahasiswa', '247006111003', 'DEV-MHS-03');

const addKelas = db.prepare('INSERT INTO kelas (nama, dosen_id) VALUES (?,?)');
const k1 = addKelas.run('Keamanan Informasi', dosen1).lastInsertRowid;
const k2 = addKelas.run('Basis Data', dosen2).lastInsertRowid;

const addNilai = db.prepare(
  "INSERT INTO nilai (kelas_id, mahasiswa_id, nilai, status) VALUES (?,?,?, 'draft')"
);
[[k1, mhs1, 85], [k1, mhs2, 78], [k1, mhs3, 90],
 [k2, mhs1, 80], [k2, mhs2, 88], [k2, mhs3, 75]]
  .forEach(r => addNilai.run(...r));

db.prepare('INSERT INTO service_clients (client_id, secret_hash) VALUES (?,?)')
  .run('service-nilai', bcrypt.hashSync('rahasia-service-nilai', 10));

console.log('Seed selesai.');