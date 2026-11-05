// Dependency-free local static preview, confined to the dist directory.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))),'dist');
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const contents=await readFile(file);res.setHeader('Content-Type',file.endsWith('.mjs')?'application/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(contents);}catch{res.writeHead(404).end('Not found');}});
server.listen(4173,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:4173'));
