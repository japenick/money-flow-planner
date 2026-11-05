// Produce a portable preview from controlled local modules without runtime dependencies.
// Normalize HTML line endings BEFORE hashing: browsers normalize CRLF/CR before CSP checks.
import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=async file=>(await readFile(path.join(root,file),'utf8')).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
const legacy=(await read('src/legacy.mjs')).replace(/^export\s*\{[^}]*\};?\s*$/gm,'').replace(/\bexport (?=(const|function|class)\b)/g,'');
let model=await read('src/model.mjs');
model=model.replace("import {parsePlan as parseLegacy,addMonth,thisMonth,isCash,newAccount} from './legacy.mjs';","const {parsePlan:parseLegacy,addMonth,thisMonth,isCash,newAccount}=Legacy;").replace(/^export\s*\{[^}]*\};?\s*$/gm,'').replace(/\bexport (?=(const|function|class)\b)/g,'');
const exports=['template','sample','account','income','rule','parsePlan','budget','simulate','totalIncomeCents','monthlyIncomeCents','FREQUENCIES','BUCKETS','TYPES','isCash','references','thisMonth','detailItem','itemAnnualCents','itemMonthlyCents','detailTotal','DETAIL_EXAMPLES'];
let app=await read('src/app.mjs');app=app.replace(/^import \{[^}]+\} from '\.\/model\.mjs';\r?\n/m,'const {'+exports.join(',')+'}=Model;\n');
const code='\nconst Legacy=(()=>{\n'+legacy+'\nreturn {parsePlan,addMonth,thisMonth,isCash,newAccount};\n})();\nconst Model=(()=>{\n'+model+'\nreturn {'+exports.join(',')+'};\n})();\n'+app+'\n';
if(/<\/script/i.test(code))throw Error('Unexpected script terminator in source.');
const css='\n'+await read('styles.css')+'\n';const hash=s=>createHash('sha256').update(s).digest('base64');
let html=await read('index.html');
// Callback replacements preserve literal dollar sequences in JavaScript source.
html=html.replace('<link rel="stylesheet" href="styles.css">',()=>'<style>'+css+'</style>').replace('<script type="module" src="src/app.mjs"></script>',()=>'<script type="module">'+code+'</script>');
html=html.replace("script-src 'self'; style-src 'self';",`script-src 'sha256-${hash(code)}'; style-src 'sha256-${hash(css)}';`);
await writeFile(path.join(root,'preview.html'),html);console.log('Portable preview generated, '+Buffer.byteLength(html)+' bytes.');
