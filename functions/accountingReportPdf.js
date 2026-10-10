const PDFDocument=require('pdfkit'),path=require('node:path');
const {resolvedInvoice}=require('./accountingInvoiceRevision');
const {accountingAccountNumber,bankLedger,overviewDefaults,calculateAccountsOverview,overviewReportRows,outgoingDunningStatus}=require('./accountingReportCalculations');
const date=v=>String(v||'').replace(/^(\d{4})-(\d{2})-(\d{2}).*$/,'$3.$2.$1');
const money=v=>Number.isSafeInteger(v)?new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(v/100):'Nicht erfasst';
async function loadAccountingReport(db){
 const names=['membershipContributions','members','accountingIncomingInvoices','accountingStatements','settings'];
 const snapshots=await Promise.all(names.map(n=>db.collection(n).get()));
 const data=Object.fromEntries(names.map((n,i)=>[n,snapshots[i].docs.map(d=>({id:d.id,...d.data()}))]));
 const outgoing=data.membershipContributions.map(r=>resolvedInvoice(r,data.members.find(m=>m.id===r.memberId)||{}));
 const ids=[...new Set(outgoing.flatMap(r=>[...(r.invoiceDispatches||[]),...(r.reminders||[])].map(x=>x.mailId)).filter(Boolean))],mails={};
 for(let i=0;i<ids.length;i+=100){const docs=await db.getAll(...ids.slice(i,i+100).map(id=>db.collection('mailQueue').doc(id)));for(const d of docs)if(d.exists){const m=d.data();mails[d.id]={status:m.status,sentAt:m.sentAt?.toDate?m.sentAt.toDate().toISOString():m.sentAt};}}
 return {outgoing,incoming:data.accountingIncomingInvoices,statements:data.accountingStatements,settings:data.settings,mails,createdAt:new Date().toISOString()};
}
function generateAccountingReport(data){return new Promise((resolve,reject)=>{
 const doc=new PDFDocument({size:'A4',layout:'landscape',margin:32,bufferPages:true,info:{Title:'PROdigitalTV Buchhaltung Gesamtexport'}}),chunks=[];
 doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
 const assets=path.join(__dirname,'assets','invoice');doc.registerFont('Arial',path.join(assets,'arial.ttf'));doc.registerFont('Bold',path.join(assets,'arialbd.ttf'));
 const width=doc.page.width-64,bottom=doc.page.height-40;let y=90,section='',headers=[],widths=[];
 const assignments=data.settings?.find(s=>s.id==='accountingBookingAccounts')?.assignments||{},mails=new Map(Object.entries(data.mails||{}));
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(data.createdAt));
 function heading(){doc.image(path.join(assets,'prodigitaltv-logo-claim.png'),doc.page.width-190,24,{fit:[158,34]});doc.font('Bold').fontSize(17).fillColor('#09233e').text(section,32,28,{width:width-190});doc.font('Arial').fontSize(9).fillColor('#53647b').text('Vollständiger Datenbestand · Stand '+date(today),32,66);y=86;}
 function cells(values,bold=false,header=false){doc.font(bold?'Bold':'Arial').fontSize(header?9:8);const texts=values.map(v=>String(v??''));const heights=texts.map((s,i)=>doc.heightOfString(s,{width:widths[i]-12,lineGap:2})),h=Math.max(23,...heights.map(h=>h+12));
  if(y+h>bottom){doc.addPage();heading();cells(headers,true,true);}if(y+h>bottom)throw Error('Datensatz zu lang für eine PDF-Seite.');
  if(header||bold)doc.save().fillColor('#eef2f7').rect(32,y,width,h).fill().restore();let x=32;
  texts.forEach((s,i)=>{doc.font(bold?'Bold':'Arial').fontSize(header?9:8).fillColor('#09233e').text(s,x+6,y+6,{width:widths[i]-12,lineGap:2});x+=widths[i];});doc.strokeColor('#dce4ef').lineWidth(.4).moveTo(32,y+h).lineTo(32+width,y+h).stroke();y+=h;
 }
 function table(title,head,sizes,rows){if(section)doc.addPage();section=title;headers=head;widths=sizes.map(s=>s*width);heading();cells(headers,true,true);if(!rows.length)cells(['Keine Datensätze vorhanden',...head.slice(1).map(()=> '')]);for(const row of rows)cells(row);}
 const outgoing=[...(data.outgoing||[])].sort((a,b)=>String(a.invoiceNumber||'').localeCompare(String(b.invoiceNumber||''))),incoming=[...(data.incoming||[])].sort((a,b)=>String(a.paidDate||a.invoiceDate||'').localeCompare(String(b.paidDate||b.invoiceDate||''))),ledger=bankLedger(data.statements||[]);
 const flags=r=>[r.archived?'Archiviert':'',r.sourceFileMissing?'PDF fehlt':'',r.reviewNote||''].filter(Boolean).join('\n');
 const labels={paid:'Bezahlt',outstanding:'Offen',unrecorded:'Nicht erfasst',cancelled:'Storniert'};
 table('Ausgangsrechnungen ('+outgoing.length+')',['Konto / Rechnung','Mitglied / Rechnungsadresse','Datum / Betrag','Zahlung / Versand','Kontakt / Hinweise'],[.13,.28,.13,.20,.26],outgoing.map(r=>{
 const history=[...(r.invoiceDispatches||[]),...(r.reminders||[])].sort((a,b)=>String(b.queuedAt||'').localeCompare(String(a.queuedAt||''))),mail=mails.get(history[0]?.mailId);
 return [accountingAccountNumber(r,assignments,'outgoing')+'\n'+(r.invoiceNumber||'')+'\nDebitor '+(r.debtorNumber||'–')+'\nJahr '+(r.year||''),[r.memberName,[r.firstName,r.lastName].filter(Boolean).join(' '),r.department,r.street,[r.country,r.postalCode,r.city].filter(Boolean).join(' ')].filter(Boolean).join('\n'),date(r.invoiceDate)+'\n'+money(r.amountCents)+'\n'+(r.membershipType==='company'?'Unternehmen':'Einzelmitglied'),[outgoingDunningStatus(r,mails,today).label,r.paidDate?'Bezahlt am '+date(r.paidDate):'',r.invoiceNeedsRegeneration?'Geändert – PDF neu erstellen':r.invoiceNeedsRedispatch?'Neu erstellt – erneut senden':'',mail?.status==='sent'?'Versendet '+date(mail.sentAt):history.length?'Versand: '+(mail?.status||'unbestätigt'):''].filter(Boolean).join('\n'),[r.billingEmail,r.phone,r.mobile,r.iban,flags(r)].filter(Boolean).join('\n')];}));
 table('Eingangsrechnungen ('+incoming.length+')',['Konto / Rechnung','Lieferant / Beleg','Datum / Betrag','Zahlung / Zuordnung','IBAN / Hinweise'],[.13,.28,.17,.18,.24],incoming.map(r=>[accountingAccountNumber(r,assignments)+'\nKreditor '+(r.creditorNumber||'–')+'\n'+(r.invoiceNumber||'')+'\nBuchungsjahr '+(r.accountingPeriodYear||r.year||String(r.invoiceDate||'').slice(0,4)),[r.supplier,r.sourceName].filter(Boolean).join('\n'),date(r.invoiceDate)+'\n'+money(r.amountCents),[labels[r.paymentStatus]||'Nicht erfasst',date(r.paidDate),r.paymentMatch?'Kontobuchung zugeordnet':'Nicht zugeordnet'].filter(Boolean).join('\n'),[r.iban||'IBAN nicht erfasst',flags(r)].filter(Boolean).join('\n')]));
 const invoices=[...outgoing.map(r=>({...r,kind:'outgoing'})),...incoming.map(r=>({...r,kind:'incoming'}))];
 table('Kontoauszüge / Buchungen ('+ledger.rows.length+')',['Konto','Datum','Lieferant / Verwendungszweck','Soll/Haben','Saldo','IBAN / Rechnung / Auszug'],[.07,.10,.33,.12,.12,.26],ledger.rows.map(r=>{const inv=invoices.find(i=>i.paymentMatch?.statementId===r.statementId&&i.paymentMatch?.rowIndex===r.rowIndex);return [accountingAccountNumber(inv||r,assignments,inv?.kind),date(r.date),r.details||r.description,money(r.amountCents),money(r.balanceCents),[r.iban||'IBAN nicht erkannt',inv?[inv.invoiceNumber,inv.memberName||inv.supplier].filter(Boolean).join(' · '):'Beleg fehlt / nicht zugeordnet',r.sourceName].join('\n')];}));
 table('Kontoauszüge – Bestände und Prüfhinweise',['Datei','Zeitraum / Konto-IBAN','Anfangssaldo','Endsaldo','Prüfhinweise'],[.27,.27,.13,.13,.20],(data.statements||[]).map(s=>[s.sourceName,date(s.periodFrom)+' – '+date(s.periodTo)+'\n'+(s.accountIban||''),money(s.openingCents),money(s.closingCents),(s.warnings||[]).join('\n')]));
 const years=[...new Set([Number(today.slice(0,4)),...outgoing.map(r=>Number(r.year)),...incoming.map(r=>Number(r.accountingPeriodYear||r.year||String(r.invoiceDate||'').slice(0,4))),...ledger.rows.map(r=>Number(r.date.slice(0,4)))])].filter(y=>y>=2000&&y<=2100).sort();
 for(const year of years){const asOf=year===Number(today.slice(0,4))?today:`${year}-12-31`,planning={...overviewDefaults(year),...data.settings?.find(s=>s.id===`accountingOverview-${year}`)},s=calculateAccountsOverview({statements:data.statements,incoming,outgoing,year,asOf,planning,bookingAccounts:assignments});
 table('Kassen- & Kontenübersicht '+year+' · '+date(asOf),['Konto','Bezeichnung','Soll','Haben'],[.10,.54,.18,.18],overviewReportRows(s).map(([code,label,debit,credit])=>[code,label,debit===''?'':money(debit),credit===''?'':money(credit)]));
 for(const warning of [...s.warnings,...(s.unknown?[s.unknown+' Rechnungen mit ungeklärtem Status oder Betrag nicht als offen eingerechnet.']:[])])cells(['','Prüfhinweis: '+warning,'','']);}
 const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.page.margins.bottom=0;doc.font('Arial').fontSize(8).fillColor('#53647b').text('PROdigitalTV · Buchhaltungsdaten · Seite '+(i+1)+' / '+pages.count,32,doc.page.height-24,{width,lineBreak:false});}doc.end();
 });}
