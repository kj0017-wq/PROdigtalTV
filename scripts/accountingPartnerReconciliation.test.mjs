import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {accountingRecordIsClosed} from '../src/utils/accountingYearClosure.js';
import {consolidatePartnerIbans} from '../src/utils/accountingPartnerIbans.js';
const source=fs.readFileSync(new URL('../src/utils/accountingPartnerReconciliation.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function reconcilePartnerIbans','function reconcilePartnerIbans');
function reordered(value){if(Array.isArray(value))return value.map(reordered);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reordered(v)]));return value;}
async function reconcile({registryChanged=false,invoiceChanged=false,correct=false,closedYear=false,bankLink=false}={}){
 const registry={partners:{a:{id:'a',number:'70006',kind:'creditor',name:'Julia Pijagin',ibans:[]}},version:1};
 const invoice={id:'invoice',supplier:'Julia Pijagin',accountingPartnerId:'a',creditorNumber:correct?'70006':'70001',amountCents:47600,invoiceDate:'2025-02-19'};
 const statement={id:'bank',rows:[{date:'2025-02-21',amountCents:-47600,iban:'DE04120300001089340325',description:'Julia Pijagin'}]};
 if(bankLink){invoice.iban='DE04120300001089340325';invoice.paymentMatch={statementId:'bank',rowIndex:0};}
 const data={accountingIncomingInvoices:[invoice],membershipContributions:[],accountingStatements:bankLink?[statement]:[],members:[]};
 const writes=[];
 const snapshot=(value,id='')=>({id,exists:()=>true,data:()=>structuredClone(value)});
 const firestore={collection:(_db,name)=>name,doc:(_db,collection,id)=>({collection,id}),getDocs:async name=>({docs:data[name].map(r=>snapshot(r,r.id))}),getDoc:async()=>snapshot(registry),runTransaction:async(_db,fn)=>fn({get:async ref=>{let value=ref.collection==='settings'?registry:ref.collection==='accountingStatements'?statement:invoice;value=reordered(value);if(ref.collection==='settings'&&registryChanged)value.partners.a.name='Changed';if(ref.collection!=='settings'&&invoiceChanged)value.amountCents=50000;return snapshot(value,ref.id);},update:(ref,patch)=>writes.push({ref,patch}),set:(ref,patch)=>writes.push({ref,patch})})};
 const context=vm.createContext({getFirebaseServices:async()=>({db:{},firestore,auth:{currentUser:{uid:'admin-current'}}}),loadClosedAccountingYears:async()=>new Set(closedYear?['2025']:[]),accountingRecordIsClosed,consolidatePartnerIbans,structuredClone});
 vm.runInContext(source+';globalThis.reconcile=reconcilePartnerIbans;',context);
 const result=await context.reconcile();return {result,writes};
}
test('field order differences across Firestore reads do not block the partner transaction',async()=>{const {result,writes}=await reconcile();assert.equal(result.updated,1);assert.equal(writes.length,2);assert.equal(writes[0].patch.creditorNumber,'70006');});
test('a real partner change still rejects reconciliation',async()=>{await assert.rejects(reconcile({registryChanged:true}),/Partnerliste wurde geändert/);});
test('a real invoice change still rejects reconciliation',async()=>{await assert.rejects(reconcile({invoiceChanged:true}),/Buchung wurde geändert/);});
test('already reconciled data needs no transaction writes',async()=>{const {result,writes}=await reconcile({correct:true});assert.equal(result.updated,0);assert.equal(writes.length,0);});

test('partner reconciliation never writes immutable bank statement rows',async()=>{const {result,writes}=await reconcile({bankLink:true});assert.equal(result.updated,1);assert.equal(writes.some(w=>w.ref.collection==='accountingStatements'),false);assert.equal(writes[0].patch.updatedBy,'admin-current');assert.match(writes[0].patch.updatedAt,/^\d{4}-/);});
test('closed accounting years are excluded from invoice reconciliation',async()=>{const {result,writes}=await reconcile({closedYear:true});assert.equal(result.updated,0);assert.equal(writes.length,0);});
