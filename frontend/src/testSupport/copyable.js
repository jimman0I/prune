/** Whether a piece of text on screen can be selected and copied.
 *
 * Text selection is off for the whole app (index.css): Prune is a desktop
 * app, and a click-and-drag across a list should not paint its labels and
 * headings blue. The things worth copying -- paths, commands, the text of
 * an error -- opt back in with Tailwind's `select-text`, on the element
 * itself or on something around it.
 *
 * So that class is what a test checks. jsdom applies no stylesheet, which
 * means a computed `user-select` is not there to be read instead. */
export function isCopyable(element) {
  return Boolean(element?.closest('.select-text'));
}
