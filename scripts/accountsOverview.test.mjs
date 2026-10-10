import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAccountsOverview,overviewTable,overviewCsv} from '../src/utils/accountsOverview.js';
const statements=[{id:'s1',periodFrom:'2026-01-01',periodTo:'2026-10-31',sourceName:'Bank.pdf',openingCents:3448618,closingCents:3448618+18000-5010,rows:[{date:'2026-01-05',amountCents:18000},{date:'2026-10-02',amountCents:-5010}]}];
test('matched invoices classify bank entries once and open invoices affect result and net assets',()=>{
 const result=calculateAccountsOverview({statements,incoming:[{invoiceDate:'2026-09-17',amountCents:5010,accountNumber:'2600',paymentStatus:'paid',paidDate:'2026-10-02',paymentMatch:{statementId:'s1',rowIndex:1}},{invoiceDate:'2026-10-02',amountCents:23287,accountNumber:'2803',paymentStatus:'outstanding'}],outgoing:[{invoiceDate:'2026-01-01',amountCents:18000,paymentStatus:'paid',paidDate:'2026-01-05',paymentMatch:{statementId:'s1',rowIndex:0}},{invoiceDate:'2026-01-01',amountCents:72000,paymentStatus:'outstanding'}],asOf:'2026-10-07',planning:{projectsCents:215703,reservesCents:800000}});
 assert.equal(result.accounts['2600'].debit,5010);assert.equal(result.accounts['2803'].debit,23287);assert.equal(result.accounts['2120'].credit,90000);assert.equal(result.debit,28297);assert.equal(result.bank,3461608);assert.equal(result.net,3510321);assert.equal(result.budget,2494618);assert.equal(result.result,61703);
});
test('unassigned entries remain counted without guessing a nominal account; archived invoices excluded',()=>{
 const r=calculateAccountsOverview({statements,incoming:[{invoiceDate:'2026-01-01',amountCents:5010,accountNumber:'2600',archived:true,paymentMatch:{statementId:'s1',rowIndex:1}},{invoiceDate:'2026-10-03',amountCents:10000,paymentStatus:'unrecorded'}],asOf:'2026-10-07'});
 assert.equal(r.unassignedDebit,15010);assert.equal(r.unassignedCredit,18000);assert.equal(r.accounts['2600'].debit,0);assert.equal(r.unknown,0);assert.equal(r.openIncoming,10000);assert.match(overviewTable(r),/Noch keinem Konto zugeordnet/);
});
test('as-of cutoff excludes later payments and includes then unpaid invoice; missing bank is unknown',()=>{
 const r=calculateAccountsOverview({statements,incoming:[{invoiceDate:'2026-09-17',amountCents:5010,accountNumber:'2600',paymentStatus:'paid',paidDate:'2026-10-02',paymentMatch:{statementId:'s1',rowIndex:1}}],asOf:'2026-09-30'});
 assert.equal(r.openIncoming,5010);assert.equal(r.accounts['2600'].debit,5010);assert.equal(r.bookingCount,1);assert.equal(r.bank,3466618);
 assert.equal(calculateAccountsOverview().bank,null);assert.equal(calculateAccountsOverview().budget,null);
});
test('CSV uses German date and text cells; malicious labels are escaped',()=>{
 const r=calculateAccountsOverview({statements,asOf:'2026-10-07'});const csv=overviewCsv(r);assert.match(csv,/07\.10\.2026/);assert.match(csv,/34486,18/);assert.match(csv,/=""2120""/);assert.match(overviewTable(r),/Kassenstand gesamt/);
});
import {overviewAccountEntries,overviewReceiptsMarkup} from '../src/utils/accountsOverview.js';
test('account overlay contains the exact entries counted in the account, with correct PDF targets',()=>{
 const invoice={id:'notary',invoiceDate:'2026-09-17',amountCents:5010,accountNumber:'2600',supplier:'Notariat <Test>',invoiceNumber:'RE26-002',sourceName:'Notar.pdf',paymentStatus:'paid',paidDate:'2026-10-02',paymentMatch:{statementId:'s1',rowIndex:1}};
 const r=calculateAccountsOverview({statements,incoming:[invoice,{id:'open',invoiceDate:'2026-10-03',amountCents:12000,accountNumber:'2600',supplier:'Offen',sourceName:'Offen.pdf',paymentStatus:'outstanding'}],outgoing:[{id:'member',invoiceDate:'2026-01-01',amountCents:18000,invoiceNumber:'2026-001',paymentStatus:'paid',paidDate:'2026-01-05',paymentMatch:{statementId:'s1',rowIndex:0}}],asOf:'2026-10-07'});
 const entries=overviewAccountEntries(r,'2600');assert.equal(entries.length,2);assert.equal(entries.reduce((sum,e)=>sum-e.amountCents,0),r.accounts['2600'].debit);assert.equal(entries[0].invoice.id,'notary');assert.equal(entries[0].invoice.kind,'incoming');assert.equal(entries[1].status,'Offen');
 const html=overviewReceiptsMarkup(r,'2600');assert.match(html,/Notariat &lt;Test&gt;/);assert.match(html,/data-overview-receipt-pdf="0"/);assert.match(html,/RE26-002/);assert.doesNotMatch(html,/2026-001/);
 assert.equal(overviewAccountEntries(r,'2120')[0].invoice.kind,'outgoing');assert.equal(overviewAccountEntries(r,'2945').length,2);
});
test('overlay keeps missing receipts visible and supplies an empty state',()=>{
 const r=calculateAccountsOverview({statements,asOf:'2026-10-07'});assert.equal(overviewAccountEntries(r,'unassigned').length,2);assert.match(overviewReceiptsMarkup(r,'unassigned'),/Beleg fehlt/);assert.doesNotMatch(overviewReceiptsMarkup(r,'unassigned'),/data-overview-receipt-pdf/);assert.match(overviewReceiptsMarkup(r,'2600'),/keine Belege vorhanden/);assert.match(overviewTable(r),/data-overview-account="2600"/);
});
test('overlay respects selected cutoff and never duplicates paid invoice as an open entry',()=>{
 const invoice={id:'notary',invoiceDate:'2026-09-17',amountCents:5010,accountNumber:'2600',paymentStatus:'paid',paidDate:'2026-10-02',paymentMatch:{statementId:'s1',rowIndex:1}};
 const before=calculateAccountsOverview({statements,incoming:[invoice],asOf:'2026-09-30'});assert.equal(overviewAccountEntries(before,'2600')[0].status,'Offen');assert.equal(overviewAccountEntries(before,'2945').length,1);
 const after=calculateAccountsOverview({statements,incoming:[invoice],asOf:'2026-10-07'});assert.equal(overviewAccountEntries(after,'2600').length,1);assert.equal(overviewAccountEntries(after,'2600')[0].status,'Bezahlt');
});
import {saveOverviewAccount,bookingAccountKey} from '../src/utils/overviewAccountAssignment.js';
function assignmentServices(records){const writes=[];const firestore={doc:(_,collection,id)=>`${collection}/${id}`,runTransaction:async(_,action)=>action({get:async ref=>({exists:()=>Boolean(records[ref]),data:()=>structuredClone(records[ref])}),update:(ref,patch)=>writes.push({method:'update',ref,patch}),set:(ref,patch)=>writes.push({method:'set',ref,patch})})};return {get:async()=>({db:{},auth:{currentUser:{uid:'admin'}},firestore}),writes};}
test('unassigned dropdown labels include account numbers and names; saved booking is reclassified',()=>{
 const before=calculateAccountsOverview({statements,asOf:'2026-10-07'}),html=overviewReceiptsMarkup(before,'unassigned');assert.equal((html.match(/data-overview-account-select=/g)||[]).length,2);assert.match(html,/>2600 · Beratungskosten \/ Rechtsberatung \/ Notar<\/option>/);
 const after=calculateAccountsOverview({statements,asOf:'2026-10-07',bookingAccounts:{'s1:1':'2600'}});assert.equal(after.accounts['2600'].debit,5010);assert.equal(after.unassignedDebit,0);assert.equal(overviewAccountEntries(after,'unassigned').length,1);assert.equal(overviewAccountEntries(after,'2600').length,1);assert.equal(after.debit,before.debit);
});
test('invoice account assignment updates only account and audit fields, preserving payment data',async()=>{
 const invoice={id:'i1',kind:'incoming',accountNumber:'',paymentStatus:'paid',paidDate:'2026-10-02',amountCents:5010,sourceName:'Notar.pdf',paymentMatch:{statementId:'s1',rowIndex:1}};
 const fake=assignmentServices({'accountingIncomingInvoices/i1':invoice});const result=await saveOverviewAccount({invoice},'2600',['2600'],fake.get);
 assert.equal(result.collection,'accountingIncomingInvoices');assert.deepEqual(Object.keys(fake.writes[0].patch).sort(),['accountNumber','updatedAt','updatedBy']);assert.equal(invoice.paidDate,'2026-10-02');assert.equal(invoice.paymentStatus,'paid');assert.equal(fake.writes[0].patch.accountNumber,'2600');
});
test('booking assignment preserves previous settings entries and does not modify bank source',async()=>{
 const booking={statementId:'s1',rowIndex:1,date:'2026-10-02',amountCents:-5010};const fake=assignmentServices({'accountingStatements/s1':statements[0],'settings/accountingBookingAccounts':{assignments:{'old:0':'2705'}}});
 const result=await saveOverviewAccount({booking},'2600',['2600'],fake.get);assert.equal(result.bookingKey,bookingAccountKey(booking));assert.equal(fake.writes.length,1);assert.equal(fake.writes[0].ref,'settings/accountingBookingAccounts');assert.deepEqual(fake.writes[0].patch.assignments,{'old:0':'2705','s1:1':'2600'});
});
test('invalid account and concurrent invoice reassignment are refused without writes',async()=>{
 const invoice={id:'i1',kind:'incoming',accountNumber:''},fake=assignmentServices({'accountingIncomingInvoices/i1':{...invoice,accountNumber:'2803'}});
 await assert.rejects(saveOverviewAccount({invoice},'bogus',['2600'],fake.get),/gültiges Konto/);await assert.rejects(saveOverviewAccount({invoice},'2600',['2600'],fake.get),/inzwischen geändert/);assert.equal(fake.writes.length,0);
});
test('changed source booking is refused without writes',async()=>{
 const booking={statementId:'s1',rowIndex:1,date:'2026-10-02',amountCents:-9999},fake=assignmentServices({'accountingStatements/s1':statements[0]});await assert.rejects(saveOverviewAccount({booking},'2600',['2600'],fake.get),/Kontobuchung wurde geändert/);assert.equal(fake.writes.length,0);
});

