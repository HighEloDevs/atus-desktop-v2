/**
 * @module
 * Whether the announced update is news the person has not looked at yet.
 */

import { useCallback, useState } from "react";
import { UPDATE_SEEN_KEY, readSeen, writeSeen } from "./news-seen";

/**
 * Tracks whether the news of the announced update was opened.
 * @param offered - Version of the update being offered, or null when there is none.
 * @returns `unseen`, true while an update is offered and its news were not opened, and `markSeen`,
 *   which records that they were.
 */
export function useUpdateSeen(offered: string | null) {
  const [seen, setSeen] = useState(() => readSeen(UPDATE_SEEN_KEY));
  const markSeen = useCallback(() => {
    if (offered === null) return;
    writeSeen(UPDATE_SEEN_KEY, offered);
    setSeen(offered);
  }, [offered]);
  return { unseen: offered !== null && seen !== offered, markSeen };
}
