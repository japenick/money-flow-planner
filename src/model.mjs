// Monthly plan model: factories, income normalization, CSP budget, import and simulation.
// All money uses integer cents. Legacy parsing is isolated for v1/v2 setup files.
import {parsePlan as parseLegacy,addMonth,thisMonth,isCash,newAccount} from './legacy.mjs';
export {addMonth,thisMonth,isCash};
export const BUCKETS={fixed:'Fixed costs',investments:'Investments',savings:'Savings',guiltFree:'Guilt-free spending'};
export const FREQUENCIES={weekly:{label:'Weekly',year:52},biweekly:{label:'Every two weeks',year:26},semimonthly:{label:'Twice a month',year:24},monthly:{label:'Monthly',year:12},annual:{label:'Yearly',year:1}};
export const CASH_TYPES=['checking','savings','cash'];
export const TYPES=['checking','savings','cash','investment','credit'];
const c=v=>Math.round(v*100),number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e9;
const idOK=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const str=(v,n=240)=>typeof v==='string'?v.slice(0,n):'';
export const account=id=>{const a=newAccount(id);delete a.monthlyIncome;a.annualGrowth=0;return a;};
export const income=id=>({id,name:'Income stream',person:'',amount:0,frequency:'monthly',destination:'hub',active:true});
export const rule=(id,accounts)=>({id,name:'Monthly flow',enabled:true,source:accounts.find(isCash)?.id??'',destination:accounts.find(a=>a.id!==accounts.find(isCash)?.id)?.id??'',mode:'percent',value:0,basis:'household',incomeId:'',bucket:'',overflowBucket:'',condition:'always',check:accounts[0]?.id??'',threshold:0,elseMode:'skip',elseValue:0,monthlyCap:null,balanceTarget:null,alreadySent:0,overflow:''});
export function template(){
 const p={version:5,currency:'USD',startMonth:thisMonth(),months:3,accounts:[],incomes:[],rules:[],csp:{buckets:{fixed:{mode:'percent',value:55},investments:{mode:'percent',value:10},savings:{mode:'percent',value:10},guiltFree:{mode:'percent',value:25}},items:{fixed:[],investments:[],savings:[],guiltFree:[]}},meetings:{}};
 p.accounts=[{...account('hub'),name:'Income & bills',role:'Income hub'},...Object.entries(BUCKETS).map(([key,name])=>({...account(key),name,type:key==='investments'?'investment':key==='savings'?'savings':'checking',role:name}))];
 p.incomes=[income('income-1')];p.rules=Object.entries(BUCKETS).map(([key,name])=>({...rule('allocate-'+key,p.accounts),name:'Fund '+name,source:'hub',destination:key,mode:'csp',bucket:key}));return p;
}
export function sample(){const p=template();p.incomes[0].amount=5000;p.incomes[0].name='Example take-home pay';p.accounts.find(a=>a.id==='savings').balance=9500;const r=p.rules.find(r=>r.bucket==='savings');r.monthlyCap=300;r.balanceTarget=10000;r.overflow='investments';r.overflowBucket='investments';p.rules=[p.rules[0],p.rules[2],p.rules[1],p.rules[3]];return p;}
export const monthlyIncomeCents=i=>number(i.amount)&&FREQUENCIES[i.frequency]?Math.round(i.amount*100*FREQUENCIES[i.frequency].year/12):0;
export const totalIncomeCents=p=>p.incomes.filter(i=>i.active).reduce((n,i)=>n+monthlyIncomeCents(i),0);
// Detail rows describe allocations; only money-flow rules move simulated cash.
export const detailItem=id=>({id,name:'New category',owner:'',mode:'fixed',amount:0,frequency:'monthly',destination:'',notes:'',active:true});
export const DETAIL_EXAMPLES={fixed:['Housing','Utilities','Groceries','Insurance','Home maintenance','Vehicle maintenance'],savings:['Emergency fund','Travel','Gifts'],investments:['Retirement account (from take-home)','IRA (from take-home)','Brokerage'],guiltFree:['Dining out','Hobbies','Entertainment']};
export function itemMonthlyCents(item,incomeCents){if(item.active===false||!number(item.amount))return 0;return item.mode==='percent'?Math.round(incomeCents*item.amount/100):Math.round(item.amount*100*(FREQUENCIES[item.frequency??'monthly']?.year??0)/12);}
export function itemAnnualCents(item,incomeCents){if(item.active===false||!number(item.amount))return 0;return item.mode==='percent'?itemMonthlyCents(item,incomeCents)*12:Math.round(item.amount*100*(FREQUENCIES[item.frequency??'monthly']?.year??0));}
export const detailTotal=(p,key)=>p.csp.items[key].reduce((n,i)=>n+itemMonthlyCents(i,totalIncomeCents(p)),0);
export function budget(p){const total=totalIncomeCents(p),amounts={};for(const [key,b]of Object.entries(p.csp.buckets)){amounts[key]=b.mode==='items'?detailTotal(p,key):b.mode==='percent'?Math.round(total*(number(b.value)?b.value:0)/100):c(number(b.value)?b.value:0);}return {income:total,amounts,total:Object.values(amounts).reduce((n,v)=>n+v,0),remaining:total-Object.values(amounts).reduce((n,v)=>n+v,0)};}
// Import only known fields; do not retain credentials or arbitrary properties.
export function parsePlan(input){
 if(input?.version===1||input?.version===2){const old=parseLegacy(input),p=template();p.accounts=old.accounts.map(a=>{const b={...a};delete b.monthlyIncome;return b;});p.incomes=old.accounts.filter(a=>a.monthlyIncome>0).map(a=>({...income('income-'+a.id.slice(0,80)),name:a.name+' income',amount:a.monthlyIncome,destination:a.id}));p.rules=old.rules.map(r=>({...rule(r.id,p.accounts),...r}));p.currency=old.currency;p.startMonth=old.startMonth;p.months=old.months;p.meetings=old.meetings;return parsePlan(p);}
 if(input?.version===3){const oldItems=input.csp?.fixedItems;if(!Array.isArray(oldItems))throw Error('Invalid older fixed-cost details.');return parsePlan({...input,version:4,csp:{...input.csp,items:{fixed:oldItems.map(i=>({...detailItem(i.id),...i})),investments:[],savings:[],guiltFree:[]}}});}
 if(input?.version===4)return parsePlan({...input,version:5,accounts:input.accounts?.map(a=>({...a,annualGrowth:0}))});
 if(!input||input.version!==5||!Array.isArray(input.accounts)||input.accounts.length>200||!Array.isArray(input.incomes)||input.incomes.length>100||!Array.isArray(input.rules)||input.rules.length>300||!input.csp?.buckets||!input.csp.items||Object.keys(BUCKETS).some(k=>!Array.isArray(input.csp.items[k])||input.csp.items[k].length>200))throw Error('Unsupported or oversized setup file.');
 if(!['USD','EUR','GBP','CAD','AUD'].includes(input.currency)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.startMonth)||!Number.isInteger(input.months)||input.months<1||input.months>360)throw Error('Invalid currency, starting month or projection length.');
 const p={version:5,currency:input.currency,startMonth:input.startMonth,months:input.months,accounts:[],incomes:[],rules:[],csp:{buckets:{},items:{fixed:[],investments:[],savings:[],guiltFree:[]}},meetings:{}};
 const checkIds=rows=>{const seen=new Set();for(const x of rows){if(!idOK(x?.id)||seen.has(x.id))throw Error('Invalid or duplicate record ID.');seen.add(x.id);}};
 [input.accounts,input.incomes,input.rules,...Object.values(input.csp.items)].forEach(checkIds);
 p.accounts=input.accounts.map(a=>{if(!TYPES.includes(a.type))throw Error('Invalid account type.');return {...account(a.id),name:str(a.name),institution:str(a.institution),owner:str(a.owner),role:str(a.role),type:a.type,balance:a.balance,buffer:a.buffer,annualGrowth:a.annualGrowth===undefined?0:a.annualGrowth,active:a.active!==false};});
 p.incomes=input.incomes.map(i=>{if(!FREQUENCIES[i.frequency])throw Error('Invalid income frequency.');return {id:i.id,name:str(i.name),person:str(i.person),amount:i.amount,frequency:i.frequency,destination:str(i.destination,100),active:i.active!==false};});
 p.rules=input.rules.map(r=>{if(!['percent','fixed','csp'].includes(r.mode)||!['incoming','available','household','income'].includes(r.basis)||!['always','below','atleast','above','atmost'].includes(r.condition)||!['skip','percent','fixed'].includes(r.elseMode))throw Error('Invalid flow type or condition.');return {...rule(r.id,p.accounts),id:r.id,name:str(r.name),enabled:r.enabled!==false,source:str(r.source,100),destination:str(r.destination,100),mode:r.mode,value:r.value,basis:r.basis,incomeId:str(r.incomeId,100),bucket:str(r.bucket),overflowBucket:str(r.overflowBucket),condition:r.condition,check:str(r.check,100),threshold:r.threshold,elseMode:r.elseMode,elseValue:r.elseValue,monthlyCap:r.monthlyCap,balanceTarget:r.balanceTarget,alreadySent:r.alreadySent,overflow:str(r.overflow,100)};});
 for(const key of Object.keys(BUCKETS)){const b=input.csp.buckets[key];if(!b||!['percent','fixed','items'].includes(b.mode))throw Error('Invalid Conscious Spending Plan bucket.');p.csp.buckets[key]={mode:b.mode,value:b.value};}
 for(const key of Object.keys(BUCKETS))p.csp.items[key]=input.csp.items[key].map(i=>{if(!['fixed','percent'].includes(i.mode)||!FREQUENCIES[i.frequency])throw Error('Invalid category amount type or frequency.');return {...detailItem(i.id),name:str(i.name),owner:str(i.owner),mode:i.mode,amount:i.amount,frequency:i.frequency,destination:str(i.destination,100),notes:str(i.notes,2000),active:i.active!==false};});
 if(input.meetings&&typeof input.meetings==='object')for(const [month,m]of Object.entries(input.meetings).slice(0,240)){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!m||typeof m!=='object')continue;p.meetings[month]={};for(const [key,v]of Object.entries(m).slice(0,40)){if(!/^[a-zA-Z0-9_-]{1,60}$/.test(key)||['__proto__','constructor','prototype'].includes(key))continue;if(typeof v==='string'||typeof v==='boolean')p.meetings[month][key]=typeof v==='string'?v.slice(0,20000):v;}}
 for(const a of p.accounts)if(![a.balance,a.buffer,a.annualGrowth].every(v=>v===null||typeof v==='number'&&Number.isFinite(v)))throw Error('Invalid account amount.');
 for(const i of p.incomes)if(!(i.amount===null||typeof i.amount==='number'&&Number.isFinite(i.amount)))throw Error('Invalid income amount.');
 for(const r of p.rules)if(!['value','threshold','elseValue','monthlyCap','balanceTarget','alreadySent'].every(k=>r[k]===null||typeof r[k]==='number'&&Number.isFinite(r[k])))throw Error('Invalid rule amount.');
 for(const b of Object.values(p.csp.buckets))if(!(b.value===null||typeof b.value==='number'&&Number.isFinite(b.value)))throw Error('Invalid bucket amount.');
 for(const i of Object.values(p.csp.items).flat())if(!(i.amount===null||typeof i.amount==='number'&&Number.isFinite(i.amount)))throw Error('Invalid category amount.');
 return p;
}
export function errors(p){const result=[],byId=new Map(p.accounts.map(a=>[a.id,a]));
 if(!Number.isInteger(p.months)||p.months<1||p.months>360)result.push('Choose 1 to 360 months.');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.startMonth))result.push('Choose a valid first month.');
 for(const a of p.accounts){if(!a.name.trim()||![a.balance,a.buffer].every(number))result.push((a.name||'Account')+': enter a name and nonnegative opening balance/buffer.');}
 for(const a of p.accounts.filter(a=>a.active&&a.type==='investment'))if(typeof a.annualGrowth!=='number'||!Number.isFinite(a.annualGrowth)||a.annualGrowth< -100||a.annualGrowth>100)result.push(a.name+': annual growth must be between -100% and 100%.');
 for(const i of p.incomes.filter(i=>i.active)){const a=byId.get(i.destination);if(!number(i.amount)||!FREQUENCIES[i.frequency])result.push((i.name||'Income')+': enter a valid take-home amount and frequency.');if(!a||!a.active||!isCash(a))result.push((i.name||'Income')+': choose an active cash account to receive it.');}
 for(const [key,b]of Object.entries(p.csp.buckets))if(b.mode!=='items'&&(!number(b.value)||(b.mode==='percent'&&b.value>100)))result.push(BUCKETS[key]+': enter a valid budget amount.');
 for(const [key,items]of Object.entries(p.csp.items))for(const i of items.filter(i=>i.active!==false)){if(!i.name.trim()||!number(i.amount)||(i.mode==='percent'&&i.amount>100)||!FREQUENCIES[i.frequency??'monthly'])result.push(BUCKETS[key]+': complete category names, amounts and frequencies.');if(i.destination&&!byId.get(i.destination)?.active)result.push(BUCKETS[key]+': choose an active destination for '+i.name+'.');}
 for(const r of p.rules.filter(r=>r.enabled)){const a=byId.get(r.source),b=byId.get(r.destination),x=byId.get(r.overflow),n=r.name||'Flow';if(!a||!a.active||!isCash(a))result.push(n+': choose an active cash source.');if(!b||!b.active||b.id===r.source)result.push(n+': choose a different active destination.');if(r.overflow&&(!x||!x.active||[r.source,r.destination].includes(x.id)))result.push(n+': choose a different overflow account.');if(r.condition!=='always'&&(!byId.get(r.check)?.active||!number(r.threshold)))result.push(n+': complete its balance condition.');if(r.mode==='csp'&&!BUCKETS[r.bucket])result.push(n+': choose a CSP bucket.');if(r.mode!=='csp'&&(!number(r.value)||(r.mode==='percent'&&r.value>100)))result.push(n+': enter a valid amount or percentage.');if(r.elseMode!=='skip'&&(!number(r.elseValue)||(r.elseMode==='percent'&&r.elseValue>100)))result.push(n+': complete the otherwise amount.');if((r.mode==='percent'||r.elseMode==='percent')&&r.basis==='income'&&!p.incomes.some(i=>i.id===r.incomeId&&i.active))result.push(n+': choose an income stream.');if(!number(r.alreadySent)||![r.monthlyCap,r.balanceTarget].every(v=>v===null||number(v)))result.push(n+': enter nonnegative limits.');if(r.bucket&&!BUCKETS[r.bucket]||r.overflowBucket&&!BUCKETS[r.overflowBucket])result.push(n+': choose valid CSP classifications.');}
 return [...new Set(result)];}
