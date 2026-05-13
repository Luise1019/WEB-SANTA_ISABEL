// Las plantillas son archivos .hbs y .css ubicados en ./templates/.
// El worker BullMQ las lee desde el filesystem en M10.
const path = require('node:path');

module.exports = {
  templatesDir: path.join(__dirname, 'templates'),
};