function generateAccountsOverviewPdf(summary){return new Promise((resolve,reject)=>{
 const doc=new PDFDocument({size:'A4',margin:32,bufferPages:true,info:{Title:'PROdigitalTV Kassen- und Kontenübersicht '+summary.year}}),chunks=[];
 doc.on('data',chunk=>chunks.push(chunk));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
 try{
 const assets=path.join(__dirname,'assets','invoice');doc.registerFont('Arial',path.join(assets,'arial.ttf'));doc.registerFont('Bold',path.join(assets,'arialbd.ttf'));
 const widths=[46,285,100,100],left=32,width=531,top=155,bottom=doc.page.height-48;
 const sourceRows=overviewReportRows(summary).flatMap(row=>row[1]==='Nicht steuerbare Einnahmen / Mitgliedsbeiträge'?[['','Nicht steuerbare Einnahmen','','','group'],['','Mitgliedsbeiträge','','','subgroup']]:row[1]==='Kapitalerträge / Steuern'?[['','','','','spacer']]:[row]);
 const rows=sourceRows.map(([code,label,debit,credit,kind])=>{
 if(code&&summary.accounts[code]){if(code==='2120'||code==='2121')debit=debit||'';else credit=credit||'';}
 if(label==='Buchhaltungssaldo')label='Buchhaltungs Saldo';
 if(label.startsWith('Vereinsergebnis laufendes Jahr'))label='VEREINSERGEBNIS lfd. Jahr '+summary.year;
 if(label==='HVB Bank – Übertrag Vorjahr')label='HVB Bank Vorjahr Übertrag';
 if(label==='Kassenstand gesamt inkl. offener Rechnungen')label='VEREINSERGEBNIS / Kassenstand gesamt';
 if(label==='Rücklagen')return null;
 if(label.startsWith('Geplante Projekte')){debit='';credit=summary.projects;}
 if(label.startsWith('Restbudget')){label='Rest Budget (inkl. Rücklagen) '+summary.year;debit=-summary.reserves;}
 const format=value=>value===''?'':value==null?'—':value===0?'- €':money(value);
 return {kind,spaceBefore:kind==='group'||kind==='total'||label==='HVB Bank Vorjahr Übertrag'||label.startsWith('Geplante Projekte')?6:0,values:[code,label,format(debit),format(credit)]};
 }).filter(Boolean);
 const notes=[...(summary.warnings||[]),...(summary.unknown?[summary.unknown+' Rechnungen ohne erfassten Betrag oder Zahlungsstatus.']:[])].join(' · ');
 let fontSize=9.5,heights,noteHeight;
 const measure=()=>{heights=rows.map(row=>{doc.font(row.kind==='group'||row.kind==='total'?'Bold':'Arial').fontSize(fontSize);return row.kind==='spacer'?8:Math.max(17,...row.values.map((value,i)=>doc.heightOfString(String(value),{width:widths[i]-10,lineGap:1})+8));});doc.font('Arial').fontSize(8);noteHeight=notes?doc.heightOfString(notes,{width})+12:0;};
 measure();while(top+24+heights.reduce((sum,h,i)=>sum+h+rows[i].spaceBefore,0)+noteHeight>bottom&&fontSize>8){fontSize-=.25;measure();}
 if(top+24+heights.reduce((sum,h,i)=>sum+h+rows[i].spaceBefore,0)+noteHeight>bottom)throw Error('Die Übersicht passt nicht vollständig auf eine Seite.');
 doc.image(path.join(assets,'prodigitaltv-logo-claim.png'),left,26,{fit:[300,72]});
 doc.font('Bold').fontSize(14).fillColor('#09233e').text('KASSEN- & KONTENÜBERSICHT '+summary.year,left,118,{width:width-110});
 doc.font('Arial').fontSize(10).text(date(summary.asOf),left+width-100,120,{width:100,align:'right'});
 let y=top;
 function draw(values,h,bold=false,group=false,warning=false){if(bold&&!group)doc.strokeColor('#aebdcc').lineWidth(.5).moveTo(left,y).lineTo(left+width,y).stroke();let x=left;
 values.forEach((value,i)=>{doc.font(bold?'Bold':'Arial').fontSize(fontSize).fillColor(warning?'#c62828':'#09233e').text(String(value),x+5,y+4,{width:widths[i]-10,align:i>=2?'right':'left',lineGap:1});x+=widths[i];});
 y+=h;}
 draw(['Konto','Bezeichnung','Soll','Haben'],24,true);
 rows.forEach((row,i)=>{y+=row.spaceBefore;draw(row.values,heights[i],row.kind==='group'||row.kind==='subgroup'||row.kind==='total',row.kind==='group'||row.kind==='subgroup',row.kind==='warning');});
 if(notes)doc.font('Arial').fontSize(8).fillColor('#53647b').text(notes,left,y+8,{width});
 if(doc.bufferedPageRange().count!==1)throw Error('Die Übersicht muss eine einzelne PDF-Seite sein.');
 doc.page.margins.bottom=0;doc.font('Arial').fontSize(8).fillColor('#53647b').text('PROdigitalTV · Ideeller Bereich',left,doc.page.height-30,{width,lineBreak:false});doc.end();
 }catch(error){doc.destroy();reject(error);}
 });}
 function createAccountingPdfExport({db,requireAdmin}){return async request=>{await requireAdmin(request);const data=await loadAccountingReport(db);
 if(request.data?.mode==='overview'){
 const year=Number(request.data.year),asOf=String(request.data.asOf||'');if(!Number.isInteger(year)||year<2000||year>2100||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||Number(asOf.slice(0,4))!==year||Number.isNaN(Date.parse(asOf)))throw Error('Bitte Jahr und Stichtag auswählen.');
 const planning={...overviewDefaults(year),...data.settings.find(s=>s.id==='accountingOverview-'+year)},bookingAccounts=data.settings.find(s=>s.id==='accountingBookingAccounts')?.assignments||{};
 const summary=calculateAccountsOverview({...data,year,asOf,planning,bookingAccounts}),buffer=await generateAccountsOverviewPdf(summary);
 return {filename:'PROdigitalTV-Kassen-Kontenuebersicht-'+year+'-'+asOf+'.pdf',base64:buffer.toString('base64')};
 }
 const buffer=await generateAccountingReport(data);return {filename:'PROdigitalTV-Buchhaltung-'+data.createdAt.slice(0,10)+'.pdf',base64:buffer.toString('base64')};};}
 module.exports={generateAccountingReport,generateAccountsOverviewPdf,loadAccountingReport,createAccountingPdfExport};
