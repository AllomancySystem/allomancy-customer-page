import { createContext, useContext } from 'react';

// App-wide "the link expired" signal. The frozen `request()` clears the token and
// throws an Unauthorized ApiError on a 401; any page that catches one calls this so
// the ROOT can show the single app-wide "expired" terminal screen — no matter which
// route triggered it. Kept deliberately minimal (a single callback over context).
export const ExpiredContext = createContext<() => void>(() => {});

/** The app-wide "mark the session expired" callback for the current route. */
export function useOnExpired(): () => void {
  return useContext(ExpiredContext);
}
