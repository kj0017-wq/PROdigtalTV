const fs=require('fs');
const strip=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const account=strip(fs.readFileSync('src/utils/accountingAccountNumber.js','utf8'));
const ledger=strip(fs.readFileSync('src/utils/bankStatementParser.js','utf8').split('export function bankLedger')[1].split('export function pdfTextLines')[0]);
const overview=strip(fs.readFileSync('src/utils/accountsOverview.js','utf8').split('export const overviewAccounts')[1].split('export function overviewTable')[0]);
const dunning=strip(fs.readFileSync('src/utils/accountingDunningStatus.js','utf8'));
fs.writeFileSync('functions/accountingReportCalculations.js','// Pure calculations mirrored from the CMS; regenerate with scripts/buildAccountingReportCalculations.cjs.\n'+account+'\nfunction bankLedger'+ledger+'\nconst overviewAccounts'+overview+'\n'+dunning+'\nmodule.exports={accountingAccountNumber,bankLedger,overviewAccounts,overviewDefaults,calculateAccountsOverview,overviewReportRows,fixedAssetDepreciation,outgoingDunningStatus};\n');
