const {assertAccountingWritable,accountingClosedYears,updateOpenAccountingRecord}=require('./accountingYearClosure');
const {allocatePartner}=require('./accountingPartners');
const {createHash}=require('node:crypto');
const normalize=value=>String(value||'').trim().toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu,'');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function activeMember(member){return ['company','individual'].includes(member.membershipType)&&!['inactive','cancelled','archived','deleted','draft'].includes(String(member.status||'').toLowerCase())&&!['inactive','cancelled','archived','deleted'].includes(String(member.membershipAccessStatus||'').toLowerCase());}
function contributionPeriod(member,year,annualCents){
 const entered=String(member.membershipStartDate||'').trim();
 if(entered&&(!/^\d{4}-\d{2}-\d{2}$/.test(entered)||new Date(entered+'T12:00:00Z').toISOString().slice(0,10)!==entered))throw new Error('Ungültiges Eintrittsdatum bei '+member.name+'. Bitte im Mitgliederdatensatz korrigieren.');
 const entryYear=entered?Number(entered.slice(0,4)):0;
 const startMonth=entryYear>year?13:entryYear===year?Number(entered.slice(5,7))+1:1;
 const months=Math.max(0,13-startMonth);
 return {membershipStartDate:entered,annualAmountCents:annualCents,contributionMonths:months,contributionFrom:months?year+'-'+String(startMonth).padStart(2,'0')+'-01':'',contributionTo:months?year+'-12-31':'',amountCents:Math.round(annualCents*months/12),notDue:months===0};
}
function annualContributionPlan(members,records,input){
 const {year,invoiceDate,companyCents,individualCents}=input;
 if(!Number.isInteger(year)||year<1900||year>2200)throw new Error('Bitte ein gültiges Beitragsjahr wählen.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)||Number(invoiceDate.slice(0,4))!==year||new Date(invoiceDate+'T12:00:00Z').toISOString().slice(0,10)!==invoiceDate)throw new Error('Das Rechnungsdatum muss gültig sein und im Beitragsjahr liegen.');
 for(const amount of [companyCents,individualCents])if(!Number.isSafeInteger(amount)||amount<0||amount>100000000)throw new Error('Bitte gültige Mitgliedsbeiträge eingeben.');
 const selected=input.memberIds===undefined?null:new Set(input.memberIds);
 if(selected&&(!selected.size||selected.size!==input.memberIds.length))throw new Error('Bitte mindestens ein Mitglied auswählen; doppelte Auswahl ist nicht erlaubt.');
 const active=members.filter(activeMember).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de')||a.id.localeCompare(b.id));
 if(selected&&[...selected].some(id=>!active.some(m=>m.id===id)))throw new Error('Ein ausgewähltes Mitglied ist nicht mehr aktiv. Bitte die Auswahl aktualisieren.');
 let next=Math.max(0,...records.map(r=>String(r.invoiceNumber||'').match(new RegExp(`^${year}-(\\d+)$`))).filter(Boolean).map(match=>Number(match[1])));
 const rows=active.filter(m=>!selected||selected.has(m.id)).map(member=>{
  const emails=[member.email,member.contactEmail,...(member.eventContacts||[]).map(c=>c.email)].filter(Boolean).map(e=>String(e).trim().toLowerCase());
  const existing=records.find(r=>Number(r.year)===year&&(r.memberId===member.id||(!r.memberId&&((normalize(member.name)&&normalize(r.memberName)===normalize(member.name))||emails.includes(String(r.billingEmail||'').trim().toLowerCase())))));
  if(existing)return {memberId:member.id,memberName:member.name||'',exists:true,invoiceNumber:existing.invoiceNumber,amountCents:existing.amountCents};
  const period=contributionPeriod(member,year,member.membershipType==='company'?companyCents:individualCents);
  const record={...period,id:`annual-${year}-${hash(member.id).slice(0,24)}`,memberId:member.id,memberName:member.name||'',debtorNumber:member.debtorNumber||'',invoiceNumber:period.notDue?'':`${year}-${String(++next).padStart(3,'0')}`,year,invoiceDate,membershipType:member.membershipType,currency:'EUR',paymentStatus:'outstanding',paidDate:'',salutation:member.salutation||'',firstName:member.firstName||'',lastName:member.lastName||'',department:member.department||'',street:[member.street,member.houseNumber].filter(Boolean).join(' ')||member.address||'',country:member.countryCode||member.country||'',postalCode:member.postalCode||'',city:member.city||'',billingEmail:member.email||member.contactEmail||'',phone:member.phone||member.contactPhone||'',mobile:member.mobile||member.contactMobile||'',personalSalutation:member.personalSalutation||'',taxNumber:member.taxNumber||'',sourceConfirmed:'',source:'Jahresbeitrag aus Mitgliederdaten',reviewStatus:'imported',reviewNote:''};
  return {...record,exists:false};
 });
 return {rows,newCount:rows.filter(r=>!r.exists&&!r.notDue).length,skippedCount:rows.filter(r=>r.exists).length,totalCents:rows.filter(r=>!r.exists&&!r.notDue).reduce((sum,r)=>sum+r.amountCents,0),fingerprint:hash(rows)};
}
function createAnnualContributions({db,requireAdmin,HttpsError}){return async request=>{
 const admin=await requireAdmin(request);const data=request.data||{};
 if(data.memberIds!==undefined&&(!Array.isArray(data.memberIds)||data.memberIds.some(id=>typeof id!=='string'||!id||id.includes('/'))||data.memberIds.length>300))throw new HttpsError('invalid-argument','Ungültige Mitgliederauswahl.');
 const input={year:Number(data.year),invoiceDate:String(data.invoiceDate||''),companyCents:Number(data.companyCents),individualCents:Number(data.individualCents),memberIds:data.memberIds};
 return db.runTransaction(async transaction=>{
  const partnerRef=db.collection('settings').doc('accountingPartners');const [members,records,partnerSnapshot]=await Promise.all([transaction.get(db.collection('members')),transaction.get(db.collection('membershipContributions')),transaction.get(partnerRef)]);const registry=partnerSnapshot.exists?partnerSnapshot.data():{};
  let plan;try{plan=annualContributionPlan(members.docs.map(d=>({id:d.id,...d.data()})),records.docs.map(d=>({id:d.id,...d.data()})),input);}catch(error){throw new HttpsError('invalid-argument',error.message);}
  if(data.dryRun!==false)return plan;
  await assertAccountingWritable(db,[input],HttpsError,transaction);
  if(typeof data.expectedFingerprint!=='string'||data.expectedFingerprint!==plan.fingerprint)throw new HttpsError('failed-precondition','Mitglieder oder Beiträge wurden inzwischen geändert. Bitte die Vorschau aktualisieren.');
  if(plan.newCount>300)throw new HttpsError('invalid-argument','Bitte höchstens 300 Mitglieder pro Durchgang auswählen.');
  const now=new Date().toISOString();
  for(const row of plan.rows.filter(r=>!r.exists&&!r.notDue)){const {exists,...record}=row;const partner=allocatePartner(registry,'debtor',record);record.debtorNumber=partner.number;record.accountingPartnerId=partner.id;transaction.update(db.collection('members').doc(record.memberId),{debtorNumber:partner.number,accountingPartnerId:partner.id});transaction.create(db.collection('membershipContributions').doc(record.id),{...record,originalImport:{...record},createdAt:now,updatedAt:now,createdBy:request.auth.uid});}
  if(plan.newCount)transaction.set(partnerRef,registry);
  return {created:plan.newCount,skipped:plan.skippedCount,totalCents:plan.totalCents};
 });
};}
module.exports={contributionPeriod,activeMember,annualContributionPlan,createAnnualContributions};

