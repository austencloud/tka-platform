const fs = require('fs');
const dir = 'C:/Users/Austen/Downloads/MatthiasBarker';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
console.log('Dir ready:', dir);
