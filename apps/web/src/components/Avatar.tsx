export function Avatar({ name, uri, size = 32 }: { name: string; uri?: string | null; size?: number }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(10, size / 2.8) }} aria-label={name} role="img">
      {uri ? <img src={uri} alt="" /> : initials}
    </span>
  );
}
