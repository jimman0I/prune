import { configure } from '@testing-library/react';

// Testing Library's findBy*/waitFor give up after 1000 ms by default. Run
// as one full parallel suite on a busy machine, a render that needs a few
// awaited fetches can take longer than that without anything being wrong,
// which showed up as a different Greek-language test failing in roughly one
// full run in three ("Unable to find role=navigation"), never twice in the
// same place. Generous here costs nothing when the UI is fast: a query
// resolves the moment its element exists, and a genuinely missing element
// still fails, just after 5 s instead of 1.
configure({ asyncUtilTimeout: 5000 });
