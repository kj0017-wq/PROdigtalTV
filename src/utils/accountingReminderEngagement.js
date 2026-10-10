const timestamp=value=>{if(value?.toDate)value=value.toDate();else if(value&&typeof value==='object'&&Number.isFinite(value.seconds))value=new Date(value.seconds*1000);const date=value instanceof Date?value:new Date(value||'');return Number.isFinite(date.getTime())?date:null;};
const format=value=>{const date=timestamp(value);return date?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date):'';};
export function reminderEngagement(record,mails=new Map()){
 const latest=(record.reminders||[]).map((item,index)=>({item,index,time:timestamp(item.queuedAt)?.getTime()||0})).sort((a,b)=>b.time-a.time||b.index-a.index)[0]?.item;
 const mail=latest?mails.get(latest.mailId):null;
 if(!mail||mail.status!=='sent')return {label:'',note:'',opened:false};
 const opened=mail.opened===true||Number(mail.openCount||0)>0||Boolean(timestamp(mail.firstOpenedAt)||timestamp(mail.lastOpenedAt));
 const first=format(mail.firstOpenedAt||mail.lastOpenedAt),last=format(mail.lastOpenedAt);
 return {opened,label:opened?'Mahnung geöffnet'+(first?' '+first:''):'Keine Öffnung erfasst',note:['Zuletzt versendete Mahnung',last?'Zuletzt erfasst: '+last:'', 'Die Erkennung erfolgt über ein geladenes Bild. Bildblocker können Öffnungen verbergen; automatische Bildabrufe können als Öffnung zählen. Eine Lesebestätigung ist das nicht.'].filter(Boolean).join(' · ')};
}
