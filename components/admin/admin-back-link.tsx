import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Props = {
  href: string;
  label: string;
};

export function AdminBackLink({ href, label }: Props) {
  return (
    <Link
      href={href}
      className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
