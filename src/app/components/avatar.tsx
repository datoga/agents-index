"use client";

import { useEffect, useState } from "react";

export function Avatar({ name, url, profile = false }: { name: string; url?: string | null; profile?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const className = profile ? "profile-avatar" : "avatar";
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";

  return <div className={className} aria-hidden="true">
    {url && !failed
      ? <img src={url} alt="" referrerPolicy="no-referrer" loading={profile ? "eager" : "lazy"} onError={() => setFailed(true)} />
      : <span>{initial}</span>}
  </div>;
}
