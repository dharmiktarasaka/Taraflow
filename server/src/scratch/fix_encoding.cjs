const fs = require('fs');
const filePath = 'c:/code/Taraflow/server/src/controllers/analytics.controller.js';
let content = fs.readFileSync(filePath, 'utf8');
// Remove literal backslash followed by r at end of lines  
content = content.replace(/\\r/g, '');
fs.writeFileSync(filePath, content);
console.log('Fixed!');
