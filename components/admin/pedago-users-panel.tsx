"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  createPedagoUserAction,
  deletePedagoUserAction,
  updatePedagoFlagsAction,
} from "@/app/actions/pedago-admin";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PedagoProfileRow } from "@/lib/data/pedago-profiles";
import {
  PEDAGO_ADMIN_KEYS,
  PEDAGO_NAV_KEYS,
} from "@/lib/pedago-access";
import type { AppLocale } from "@/i18n/routing";
import type { PedagoAdminFlagKey, PedagoNavFlagKey } from "@/types";
import {
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

function normalizeSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

type Props = {
  locale: AppLocale;
  rows: PedagoProfileRow[];
};

function fullNav(): Record<PedagoNavFlagKey, boolean> {
  return PEDAGO_NAV_KEYS.reduce(
    (acc, k) => {
      acc[k] = true;
      return acc;
    },
    {} as Record<PedagoNavFlagKey, boolean>,
  );
}

function fullAdmin(): Record<PedagoAdminFlagKey, boolean> {
  return PEDAGO_ADMIN_KEYS.reduce(
    (acc, k) => {
      acc[k] = true;
      return acc;
    },
    {} as Record<PedagoAdminFlagKey, boolean>,
  );
}

export function PedagoUsersPanel({ locale, rows: initialRows }: Props) {
  const t = useTranslations("admin.pedago");
  const tAdmin = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<PedagoProfileRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nav, setNav] = useState(fullNav);
  const [admin, setAdmin] = useState(fullAdmin);
  const [searchQuery, setSearchQuery] = useState("");

  const resetForm = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setNav(fullNav());
    setAdmin(fullAdmin());
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (r: PedagoProfileRow) => {
    setEditRow(r);
    setNav({ ...r.nav });
    setAdmin({ ...r.admin });
  };

  const handleCreate = () => {
    startTransition(() => {
      void (async () => {
        const res = await createPedagoUserAction(locale, {
          email,
          firstName,
          lastName,
          nav,
          admin,
        });
        if (res.ok) {
          toast.success(t("toastCreated"));
          setCreateOpen(false);
          resetForm();
          router.refresh();
        } else {
          toast.error(res.error === "EMAIL_IN_USE" ? t("errEmailInUse") : t("toastError"));
        }
      })();
    });
  };

  const handleSaveEdit = () => {
    if (!editRow) return;
    const id = editRow.id;
    startTransition(() => {
      void (async () => {
        const res = await updatePedagoFlagsAction(locale, id, { nav, admin });
        if (res.ok) {
          toast.success(t("toastUpdated"));
          setEditRow(null);
          router.refresh();
        } else {
          toast.error(t("toastError"));
        }
      })();
    });
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(() => {
      void (async () => {
        const res = await deletePedagoUserAction(locale, id);
        if (res.ok) {
          toast.success(t("toastDeleted"));
          router.refresh();
        } else {
          toast.error(t("toastError"));
        }
      })();
    });
  };

  const filteredRows = useMemo(() => {
    const q = normalizeSearch(searchQuery);
    if (!q) return initialRows;
    return initialRows.filter((r) => {
      const hay = normalizeSearch(
        `${r.firstName} ${r.lastName} ${r.email}`,
      );
      return hay.includes(q);
    });
  }, [initialRows, searchQuery]);

  const navLabels = useMemo(() => {
    const m: Record<PedagoNavFlagKey, string> = {
      dashboard: t("nav.dashboard"),
      announcements: t("nav.announcements"),
      cloud: t("nav.cloud"),
      messaging: t("nav.messaging"),
      classes: t("nav.classes"),
      calendar: t("nav.calendar"),
      sanctionsHub: t("nav.sanctionsHub"),
      disciplineWarning: t("nav.disciplineWarning"),
    };
    return m;
  }, [t]);

  const adminLabels = useMemo(() => {
    const m: Record<PedagoAdminFlagKey, string> = {
      adminClasses: t("admin.adminClasses"),
      adminTeacherAccounts: t("admin.adminTeacherAccounts"),
      adminStudents: t("admin.adminStudents"),
      adminCalendar: t("admin.adminCalendar"),
      adminAnnouncements: t("admin.adminAnnouncements"),
      adminSanctions: t("admin.adminSanctions"),
      adminLeadForms: t("admin.adminLeadForms"),
      adminHistory: t("admin.adminHistory"),
      adminStaffDirectory: t("admin.adminStaffDirectory"),
    };
    return m;
  }, [t]);

  const renderFlagGrid = (
    keysNav: readonly PedagoNavFlagKey[],
    keysAdmin: readonly PedagoAdminFlagKey[],
    navState: Record<PedagoNavFlagKey, boolean>,
    adminState: Record<PedagoAdminFlagKey, boolean>,
    setNavState: (v: Record<PedagoNavFlagKey, boolean>) => void,
    setAdminState: (v: Record<PedagoAdminFlagKey, boolean>) => void,
  ) => (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
        <p className="text-sm font-semibold">{t("sectionNav")}</p>
        <div className="space-y-3">
          {keysNav.map((k) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <Label htmlFor={`nav-${k}`} className="text-sm font-normal">
                {navLabels[k]}
              </Label>
              <Switch
                id={`nav-${k}`}
                checked={navState[k]}
                onCheckedChange={(c) =>
                  setNavState({ ...navState, [k]: c })
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
        <p className="text-sm font-semibold">{t("sectionAdmin")}</p>
        <div className="space-y-3">
          {keysAdmin.map((k) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <Label htmlFor={`adm-${k}`} className="text-sm font-normal">
                {adminLabels[k]}
              </Label>
              <Switch
                id={`adm-${k}`}
                checked={adminState[k]}
                onCheckedChange={(c) =>
                  setAdminState({ ...adminState, [k]: c })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <AdminBackLink href="/admin" label={tAdmin("backToAdmin")} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">{t("pageTitle")}</h1>
            <p className="max-w-prose text-muted-foreground">{t("pageSubtitle")}</p>
          </div>
        </div>
        <Button type="button" onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("create")}
        </Button>
      </header>

      {initialRows.length > 0 ? (
        <div className="relative max-w-lg">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 bg-background pl-9"
            aria-label={t("searchPlaceholder")}
            autoComplete="off"
          />
        </div>
      ) : null}

      <div className="space-y-3">
        {initialRows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {t("empty")}
            </CardContent>
          </Card>
        ) : filteredRows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {t("searchEmpty")}
            </CardContent>
          </Card>
        ) : (
          filteredRows.map((r) => (
            <Card key={r.id} className="border-border/80">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
                <div className="flex gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                    <UserRound className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {r.firstName} {r.lastName}
                    </CardTitle>
                    <CardDescription>{r.email}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => openEdit(r)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => setDeleteId(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("delete")}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("dialogCreateTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-fn">{t("firstName")}</Label>
                <Input
                  id="p-fn"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-ln">{t("lastName")}</Label>
                <Input
                  id="p-ln"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-em">{t("email")}</Label>
              <Input
                id="p-em"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {renderFlagGrid(
              PEDAGO_NAV_KEYS,
              PEDAGO_ADMIN_KEYS,
              nav,
              admin,
              setNav,
              setAdmin,
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="button" disabled={pending} onClick={handleCreate}>
                {t("submitCreate")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editRow != null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editRow ? `${editRow.firstName} ${editRow.lastName}` : ""}
            </DialogTitle>
          </DialogHeader>
          {editRow ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{editRow.email}</p>
              {renderFlagGrid(
                PEDAGO_NAV_KEYS,
                PEDAGO_ADMIN_KEYS,
                nav,
                admin,
                setNav,
                setAdmin,
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
                  {t("cancel")}
                </Button>
                <Button type="button" disabled={pending} onClick={handleSaveEdit}>
                  {t("save")}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              {t("deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