export function simulate(p){const issues=errors(p);if(issues.length)return {errors:issues,months:[]};const byId=new Map(p.accounts.map(a=>[a.id,a])),balances=new Map(p.accounts.map(a=>[a.id,c(a.balance)])),b=budget(p),months=[];
 for(let step=0;step<p.months;step++){const opening=Object.fromEntries(balances),incoming=new Map(p.accounts.map(a=>[a.id,0])),funded=Object.fromEntries(Object.keys(BUCKETS).map(k=>[k,0])),rows=[],growth=Object.fromEntries(p.accounts.map(a=>[a.id,0]));let external=0;
  // Effective annual return, applied to opening balances. New contributions grow next month.
  for(const a of p.accounts.filter(a=>a.active&&a.type==='investment')){growth[a.id]=Math.round(balances.get(a.id)*(Math.pow(1+a.annualGrowth/100,1/12)-1));balances.set(a.id,balances.get(a.id)+growth[a.id]);}
  if([...balances.values()].some(v=>!Number.isSafeInteger(v)))return {errors:['Projection exceeds safe numeric limits. Reduce balances, growth rates or horizon.'],months:[]};
  for(const i of p.incomes.filter(i=>i.active)){const amount=monthlyIncomeCents(i);balances.set(i.destination,balances.get(i.destination)+amount);incoming.set(i.destination,incoming.get(i.destination)+amount);external+=amount;}
  for(const r of p.rules.filter(r=>r.enabled)){const source=byId.get(r.source),dest=byId.get(r.destination),v=balances.get(r.check)??0,t=c(r.threshold??0);const match=r.condition==='always'||(r.condition==='below'?v<t:r.condition==='atleast'?v>=t:r.condition==='above'?v>t:v<=t),mode=match?r.mode:r.elseMode,value=match?r.value:r.elseValue;
   const available=Math.max(0,balances.get(source.id)-c(source.buffer)),basis=r.basis==='household'?b.income:r.basis==='income'?monthlyIncomeCents(p.incomes.find(i=>i.id===r.incomeId)??{}):r.basis==='available'?available:incoming.get(source.id);
   const requested=mode==='skip'?0:mode==='csp'?Math.max(0,b.amounts[r.bucket]-funded[r.bucket]):mode==='fixed'?c(value):Math.round(basis*value/100);
   const affordable=Math.min(available,requested),capRoom=r.monthlyCap===null?Infinity:Math.max(0,c(r.monthlyCap)-(step===0?c(r.alreadySent):0));
   const room=(a,target=null)=>a.type==='credit'?Math.max(0,balances.get(a.id)):target===null?Infinity:Math.max(0,c(target)-balances.get(a.id));
   const primary=Math.min(affordable,capRoom,room(dest,r.balanceTarget)),overflowAccount=byId.get(r.overflow),overflow=overflowAccount?Math.min(affordable-primary,room(overflowAccount)):0;
   const move=(to,amount)=>{if(!amount)return;balances.set(source.id,balances.get(source.id)-amount);balances.set(to.id,balances.get(to.id)+(to.type==='credit'?-amount:amount));if(isCash(to))incoming.set(to.id,incoming.get(to.id)+amount);};move(dest,primary);if(overflowAccount)move(overflowAccount,overflow);
   if(r.bucket)funded[r.bucket]+=primary;if(r.overflowBucket)funded[r.overflowBucket]+=overflow;
   rows.push({...r,overflowDestination:r.overflow,matches:match,requested,primary,overflow,unfunded:requested-affordable,retained:affordable-primary-overflow});
  }
  const closing=Object.fromEntries(balances),net=values=>p.accounts.reduce((n,a)=>n+(a.type==='credit'?-values[a.id]:values[a.id]),0);if(!Number.isSafeInteger(net(closing)))return {errors:['Projection exceeds safe numeric limits. Reduce balances, growth rates or horizon.'],months:[]};if(net(closing)-net(opening)!==external+Object.values(growth).reduce((n,v)=>n+v,0))throw Error('Money conservation check failed.');
  months.push({month:addMonth(p.startMonth,step),opening,closing,external,funded,rows,growth});
 }
 return {errors:[],months};}
export const references=(p,id)=>p.rules.filter(r=>[r.source,r.destination,r.overflow,...(r.condition==='always'?[]:[r.check])].includes(id));


