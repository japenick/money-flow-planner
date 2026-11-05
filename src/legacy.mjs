// Monthly money-flow model. Sections: plan factories, import/migration, validation,
// ordered transfers and month-by-month simulation. Every calculation uses cents.
export const ACCOUNT_TYPES=['checking','savings','cash','investment','credit'];
export const CURRENCIES=['USD','EUR','GBP','CAD','AUD'];
const CASH=new Set(['checking','savings','cash']);
const MODES=['percent','fixed'];
const BASES=['incoming','available'];
const CONDITIONS=['always','below','atleast','above','atmost'];
const LIMIT=10000000000;
const idOK=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const text=(v,max=240)=>typeof v==='string'?v.slice(0,max):'';
const numeric=v=>v===null||typeof v==='number'&&Number.isFinite(v);
const nonnegative=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=LIMIT;
export const toCents=v=>Math.round(v*100);
export const isCash=a=>Boolean(a&&CASH.has(a.type));
export function thisMonth(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
export function addMonth(month,offset){const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+offset,1));return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');}
export function blankPlan(){return {version:2,origin:'user',currency:'USD',startMonth:thisMonth(),months:3,accounts:[],rules:[],meetings:{},spendingPlanUrl:''};}
export function newAccount(id){return {id,name:'New account',institution:'',type:'checking',owner:'',role:'',balance:0,monthlyIncome:0,buffer:0,active:true};}
export function newRule(id,accounts){const source=accounts.find(a=>a.active&&isCash(a))?.id??'';return {id,name:'New monthly flow',enabled:true,source,destination:accounts.find(a=>a.active&&a.id!==source)?.id??'',mode:'percent',value:0,basis:'incoming',condition:'always',check:source,threshold:0,elseMode:'skip',elseValue:0,monthlyCap:null,balanceTarget:null,alreadySent:0,overflow:''};}
export function examplePlan(){
 const p=blankPlan();p.origin='example';
 p.accounts=[{...newAccount('example-a'),name:'Account A',balance:1000,monthlyIncome:5000,buffer:1000,role:'Income & bills'},{...newAccount('example-b'),name:'Savings B',type:'savings',balance:9500,role:'Savings goal'},{...newAccount('example-xyz'),name:'Overflow XYZ',type:'investment',role:'Investments'},{...newAccount('example-bills'),name:'Bills account',role:'Bills'}];
 p.rules=[{...newRule('example-rule',p.accounts),name:'20% to savings, then XYZ',source:'example-a',destination:'example-b',value:20,monthlyCap:500,balanceTarget:10000,overflow:'example-xyz'}, {...newRule('example-fixed',p.accounts),name:'Fixed monthly bills allocation',source:'example-a',destination:'example-bills',mode:'fixed',value:1500}];
 return p;
}
// Reconstruct only known fields. Imported state never supplies code or source metadata.
export function parsePlan(input){
 if(input?.version===1)return migrateV1(input);
 if(!input||input.version!==2||!Array.isArray(input.accounts)||input.accounts.length>200||!Array.isArray(input.rules)||input.rules.length>300)throw Error('Unsupported plan format or too many accounts/rules.');
 if(!CURRENCIES.includes(input.currency)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.startMonth)||!Number.isInteger(input.months)||input.months<1||input.months>60)throw Error('Choose a supported currency, starting month and 1-60 simulation months.');
 const accountIds=new Set(),ruleIds=new Set();
 const accounts=input.accounts.map(a=>{
  if(!a||!idOK(a.id)||accountIds.has(a.id)||!ACCOUNT_TYPES.includes(a.type)||typeof a.name!=='string'||!['balance','monthlyIncome','buffer'].every(k=>numeric(a[k])))throw Error('An account has an invalid ID, type or amount.');
  accountIds.add(a.id);return {id:a.id,name:text(a.name),institution:text(a.institution),owner:text(a.owner),role:text(a.role),type:a.type,balance:a.balance,monthlyIncome:a.monthlyIncome,buffer:a.buffer,active:a.active!==false};
 });
 const rules=input.rules.map(r=>{
  if(!r||!idOK(r.id)||ruleIds.has(r.id)||!MODES.includes(r.mode)||!BASES.includes(r.basis)||!CONDITIONS.includes(r.condition)||!['skip',...MODES].includes(r.elseMode)||!['value','threshold','elseValue','monthlyCap','balanceTarget','alreadySent'].every(k=>numeric(r[k])))throw Error('A rule has an invalid ID, amount or condition.');
  ruleIds.add(r.id);return {id:r.id,name:text(r.name),enabled:r.enabled!==false,source:text(r.source,100),destination:text(r.destination,100),mode:r.mode,value:r.value,basis:r.basis,condition:r.condition,check:text(r.check,100),threshold:r.threshold,elseMode:r.elseMode,elseValue:r.elseValue,monthlyCap:r.monthlyCap,balanceTarget:r.balanceTarget,alreadySent:r.alreadySent,overflow:text(r.overflow,100)};
 });
 const meetings={};
 if(input.meetings&&typeof input.meetings==='object'&&!Array.isArray(input.meetings))for(const [month,m]of Object.entries(input.meetings).slice(0,240)){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!m||typeof m!=='object')continue;
  meetings[month]={};for(const [key,val]of Object.entries(m).slice(0,40))if(/^[a-zA-Z0-9_-]{1,60}$/.test(key)&&!['__proto__','constructor','prototype'].includes(key)&&(typeof val==='string'||typeof val==='boolean'))meetings[month][key]=typeof val==='string'?val.slice(0,20000):val;
 }
 return {version:2,origin:input.origin==='example'?'example':'user',currency:input.currency,startMonth:input.startMonth,months:input.months,accounts,rules,meetings,spendingPlanUrl:text(input.spendingPlanUrl,2000)};
}
export function migrateV1(old){
 if(!old.meta||!old.balances||!Array.isArray(old.rules))throw Error('The older plan is missing its account labels or balances.');
 const p=blankPlan();
 p.accounts=Object.entries(old.meta).map(([id,m])=>({...newAccount(id),name:text(m?.alias)||'Imported account',role:text(m?.role),type:m?.role==='Investments'?'investment':m?.role==='Card payments'?'credit':'checking',balance:old.balances[id]??0,monthlyIncome:id===old.source?old.deposit??0:0,buffer:id===old.source?old.reserve??0:0,active:m?.included!==false}));
 p.rules=old.rules.map(r=>({...newRule(r.id,p.accounts),id:r.id,name:text(r.name),enabled:r.enabled!==false,source:old.source,destination:r.destination,value:r.percent,basis:'incoming',condition:r.condition,check:r.check,threshold:r.threshold,elseMode:r.condition==='always'?'skip':'percent',elseValue:r.otherPercent,balanceTarget:r.cap??null}));
 p.meetings=old.meetings??{};return parsePlan(p);
}
export function planErrors(p){
 const errors=[];const accounts=new Map(p.accounts.map(a=>[a.id,a]));
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.startMonth)||!Number.isInteger(p.months)||p.months<1||p.months>60)errors.push('Choose a starting month and 1-60 months to simulate.');
 if(!CURRENCIES.includes(p.currency))errors.push('Choose a supported plan currency.');
 for(const a of p.accounts){
  if(!a.name.trim())errors.push('An account needs a name.');
  if(!['balance','monthlyIncome','buffer'].every(k=>nonnegative(a[k])))errors.push(a.name+': balances, income and buffers must be nonnegative amounts.');
  if(!isCash(a)&&a.monthlyIncome>0)errors.push(a.name+': recurring income belongs in a cash, checking or savings account.');
 }
 for(const r of p.rules.filter(r=>r.enabled)){
  const src=accounts.get(r.source),dst=accounts.get(r.destination),check=accounts.get(r.check),extra=accounts.get(r.overflow);
  const name=r.name||'Unnamed rule';
  if(!src||!src.active||!isCash(src))errors.push(name+': choose an active cash source.');
  if(!dst||!dst.active||dst.id===r.source)errors.push(name+': choose an active destination different from the source.');
  if(r.overflow&&(!extra||!extra.active||extra.id===r.source||extra.id===r.destination))errors.push(name+': overflow must be a different active account.');
  if(r.condition!=='always'&&(!check||!check.active||!nonnegative(r.threshold)))errors.push(name+': choose a condition account and a nonnegative threshold.');
  if(!nonnegative(r.value)||(r.mode==='percent'&&r.value>100))errors.push(name+': enter a valid amount or a percentage from 0 to 100.');
  if(r.elseMode!=='skip'&&(!nonnegative(r.elseValue)||(r.elseMode==='percent'&&r.elseValue>100)))errors.push(name+': enter a valid otherwise amount.');
  if(!nonnegative(r.alreadySent)||![r.monthlyCap,r.balanceTarget].every(v=>v===null||nonnegative(v)))errors.push(name+': limits and amount already sent must be nonnegative.');
 }
 return [...new Set(errors)];
}
const conditionMet=(r,balances)=>{const v=balances.get(r.check)??0,t=toCents(r.threshold);return r.condition==='always'||(r.condition==='below'?v<t:r.condition==='atleast'?v>=t:r.condition==='above'?v>t:v<=t);};
const destinationRoom=(a,balances,target=null)=>a.type==='credit'?Math.max(0,balances.get(a.id)):target===null?Infinity:Math.max(0,toCents(target)-balances.get(a.id));
export function simulatePlan(p){
 const errors=planErrors(p);if(errors.length)return {errors,months:[]};
 if(!p.accounts.length)return {errors:[],months:[]};
 const accounts=new Map(p.accounts.map(a=>[a.id,a]));const balances=new Map(p.accounts.map(a=>[a.id,toCents(a.balance)]));
 const months=[];
 for(let index=0;index<p.months;index++){
  const month=addMonth(p.startMonth,index),opening=Object.fromEntries(balances),incoming=new Map(p.accounts.map(a=>[a.id,0]));let incomeTotal=0;const rows=[];
  for(const a of p.accounts.filter(a=>a.active&&isCash(a))){const income=toCents(a.monthlyIncome);balances.set(a.id,balances.get(a.id)+income);incoming.set(a.id,income);incomeTotal+=income;}
  for(const r of p.rules.filter(r=>r.enabled)){
   const source=accounts.get(r.source),destination=accounts.get(r.destination),matches=conditionMet(r,balances);
   const mode=matches?r.mode:r.elseMode,value=matches?r.value:r.elseValue;
   const available=Math.max(0,balances.get(source.id)-toCents(source.buffer));
   const basis=r.basis==='incoming'?incoming.get(source.id):available;
   const requested=mode==='skip'?0:mode==='fixed'?toCents(value):Math.round(basis*value/100);
   const funded=Math.min(requested,available),monthlyRoom=r.monthlyCap===null?Infinity:Math.max(0,toCents(r.monthlyCap)-(index===0?toCents(r.alreadySent):0));
   const targetRoom=destinationRoom(destination,balances,r.balanceTarget);
   const primary=Math.min(funded,monthlyRoom,targetRoom);const excess=funded-primary;
   const overflowAccount=accounts.get(r.overflow);
   const overflow=overflowAccount?Math.min(excess,destinationRoom(overflowAccount,balances)):0;
   const transfer=(to,amount)=>{if(!amount)return;balances.set(source.id,balances.get(source.id)-amount);balances.set(to.id,balances.get(to.id)+(to.type==='credit'?-amount:amount));if(isCash(to))incoming.set(to.id,incoming.get(to.id)+amount);};
   transfer(destination,primary);if(overflowAccount)transfer(overflowAccount,overflow);
   const limits=[];if(primary<funded&&monthlyRoom<=primary)limits.push('monthly contribution limit');if(primary<funded&&targetRoom<=primary)limits.push(destination.type==='credit'?'card balance':'destination target');
   rows.push({id:r.id,name:r.name,source:r.source,destination:r.destination,overflowDestination:r.overflow,matches,mode,value,basis,requested,primary,overflow,unfunded:requested-funded,retained:funded-primary-overflow,limits});
  }
  const closing=Object.fromEntries(balances),net=values=>p.accounts.reduce((sum,a)=>sum+(a.type==='credit'?-values[a.id]:values[a.id]),0);
  const netChange=net(closing)-net(opening);
  if(netChange!==incomeTotal)throw Error('Internal reconciliation failed.');
  months.push({month,opening,closing,incomeTotal,rows,transferred:rows.reduce((n,r)=>n+r.primary+r.overflow,0),overflow:rows.reduce((n,r)=>n+r.overflow,0),unfunded:rows.reduce((n,r)=>n+r.unfunded,0)});
 }
 return {errors:[],months};
}
export function accountReferences(p,id){return p.rules.filter(r=>[r.source,r.destination,r.overflow,...(r.condition==='always'?[]:[r.check])].includes(id));}
export function removeAccount(p,id){if(accountReferences(p,id).length)throw Error('This account is used by a rule. Change or delete those rules first.');return {...p,accounts:p.accounts.filter(a=>a.id!==id)};}

