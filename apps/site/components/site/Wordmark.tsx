import s from "./wordmark.module.css";
/** "zebrasplit", always lowercase (type.wordmark). */
export function Wordmark({ size = "nav" }: { size?: "nav" | "footer" | "join" }) {
  return <span className={[s.mark, s[size]].join(" ")}>zebrasplit</span>;
}
