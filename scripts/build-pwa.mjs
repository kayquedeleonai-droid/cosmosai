import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const files=['/index.html','/manifest.webmanifest','/favicon.svg','/selection-cursor.svg','/knife-cursor.svg','/pan-cursor.svg','/icons/cosmos-192.png','/icons/cosmos-512.png',...(await readdir('dist/assets')).map(f=>'/assets/'+f)];
const hash=createHash('sha256');for(const f of files)hash.update(await readFile('dist'+f));
const version=hash.digest('hex').slice(0,16);
const template=await readFile('scripts/sw-template.js','utf8');
await writeFile('dist/sw.js',template.replace('__VERSION__',version).replace('__ASSETS__',JSON.stringify(files)));
console.log('PWA build:',version);
