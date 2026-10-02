const editableFields = ["firstName", "lastName", "company", "position", "email", "phone", "linkedIn"];

function cleanValue(value = "") {
  return String(value || "").trim();
}

export function registrationEditorValues(registration = {}, participantRole = "Hauptperson") {
  const source = participantRole === "Begleitperson" ? registration.companion || {} : registration;
  return Object.fromEntries(editableFields.map(field => [field, cleanValue(source[field])]));
}

export function registrationEditorPatch(registration = {}, participantRole = "Hauptperson", values = {}) {
  const updated = Object.fromEntries(editableFields.map(field => [field, cleanValue(values[field])]));
  if (participantRole === "Begleitperson") {
    return {
      id: registration.id,
      companion: {
        ...(registration.companion || {}),
        ...updated
      },
      adminEditedAt: new Date().toISOString()
    };
  }
  return {
    id: registration.id,
    ...updated,
    adminEditedAt: new Date().toISOString()
  };
}
