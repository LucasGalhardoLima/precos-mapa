export const FADE_IN = {
  from: { opacity: 0, translateY: 10 },
  animate: { opacity: 1, translateY: 0 },
  transition: { type: "timing" as const, duration: 400 },
} as const;

export const STAGGER_DELAY = 80;

export const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 1,
} as const;
