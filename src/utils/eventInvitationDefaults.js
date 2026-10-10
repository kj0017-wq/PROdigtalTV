export function eventInvitationDefaults(event = {}) {
  const sources = { save_the_date: 'saveTheDateText', invitation: 'invitationText', invitation_update: 'invitationUpdateText' };
  const source = sources[event.mailingType] || (event.registrationEnabled || ['registration_open', 'live'].includes(event.lifecyclePhase) ? 'invitationText' : 'saveTheDateText');
  const membersOnly = ['member', 'members', 'members_only', 'internal'].includes(String(event.accessType || '').toLowerCase()) || /jahreshauptversammlung/i.test(event.eventType || '');
  return { source, recipientGroup: membersOnly ? 'members' : 'members_contacts', registrationStatus: 'unregistered', titlePrefix: source === 'saveTheDateText' ? 'Save the date' : source === 'invitationUpdateText' ? 'Einladungsupdate' : 'Einladung' };
}
