import { useCallback, useRef, useState } from 'react';
import { streamDeepCleanExecute } from '../lib/api.js';
import { executeLogLine } from '../lib/scanLog.js';

/** The clean itself, streamed a rule at a time -- BleachBit's own "Delete
 * ... Vacuum ..." output, for the step that actually removes something
 * rather than for the scan that only measures it.
 *
 * Deliberately not a useQuery, unlike useDeepCleanScan: there is exactly
 * one clean in flight at a time, it is never repeated on remount or
 * refetch, and its caller (DeepClean.jsx's handleClean) needs the final
 * summary back as a return value -- the same {freedBytes, results} shape
 * executeDeepClean's one-shot POST used to hand back -- so the existing
 * toast and locked-file logic there needs no change beyond which function
 * it awaits.
 *
 * Errors keep the same contract that one-shot call had: `run` throws, and
 * the caller's own try/catch sets its error banner, same as before.
 * Stopping is not an error -- it resolves with whatever was cleaned
 * before the click, the same way Stop already behaves on the scan side.
 *
 * `currentId` is the rule presently being cleaned (null between rules and
 * once finished), for the tree to highlight while a clean is running --
 * the same "what is it doing right now" question the scan's own
 * `currentId` (see useDeepCleanScan.js) answers, asked of the step that
 * can take noticeably longer per rule: a large shader cache is one
 * quarantine call, not many small ones. */
export function useDeepCleanExecute(nameOf, messages) {
  // See useDeepCleanScan: a ref so each line uses the current language.
  const nameOfRef = useRef(nameOf);
  nameOfRef.current = nameOf;
  // Likewise the wording around the name (deepClean.log). Undefined falls
  // through to scanLog.js's English default.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [log, setLog] = useState([]);
  const [executed, setExecuted] = useState(0);
  const [total, setTotal] = useState(0);
  const [cleaning, setCleaning] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const abortRef = useRef(null);

  const run = useCallback(async (ruleIds) => {
    setLog([]);
    setExecuted(0);
    setTotal(ruleIds.length);
    setCurrentId(null);
    setCleaning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let freedBytes = 0;
    const results = [];
    let streamError = null;

    try {
      await streamDeepCleanExecute(ruleIds, (type, data) => {
        if (type === 'start') {
          setTotal(data.total);
        } else if (type === 'rule') {
          results.push(data);
          freedBytes += data.freedBytes || 0;
          setLog((prev) => [...prev, executeLogLine(data, nameOfRef.current, messagesRef.current)]);
          setExecuted((n) => n + 1);
          setCurrentId(data.id);
        } else if (type === 'error') {
          // Held rather than thrown immediately: the stream has already
          // sent whatever it cleaned before the failure, and that stays
          // reported. Thrown once the stream itself ends, below.
          streamError = data.message;
        }
      }, controller.signal);
    } catch (err) {
      // Stop is a user action, not a failure -- whatever was cleaned
      // before that point already happened and is returned, not thrown.
      if (err.name === 'AbortError' || /abort/i.test(err.message || '')) {
        return { freedBytes, results, aborted: true };
      }
      throw err;
    } finally {
      setCleaning(false);
      setCurrentId(null);
      abortRef.current = null;
    }

    if (streamError) throw new Error(streamError);
    return { freedBytes, results };
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { run, stop, cleaning, log, executed, total, currentId };
}
