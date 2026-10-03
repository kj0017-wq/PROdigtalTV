import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionsSource = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
const publicPagesSource = await readFile(new URL("../src/pages/publicPages.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const participantsSource = await readFile(new URL("../src/utils/registrationParticipants.js", import.meta.url), "utf8");
const cmsPagesSource = await readFile(new URL("../src/cms/cmsPages.js", import.meta.url), "utf8");

test("zweite Person erhält einen eigenständigen Anmeldedatensatz", () => {
  assert.match(functionsSource, /const companionRegistrationRef = input\.hasCompanion/);
  assert.match(functionsSource, /registrationRole: "additional_person"/);
  assert.match(functionsSource, /primaryRegistrationId: registrationRef\.id/);
  assert.match(functionsSource, /registeredByEmail: input\.email/);
  assert.match(functionsSource, /if \(companionRegistration\) transaction\.set\(companionRegistrationRef, companionRegistration\)/);
  assert.match(functionsSource, /hasCompanion: false, companion: null, participantCount: 1/);
  assert.match(participantsSource, /registrationRole === "additional_person" \? "Zusätzliche Person"/);
  assert.match(cmsPagesSource, /Eigenständige Anmeldung · angemeldet von/);
});

test("jede Person erhält eigene Bestätigung und eigenes Ticket", () => {
  assert.match(functionsSource, /companionConfirmationToken = input\.hasCompanion \? randomBytes/);
  assert.match(functionsSource, /confirmationUrl: registrationConfirmationUrl\(companionConfirmationToken\)/);
  assert.match(functionsSource, /ticketTokenHash: hashToken\(companionCheckinTicketToken\)/);
  assert.match(functionsSource, /confirmationRequired: !checkinMode/);
  assert.match(publicPagesSource, /eigenständige Anmeldung geführt/);
  assert.match(mainSource, /Beide Personen erhalten eine eigene E-Mail/);
  assert.doesNotMatch(publicPagesSource, /demselben Handy-Ticket/);
});

test("Doppelanmeldungen werden für beide E-Mail-Adressen verhindert", () => {
  assert.match(functionsSource, /blockingEventRegistrationByEmail/);
  assert.match(functionsSource, /where\("companion\.email", "==", normalized\)/);
  assert.match(functionsSource, /const bookingEmails = \[input\.email/);
});
