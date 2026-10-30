const db = require('./db');

const stmt = db.prepare(
  'INSERT INTO audit_log (waktu, subjek, endpoint, device, hasil, alasan) VALUES (?,?,?,?,?,?)'
);

function audit({ subjek, endpoint, device, hasil, alasan }) {
  stmt.run(new Date().toISOString(), subjek || '-', endpoint, device || '-', hasil, alasan);
}

module.exports = audit;