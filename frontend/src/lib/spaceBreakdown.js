/** The numbers behind the Dashboard's one question, "where is my space
 * going?" -- used, split into what the program list accounts for and what
 * it does not, and free.
 *
 * `ready` is the honesty gate. The program figure needs the disk AND the
 * program sizes, and the sizes arrive well after the list (they walk real
 * install folders). Until both are in, the split is withheld entirely --
 * `programsBytes` and `otherBytes` stay null and the bar draws used and free
 * only -- so a number never appears and then changes underneath the reader.
 *
 * Only programs with a numeric size are summed. A program with no size
 * (a Store app, an entry whose folder could not be read) is counted in
 * `unsizedCount` instead of being added as 0, and the screen says so.
 * "Everything else" is used minus that sum, floored at 0: program sizes can
 * legitimately add up to more than this drive holds (an install on another
 * drive, shared files counted twice), and a negative slice of a bar is not
 * a thing. When that happens `exceedsUsed` is set so the legend can say why
 * the two figures do not subtract. */
export function spaceBreakdown({ diskSpace, programs, programsMeasured }) {
  const empty = {
    ready: false, totalBytes: null, usedBytes: null, freeBytes: null,
    programsBytes: null, otherBytes: null, sizedCount: 0, unsizedCount: 0,
    exceedsUsed: false, segments: { programs: 0, other: 0, free: 0 }
  };
  if (!diskSpace || !(diskSpace.totalBytes > 0)) return empty;

  const totalBytes = diskSpace.totalBytes;
  const freeBytes = Math.min(Math.max(diskSpace.freeBytes, 0), totalBytes);
  const usedBytes = totalBytes - freeBytes;
  const pct = (bytes) => (bytes / totalBytes) * 100;

  if (!programsMeasured) {
    return {
      ...empty, totalBytes, usedBytes, freeBytes,
      segments: { programs: 0, other: pct(usedBytes), free: pct(freeBytes) }
    };
  }

  let programsBytes = 0;
  let sizedCount = 0;
  let unsizedCount = 0;
  for (const program of programs || []) {
    if (typeof program.sizeBytes === 'number') {
      programsBytes += program.sizeBytes;
      sizedCount += 1;
    } else {
      unsizedCount += 1;
    }
  }

  const otherBytes = Math.max(usedBytes - programsBytes, 0);
  // What the bar can show: never more programs than there is used space.
  const drawnPrograms = Math.min(programsBytes, usedBytes);
  return {
    ready: true, totalBytes, usedBytes, freeBytes, programsBytes, otherBytes,
    sizedCount, unsizedCount, exceedsUsed: programsBytes > usedBytes,
    segments: { programs: pct(drawnPrograms), other: pct(usedBytes - drawnPrograms), free: pct(freeBytes) }
  };
}

export const DASHBOARD_TOP_COUNT = 5;

/** The biggest measured programs, biggest first. `ratio` is each row's size
 * relative to the largest, which is what its bar is drawn from -- relative,
 * not a share of the drive, because five rows each a few percent of a
 * terabyte would all be slivers. A size of 0 or none is not "large". */
export function largestPrograms(programs, count = DASHBOARD_TOP_COUNT) {
  const sized = (programs || []).filter((p) => typeof p.sizeBytes === 'number' && p.sizeBytes > 0);
  const top = [...sized].sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, count);
  const max = top.length ? top[0].sizeBytes : 0;
  return top.map((p) => ({ ...p, ratio: max > 0 ? p.sizeBytes / max : 0 }));
}
