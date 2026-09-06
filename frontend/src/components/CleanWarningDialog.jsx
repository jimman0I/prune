import { useState } from 'react';
import ModalOverlay from './ModalOverlay.jsx';
import { warningFor } from '../lib/cleanWarning.js';

/** The question in front of a Deep Clean rule that loses something.
 *
 * Sixteen rules are marked risky and none is selected by default, so
 * reaching this dialog always takes a deliberate click. What it adds is
 * the consequence, in the moment the choice is made: the row's own
 * description already says "Signs you out of every site that remembered
 * you", but it is eleven-point muted text under a name, and the badge
 * beside it says only "Loses data".
 *
 * Cancel is the default action and reads as the safe one; the confirm is
 * styled as danger and says what it does rather than "OK". Nothing here
 * deletes anything -- ticking a box is not cleaning -- so the wording is
 * "Enable anyway" rather than anything more alarming. The Clean button's
 * own confirmation still stands between this and any file moving.
 *
 * Sits in ModalOverlay like every other dialog in the app, which is what
 * gives it role="dialog", a focus trap, Escape, and focus returned to the
 * checkbox that opened it.
 */
export default function CleanWarningDialog({ item, onCancel, onConfirm }) {
  // Unticked each time the dialog opens rather than remembered across
  // rules: it names one rule, and carrying a tick over from the last one
  // would silence a warning nobody read.
  const [remember, setRemember] = useState(false);
  const { title, remember: rememberLabel, body } = warningFor(item);

  return (
    <ModalOverlay label={title} onClose={onCancel}>
      <div className="glass-panel w-[420px] max-w-full p-6">
        <h2 className="text-[15px] font-medium text-[color:var(--text-primary)]">{title}</h2>

        <p className="text-[13px] text-[color:var(--danger)] mt-3">{body}</p>

        <label className="flex items-center gap-2.5 mt-5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-[15px] h-[15px] accent-[color:var(--accent-primary)] cursor-pointer"
          />
          <span className="text-[12.5px] text-[color:var(--text-secondary)]">{rememberLabel}</span>
        </label>

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button
            className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium"
            onClick={() => onConfirm(remember)}
          >
            Enable anyway
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
