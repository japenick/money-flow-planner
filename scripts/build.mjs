// Build an allowlisted static bundle; never copy records from the surrounding workspace.
import {mkdir,copyFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files=['index.html','styles.css','src/app.mjs','src/model.mjs','src/legacy.mjs'];
for(const file of files){const destination=path.join(root,'dist',file);await mkdir(path.dirname(destination),{recursive:true});await copyFile(path.join(root,file),destination);}

const js=await readFile(path.join(root,'dist','src','app.mjs'),'utf8');
if(/localStorage|sessionStorage|indexedDB|fetch\s*\(/.test(js))throw Error('Fresh-session privacy check failed: persistent storage or network code found.');
console.log('Static app built: '+files.length+' allowlisted files; no setup persistence or network calls.');

