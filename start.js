const fs = require('fs');
const path = require('path');

let serverPath;

if (fs.existsSync(path.join(__dirname, 'LedgerLine', 'backend', 'server.js'))) {
  process.chdir(path.join(__dirname, 'LedgerLine'));
  serverPath = path.join(__dirname, 'LedgerLine', 'backend', 'server.js');
} else {
  serverPath = path.join(__dirname, 'backend', 'server.js');
}

require(serverPath);
