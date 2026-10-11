import fs from 'node:fs';
import vm from 'node:vm';
const bio=fs.readFileSync('biologia/index.html','utf8');
const lit=fs.readFileSync('lektura/index.html','utf8');
const bank=vm.runInNewContext(bio.slice(bio.indexOf('const bank='),bio.indexOf('const $=' )).split('let session')[0]+'\nbank');
const start=lit.indexOf('const mcq=');
const pools=vm.runInNewContext(lit.slice(start,lit.indexOf('const API_BASE'))+'\npools');
fs.writeFileSync('question-bank.js','// Canonical server question bank. Keep aligned with the quiz HTML; tested for equality.\nexport const biology = '+JSON.stringify(bank,null,2)+';\nexport const literature = '+JSON.stringify(pools,null,2)+';\n');
fs.writeFileSync('package.json',JSON.stringify({private:true,type:'module',scripts:{test:'node --test tests/*.test.mjs'}},null,2)+'\n');

