// Pure calculations mirrored from the CMS; regenerate with scripts/buildAccountingReportCalculations.cjs.
function accountingAccountNumber(record,assignments={},kind='incoming'){const direct=String(record.accountNumber||'').trim();if(record.paymentMatch&&direct)return direct;const booking=record.paymentMatch||record;if(booking.statementId&&Number.isInteger(booking.rowIndex)){const value=assignments[`${booking.statementId}:${booking.rowIndex}`];if(value)return value;}if(direct)return direct;return kind==='outgoing'?'2120':'';}

function bankLedger(statements){const sorted=[...statements].sort((a,b)=>a.periodFrom.localeCompare(b.periodFrom)||a.sourceName.localeCompare(b.sourceName));const warnings=sorted.flatMap(s=>s.warnings||[]);const accountIbans=[...new Set(sorted.map(s=>s.accountIban).filter(Boolean))];if(accountIbans.length>1)warnings.push('Die Auszüge gehören zu unterschiedlichen IBANs. Bitte getrennt einlesen.');let previous=null;const rows=[];let debitCents=0,creditCents=0;for(const statement of sorted){if(previous&&(statement.periodFrom<previous.periodTo||statement.openingCents!==previous.closingCents))warnings.push(`Lücke oder Überschneidung vor ${statement.sourceName}.`);for(const {rowIndex,row}of statement.rows.map((row,rowIndex)=>({row,rowIndex})).sort((a,b)=>(a.row.postingOrder??a.rowIndex)-(b.row.postingOrder??b.rowIndex))){if(row.amountCents<0)debitCents+=row.amountCents;else creditCents+=row.amountCents;rows.push({...row,sourceName:statement.sourceName,statementId:statement.id||statement.sourceHash||'',rowIndex});}previous=statement;}return {rows,warnings,accountIbans,openingCents:sorted[0]?.openingCents??0,openingDate:sorted[0]?.openingDate||'',debitCents,creditCents,closingCents:sorted.at(-1)?.closingCents??0};}

