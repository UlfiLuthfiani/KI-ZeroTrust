const jwt = require('jsonwebtoken');
const db = require('./db');
const audit = require('./audit');
const { decide } = require('./policy');

function guard(req, res, next) {
  const endpoint = `${req.method} ${req.originalUrl}`;
  const device = req.headers['x-device-id'];

  const tolak = (status, subjek, alasan) => {
    audit({ subjek, endpoint, device, hasil: 'deny', alasan });
    return res.status(status).json({ error: alasan });
  };

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return tolak(401, '-', 'token tidak ada');

  let payload;
  try {
    payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch (e) {
    return tolak(401, '-', 'token tidak valid atau kedaluwarsa');
  }

  // device wajib untuk user (bukan service)
  if (payload.role !== 'service') {
    const ok = db
      .prepare('SELECT 1 FROM devices WHERE user_id = ? AND device_id = ?')
      .get(payload.sub, device || '');
    if (!ok) return tolak(403, String(payload.sub), 'device tidak terdaftar');
  }

  const d = decide({ user: payload, method: req.method, path: req.path, query: req.query });
  audit({
    subjek: String(payload.sub),
    endpoint,
    device,
    hasil: d.allow ? 'allow' : 'deny',
    alasan: d.reason,
  });
  if (!d.allow) return res.status(403).json({ error: d.reason });

  next();
}

module.exports = guard;