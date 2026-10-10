import {accountingLockYears} from '../src/utils/accountingYearClosure.js';
import {partnersMarkup} from '../src/utils/accountingPartners.js';
import {requestedAccountingYear} from '../src/utils/accountingYear.js';
import {reminderEngagement} from '../src/utils/accountingReminderEngagement.js';
import {accountingRootFolderMarkup} from '../src/utils/accountingFolders.js';
import {accountingAccountNumber} from '../src/utils/accountingAccountNumber.js';
import {accountsOverviewMarkup} from '../src/utils/accountsOverview.js';
import {invoiceRevisionPatch} from '../src/utils/accountingInvoiceRevision.js';
import {outgoingDunningStatus} from '../src/utils/accountingDunningStatus.js';
import {invoiceAssignmentsMarkup} from '../src/utils/invoiceAssignments.js';
import {incomingInvoicesMarkup} from '../src/utils/incomingInvoices.js';
import {bankStatementsMarkup} from '../src/utils/bankStatements.js';
import {csvTextCell,germanCsvDate} from '../src/utils/csvText.js';
import {accountingFoldersMarkup} from '../src/utils/accountingFolders.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('src/cms/accounting.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const context={accountingLockYears,partnersMarkup,requestedAccountingYear,reminderEngagement,accountingRootFolderMarkup,accountingAccountNumber,watchOverviewBookingAccounts:async()=>{},accountsOverviewMarkup,invoiceRevisionPatch,outgoingDunningStatus,invoiceAssignmentsMarkup,incomingInvoicesMarkup,bankStatementsMarkup,csvTextCell,germanCsvDate,accountingFoldersMarkup,Intl,Number,Set,Map,JSON,currentUser:()=>({role:'admin'}),isAdmin:()=>true,list:async c=>['members','accountingStatements','accountingIncomingInvoices','accountingPaymentMatches'].includes(c)?[]:[{id:'2026-001',invoiceNumber:'2026-001',memberName:'Test </script>',amountCents:80000,year:2026,paymentStatus:'unrecorded',reviewStatus:'needs_review',invoiceDate:'2026-01-01'}],cmsShell:(_,v)=>v,cmsTitle:()=>'',escapeHtml:v=>String(v??'').replaceAll('<','&lt;'),formatDate:v=>v};vm.createContext(context);vm.runInContext(source,context);
test('contributions use exact cents',()=>{assert.equal(context.parseContributionCents('800,00'),80000);assert.equal(context.parseContributionCents('180.5'),18050);for(const v of ['-1','abc','1.234,56','1.111'])assert.throws(()=>context.parseContributionCents(v));});
test('accounting dates use DD.MM.YY',()=>{assert.equal(context.formatAccountingDate('2026-01-05'),'05.01.26');assert.equal(context.formatAccountingDate(''),'');});
test('unknown payment status is never counted as paid or outstanding',()=>{const s=context.accountingSummary([{amountCents:80000,paymentStatus:'unrecorded'},{amountCents:18000,paymentStatus:'paid'},{amountCents:18000,paymentStatus:'outstanding'},{amountCents:80000,paymentStatus:'cancelled'}]);assert.equal(s.totalCents,116000);assert.equal(s.paidCents,18000);assert.equal(s.outstandingCents,18000);assert.equal(s.unrecorded,1);});
test('CSV preserves quotes, postal codes and telephone strings',()=>{const csv=context.accountingCsv([{memberName:'Test "GmbH"',invoiceNumber:'2026-001',amountCents:80000,postalCode:'01234',phone:'+49123',paymentStatus:'unrecorded'}]);assert.ok(csv.includes('"Test ""GmbH"""'));assert.ok(csv.includes(csvTextCell('800,00')));assert.ok(csv.includes(csvTextCell('01234')));assert.ok(csv.includes(csvTextCell('+49123')));});
test('page embeds valid JSON without allowing closing script tags',async()=>{const html=await context.accountingPage();const json=html.match(/data-accounting-records>([\s\S]*?)<\/script>/)[1];assert.equal(JSON.parse(json).records[0].memberName,'Test </script>');assert.ok(!json.includes('</script>'));});
test('member names use normal accounting table typography',async()=>{assert.match(await context.accountingPage(),/class="link accounting-member-name"/);});
test('linked accounting records use the member database for address and contact data',()=>{const record=context.accountingRecordWithMember({memberId:'m1',memberName:'Rechnung GmbH',street:'Alt 1',billingEmail:'alt@example.de'},[{id:'m1',name:'Mitglied GmbH',street:'Neu',houseNumber:'2',email:'neu@example.de'}]);assert.equal(record.memberName,'Rechnung GmbH');assert.equal(record.street,'Neu 2');assert.equal(record.billingEmail,'neu@example.de');assert.equal(record.canonicalMember,true);});
test('assignment opens from incoming invoices in a dialog; legacy link stays in incoming area',async()=>{const html=await context.accountingPage(new URLSearchParams('area=assignment'));assert.match(html,/data-accounting-area="incoming" >/);assert.match(html,/<dialog data-accounting-assignment-dialog/);assert.match(html,/data-incoming-assignments/);assert.doesNotMatch(html,/href="[^"]*area=assignment/);});
test('non-admin does not load financial records',async()=>{context.isAdmin=()=>false;context.list=()=>{throw new Error('financial data must not be read');};assert.match(await context.accountingPage(),/Administratoren/);});

