export function csvTextCell(value,{forceText=false}={}){
 const text=String(value??'');
 const asText=forceText||typeof value==='number'||/^\s*[\d=+@-]/.test(text);
 const serialized=asText&&text?`="${text.replaceAll('"','""')}"`:text;
 return `"${serialized.replaceAll('"','""')}"`;
}
export function germanCsvDate(value,{withTime=false}={}){
 if(value===null||value===undefined||value==='')return '';
 const text=typeof value==='string'?value.trim():'';
 const pureDate=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(pureDate){const date=new Date(text+'T12:00:00Z');if(!Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===text)return `${pureDate[3]}.${pureDate[2]}.${pureDate[1]}`;return text;}
 if(text&&!/^\d{4}-\d{2}-\d{2}T/.test(text))return text;
 const date=value instanceof Date?value:typeof value?.toDate==='function'?value.toDate():typeof value?.seconds==='number'?new Date(value.seconds*1000):new Date(value);
 if(Number.isNaN(date.getTime()))return text;
 const parts=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:{})}).formatToParts(date);
 const get=type=>parts.find(part=>part.type===type)?.value||'';
 return `${get('day')}.${get('month')}.${get('year')}${withTime?` ${get('hour')}:${get('minute')} Uhr`:''}`;
}
