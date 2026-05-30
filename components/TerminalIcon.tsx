export type IconName =
  | 'activity'
  | 'alert'
  | 'arrowRight'
  | 'briefcase'
  | 'book'
  | 'chart'
  | 'check'
  | 'chevron'
  | 'database'
  | 'discord'
  | 'eye'
  | 'lock'
  | 'radar'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'shield'
  | 'terminal'
  | 'telegram'
  | 'users'
  | 'zap'

type Props = {
  name: IconName
  className?: string
}

const paths: Record<IconName, JSX.Element> = {
  activity: <path d="M3 12h4l2-6 4 12 2-6h6" />,
  alert: <><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  briefcase: <><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M4 7h16v12H4z" /><path d="M4 12h16" /></>,
  book: <><path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4V4Z" /><path d="M5 4v12" /><path d="M9 8h6" /><path d="M9 12h5" /></>,
  chart: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 3-4 3 2 4-7" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  discord: <path fill="currentColor" stroke="none" d="M19.8 6.2A17.1 17.1 0 0 0 15.7 5l-.4.8a14 14 0 0 1 3.2 1.5 12.9 12.9 0 0 0-13 0 14 14 0 0 1 3.2-1.5L8.3 5a17.1 17.1 0 0 0-4.1 1.2C1.7 9.9 1 13.6 1.3 17.2A17.2 17.2 0 0 0 6.4 20l1-1.4a10.5 10.5 0 0 1-1.7-.8l.4-.3a12.6 12.6 0 0 0 11.8 0l.4.3a10.5 10.5 0 0 1-1.7.8l1 1.4a17.2 17.2 0 0 0 5.1-2.8c.4-4.1-.8-7.8-2.9-11ZM8.7 14.6c-.9 0-1.6-.8-1.6-1.8S7.8 11 8.7 11s1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm6.6 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z" />,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  radar: <><circle cx="12" cy="12" r="9" /><path d="M12 12 18 6" /><path d="M12 3v3" /><path d="M3 12h3" /><path d="M12 18v3" /><path d="M18 12h3" /></>,
  refresh: <><path d="M20 6v5h-5" /><path d="M4 18v-5h5" /><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9" /><path d="M5.5 15A7 7 0 0 0 18 17.5l2-2.5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></>,
  settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /><path d="M4 12h2" /><path d="M18 12h2" /><path d="m6.3 6.3 1.4 1.4" /><path d="m16.3 16.3 1.4 1.4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m17.7 6.3-1.4 1.4" /><path d="m7.7 16.3-1.4 1.4" /></>,
  shield: <path d="M12 3 5 6v6c0 4.5 3 7.3 7 9 4-1.7 7-4.5 7-9V6l-7-3Z" />,
  terminal: <><path d="m5 7 5 5-5 5" /><path d="M12 17h7" /></>,
  telegram: <path fill="currentColor" stroke="none" d="M21.9 4.6c.2-.9-.4-1.3-1.2-1L2.8 10.5c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4L17.9 6.7c.5-.3 1-.1.6.2l-8.7 7.8-.3 4.7c.5 0 .8-.2 1.1-.5l2.5-2.4 5.1 3.8c.9.5 1.6.2 1.8-.9l3.1-14.8Z" />,
  users: <><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4" /><circle cx="12" cy="8" r="3" /><path d="M20 18c0-1.7-1.1-3.1-2.7-3.7" /><path d="M16.5 5.2a3 3 0 0 1 0 5.6" /><path d="M4 18c0-1.7 1.1-3.1 2.7-3.7" /><path d="M7.5 5.2a3 3 0 0 0 0 5.6" /></>,
  zap: <path d="M13 2 4 14h7l-1 8 10-13h-7l0-7Z" />,
}

export default function TerminalIcon({ name, className = 'h-4 w-4' }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
