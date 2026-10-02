import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault(), projectId: "prodigitaltv-da47b" });
const db = getFirestore();
const ref = db.collection("memberDocuments").doc("zukunftsstrategie-2027-2030");
const snapshot = await ref.get();
if (!snapshot.exists) throw new Error("Strategiedokument fehlt.");

let html = String(snapshot.data().htmlContent || "");
const bridge = String.raw`
let currentIdeaType="Idee";
function setType(el,type){
  currentIdeaType=type || "Idee";
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("subject").placeholder="Kurzer Titel – "+currentIdeaType;
}
function strategyStatus(id,message,isError){
  const node=document.getElementById(id);
  if(!node) return;
  node.textContent=message;
  node.style.display="block";
  node.style.background=isError ? "#fff0f0" : "#eef8f0";
  node.style.color=isError ? "#9a1725" : "#2f6c43";
}
function submitIdea(){
  const idea={
    ideaType:currentIdeaType,
    name:document.getElementById("name")?.value || "",
    company:document.getElementById("company")?.value || "",
    subject:document.getElementById("subject")?.value || "",
    message:document.getElementById("message")?.value || ""
  };
  strategyStatus("notice","Vorschlag wird gespeichert ...",false);
  parent.postMessage({type:"pdtv-member-strategy-submit",responseType:"idea",idea},"*");
}
function saveMemberSurvey(){
  const ids=["qa1","qa2","qa3","qa4","qa5","qa6","qa7","qa8","qa8text","qa9","qa10"];
  const answers={};
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(el) answers[id]=el.value;
  });
  strategyStatus("qa-notice","Antworten werden gespeichert ...",false);
  parent.postMessage({type:"pdtv-member-strategy-submit",responseType:"survey",answers},"*");
}
window.addEventListener("message",event=>{
  const result=event.data || {};
  if(result.type!=="pdtv-member-strategy-result") return;
  const noticeId=result.responseType==="idea" ? "notice" : "qa-notice";
  strategyStatus(noticeId,result.message || (result.ok ? "Gespeichert." : "Speichern fehlgeschlagen."),!result.ok);
  if(result.ok && result.responseType==="idea"){
    ["subject","message"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  }
});
`;

const pattern = /let currentIdeaType="Idee";[\s\S]*?function clearMemberSurvey\(\)\{|function setType\(el,type\)\{[\s\S]*?function clearMemberSurvey\(\)\{/;
if (!pattern.test(html)) throw new Error("Formularfunktionen konnten nicht gefunden werden.");
html = html.replace(pattern, bridge + "\nfunction clearMemberSurvey(){");
html = html
  .replace("Antworten im Strategiepapier speichern", "Antworten sicher speichern")
  .replace("Vielen Dank. Die Antworten wurden im Strategiepapier gespeichert.", "Ihre Antworten werden geschützt gespeichert.")
  .replace("Vielen Dank. Ihr Vorschlag wurde im Strategiepapier erfasst.", "Ihr Vorschlag wird geschützt gespeichert.")
  .replace("Die Antworten können anonym oder personenbezogen ausgewertet und für Positionierung, Mitgliederbindung, neue Angebote", "Die Antworten werden Ihrem Mitgliederkonto zugeordnet und ausschließlich im Admin-Bereich für Positionierung, Mitgliederbindung und neue Angebote ausgewertet");
if (!html.includes("data-strategy-privacy-note")) {
  html = html.replace('<div class="qa-actions">', '<p class="evidence" data-strategy-privacy-note><strong>Datenschutzhinweis:</strong> Ihre Antworten werden Ihrem Mitgliederkonto zugeordnet und sind ausschließlich für Administratoren sichtbar.</p><div class="qa-actions">');
}
if (!html.includes("data-strategy-idea-privacy")) {
  html = html.replace('<div class="tabs">', '<p class="evidence" data-strategy-idea-privacy><strong>Datenschutzhinweis:</strong> Vorschläge werden Ihrem Mitgliederkonto zugeordnet und sind ausschließlich für Administratoren sichtbar.</p><div class="tabs">');
}

await ref.update({
  htmlContent: html,
  responseCollection: "memberStrategyResponses",
  updatedAt: FieldValue.serverTimestamp()
});
console.log(JSON.stringify({ updated: true, htmlLength: html.length }));