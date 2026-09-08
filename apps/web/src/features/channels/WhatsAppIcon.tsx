import type { SVGProps } from "react";

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.5 11.6a8.5 8.5 0 0 1-12.7 7.5L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4.2Z" />
      <path
        d="m8.3 7.2 1.4 2.5-1 1.1c.8 1.8 2 3 3.8 3.7l1-1 2.6 1.4c.3.2.3.5.1.9-.5 1-1.4 1.4-2.5 1.1-3.9-1-6.9-4-7.3-7.2-.1-1 .4-1.8 1.1-2.3.3-.2.6-.4.8-.2Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
