import ModalOverlay from './ModalOverlay.jsx';
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts.js';

/** The list of chords, reachable from Settings and from Ctrl+/.
 *
 * Rendered from the same array the listener is documented against, so the
 * list cannot quietly claim a shortcut that was never wired up -- the
 * usual failure of a help screen written by hand.
 *
 * Uses ModalOverlay like every other dialog, which means it inherits the
 * focus trap, Escape, initial focus on the close button and focus restore
 * without restating any of it.
 */
function Keys({ keys }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, i) => (
        <span key={key} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-[10px] text-[color:var(--text-muted)]">+</span>}
          <kbd className="font-mono text-[10.5px] px-1.5 py-0.5 rounded border border-[color:var(--border-subtle)] bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)]">
            {key}
          </kbd>
        </span>
      ))}
    </span>
  );
}

export default function ShortcutsModal({ onClose }) {
  return (
    <ModalOverlay label="Keyboard shortcuts" onClose={onClose}>
      <div className="glass-panel w-full max-w-[460px] p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="display-heading text-[20px]">Keyboard shortcuts</h2>
          <button className="btn-ghost px-3 py-1.5 rounded-lg text-[12px]" onClick={onClose}>
            Close
          </button>
        </div>

        <ul className="space-y-2.5">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.action} className="flex items-baseline justify-between gap-4">
              <span className="text-[12.5px] text-[color:var(--text-secondary)]">{shortcut.action}</span>
              <span className="shrink-0">
                <Keys keys={shortcut.keys} />
                {shortcut.alternative && (
                  <>
                    <span className="mx-1.5 text-[10.5px] text-[color:var(--text-muted)]">or</span>
                    <Keys keys={shortcut.alternative} />
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>

        <p className="text-[11.5px] text-[color:var(--text-muted)] mt-5 leading-snug">
          Cmd works in place of Ctrl. A chord is ignored while you are typing in a field, so
          Ctrl+F still reaches the search box you are already in.
        </p>
      </div>
    </ModalOverlay>
  );
}
