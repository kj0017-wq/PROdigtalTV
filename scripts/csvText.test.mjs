import test from 'node:test';import assert from 'node:assert/strict';
import {csvTextCell} from '../src/utils/csvText.js';
const decode=cell=>cell.slice(1,-1).replaceAll('""','"');
test('Excel text expressions preserve leading zeros, long numbers, dates and decimal strings',()=>{for(const value of ['01234','+491723074583','2026-001','2026-01-01','800,00','123456789012345678901',0,800])assert.equal(decode(csvTextCell(value)),`="${String(value)}"`);});
test('embedded formula quotes cannot escape the text literal',()=>{assert.equal(decode(csvTextCell('=HYPERLINK("malicious")')), '="=HYPERLINK(""malicious"")"');assert.equal(decode(csvTextCell('123";456')),'="123"";456"');});
test('empty cells and normal prose retain their original contents',()=>{assert.equal(decode(csvTextCell('')),'');assert.equal(decode(csvTextCell('Test "GmbH"')),'Test "GmbH"');});
import {germanCsvDate} from '../src/utils/csvText.js';
test('German CSV dates preserve calendar dates and format Berlin timestamps',()=>{assert.equal(germanCsvDate('2026-10-06'),'06.10.2026');assert.equal(germanCsvDate('2026-07-01'),'01.07.2026');assert.equal(germanCsvDate('2026-10-05T22:30:00Z',{withTime:true}),'06.10.2026 00:30 Uhr');assert.equal(germanCsvDate('2026-01-05T23:30:00Z',{withTime:true}),'06.01.2026 00:30 Uhr');assert.equal(germanCsvDate({seconds:0},{withTime:true}),'01.01.1970 01:00 Uhr');assert.equal(germanCsvDate(''),'');assert.equal(germanCsvDate('06.10.2026'),'06.10.2026');});