test('regenerated paid invoice keeps payment and date visible independently from invoice creation status',()=>{
 const record={id:'2026-003',invoiceNumber:'2026-003',memberName:'KJ Technical Consulting Klaus Juli',invoiceDate:'2026-01-01',amountCents:18000,paymentStatus:'paid',paidDate:'2026-03-06',invoiceNeedsRedispatch:true,invoicePdfArtifact:{generatedAt:'2026-10-07'},reviewStatus:'reviewed'};
 const html=context.outgoingRowsMarkup([record]);
 assert.match(html,/data-dunning-status="2026-003"[^>]*>Bezahlt<\/span>/);
 assert.match(html,/06\.03\.2026/);
 assert.match(html,/data-invoice-status="2026-003"[^>]*>Neu erstellt<\/span>/);
 assert.doesNotMatch(html,/Geprüft|Prüfen|Neu erstellt · erneut senden/);
 assert.equal(outgoingDunningStatus({...record,invoiceNeedsRegeneration:true}).key,'paid');
 assert.equal(record.paidDate,'2026-03-06');
});
test('outgoing list replaces review filter and column with invoice lifecycle status',async()=>{
 context.isAdmin=()=>true;context.list=async()=>[];
 const html=await context.accountingPage();
 assert.match(html,/<label>Rechnungsstatus<\/label>/);
 assert.match(html,/>Status<\/th>/);
 assert.doesNotMatch(html,/<label>Datenprüfung|>Prüfung<\/th>|Datensätze · \d+ zur Prüfung/);
});

test('reminder level appears once; confirmed reminder send and German date appear in the status column',()=>{
 const record={id:'2026-024',invoiceNumber:'2026-024',memberName:'Sebastian Labonte',invoiceDate:'2026-01-01',amountCents:18000,paymentStatus:'outstanding',reminders:[{mailId:'reminder',level:1,queuedAt:'2026-10-07T09:26:00Z'}]};
 const mails=new Map([['reminder',{status:'sent',sentAt:'2026-10-07T09:26:00Z'}]]);
 const html=context.outgoingRowsMarkup([record],mails);
 assert.equal((html.match(/Mahnstufe 1/g)||[]).length,1);
 assert.match(html,/data-invoice-status="2026-024"[^>]*>Versendet 07\.10\.2026<\/span>/);
 assert.doesNotMatch(html,/data-outgoing-mail-feedback/);
});
test('overview has its own active accounting tab, logo and planning controls',async()=>{
 context.isAdmin=()=>true;context.list=async()=>[];
 const html=await context.accountingPage(new URLSearchParams('area=overview'));
 assert.match(html,/class="active" href="#\/cms\/accounting\?area=overview"/);
 assert.match(html,/data-accounting-area="overview" >/);
 assert.match(html,/data-overview-plan/);
 assert.match(html,/prodigitaltv-logo-claim\.png/);
});
