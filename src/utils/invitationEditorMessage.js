export function invitationEditorMessage(editor) {
  if (!editor) return null;
  const choices = {
    save_the_date: { source: 'saveTheDateText', prefix: 'Save the date' },
    invitation: { source: 'invitationText', prefix: 'Einladung' },
    invitation_update: { source: 'invitationUpdateText', prefix: 'Einladungsupdate' }
  };
  const selected = choices[editor.querySelector('[name="mailingType"]')?.value];
  if (!selected) return null;
  return { ...selected, text: editor.querySelector(`[name="${selected.source}"]`)?.value || '' };
}
