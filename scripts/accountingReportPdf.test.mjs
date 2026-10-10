import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {calculateAccountsOverview} from '../src/utils/accountsOverview.js';
const require=createRequire(import.meta.url),server=require('../functions/accountingReportCalculations');
test('PDF and CMS share exact balances, account mappings and open totals',()=>{
const data={statements:[{id:'s',sourceName:'A.pdf',periodFrom:'2026-01-01',periodTo:'2026-10-31',openingCents:100000,closingCents:113000,rows:[{date:'2026-03-01',amountCents:18000},{date:'2026-03-02',amountCents:-5000}]}],outgoing:[{invoiceDate:'2026-01-01',amountCents:18000,paymentStatus:'paid',paymentMatch:{statementId:'s',rowIndex:0}}],incoming:[{invoiceDate:'2026-03-01',amountCents:5000,paymentStatus:'paid',paymentMatch:{statementId:'s',rowIndex:1}},{invoiceDate:'2026-04-01',amountCents:12000,paymentStatus:'outstanding',accountNumber:'2803'}],bookingAccounts:{'s:1':'2705'},year:2026,asOf:'2026-10-07'};
assert.deepEqual(server.calculateAccountsOverview(data),calculateAccountsOverview(data));
});
test('export authorization failure prevents reading private financial data',async()=>{let reads=0;const fn=require('../functions/accountingReportPdf').createAccountingPdfExport({db:{collection(){reads++;}},requireAdmin:async()=>{throw Error('Admin required');}});await assert.rejects(fn({}),/Admin required/);assert.equal(reads,0);});
