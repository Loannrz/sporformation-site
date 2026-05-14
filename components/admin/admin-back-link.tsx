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
      className="-ml-2 mb-6 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
