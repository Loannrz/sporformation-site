"use client";

import { deleteAnnouncementAdminAction } from "@/app/actions/announcements-admin";
import { AnnouncementLogoMark } from "@/components/announcements/announcement-logo-mark";
import { EditAnnouncementForm } from "@/components/announcements/edit-announcement-form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Announcement } from "@/types";
import { announcementAccentArticleClass } from "@/lib/announcement-accents";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  announcements: Announcement[];
  locale: AppLocale;
  canManage: boolean;
};

export function AnnouncementsBulletin({
  announcements,
  locale,
  canManage,
}: Props) {
  const router = useRouter();
  const t = useTranslations("announcements");
  const tManage = useTranslations("announcements.manage");
  const formatter = useFormatter();
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [pending, startTransition] = useTransition();

  const formattedDate = (iso: string) =>
    formatter.dateTime(new Date(iso), {
      dateStyle: "medium",
    });

  const confirmDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteAnnouncementAdminAction(locale, deleteTarget.id);
      if (!res.ok) {
        if (res.error === "FORBIDDEN") {
          toast.error(tManage("forbiddenToast"));
          return;
        }
        if (res.error === "NO_SERVICE_ROLE") {
          toast.error(tManage("serviceToast"));
          return;
        }
        toast.error(tManage("deleteFailedToast"));
        return;
      }
      toast.success(tManage("deletedToast"));
      setDeleteTarget(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {announcements.map((a) => (
        <Card
          key={a.id}
          className={cn("overflow-hidden", announcementAccentArticleClass(a.accentKey))}
        >
          <CardHeader>
            <div className="flex flex-wrap items-start gap-4">
              <AnnouncementLogoMark
                logoKey={a.logoKey}
                accentKey={a.accentKey}
                variant="lg"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        a.importance === "urgent" ? "urgent" : "secondary"
                      }
                    >
                      {a.importance}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formattedDate(a.createdAt)}
                    </span>
                    <Badge variant="outline" className="text-[11px] font-normal">
                      {tManage(`visibility.${a.audience}`)}
                    </Badge>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2"
                        onClick={() => setEditing(a)}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        {tManage("editButton")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(a)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        {tManage("deleteButton")}
                      </Button>
                    </div>
                  ) : null}
                </div>
                <CardTitle className="leading-snug">{a.title}</CardTitle>
                <CardDescription>{t("fromLeadership")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: a.html }}
          />
        </Card>
      ))}

      {announcements.length === 0 ? (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{t("bulletinEmpty")}</p>
          {canManage ? (
            <p className="text-xs">{t("bulletinEmptyHintManage")}</p>
          ) : (
            <p className="text-xs">{t("bulletinEmptyHintRead")}</p>
          )}
        </div>
      ) : null}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{tManage("editDialogTitle")}</DialogTitle>
            <DialogDescription>{tManage("editDialogDesc")}</DialogDescription>
          </DialogHeader>
          {editing ? (
            <EditAnnouncementForm
              locale={locale}
              announcement={editing}
              onSaved={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tManage("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tManage("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {tManage("cancelDelete")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => confirmDelete()}
            >
              {pending ? tManage("deletingLabel") : tManage("confirmDelete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
