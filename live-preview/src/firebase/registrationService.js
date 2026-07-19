import { getOne, upsert } from "./dataService.js";
import { getFirebaseServices } from "./firebaseClient.js";

export async function createRegistration(eventId, input) {
  const event = await getOne("events", eventId);
  if (!event || !event.registrationEnabled) throw new Error("Fuer dieses Event ist keine Anmeldung moeglich.");
  const firebase = await getFirebaseServices();
  const registration = {
    id: `registration-${crypto.randomUUID()}`,
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.date,
    eventAccessType: event.accessType,
    ...input,
    privacyAccepted: Boolean(input.privacyAccepted),
    emailConfirmed: false,
    status: "pending_email_confirmation",
    mailStatus: "queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!registration.privacyAccepted) throw new Error("Bitte stimmen Sie den Datenschutzbestimmungen zu.");
  await upsert("registrations", registration);
  if (firebase) {
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "sendRegistrationConfirmationMail");
    await callable({ registrationId: registration.id });
  } else {
    await upsert("mailQueue", {
      id: `mail-${crypto.randomUUID()}`,
      type: "registration_confirmation",
      to: registration.email,
      subject: `Bitte bestaetigen: ${event.title}`,
      eventId,
      registrationId: registration.id,
      status: "queued",
      queuedAt: new Date().toISOString()
    });
  }
  return registration;
}

export async function confirmRegistration(token) {
  const firebase = await getFirebaseServices();
  if (firebase) {
    const callable = firebase.functionsLib.httpsCallable(firebase.functions, "confirmRegistrationByToken");
    return (await callable({ token })).data;
  }
  if (!token) throw new Error("Der Bestaetigungslink ist unvollstaendig.");
  throw new Error("Firebase ist nicht erreichbar. Die Anmeldung wurde nicht bestaetigt.");
}
