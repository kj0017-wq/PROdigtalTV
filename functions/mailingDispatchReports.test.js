const test=require('node:test'),assert=require('node:assert/strict');const {isAutomaticMailing,summarizeMailing,reportText,createMailingDispatchReports}=require('./mailingDispatchReports');
test('only automatic list mailings are eligible',()=>{assert.ok(isAutomaticMailing({sendMode:'scheduled',status:'queued',recipientGroup:'members_event_guests'}));for(const r of [{sendMode:'now',status:'queued'},{sendMode:'scheduled',status:'queued',recipientGroup:'test_group'},{sendMode:'scheduled',status:'queued',testOnly:true},{sendMode:'scheduled',status:'queued',channels:['push']},{sendMode:'scheduled',status:'processing'}])assert.equal(isAutomaticMailing(r),false);});
test('transport acceptance, errors, bounces and open work stay distinct',()=>{const c=summarizeMailing([{status:'sent',deliveryStatus:'bounced'},{status:'sent',deliveryStatus:'delayed'},{status:'failed'},{status:'skipped'},{status:'queued'}],6);assert.deepEqual(c,{total:6,accepted:2,failed:1,skipped:1,bounced:1,delayed:1,pending:2});assert.ok(reportText({},c,Date.now()).includes('keine Bestätigung'));});

test('one report per completed batch, never a report about itself', async () => {
  const now=Date.now(), stamp={toMillis:()=>now-60000};
  const store=new Map([
    ['settings/mailingDispatchReports',{enabled:true,recipientEmail:'owner@example.de',startAt:{toMillis:()=>now-3600000}}],
    ['eventNotifications/n1',{title:'Einladung',sendMode:'scheduled',recipientGroup:'members',status:'queued',queuedMailCount:2,updatedAt:stamp,processedAt:stamp}],
    ['mailQueue/a',{notificationId:'n1',status:'sent'}],
    ['mailQueue/b',{notificationId:'n1',status:'failed'}]
  ]);
  const ref=key=>({id:key.split('/')[1],key,get:async()=>snap(key)});
  const snap=key=>({id:key.split('/')[1],ref:ref(key),exists:store.has(key),data:()=>store.get(key)});
  const db={
    collection:name=>({
      doc:id=>ref(name+'/'+id),
      where:(field,operator,value)=>({
        get:async()=>({docs:[...store].filter(([key,data])=>key.startsWith(name+'/')&&(operator==='>='||data[field]===value)).map(([key])=>snap(key))})
      })
    }),
    runTransaction:async fn=>fn({
      get:async r=>snap(r.key),
      create:(r,data)=>{assert.ok(!store.has(r.key));store.set(r.key,data);},
      update:(r,data)=>store.set(r.key,{...store.get(r.key),...data})
    })
  };
  const service=createMailingDispatchReports({db,FieldValue:{serverTimestamp:()=>stamp},Timestamp:{fromMillis:x=>x},now:()=>now});
  store.set('mailQueue/b',{notificationId:'n1',status:'queued'});
  assert.equal((await service.sweep()).queued,0,'Wait for unfinished mail transport');
  store.set('mailQueue/b',{notificationId:'n1',status:'failed'});
  assert.equal((await service.sweep()).queued,1);
  assert.equal((await service.sweep()).queued,0);
  const report=store.get('mailQueue/mailing-statistics-n1');
  assert.equal(report.to,'owner@example.de');assert.equal(report.statistics.failed,1);
  assert.equal(report.notificationId,undefined);assert.ok(store.get('eventNotifications/n1').dispatchReportMailId);
});
