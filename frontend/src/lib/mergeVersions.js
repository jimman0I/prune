/** Fills in versions for programs whose registry entry never recorded
 * one.
 *
 * 15 of the 130 entries on this machine have no DisplayVersion, and they
 * are not a random 15: they are overwhelmingly the games and clients a
 * launcher installed -- Steam, Ubisoft, Riot titles -- so the Version
 * column went blank exactly where someone scanning the list is most
 * likely to be looking. The backend reads the version off each program's
 * own binary, the same place Windows' Properties dialog reads it from,
 * and this merges the result in.
 *
 * A registry-reported version is never overwritten, for the same reason
 * a registry-reported size isn't: that string is what the vendor declared
 * about their own program, and a binary in the folder can legitimately
 * disagree with it. Only blanks get filled.
 *
 * `versionFromBinary` marks the ones that were read off an executable, so
 * the UI can distinguish them if it ever needs to. */
export function mergeBinaryVersions(programs, versions) {
  if (!versions || Object.keys(versions).length === 0) return programs;

  return programs.map((program) => {
    if (program.version) return program;
    const found = versions[program.id];
    if (typeof found !== 'string' || !found) return program;
    return { ...program, version: found, versionFromBinary: true };
  });
}
