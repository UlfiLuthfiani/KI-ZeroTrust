require('dotenv').config();
const express = require('express');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const authRouter = require('./auth');
const guard = require('./guard');

const app = express();
app.use(express.json());

app.use('/auth', authRouter);
app.use(guard); // semua selain /auth wajib lewat sini

function proxyTo(target, pathFilter) {
  return createProxyMiddleware({
    target,
    pathFilter,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-Gateway-Secret', process.env.GATEWAY_SECRET);
        fixRequestBody(proxyReq, req);
      },
    },
  });
}

app.use(proxyTo('http://localhost:3001', ['/nilai', '/kelas']));
app.use(proxyTo('http://localhost:3002', ['/transkrip']));

app.listen(process.env.PORT, () => {
  console.log(`Gateway jalan di port ${process.env.PORT}`);
});