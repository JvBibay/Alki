"use client";

import { useEffect, useState } from "react";

/** A slim notice when the phone has no connection. Everything still works; only voice, sync and sign-in need one. */
export default function OfflineBar() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="offlinebar" role="status">
      You’re offline. Kwenta still works; backup, voice and sign-in will catch up when you’re back online.
    </div>
  );
}
