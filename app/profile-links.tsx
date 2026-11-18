import { profileLinks } from "./content";
import { CodeIcon, DocumentIcon, ScholarIcon } from "./icons";

// The Scholar / GitHub / CV buttons. They appear twice, on the title page and
// in the margin card, and data-dock-item pairs each button with its twin so it
// can fly between the two.

const icons = { scholar: ScholarIcon, github: CodeIcon, cv: DocumentIcon };

export default function ProfileLinks({ className }: { className: string }) {
  return (
    <ul className={className}>
      {profileLinks.map(({ id, label, href }) => {
        const Icon = icons[id];
        return (
          <li key={id}>
            <a className="pill" data-dock-item={id} href={href} target="_blank" rel="noreferrer">
              <Icon />
              {label}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
