'use strict';
function createMailboxHttp({service,verifyToken}){
 const codes={'unauthenticated':401,'permission-denied':403,'not-found':404,'invalid-argument':400,'failed-precondition':409,'data-loss':502};
 async function actor(req){const token=/^Bearer (.+)$/i.exec(req.get('Authorization')||'')?.[1];if(!token)throw Object.assign(Error('Bitte zuerst anmelden.'),{code:'unauthenticated'});let decoded;try{decoded=await verifyToken(token);}catch{throw Object.assign(Error('Sitzung ungültig. Bitte erneut anmelden.'),{code:'unauthenticated'});}return {uid:decoded.uid,token:decoded};}
 function fail(res,e){if(res.headersSent){res.destroy();return;}res.status(codes[e.code]||500).json({error:codes[e.code]?e.message:'Die Datei konnte nicht bereitgestellt werden.'});}
 function headers(res){res.set('Cache-Control','private, no-store, max-age=0');res.set('Vary','Authorization, Origin');res.set('X-Content-Type-Options','nosniff');}
 return {
 upload:async(req,res)=>{headers(res);if(req.method!=='POST'){res.status(405).end();return;}try{const auth=await actor(req);if(!Buffer.isBuffer(req.rawBody)||req.rawBody.length>20*1024*1024)throw Object.assign(Error('Datei zu groß oder leer.'),{code:'invalid-argument'});const result=await service.upload({auth,data:{documentId:req.get('X-Mailbox-DocumentId')}},req.rawBody);res.json(result);}catch(e){fail(res,e);}},
 file:async(req,res)=>{headers(res);if(req.method!=='POST'){res.status(405).end();return;}try{const auth=await actor(req),result=await service.prepareRead({auth,data:req.body});res.set('Content-Type',result.mime);res.set('Content-Length',String(result.buffer.length));const safe=result.filename.replace(/[^a-zA-Z0-9._-]/g,'_');res.set('Content-Disposition',`inline; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`);res.set('Access-Control-Expose-Headers','X-Mailbox-Sha256, X-Mailbox-Size, X-Mailbox-Receipt, X-Mailbox-Record-Read');res.set('X-Mailbox-Sha256',result.sha256);res.set('X-Mailbox-Size',String(result.buffer.length));res.set('X-Mailbox-Receipt',result.receipt);res.set('X-Mailbox-Record-Read',String(result.recordRead));
 // A socket close/error is not a completed transfer. Keep the function alive until finish.
 const finished=await new Promise(resolve=>{let done=false;const settle=value=>{if(!done){done=true;resolve(value);}};res.once('finish',()=>settle(true));res.once('close',()=>settle(false));res.once('error',()=>settle(false));res.end(result.buffer);});if(finished)await result.complete();
 }catch(e){fail(res,e);}}
 };
}
module.exports={createMailboxHttp};
