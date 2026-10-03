import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchExplorerMenu, setExplorerMenu } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Toggle from './Toggle.jsx';

/** Settings -> General -> "Add Prune to the right-click menu".
 *
 * An opt-in, off by default: it adds four verbs to File Explorer's context
 * menu in the per-user class registry -- "Shred with Prune" on files and
 * folders, "Find in Prune (uninstall)" on programs and shortcuts -- so it is
 * only ever written by this switch, and the help text says it is for this
 * account only, needs no administrator rights, and that switching it off
 * removes every entry.
 *
 * The switch shows what Windows actually has -- read from the registry by the
 * backend (services/explorerMenu.js), not from a copy in settings.json -- and
 * the sentence names the two entries with the captions the registry holds
 * (the backend sends them in the app's language), so it cannot describe a menu
 * that is not there. Where it cannot work (a development build, or an install
 * path that cannot sit inside a menu command) it is off and says which. */
export default function ExplorerMenuSetting() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const status = useQuery({ queryKey: keys.explorerMenu, queryFn: () => fetchExplorerMenu(), retry: false });
  const change = useMutation({
    mutationFn: (enabled) => setExplorerMenu(enabled),
    // The reply is the state read back from the registry, so it replaces the
    // cache; a failure leaves the switch where Windows has it.
    onSuccess: (updated) => queryClient.setQueryData(keys.explorerMenu, updated)
  });

  const data = status.data;
  const supported = data?.supported === true;
  const enabled = supported && data?.enabled === true;
  const title = t('explorerV3.menu.title');
  const captions = data?.captions ?? { shred: '', find: '' };

  const notes = [];
  if (status.isError) notes.push(<p key="load" role="alert" className="text-[color:var(--danger)] select-text">{t('explorerV3.menu.loadFailed', status.error.message)}</p>);
  if (change.isError) notes.push(<p key="save" role="alert" className="text-[color:var(--danger)] select-text">{t('explorerV3.menu.saveFailed', change.error.message)}</p>);
  if (data && !supported) {
    notes.push(
      <p key="unsupported" className="text-[color:var(--text-muted)]">
        {t(data.reason === 'unsafePath' ? 'explorerV3.menu.unsafePath' : 'explorerV3.menu.unsupported')}
      </p>
    );
  }
  if (supported && data.incomplete) notes.push(<p key="incomplete" className="text-[color:var(--text-secondary)] max-w-[62ch]">{t('explorerV3.menu.incomplete')}</p>);
  if (supported && data.foreign) notes.push(<p key="foreign" className="text-[color:var(--text-secondary)] max-w-[62ch]">{t('explorerV3.menu.foreign')}</p>);

  return (
    <div className="glass-panel p-6" data-testid="explorer-menu">
      <div data-setting-row className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[color:var(--text-primary)]">{title}</div>
          <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[62ch]">
            {t('explorerV3.menu.description', captions.shred, captions.find)}
          </p>
          <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1 leading-relaxed max-w-[62ch]">
            {t('explorerV3.menu.showMore')}
          </p>
        </div>
        <Toggle
          checked={enabled}
          onChange={() => change.mutate(!enabled)}
          label={title}
          disabled={!supported || change.isPending}
        />
      </div>

      {notes.length > 0 && <div className="mt-4 flex flex-col gap-2 text-[12.5px]">{notes}</div>}
    </div>
  );
}
