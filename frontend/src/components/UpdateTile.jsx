import { useState } from 'react';
import { openUpdatePage } from '../lib/api.js';
import { useSettings, useUpdateCheck } from '../hooks/useSystemQueries.js';

/** A tile in the corner of the window when a newer release exists.
 *
 * Only ever shows the update check's answer: with the check off -- its
 * default -- there is no answer to show and the tile never appears. A
 * dismissed version is remembered in settings and not offered again; a
 * newer one than that is. A tile that returned on every launch would teach
 * people to close it without reading it.
 */
export default function UpdateTile() {
  const { settings, save } = useSettings();
  const enabled = settings?.updateCheck === true;
  const { data } = useUpdateCheck(enabled);
  const [openError, setOpenError] = useState(null);

  if (!enabled || data?.newer !== true || !data.latest) return null;
  if (settings?.dismissedUpdateVersion === data.latest) return null;

  const download = () => {
    setOpenError(null);
    openUpdatePage().catch((err) => setOpenError(err.message));
  };

  return (
    <section
      role="region"
      aria-label="Update available"
      className="glass-panel fixed bottom-5 right-5 z-40 w-[320px] rounded-xl p-4 shadow-2xl"
    >
      <p className="text-[13.5px] font-medium text-[color:var(--text-primary)]">{`Prune ${data.latest} is available`}</p>
      <p className="text-[12px] text-[color:var(--text-secondary)] mt-1 leading-relaxed">
        {`You have ${data.current}. Nothing is downloaded until you choose to.`}
      </p>
      {openError && (
        <p className="text-[12px] text-[color:var(--danger)] mt-2">{`Couldn't open the page: ${openError}`}</p>
      )}
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 rounded-md text-[12.5px]"
          onClick={() => save.mutate({ dismissedUpdateVersion: data.latest })}
        >
          Not now
        </button>
        <button type="button" className="btn-primary px-3 py-1.5 rounded-md text-[12.5px] font-medium" onClick={download}>
          Download
        </button>
      </div>
    </section>
  );
}