const overviewAccounts=[['2120','Echte Mitgliedsbeiträge','credit'],['2560','Reisekostenerstattungen','debit'],['2600','Beratungskosten / Rechtsberatung / Notar','debit'],['2701','Büromaterial','debit'],['2703','Bankspesen','debit'],['2705','Internetkosten','debit'],['2801','Vereinsmitteilungen, Flyer, Broschüren, Abos','debit'],['2802','Messen und Kongresse','debit'],['2803','Medienfrühstücke (Veranstaltungen)','debit'],['2804','GEMA','debit'],['2895','Öffentlichkeitsarbeit','debit'],['2900','Sonstige Kosten ideeller Bereich','debit'],['2121','Kapitalzinsen','credit'],['2702','Kapitalsteuer','debit'],['0100','Webportal (Anlagevermögen)','asset'],['2706','Abschreibungen Webportal','debit']];
const money=n=>n==null?'—':new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function overviewDefaults(year){return {projectsCents:year===2026?215703:0,reservesCents:year===2026?800000:0};}
function fixedAssetDepreciation(invoice,year,asOf){
 const asset=invoice.fixedAsset;if(!asset||asset.archived||!Number.isSafeInteger(asset.costCents)||asset.costCents<=0||asset.durationMonths!==36||!/^\d{4}-(0[1-9]|1[0-2])$/.test(asset.startMonth||''))return null;
 const monthIndex=value=>Number(value.slice(0,4))*12+Number(value.slice(5,7))-1,start=monthIndex(asset.startMonth),end=monthIndex(asOf),beforeYear=year*12-1;
 const elapsed=point=>Math.max(0,Math.min(asset.durationMonths,point-start+1));
 const accumulated=point=>Math.round(asset.costCents*elapsed(point)/asset.durationMonths);
 return {invoice,name:asset.name||'Anlagegut',costCents:asset.costCents,startMonth:asset.startMonth,durationMonths:asset.durationMonths,months:Math.max(0,elapsed(end)-elapsed(beforeYear)),depreciationCents:Math.max(0,accumulated(end)-accumulated(beforeYear)),accumulatedCents:accumulated(end),carryingCents:asset.costCents-accumulated(end)};
}
function calculateAccountsOverview({statements=[],incoming=[],outgoing=[],year=2026,asOf=`${year}-12-31`,planning=overviewDefaults(year),bookingAccounts={}}={}){
 const start=`${year}-01-01`,end=asOf<`${year}-12-31`?asOf:`${year}-12-31`;
 const selected=statements.filter(s=>s.periodFrom<=end&&s.periodTo>=start);
 const ledger=bankLedger(selected),allRows=ledger.rows.filter(r=>r.date<=end),rows=allRows.filter(r=>r.date>=start);
 const active=r=>!r.archived&&r.paymentStatus!=='cancelled';
 const invoices=[...incoming.filter(active).map(r=>({...r,kind:'incoming'})),...outgoing.filter(active).map(r=>({...r,kind:'outgoing'}))];
 const assets=incoming.filter(active).filter(invoice=>invoice.invoiceDate&&invoice.invoiceDate<=end).map(invoice=>fixedAssetDepreciation(invoice,year,`${year}-12-31`)).filter(Boolean),capitalizedByInvoice=new Map();
 const accounts=Object.fromEntries(overviewAccounts.map(([code])=>[code,{debit:0,credit:0}]));
 let unassignedDebit=0,unassignedCredit=0,openIncoming=0,openOutgoing=0,unknown=0;
 const entries=Object.fromEntries([...overviewAccounts.map(([code])=>code),'unassigned','2945'].map(code=>[code,[]]));
 const add=(code,amount,invoice=null,booking=null)=>{if(amount<0&&invoice?.kind==='incoming'){const asset=assets.find(a=>a.invoice.id===invoice.id);if(asset)capitalizedByInvoice.set(invoice.id,Math.min(asset.costCents,(capitalizedByInvoice.get(invoice.id)||0)-amount));}const account=accounts[String(code)]?String(code):'unassigned';entries[account].push({invoice,booking,amountCents:amount,date:booking?.date||invoice?.invoiceDate||'',status:invoice?.sourceFileMissing?'PDF fehlt':booking?(invoice?'Bezahlt':'Beleg fehlt'):'Offen'});const entry=accounts[String(code)];if(entry)entry[amount<0?'debit':'credit']+=Math.abs(amount);else if(amount<0)unassignedDebit+=-amount;else unassignedCredit+=amount;};
 for(const row of rows){const invoice=invoices.find(i=>i.paymentMatch?.statementId===row.statementId&&i.paymentMatch?.rowIndex===row.rowIndex);add(accountingAccountNumber(invoice||row,bookingAccounts,invoice?.kind==='outgoing'?'outgoing':'incoming'),row.amountCents,invoice||null,row);entries['2945'].push({invoice:invoice||null,booking:row,amountCents:row.amountCents,date:row.date,status:invoice?'Zugeordnet':'Beleg fehlt'});}
 for(const invoice of invoices){const periodYear=Number(invoice.accountingPeriodYear),recognitionDate=Number.isInteger(periodYear)&&periodYear>=2000&&periodYear<=2100?`${periodYear}-01-01`:invoice.invoiceDate;if(!invoice.invoiceDate||!recognitionDate||recognitionDate>end)continue;
  const paidDate=invoice.paidDate||invoice.paymentMatch?.bookingDate||'';
  const matchedRow=allRows.find(r=>r.statementId===invoice.paymentMatch?.statementId&&r.rowIndex===invoice.paymentMatch?.rowIndex)||statements.find(s=>(s.id||s.sourceHash)===invoice.paymentMatch?.statementId)?.rows?.[invoice.paymentMatch?.rowIndex];
  const bankPaid=Boolean(matchedRow&&matchedRow.date<=end&&matchedRow.amountCents<0);
  const paid=invoice.kind==='incoming'?bankPaid:Boolean(matchedRow&&matchedRow.date<=end)||(paidDate&&paidDate<=end&&(invoice.paymentStatus==='paid'||invoice.paymentMatch));
  if(paid)continue;
  const knownOpen=invoice.kind==='incoming'||invoice.paymentStatus==='outstanding'||(invoice.paymentStatus==='paid'&&paidDate>end);
  if(!knownOpen||!Number.isSafeInteger(invoice.amountCents)){unknown++;continue;}
  if(invoice.kind==='incoming')openIncoming+=invoice.amountCents;else openOutgoing+=invoice.amountCents;
  if(recognitionDate>=start)add(accountingAccountNumber(invoice,bookingAccounts,invoice.kind),invoice.kind==='incoming'?-invoice.amountCents:invoice.amountCents,invoice);
 }
 const cashDebit=Object.values(accounts).reduce((sum,account)=>sum+account.debit,unassignedDebit),cashCredit=Object.values(accounts).reduce((sum,account)=>sum+account.credit,unassignedCredit);
 for(const asset of assets){
  const originalAccount=accountingAccountNumber(asset.invoice,bookingAccounts,'incoming'),capitalized=capitalizedByInvoice.get(asset.invoice.id)||0;
  if(originalAccount!=='0100'&&capitalized){if(accounts[originalAccount])accounts[originalAccount].debit-=capitalized;else unassignedDebit-=capitalized;const source=entries[originalAccount]||entries.unassigned;entries['0100'].push(...source.filter(entry=>entry.invoice?.id===asset.invoice.id));entries[originalAccount in entries?originalAccount:'unassigned']=source.filter(entry=>entry.invoice?.id!==asset.invoice.id);}
  if(!entries['0100'].some(entry=>entry.invoice?.id===asset.invoice.id))entries['0100'].push({invoice:{...asset.invoice,kind:'incoming'},booking:null,amountCents:-asset.costCents,date:asset.invoice.invoiceDate,status:'Anlagegut'});
  if(asset.accumulatedCents)entries['0100'].push({invoice:{...asset.invoice,kind:'incoming'},booking:null,amountCents:asset.accumulatedCents,date:year+'-12-31',status:'Abschreibung kumuliert'});
  if(asset.depreciationCents){accounts['2706'].debit+=asset.depreciationCents;entries['2706'].push({invoice:{...asset.invoice,kind:'incoming'},booking:null,amountCents:-asset.depreciationCents,date:year+'-12-31',status:'Jahresabschreibung'});}
 }
 if(assets.length){accounts['0100'].debit=assets.reduce((sum,asset)=>sum+asset.costCents,0);accounts['0100'].credit=assets.reduce((sum,asset)=>sum+asset.accumulatedCents,0);}
 const expenseAccounts=overviewAccounts.filter(([, ,kind])=>kind!=='asset').map(([code])=>accounts[code]);
 const debit=expenseAccounts.reduce((sum,account)=>sum+account.debit,unassignedDebit),credit=expenseAccounts.reduce((sum,account)=>sum+account.credit,unassignedCredit);
 const opening=selected.length?ledger.openingCents+allRows.filter(r=>r.date<start).reduce((s,r)=>s+r.amountCents,0):null;
 const bank=opening==null?null:opening+rows.reduce((s,r)=>s+r.amountCents,0);
 const net=bank==null?null:bank+openOutgoing-openIncoming;
 const capitalizedCents=[...capitalizedByInvoice.values()].reduce((sum,value)=>sum+value,0),depreciationCents=assets.reduce((sum,asset)=>sum+asset.depreciationCents,0);
 return {year,asOf:end,entries,accounts,debit,credit,assets,capitalizedCents,depreciationCents,cashResult:cashCredit-cashDebit,result:credit-debit,opening,bank,openIncoming,openOutgoing,net,projects:planning.projectsCents||0,reserves:planning.reservesCents||0,budget:net==null?null:net-(planning.projectsCents||0)-(planning.reservesCents||0),unassignedDebit,unassignedCredit,unknown,warnings:ledger.warnings,bookingCount:rows.length};
}
function overviewReportRows(s){const used=code=>s.accounts[code].debit>0||s.accounts[code].credit>0,expenses=overviewAccounts.filter(([code,,kind])=>kind==='debit'&&code!=='2702'&&used(code)),capital=overviewAccounts.filter(([code])=>['2121','2702'].includes(code)&&used(code));return [
 ['','IDEELLER BEREICH','','','group'],
 ...(used('2120')?[['','Nicht steuerbare Einnahmen / Mitgliedsbeiträge','','','group'],['2120',overviewAccounts[0][1],s.accounts['2120'].debit,s.accounts['2120'].credit]]:[]),
 ...(expenses.length?[['','Ausgaben','','','group'],...expenses.map(([code,label])=>[code,label,s.accounts[code].debit,s.accounts[code].credit])]:[]),
 ...(capital.length?[['','Kapitalerträge / Steuern','','','group'],...capital.map(([code,label])=>[code,label,s.accounts[code].debit,s.accounts[code].credit])]:[]),
 ...(s.unassignedDebit||s.unassignedCredit?[['','Noch keinem Konto zugeordnet',s.unassignedDebit,s.unassignedCredit,'warning']]:[]),
 ['','Buchhaltungssaldo',s.debit,s.credit,'total'],

 ['','Vereinsergebnis laufendes Jahr '+s.year,'',s.result,'total'],
 ...(s.accounts['0100'].debit>s.accounts['0100'].credit?[['','ANLAGEVERMÖGEN','','','group'],['0100','Webportal (Restbuchwert zum Jahresende)','',s.accounts['0100'].debit-s.accounts['0100'].credit]]:[]),
 ['','HVB Bank – Übertrag Vorjahr','',s.opening],['','Offene Eingangsrechnungen',s.openIncoming,''],['','Offene Ausgangsrechnungen','',s.openOutgoing],['2945','Guthaben HVB','',s.bank,'total'],
 ['','Kassenstand gesamt inkl. offener Rechnungen','',s.net,'total'],['',`Geplante Projekte bis Ende ${s.year}`,s.projects,''],['','Rücklagen',s.reserves,''],['',`Restbudget ${s.year}`,'',s.budget,'total']];}

function berlinToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
const day=value=>{const raw=String(value||'');const s=raw.includes('T')&&Number.isFinite(Date.parse(raw))?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(raw)):raw.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const n=Date.parse(s+'T12:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:null;};
const plus=(n,days)=>new Date(n+days*86400000).toISOString().slice(0,10);
function outgoingDunningStatus(record,mails=new Map(),today=berlinToday()){
 if(record.paymentStatus!=='outstanding')return {label:{paid:'Bezahlt',cancelled:'Storniert',unrecorded:'Nicht erfasst'}[record.paymentStatus]||'Nicht erfasst',key:record.paymentStatus,level:0};
 const now=day(today);if(now===null)return {label:'Offen',key:'outstanding',level:0};
 const sent=(history)=>history.map(item=>({item,mail:mails.get(item.mailId)})).filter(x=>x.mail?.status==='sent'&&day(x.mail.sentAt||x.item.queuedAt)!==null);
 const reminders=sent(record.reminders||[]).sort((a,b)=>Number(b.item.level)-Number(a.item.level));
 if(reminders.length){const last=reminders[0];const start=day(last.mail.sentAt||last.item.queuedAt);const elapsed=Math.max(0,Math.floor((now-start)/86400000));const level=Math.min(5,Number(last.item.level)+Math.floor(elapsed/30));return {label:level>=5?'Vakant':'Mahnstufe '+level,key:level>=5?'vacant':'reminder_'+level,level,nextDate:level>=5?'':plus(start,(Math.floor(elapsed/30)+1)*30),sentLevel:Number(last.item.level)};}
 const invoices=sent(record.invoiceDispatches||[]).map(x=>day(x.mail.sentAt||x.item.queuedAt)).sort((a,b)=>a-b);
 if(!invoices.length)return {label:'Offen',key:'outstanding',level:0,note:'Rechnungsversand noch nicht bestätigt'};
 const start=invoices[0],elapsed=Math.max(0,Math.floor((now-start)/86400000));const level=elapsed<90?0:Math.min(5,1+Math.floor((elapsed-90)/30));
 return {label:level>=5?'Vakant':level?'Mahnstufe '+level:'Offen',key:level>=5?'vacant':level?'reminder_'+level:'outstanding',level,nextDate:level>=5?'':plus(start,level?90+level*30:90)};
}

module.exports={accountingAccountNumber,bankLedger,overviewAccounts,overviewDefaults,calculateAccountsOverview,overviewReportRows,fixedAssetDepreciation,outgoingDunningStatus};
