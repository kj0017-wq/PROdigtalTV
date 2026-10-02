import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { eventAgendaItems } from "../src/utils/eventAgenda.js";
import { agendaMarkup } from "../src/utils/eventArea.js";
import { escapeHtml } from "../src/utils/format.js";
import { isVisibleEventTalk } from "../src/utils/eventTalkVisibility.js";

test("legacy public schedule puts the program title above the person", () => {
  const items = eventAgendaItems({ scheduleText: "19:00 | Beate Busch | Begrüßung durch PROdigitalTV\n21:30 | Ende der Veranstaltung |" });
  assert.equal(items[0].title, "Begrüßung durch PROdigitalTV");
  assert.equal(items[0].person, "Beate Busch");
  assert.equal(items[1].title, "Ende der Veranstaltung");
  const html = agendaMarkup({ scheduleItems: items });
  assert.match(html, /<strong>Begrüßung durch PROdigitalTV<\/strong><p>Beate Busch<\/p>/);
});
test("structured agenda resolves multiple speakers without adding unscheduled assigned talks", () => {
  const topics = [{ id:"talk",title:"Vortrag",speakerIds:["anna","max"],longDescription:"Beschreibung" }, { id:"later",title:"Weiterer Vortrag" }];
  const speakers = [{id:"anna",name:"Anna"},{id:"max",name:"Max"}];
  const items = eventAgendaItems({scheduleItems:[{time:"10:00",title:"Vortrag",topicId:"talk"}],scheduleText:"obsolete"}, topics, speakers);
  assert.equal(items[0].person, "Anna, Max");
  assert.equal(items[0].description, "Beschreibung");
  assert.equal(items.length, 1);
  const html = agendaMarkup({scheduleItems:items});
  assert.equal((html.match(/<details /g)||[]).length,1);
  assert.equal(html.includes("obsolete"),false);
  assert.equal(html.includes("Weiterer Vortrag"),false);
});
test("public event uses shared cards with speaker links and excludes hidden talks", () => {
  const source = readFileSync(new URL("../src/pages/publicPages.js",import.meta.url),"utf8");
  const start=source.indexOf("function eventScheduleMarkup(");
  const block=source.slice(start,source.indexOf("function retrospectiveLinkedEvent(",start));
  const context={eventAgendaItems,agendaMarkup,escapeHtml,isVisibleEventTalk,
    speakerName:speaker=>speaker.name,speakerProfileHref:speaker=>"#/speaker/"+speaker.id};
  vm.createContext(context);
  vm.runInContext(block+";render=eventScheduleMarkup",context);
  const html=context.render({id:"event",topicIds:["visible","hidden"],scheduleText:"10:00 | Anna | Vortrag\n11:00 | Max | Versteckt"},[
    {id:"visible",title:"Vortrag",status:"published",speakerIds:["anna"],longDescription:"Details<script>bad()</script>"},
    {id:"hidden",title:"Versteckt",status:"inactive"}
  ],[{id:"anna",name:"Anna"}]);
  assert.match(html,/<h2>Agenda<\/h2>/);
  assert.match(html,/<details class="event-agenda-card"/);
  assert.match(html,/#\/speaker\/anna/);
  assert.equal(html.includes("Versteckt"),false);
  assert.equal(html.includes("<script>"),false);
  assert.equal(source.includes("Vorträge der Veranstaltung"),false);
});
