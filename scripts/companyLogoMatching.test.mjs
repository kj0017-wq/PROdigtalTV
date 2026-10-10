import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../src/cms/cmsPages.js',import.meta.url),'utf8');
const a=s.indexOf('function normalizeCompanyKey(');const b=s.indexOf('function companyLogoMarkup(',a);
const resolve=new Function('recordMediaAsset','mediaAssetUrl','memberLogoUrl',`${s.slice(a,b)};return companyLogoForSpeakers;`)(()=>null,asset=>asset.url||'',member=>member.logoUrl||'');
test('Major Seven never matches ORS substring',()=>{assert.equal(resolve({},[{company:'Major Seven Consulting'}],[{name:'ORS',logoUrl:'/ors.png'}],[],[]).logoUrl,'');});
test('exact normalized company match works',()=>{assert.equal(resolve({},[{company:'Major Seven Consulting GmbH'}],[],[{name:'Major Seven Consulting',logoUrl:'/major.png'}],[]).logoUrl,'/major.png');});
test('explicit contribution and speaker logos are preserved',()=>{assert.equal(resolve({companyLogoUrl:'/topic.png'},[{company:'Company',companyLogoUrl:'/speaker.png'}]).logoUrl,'/topic.png');assert.equal(resolve({},[{company:'Company',companyLogoUrl:'/speaker.png'}]).logoUrl,'/speaker.png');});
