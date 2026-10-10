export const invoiceContentFields=['memberId','memberName','invoiceNumber','invoiceDate','amountCents','year','membershipType','salutation','firstName','lastName','department','street','country','postalCode','city','billingEmail','personalSalutation','taxNumber','contributionMonths','contributionFrom','contributionTo'];
export function invoiceRevisionPatch(before,patch,now=new Date().toISOString()){
 const changed=invoiceContentFields.filter(key=>Object.hasOwn(patch,key)&&String(before[key]??'').trim()!==String(patch[key]??'').trim());
 return changed.length?{invoiceRevision:Number(before.invoiceRevision||0)+1,invoiceNeedsRegeneration:true,invoiceNeedsRedispatch:true,invoiceChangedAt:now,invoiceChangedFields:changed,reviewStatus:'needs_review'}:{};
}
