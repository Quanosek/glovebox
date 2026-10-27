import { APP_NAME, APP_REPOSITORY_URL, APP_SUPPORT_URL } from "@/lib/brand";

export function ProjectLinks({ compact = false }: { compact?: boolean }) {
  const links = [
    {
      href: APP_SUPPORT_URL,
      label: "Postaw kawę",
      description: `Wesprzyj rozwój ${APP_NAME} na BuyCoffee`,
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M5 8h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Zm12 1h2a3 3 0 0 1 0 6h-2M3 22h18M8 2v3m4-3v3m4-3v3" />
        </svg>
      ),
    },
    {
      href: APP_REPOSITORY_URL,
      label: "GitHub",
      description: `Kod źródłowy ${APP_NAME} na GitHub`,
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.237 1.838 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.468-2.38 1.235-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.323 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.29-1.553 3.297-1.23 3.297-1.23.654 1.652.243 2.873.12 3.176.77.84 1.233 1.91 1.233 3.22 0 4.608-2.807 5.62-5.48 5.917.43.372.823 1.102.823 2.222 0 1.606-.015 2.9-.015 3.293 0 .322.216.694.825.576C20.565 22.296 24 17.8 24 12.5 24 5.87 18.627.5 12 .5Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      {links.map((link, index) => {
        const description = `${link.description} (otwiera nową kartę)`;
        return (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={description}
            title={description}
            className={`btn justify-center [&>svg]:shrink-0 ${index === 0 ? "btn-primary" : ""} ${compact ? "h-9 w-9 p-0" : "gap-2"}`}
          >
            {link.icon}
            {!compact && <span>{link.label}</span>}
          </a>
        );
      })}
    </div>
  );
}
