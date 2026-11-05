// Non-browser smoke tests exercise every view and key UI state transitions.
// These do not claim pixel layout, accessibility-tree or real-browser verification.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const listeners=new Map(),windows=new Map(),elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',dataset:{},handlers:new Map(),addEventListener(t,f){this.handlers.set(t,f);},setAttribute(){},focus(){}});return elements.get(id);};
globalThis.document={activeElement:null,querySelector:s=>element(s.slice(1)),querySelectorAll:()=>[],getElementById:element,addEventListener(t,f){listeners.set(t,f);},createElement:()=>({click(){}})};
globalThis.window={addEventListener(t,f){windows.set(t,f);}};globalThis.confirm=()=>true;
await import('../src/app.mjs');
const view=()=>element('view').innerHTML;
const click=control=>listeners.get('click')({target:{closest:()=>control}});
const tab=id=>click({dataset:{tab:id}});
const action=(a,id='')=>click({dataset:{action:a,id}});
const change=(kind,id,key,value,type='text')=>listeners.get('change')({target:{dataset:{kind,id,key},value,type}});
test('every section renders with a fresh zero-income template',()=>{for(const t of ['income','accounts','csp','flows','projection','review']){tab(t);assert.ok(view().length>300);assert.ok(!view().includes('undefined'));}});
test('income input changes CSP allocations and the money-flow preview',()=>{change('income','income-1','amount','5000','number');tab('income');assert.ok(view().includes('$5,000.00'));tab('csp');assert.ok(view().includes('$2,750.00'));tab('flows');assert.ok(view().includes('CSP bucket remainder'));assert.ok(view().includes('$1,250.00'));});
test('percentage-of-household-income option is visible and selectable',()=>{change('rule','allocate-fixed','mode','percent');tab('flows');assert.ok(view().includes('Total household take-home income'));assert.ok(view().includes('A selected income stream'));change('rule','allocate-fixed','basis','household');change('rule','allocate-fixed','value','55','number');assert.ok(view().includes('$2,750.00'));});
test('fixed-cost items can be added and used instead of percentage budget',()=>{action('add-item','fixed');tab('csp');assert.ok(view().includes('New category'));change('bucket','fixed','mode','items');assert.ok(view().includes('selected>Sum of category line items'));});
test('new visit resets to basic template instead of remembering inputs',()=>{windows.get('pageshow')({persisted:true});tab('income');assert.ok(view().includes('$0.00'));assert.ok(!view().includes('$5,000.00'));});
test('sample overflow preserves destination names in UI',()=>{element('example-plan').handlers.get('click')();tab('flows');assert.ok(view().includes('Overflow to Investments'));assert.ok(view().includes('$200.00'));});
test('account deletion blocks references rather than breaking flows',()=>{action('delete-account','hub');assert.ok(element('status').textContent.includes('referencing'));tab('accounts');assert.ok(view().includes('Income &amp; bills'));});
test('user-entered names are HTML-escaped',()=>{change('account','hub','name','<img src=x onerror=alert(1)>');tab('accounts');assert.ok(view().includes('&lt;img'));assert.ok(!view().includes('<img src=x'));});
test('browser code contains no persistence or network calls',async()=>{const code=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');assert.doesNotMatch(code,/localStorage|sessionStorage|indexedDB|fetch\s*\(/);assert.ok(code.includes('let plan=template()'));});

test('all buckets have editable category details and common categories never duplicate',()=>{windows.get('pageshow')({persisted:true});for(const key of ['fixed','savings','investments','guiltFree']){action('example-items',key);tab('csp');assert.ok(view().includes('Category / purpose'));assert.ok(view().includes('Person / owner (optional)'));assert.ok(view().includes('Category timeframe'));change('bucket',key,'mode','items');}assert.ok(view().includes('Travel'));assert.ok(view().includes('Brokerage'));const count=(view().match(/data-action="delete-item"/g)||[]).length;action('example-items','savings');assert.equal((view().match(/data-action="delete-item"/g)||[]).length,count);change('detail-savings',view().match(/data-id="([^" ]+)" data-key="name"[^>]*value="Travel"/)[1],'amount','100','number');assert.ok(view().includes('$100.00 / month'));});
