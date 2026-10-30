const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./db');
const audit = require('./audit');

const router = express.Router();

function log(req, subjek, hasil, alasan) {
  audit({
    subjek,
    endpoint: `${req.method} ${req.originalUrl}`,
    device: req.headers['x-device-id'],
    hasil,
    alasan,
  });
}

// POST /auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const deviceId = req.headers['x-device-id'];

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    log(req, username, 'deny', 'kredensial salah');
    return res.status(401).json({ error: 'Kredensial salah' });
  }

  const dev = db
    .prepare('SELECT 1 FROM devices WHERE user_id = ? AND device_id = ?')
    .get(user.id, deviceId || '');
  if (!dev) {
    log(req, username, 'deny', 'device tidak terdaftar');
    return res.status(403).json({ error: 'Device tidak terdaftar' });
  }

  const accessToken = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TTL,
  });

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = Date.now() + Number(process.env.REFRESH_HARI) * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?,?,?)').run(
    user.id, refreshToken, expiresAt
  );

  log(req, username, 'allow', 'login berhasil');
  res.json({ access_token: accessToken, refresh_token: refreshToken });
});

// POST /auth/refresh
router.post('/refresh', (req, res) => {
  const { refresh_token } = req.body || {};
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refresh_token || '');

  if (!row || row.revoked || row.expires_at < Date.now()) {
    log(req, '-', 'deny', 'refresh token tidak valid/dicabut/kedaluwarsa');
    return res.status(401).json({ error: 'Refresh token tidak valid' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TTL,
  });

  log(req, user.username, 'allow', 'refresh berhasil');
  res.json({ access_token: accessToken });
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  const { refresh_token } = req.body || {};
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refresh_token || '');

  if (!row || row.revoked) {
    log(req, '-', 'deny', 'refresh token tidak valid');
    return res.status(401).json({ error: 'Refresh token tidak valid' });
  }

  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(row.id);
  log(req, String(row.user_id), 'allow', 'logout, refresh token dicabut');
  res.json({ message: 'Logout berhasil' });
});

// POST /auth/service
router.post('/service', (req, res) => {
  const { client_id, client_secret } = req.body || {};
  const client = db.prepare('SELECT * FROM service_clients WHERE client_id = ?').get(client_id || '');

  if (!client || !bcrypt.compareSync(client_secret || '', client.secret_hash)) {
    log(req, client_id, 'deny', 'client id/secret salah');
    return res.status(401).json({ error: 'Client tidak valid' });
  }

  const token = jwt.sign({ sub: client.client_id, role: 'service' }, process.env.JWT_SECRET, {
    expiresIn: process.env.SERVICE_TTL,
  });

  log(req, client_id, 'allow', 'token service diterbitkan');
  res.json({ access_token: token });
});

module.exports = router;