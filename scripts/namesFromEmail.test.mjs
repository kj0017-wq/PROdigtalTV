import test from 'node:test';import assert from 'node:assert/strict';import {namesFromEmail} from '../src/utils/namesFromEmail.js';
test('Suggest given and family names from dotted personal email',()=>assert.deepEqual(namesFromEmail('alena.edwards@sonymusic.com'),{firstName:'Alena',lastName:'Edwards'}));
test('Keep hyphenated names',()=>assert.deepEqual(namesFromEmail('anna-lena.müller@example.de'),{firstName:'Anna-Lena',lastName:'Müller'}));
test('Do not guess initials, functional mailboxes or multi-part addresses',()=>{for(const email of ['c.ziegler@example.de','invoice.stv@example.de','info.office@example.de','a.b@example.de','vorname.nachname.123@example.de','joerg@example.de'])assert.equal(namesFromEmail(email),null,email);});
