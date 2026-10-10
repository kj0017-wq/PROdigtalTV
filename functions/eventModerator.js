const CARD_FIELDS = ["id", "time", "speakerName", "position", "company", "contributionRole", "title", "bio", "description", "notes"];
function canModerate(event, uid, profile) {
  return Boolean(uid && profile && profile.status !== "inactive" && Array.isArray(event.moderatorUserIds) && event.moderatorUserIds.includes(uid));
}
function cardsPatch(input) {
  if (!Array.isArray(input.cards) || input.cards.length > 200 || !Array.isArray(input.removedIds || []) || (input.removedIds || []).length > 400) throw new Error("UngÃ¼ltige Karten.");
  return {
    moderationCards: input.cards.map(card => Object.fromEntries(CARD_FIELDS.map(key => {
      if (typeof card?.[key] !== "string" || card[key].length > 12000) throw new Error("UngÃ¼ltiges Kartenfeld.");
      return [key, card[key]];
    }))),
    moderationCardRemovedIds: (input.removedIds || []).map(id => {
      if (typeof id !== "string" || id.length > 200) throw new Error("UngÃ¼ltige Karten-ID.");
      return id;
    }),
    moderationCardOrientation: input.orientation === "landscape" ? "landscape" : "portrait"
  };
}
function moderatorCardOwner(event, uid, profile, requestedOwner) {
  const cms = ["admin", "editor"].includes(profile?.role) && profile.status !== "inactive";
  if (!cms && !canModerate(event, uid, profile)) throw new Error("Keine Moderatorberechtigung.");
  const owner = cms ? String(requestedOwner || "") : uid;
  if (!cms && requestedOwner && requestedOwner !== uid) throw new Error("Nur eigene Moderationskarten sind zugänglich.");
  if (owner.includes("/") || owner.length > 128) throw new Error("Ungültiger Moderator.");
  return owner;
}
module.exports = { canModerate, cardsPatch, moderatorCardOwner };
