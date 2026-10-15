/** 40 px sand disc with initials. `done` = ink with a volt stripe swiped across; `pending` = dashed outline. */
export function Avatar({ name, uri, size, done = false, pending = false, className }: { name: string; uri?: string | null; size?: number; done?: boolean; pending?: boolean; className?: string }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const cls = ["avatar", done ? "done" : "", pending && !done ? "pending" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <span className={cls} style={size ? { width: size, height: size } : undefined} aria-label={done ? `${name}, done adding expenses` : name} role="img">
      {uri && !done ? <img src={uri} alt="" /> : <span>{initials}</span>}
    </span>
  );
}
