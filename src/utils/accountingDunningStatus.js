export function berlinToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
const day=value=>{const raw=String(value||'');const s=raw.includes('T')&&Number.isFinite(Date.parse(raw))?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(raw)):raw.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const n=Date.parse(s+'T12:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:null;};
const plus=(n,days)=>new Date(n+days*86400000).toISOString().slice(0,10);
export function outgoingDunningStatus(record,mails=new Map(),today=berlinToday()){
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
