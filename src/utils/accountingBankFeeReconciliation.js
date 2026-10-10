import {callEventModerator} from '../firebase/eventModeratorService.js?v=1';
let active;export function reconcileBankFees(){if(!active)active=callEventModerator('reconcileAccountingBankFees',{}).finally(()=>{active=null;});return active;}