test('unassigned and unrecorded incoming invoices remain open until bank payment is linked',()=>{const invoice={id:'pending',invoiceDate:'2026-10-01',amountCents:23287,paymentStatus:'unrecorded'};const pending=calculateAccountsOverview({incoming:[invoice],asOf:'2026-10-07'});assert.equal(pending.openIncoming,23287);assert.equal(pending.unassignedDebit,23287);assert.equal(pending.entries.unassigned[0].status,'Offen');const manual=calculateAccountsOverview({incoming:[{...invoice,paymentStatus:'paid',paidDate:'2026-10-02'}],asOf:'2026-10-07'});assert.equal(manual.openIncoming,23287);const bank={id:'payment',sourceName:'Bank.pdf',periodFrom:'2026-10-01',periodTo:'2026-10-31',openingCents:100000,closingCents:76713,rows:[{date:'2026-10-05',amountCents:-23287}]};const linked={...invoice,paymentMatch:{statementId:'payment',rowIndex:0}};assert.equal(calculateAccountsOverview({statements:[bank],incoming:[linked],asOf:'2026-10-07'}).openIncoming,0);assert.equal(calculateAccountsOverview({statements:[bank],incoming:[linked],asOf:'2026-10-04'}).openIncoming,23287);});

test('APR late prior-year invoice is excluded before its allocated period and counted once in 2026',()=>{const bank={id:'apr',periodFrom:'2026-06-01',periodTo:'2026-06-30',openingCents:500000,closingCents:80000,rows:[{date:'2026-06-25',amountCents:-420000,accountNumber:'2804'}]},invoice={id:'apr2026',invoiceDate:'2025-12-18',year:2026,accountingPeriodYear:2026,amountCents:420000,accountNumber:'2804',paymentStatus:'paid',paidDate:'2026-06-25',paymentMatch:{statementId:'apr',rowIndex:0}};const old=calculateAccountsOverview({statements:[bank],incoming:[invoice],year:2025});assert.equal(old.openIncoming,0);assert.equal(old.accounts['2804'].debit,0);const early=calculateAccountsOverview({statements:[bank],incoming:[invoice],year:2026,asOf:'2026-01-31'});assert.equal(early.openIncoming,420000);assert.equal(early.accounts['2804'].debit,420000);const paid=calculateAccountsOverview({statements:[bank],incoming:[invoice],year:2026,asOf:'2026-12-31'});assert.equal(paid.openIncoming,0);assert.equal(paid.accounts['2804'].debit,420000);assert.equal(paid.bank,80000);});
