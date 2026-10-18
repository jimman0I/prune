import { useLanguage } from '../i18n/LanguageContext.jsx';

/** What the wizard automation is doing to an uninstaller's window, in one
 * line under the progress (see backend services/wizardAutomation.js).
 *
 * While it answers, a quiet status: which control it just used. When it
 * hands the wizard back, the reason, in the warning colour and as an alert,
 * because the person now has a window to deal with that Prune put in front
 * of them. Renders nothing without an event. */
const REASONS = ['personal', 'typing', 'unknownButton', 'unknownChoice', 'loop', 'elevated', 'tooMany'];

export default function WizardNote({ event, className = '' }) {
  const { t } = useLanguage();
  if (!event) return null;
  if (event.state === 'handover') {
    const reason = REASONS.includes(event.reason) ? event.reason : 'unknownChoice';
    return (
      <p role="alert" data-wizard-handover className={`text-[12.5px] leading-snug text-[color:var(--warning)] ${className}`}>
        {t(`wizardV5.handover.${reason}`)}
      </p>
    );
  }
  if (event.state !== 'answered' || !event.label) return null;
  const verb = event.act === 'toggle' ? 'unticked' : event.act === 'select' ? 'chose' : 'pressed';
  return (
    <p role="status" data-wizard-answered className={`text-[12.5px] leading-snug text-[color:var(--text-secondary)] ${className}`}>
      {t(`wizardV5.answered.${verb}`, event.label)}
    </p>
  );
}
