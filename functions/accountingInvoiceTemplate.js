const path=require('node:path');
const TEMPLATE_VERSION='prodigitaltv-membership-layout-2026-v1';
const PAGE={width:595.32,height:841.92};
const assets=path.join(__dirname,'assets','invoice');
function drawInvoiceTemplate(doc,record){
 doc.registerFont('Invoice',path.join(assets,'arial.ttf'));
 doc.registerFont('Invoice-Bold',path.join(assets,'arialbd.ttf'));
 const x=56,width=477;
 const line=(text,left,bottom,{font='Invoice',size=10.5,color='#000000',maxWidth=width,align='left'}={})=>{
  doc.font(font).fontSize(size).fillColor(color);
  const actualWidth=doc.widthOfString(String(text));
  const offset=align==='right'?maxWidth-actualWidth:align==='center'?(maxWidth-actualWidth)/2:0;
  doc.text(String(text),left+offset,PAGE.height-bottom,{baseline:'alphabetic',lineBreak:false});
 };
 const fitted=(text,font,size,maxWidth)=>{doc.font(font).fontSize(size);while(size>7.5&&doc.widthOfString(text)>maxWidth){size-=0.25;doc.fontSize(size);}if(doc.widthOfString(text)>maxWidth)throw new Error('Text passt nicht in die Rechnungsvorlage: '+text);return size;};
 doc.image(path.join(assets,'prodigitaltv-logo-claim.png'),330,PAGE.height-798,{fit:[210,42]});
 line('PROdigitalTV e.V. - Wandalenweg 26 - 20097 Hamburg - Deutschland',x,697,{size:7.3});
 const person=[record.firstName,record.lastName].filter(Boolean).join(' ');
 const country=String(record.country||'DE').trim();const countryPrefix=['DE','D','D-','Deutschland'].includes(country)?'D-':['AT','A','A-','Österreich'].includes(country)?'A-':['GB','GB-'].includes(country)?'GB-':['CH','CH-'].includes(country)?'CH-':country.replace(/-$/,'')+'-';
 const recipient=[record.memberName,person,record.department,record.street,countryPrefix+record.postalCode+' '+record.city].filter(Boolean);
 let bottom=664;
 for(const text of recipient){line(text,x,bottom,{size:fitted(text,'Invoice',10.5,width)});bottom-=15;}
 if(record.billingEmail){bottom-=10;line(record.billingEmail,x,bottom,{size:fitted(record.billingEmail,'Invoice',10.5,width)});}
 const shift=Math.max(0,594-bottom); // Preserve room between address and date for extra address lines.
 const date=new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(record.invoiceDate+'T12:00:00Z'));
 line('Hamburg, den '+date,x,578-shift,{align:'right',maxWidth:459});
 const title='RECHNUNG '+record.invoiceNumber+' MB - '+record.memberName;
 line(title,x,548-shift,{font:'Invoice-Bold',size:fitted(title,'Invoice-Bold',10.5,width)});
 const salutation=record.personalSalutation||('Guten Tag '+(person||record.memberName)+',');
 line(salutation,x,520-shift,{size:fitted(salutation,'Invoice',10.5,width)});
 line('wir möchten uns bei Ihnen für Ihre Mitgliedschaft bei PROdigitalTV bedanken und übersenden Ihnen die',x,492-shift);
 line('Rechnung über Ihren Mitgliedsbeitrag für das Jahr '+record.year+'.',x,477-shift);
 const tableBottom=419-shift,tableTop=PAGE.height-tableBottom-28,columns=[163,157,157];
 doc.save().fillColor('#c90000').rect(x,tableTop,width,14).fill().restore();
 doc.lineWidth(1).strokeColor('#000000').rect(x,tableTop,width,28).stroke();
 for(const left of [x+columns[0],x+columns[0]+columns[1]])doc.moveTo(left,tableTop).lineTo(left,tableTop+28).stroke();
 line('Position',x+6,tableBottom+17,{font:'Invoice-Bold',size:9.5,color:'#ffffff'});
 line('Kategorie',x+169,tableBottom+17,{font:'Invoice-Bold',size:9.5,color:'#ffffff'});
 line('Beitrag in €',x+326,tableBottom+17,{font:'Invoice-Bold',size:9.5,color:'#ffffff',align:'right',maxWidth:145});
 let position='Mitgliederbeitrag '+record.year;
 if(record.contributionMonths&&record.contributionMonths<12)position+=' ('+record.contributionMonths+' Monate)';
 const category=record.membershipType==='company'?'Unternehmensmitgliedschaft':'Einzelmitgliedschaft';
 const amount=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(record.amountCents/100).replace(/\u00a0/g,' ');
 line(position,x+6,tableBottom+4,{size:fitted(position,'Invoice',9.5,151)});
 line(category,x+169,tableBottom+4,{size:fitted(category,'Invoice',9.5,145)});
 line(amount,x+326,tableBottom+4,{size:9.5,align:'right',maxWidth:145});
 line('Umsatzsteuerbefreit durch Eintrag in das Hamburger Vereinsregister unter der Nr. VR-Hamburg 19974',x,399-shift,{font:'Helvetica-Oblique',size:7.5});
 const intro='Bitte überweisen Sie den Betrag von ';
 line(intro,x,374-shift);doc.font('Invoice').fontSize(10.5);const amountX=x+doc.widthOfString(intro);
 line(amount,amountX,374-shift,{font:'Invoice-Bold'});doc.font('Invoice-Bold').fontSize(10.5);const accountX=amountX+doc.widthOfString(amount);
 line(' auf unser Konto bei der Hypo Vereinsbank',accountX,374-shift);
 line('Kontoinhaber:   PROdigitalTV',x,345-shift);
 line('IBAN              DE86100208900031410797',x,330-shift);
 line('BIC                HYVEDEMM488',x,315-shift);
 line('Mit freundlichen Grüßen',x,260-shift);
 line('PROdigitalTV',x,220-shift);line('Beate Busch',x,205-shift);line('Vorsitzende des Vorstandes',x,190-shift);
 if(190-shift<110)throw new Error('Die Rechnungsadresse ist zu lang für die einseitige Vorlage. Bitte prüfen.');
 line('PROdigitalTV - Interessengemeinschaft Digitale Medien e.V.   -   VR Hamburg 19974',0,85,{font:'Times-Roman',size:8.5,maxWidth:PAGE.width,align:'center'});
 line('Sitz des Vereins: Wandalenweg 26 - 20097 Hamburg - Deutschland',0,73,{font:'Times-Roman',size:8.5,maxWidth:PAGE.width,align:'center'});
 line('Vorsitzende des Vorstandes: Beate Busch',0,61,{font:'Times-Roman',size:8.5,maxWidth:PAGE.width,align:'center'});
 line('www.prodigitaltv.de - post@prodigitaltv.de',0,49,{font:'Times-Roman',size:8.5,color:'#0000ee',maxWidth:PAGE.width,align:'center'});
}
module.exports={drawInvoiceTemplate,TEMPLATE_VERSION,PAGE};
