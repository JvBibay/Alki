const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  wallet: "M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zm13 7h.01",
  plan: "M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 8h3m-3 4h6",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2",
  plus: "M12 5v14M5 12h14",
  chat: "M4 5h16v11H9l-5 4z",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
  stats: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  budget: "M12 3v18M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6",
  repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3",
  transfer: "M7 7h13l-4-4M17 17H4l4 4",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm-7-3a7 7 0 0 0 14 0M12 19v3",
  send: "M5 12h14M13 6l6 6-6 6",
  back: "M15 18l-6-6 6-6",
  chevron: "M9 18l6-6-6-6",
  // Theme
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1.5v2M12 20.5v2M4.6 4.6 6 6M18 18l1.4 1.4M1.5 12h2M20.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4",
  moon: "M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z",
  auto: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M12 7.5h4M12 12h5.5M12 16.5h4",
  // Alki's closet slots
  hat: "M7 15.5V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v9.5M3 15.5c0 1.4 4 2.5 9 2.5s9-1.1 9-2.5M7 12.5h10",
  glasses: "M2.5 13a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M14.5 13a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M9.5 13c1.5-1.2 3.5-1.2 5 0M2.5 12 4 8M21.5 12 20 8",
  bowtie: "M10.5 10.5 4 7v10l6.5-3.5zM13.5 10.5 20 7v10l-6.5-3.5zM10.5 10h3v4h-3z",
  hand: "M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5V5a1.5 1.5 0 0 1 3 0v6M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5.2-3L3 14.5a1.6 1.6 0 0 1 2.7-1.6L8 15.5",
  scene: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 16l5-5 4.5 4.5 3-3L21 18M15.5 9h.01",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  close: "M6 6l12 12M18 6 6 18",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  up: "M12 19V5m-6 6 6-6 6 6",
  down: "M12 5v14m-6-6 6 6 6-6",
  check: "M5 12l5 5 9-10",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.3-4.3",
  download: "M12 4v12m-5-5 5 5 5-5M4 20h16",
  upload: "M12 20V8m-5 5 5-5 5 5M4 4h16",
  flame: "M12 22c4 0 7-2.7 7-6.5 0-3.5-2.5-5.7-4-8.5-.6 2-1.6 3-3 3.5C12.5 7 11 4.5 9 2c0 4-4 6.7-4 11.5C5 18.6 8 22 12 22z",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zm4 4h4",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  sliders: "M4 6h9m4 0h3M15 4v4M4 12h3m4 0h9M9 10v4M4 18h11m4 0h1M17 16v4",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  cloud: "M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9.5 4.3 4.3 0 0 1 17.5 18z",
  key: "M14.5 9.5a4 4 0 1 1-1.2-2.9L21 14.2V17h-2.8v-2h-2v-2h-1.6z",
  logout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  shield: "M12 3l7 3v5.5c0 4.4-3 7.8-7 9.5-4-1.7-7-5.1-7-9.5V6z",
  eyeOff:"M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
};

export default function Icon({ name, size = 22, stroke = 2 }: { name: keyof typeof PATHS | string; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}
