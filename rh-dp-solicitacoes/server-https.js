const https = require('https');
const fs = require('fs');
const path = require('path');
const next = require('next');

const port = 3000;
const hostname = '0.0.0.0';

const app = next({
  dev: false,
  dir: __dirname
});

const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('C:\\Certificados\\sgi\\sgi.ergengenharia.com.br-key.pem'),
  cert: fs.readFileSync('C:\\Certificados\\sgi\\sgi.ergengenharia.com.br-chain.pem')
};

app.prepare().then(() => {
  https.createServer(httpsOptions, (req, res) => {
    handle(req, res);
  }).listen(port, hostname, () => {
    console.log(`Servidor HTTPS rodando em https://sgi.ergengenharia.com.br:${port}`);
  });
});
