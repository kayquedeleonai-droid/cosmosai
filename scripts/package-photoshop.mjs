import {readFile,writeFile} from 'node:fs/promises';
// Uncompressed ZIP, no third-party packaging/runtime dependencies.
function crc32(bytes){let c=0xffffffff;for(const byte of bytes){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
const files=['manifest.json','index.html','style.css','crop-core.js','main.js'].map(file=>({from:'photoshop-plugin/'+file,name:'plugin/'+file}));
files.push({from:'public/cosmos-selection-bridge.cjs',name:'cosmos-selection-bridge.cjs'},...['LEIA-ME.txt','iniciar-conector.cmd'].map(file=>({from:'photoshop-plugin/'+file,name:file})));
const local=[],central=[];let offset=0;
for(const file of files){
 const data=await readFile(file.from),name=Buffer.from(file.name),crc=crc32(data),header=Buffer.alloc(30),directory=Buffer.alloc(46);
 header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
 directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x800,8);directory.writeUInt16LE(33,14);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(data.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);
 local.push(header,name,data);central.push(directory,name);offset+=header.length+name.length+data.length;
}
const end=Buffer.alloc(22),dir=Buffer.concat(central);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
await writeFile('public/cosmos-photoshop-plugin.zip',Buffer.concat([...local,dir,end]));
console.log('Photoshop plugin + local connector packaged.');
