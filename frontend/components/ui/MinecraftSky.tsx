import styles from "./sky.module.css";

/**
 * Clouds: vertical position, width, time to cross the screen, start offset
 * (negative = already mid-way on first paint), opacity, and the spot they rest
 * at when the viewer prefers reduced motion. Far clouds are smaller, fainter
 * and slower, which reads as depth.
 */
const CLOUDS = [
  { top: "7vh", w: "300px", duration: "150s", delay: "-25s", alpha: 0.07, rest: "6vw" },
  { top: "20vh", w: "170px", duration: "230s", delay: "-140s", alpha: 0.045, rest: "62vw" },
  { top: "38vh", w: "360px", duration: "130s", delay: "-80s", alpha: 0.055, rest: "28vw" },
  { top: "58vh", w: "210px", duration: "200s", delay: "-50s", alpha: 0.04, rest: "74vw" },
  { top: "78vh", w: "280px", duration: "170s", delay: "-120s", alpha: 0.05, rest: "12vw" },
];

/** Animated Minecraft night sky, fixed behind all page content. Decorative only. */
export function MinecraftSky() {
  return (
    <div className={styles.sky} aria-hidden>
      <div className={`${styles.stars} ${styles.starsA}`} />
      <div className={`${styles.stars} ${styles.starsB}`} />
      <div className={`${styles.stars} ${styles.starsC}`} />
      <div className={styles.moon} />
      {CLOUDS.map((c) => (
        <div
          key={c.top}
          className={styles.cloud}
          style={
            {
              "--top": c.top,
              "--w": c.w,
              "--duration": c.duration,
              "--delay": c.delay,
              "--alpha": c.alpha,
              "--rest": c.rest,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
