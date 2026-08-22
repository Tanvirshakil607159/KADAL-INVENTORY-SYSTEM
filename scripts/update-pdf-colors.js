const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/main/utils/pdf-generator.js');
let content = fs.readFileSync(file, 'utf8');

// Replace specific colors to black #000
content = content.replace(/'#6366f1'/g, "'#000'");
content = content.replace(/'#4f46e5'/g, "'#000'");
content = content.replace(/'#10b981'/g, "'#000'");
content = content.replace(/'#ef4444'/g, "'#000'");
content = content.replace(/'#f59e0b'/g, "'#000'");
content = content.replace(/'#3b82f6'/g, "'#000'");
content = content.replace(/'#1e293b'/g, "'#000'");

// Replace white text in headers to black
content = content.replace(/color:\s*'(#fff|#ffffff)'/g, "color: '#000'");

// Fix fill colors for headers (remove the color condition for rowIndex === 0)
// 1. fillColor: (rowIndex) => rowIndex === 0 ? '#000' : null, (after replace)
content = content.replace(/fillColor:\s*\(\w*\)\s*=>\s*\w*\s*===\s*0\s*\?\s*'#000'\s*:\s*null/g, "fillColor: () => null");

// 2. fillColor: (rowIndex) => rowIndex === 0 ? '#000' : (rowIndex % 2 === 0 ? '#fafafa' : null),
content = content.replace(/fillColor:\s*\(\w*\)\s*=>\s*\w*\s*===\s*0\s*\?\s*'#000'\s*:\s*(\(.*?\))/g, "fillColor: (rowIndex) => $1");

// 3. fillColor: (rowIndex) => rowIndex === 0 ? '#000' : (rowIndex % 2 === 1 && rowIndex <= items.length ? '#f8fafc' : null),
content = content.replace(/fillColor:\s*\(\w*\)\s*=>\s*\w*\s*===\s*0\s*\?\s*'#000'\s*:\s*(\(.*?\))/g, "fillColor: (rowIndex) => $1");

// 4. totalRow.push({ text: challan.items.reduce(...), style: 'tableCell', alignment: 'right', bold: true, fillColor: '#f0f0ff' });
content = content.replace(/fillColor:\s*'#f0f0ff'/g, "fillColor: null");

// Write back
fs.writeFileSync(file, content);
console.log('Colors replaced successfully!');
