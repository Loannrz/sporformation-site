"use client";

import { useState, useTransition, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import type { SessionUser } from "@/types";
import type { AppLocale } from "@/i18n/routing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import ThemeToggleCards from "@/components/settings/theme-toggle-cards";
import { ProfileAvatarSettingsSection } from "@/components/settings/profile-avatar-settings-section";
import {
  updateMyProfileAction,
  changeMyPasswordAction,
  updateProfileLocaleAction,
} from "@/app/actions/profile-settings";
import { toast } from "sonner";
import { routing } from "@/i18n/routing";
import {
  Bell,
  Eye,
  Languages,
  Palette,
  Settings,
  Shield,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PREFS_KEY = "sporformation-prefs-v1";

const selectClassName =
  "flex h-10 w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

const settingsCardClass = "overflow-hidden border-border/80 shadow-sm";
const settingsCardHeaderClass =
  "border-b border-border/50 bg-muted/20 pb-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0";

type Prefs = {
  emailNotif: boolean;
  absNotif: boolean;
  docNotif: boolean;
  msgNotif: boolean;
  digest: "never" | "daily" | "weekly";
  profileVisibility: "all" | "admins";
  showOnline: boolean;
};

function defaultPrefs(): Prefs {
  return {
    emailNotif: true,
    absNotif: true,
    docNotif: true,
    msgNotif: true,
    digest: "weekly",
    profileVisibility: "all",
    showOnline: true,
  };
}

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return defaultPrefs();
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs();
    return { ...defaultPrefs(), ...JSON.parse(raw) } as Prefs;
  } catch {
    return defaultPrefs();
  }
}

function savePrefs(p: Prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

type Props = {
  user: SessionUser;
  locale: AppLocale;
  initialPhone: string;
};

const ACCENT_SWATCH: Record<
  "default" | "ocean" | "violet" | "amber",
  string
> = {
  default: "bg-primary",
  ocean: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
};

export function SettingsTabs({ user, locale, initialPhone }: Props) {
  const t = useTranslations("settings");
  const router = useRouter();
  const pathname = usePathname();
  const activeLocale = useLocale();
  const [pending, start] = useTransition();

  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [bio, setBio] = useState(user.bio ?? "");
  const [phone, setPhone] = useState(initialPhone);

  const [curPw, setCurPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [nextPw2, setNextPw2] = useState("");

  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [fontScale, setFontScale] = useState<"normal" | "large">("normal");

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const stored = localStorage.getItem("sf-font-scale");
    if (stored === "large" || stored === "normal") {
      setFontScale(stored);
      return;
    }
    const ds = document.documentElement.dataset.fontScale;
    if (ds === "large" || ds === "normal") setFontScale(ds);
  }, []);

  const applyFontScale = (v: "normal" | "large") => {
    setFontScale(v);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.fontScale = v;
      localStorage.setItem("sf-font-scale", v);
    }
  };

  const applyAccent = (v: string) => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.accent = v;
      localStorage.setItem("sf-accent", v);
    }
  };

  const onSaveProfile = () => {
    start(async () => {
      const res = await updateMyProfileAction(locale, {
        firstName,
        lastName,
        bio,
        phone,
      });
      if (!res.ok) {
        toast.error(String(res.error));
        return;
      }
      toast.success(t("savedProfile"));
      router.refresh();
    });
  };

  const onChangePassword = () => {
    if (nextPw.length < 8) {
      toast.error(t("passwordShort"));
      return;
    }
    if (nextPw !== nextPw2) {
      toast.error(t("passwordMismatch"));
      return;
    }
    start(async () => {
      const res = await changeMyPasswordAction({
        currentPassword: curPw,
        nextPassword: nextPw,
      });
      if (!res.ok) {
        if (res.error === "BAD_CURRENT_PASSWORD") {
          toast.error(t("badCurrentPassword"));
        } else {
          toast.error(String(res.error));
        }
        return;
      }
      toast.success(t("passwordChanged"));
      setCurPw("");
      setNextPw("");
      setNextPw2("");
    });
  };

  const onLocaleChange = (next: "fr" | "en") => {
    start(async () => {
      await updateProfileLocaleAction(locale, next);
      router.replace(pathname, { locale: next });
      toast.success(t("localeSaved"));
    });
  };

  const syncPrefs = (next: Prefs) => {
    setPrefs(next);
    savePrefs(next);
    toast.success(t("prefsSaved"));
  };

  const tabTriggerClass =
    "gap-2 rounded-lg px-3 py-2 text-sm lg:w-full lg:justify-start lg:px-3.5 data-[state=active]:shadow-sm";

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <header className="relative mb-10 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/40 px-6 py-8 shadow-sm sm:px-10">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-0 h-44 w-44 rounded-full bg-primary/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Settings className="h-3.5 w-3.5 text-primary" aria-hidden />
              {t("pageKicker")}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("title")}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="profile" className="w-full">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-10 lg:items-start">
          <TabsList
            className={cn(
              "flex h-auto w-full flex-none flex-row flex-wrap justify-start gap-1 rounded-xl border border-border/70 bg-muted/45 p-1.5",
              "lg:sticky lg:top-24 lg:w-56 lg:flex-col lg:flex-nowrap lg:items-stretch lg:justify-start",
            )}
          >
            <TabsTrigger value="profile" className={tabTriggerClass}>
              <User className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {t("tabProfile")}
            </TabsTrigger>
            <TabsTrigger value="security" className={tabTriggerClass}>
              <Shield className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {t("tabSecurity")}
            </TabsTrigger>
            <TabsTrigger value="appearance" className={tabTriggerClass}>
              <Palette className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {t("tabAppearance")}
            </TabsTrigger>
            <TabsTrigger value="language" className={tabTriggerClass}>
              <Languages className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {t("tabLanguage")}
            </TabsTrigger>
            <TabsTrigger value="notifications" className={tabTriggerClass}>
              <Bell className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {t("tabNotifications")}
            </TabsTrigger>
            <TabsTrigger value="privacy" className={tabTriggerClass}>
              <Eye className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {t("tabPrivacy")}
            </TabsTrigger>
          </TabsList>

          <div className="min-w-0 flex-1 space-y-6">
            <TabsContent value="profile" className="mt-0 outline-none">
              <Card className={settingsCardClass}>
                <CardHeader className={settingsCardHeaderClass}>
                  <div>
                    <CardTitle>{t("profileTitle")}</CardTitle>
                    <CardDescription className="mt-1.5 max-w-prose">
                      {t("profileDesc")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                  <ProfileAvatarSettingsSection locale={locale} user={user} />
                  <div className="h-px w-full bg-border/80" aria-hidden />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sf-fn">{t("firstName")} *</Label>
                      <Input
                        id="sf-fn"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sf-ln">{t("lastName")} *</Label>
                      <Input
                        id="sf-ln"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="sf-em">
                        {t("email")}
                        {user.role === "ELEVE" ? null : " *"}
                      </Label>
                      <Input
                        id="sf-em"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        readOnly={user.role === "ELEVE"}
                        required={user.role !== "ELEVE"}
                        className={cn(
                          "rounded-lg",
                          user.role === "ELEVE" &&
                            "cursor-default bg-muted/50",
                        )}
                        autoComplete="email"
                      />
                      {user.role === "ELEVE" ? (
                        <p className="text-xs text-muted-foreground">
                          {t("emailStudentManaged")}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="sf-ph">{t("phone")}</Label>
                      <Input
                        id="sf-ph"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t("phonePlaceholder")}
                        className="rounded-lg sm:max-w-md"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="sf-bio">{t("bio")}</Label>
                      <Textarea
                        id="sf-bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={4}
                        placeholder={t("bioPlaceholder")}
                        className="min-h-[120px] rounded-lg"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={onSaveProfile}
                    disabled={pending}
                    className="rounded-lg shadow-sm"
                  >
                    {pending ? t("saving") : t("save")}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-0 outline-none">
              <Card className={settingsCardClass}>
                <CardHeader className={settingsCardHeaderClass}>
                  <div>
                    <CardTitle>{t("securityTitle")}</CardTitle>
                    <CardDescription className="mt-1.5 max-w-prose">
                      {t("securityDesc")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="grid gap-5 sm:max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="sf-cp">{t("currentPassword")}</Label>
                      <Input
                        id="sf-cp"
                        type="password"
                        value={curPw}
                        onChange={(e) => setCurPw(e.target.value)}
                        autoComplete="current-password"
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sf-np">{t("newPassword")}</Label>
                      <Input
                        id="sf-np"
                        type="password"
                        value={nextPw}
                        onChange={(e) => setNextPw(e.target.value)}
                        autoComplete="new-password"
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sf-np2">{t("confirmPassword")}</Label>
                      <Input
                        id="sf-np2"
                        type="password"
                        value={nextPw2}
                        onChange={(e) => setNextPw2(e.target.value)}
                        autoComplete="new-password"
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={onChangePassword}
                    disabled={pending}
                    className="rounded-lg shadow-sm"
                  >
                    {t("updatePassword")}
                  </Button>
                  <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                    {t("sessionsHint")}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="mt-0 space-y-6 outline-none">
              <ThemeToggleCards />
              <Card className={settingsCardClass}>
                <CardHeader className={settingsCardHeaderClass}>
                  <div>
                    <CardTitle>{t("accentTitle")}</CardTitle>
                    <CardDescription className="mt-1.5 max-w-prose">
                      {t("accentDesc")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(["default", "ocean", "violet", "amber"] as const).map(
                      (a) => (
                        <Button
                          key={a}
                          type="button"
                          variant="outline"
                          onClick={() => applyAccent(a)}
                          className="h-auto justify-start gap-2.5 rounded-xl border-border/80 py-3 pl-3 pr-3 shadow-none hover:bg-muted/50"
                        >
                          <span
                            className={cn(
                              "h-6 w-6 shrink-0 rounded-full ring-2 ring-background ring-offset-2 ring-offset-card",
                              ACCENT_SWATCH[a],
                            )}
                            aria-hidden
                          />
                          <span className="truncate text-left text-sm font-medium">
                            {t(`accent.${a}`)}
                          </span>
                        </Button>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className={settingsCardClass}>
                <CardHeader className={settingsCardHeaderClass}>
                  <div>
                    <CardTitle>{t("fontTitle")}</CardTitle>
                    <CardDescription className="mt-1.5 max-w-prose">
                      {t("fontDesc")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="inline-flex rounded-xl border border-border/70 bg-muted/30 p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => applyFontScale("normal")}
                      className={cn(
                        "rounded-lg px-4 shadow-none",
                        fontScale === "normal" &&
                          "bg-background text-foreground shadow-sm hover:bg-background",
                      )}
                    >
                      {t("fontNormal")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => applyFontScale("large")}
                      className={cn(
                        "rounded-lg px-4 shadow-none",
                        fontScale === "large" &&
                          "bg-background text-foreground shadow-sm hover:bg-background",
                      )}
                    >
                      {t("fontLarge")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="language" className="mt-0 outline-none">
              <Card className={settingsCardClass}>
                <CardHeader className={settingsCardHeaderClass}>
                  <div>
                    <CardTitle>{t("languageTitle")}</CardTitle>
                    <CardDescription className="mt-1.5 max-w-prose">
                      {t("languageDesc")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label>{t("siteLanguage")}</Label>
                    <select
                      value={activeLocale}
                      onChange={(e) =>
                        onLocaleChange(e.target.value as "fr" | "en")
                      }
                      className={selectClassName}
                    >
                      {routing.locales.map((l) => (
                        <option key={l} value={l}>
                          {l === "fr" ? "Français" : "English"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("dateFormatHint")}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 outline-none">
              <Card className={settingsCardClass}>
                <CardHeader className={settingsCardHeaderClass}>
                  <div>
                    <CardTitle>{t("notifTitle")}</CardTitle>
                    <CardDescription className="mt-1.5 max-w-prose">
                      {t("notifDesc")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  {(
                    [
                      ["nf-em", "notifEmail", "emailNotif"] as const,
                      ["nf-ab", "notifAbs", "absNotif"] as const,
                      ["nf-doc", "notifDoc", "docNotif"] as const,
                      ["nf-msg", "notifMsg", "msgNotif"] as const,
                    ] as const
                  ).map(([id, labelKey, prefKey]) => (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-muted/20 px-4 py-3.5 transition-colors hover:bg-muted/35"
                    >
                      <Label htmlFor={id} className="cursor-pointer text-sm font-medium leading-snug">
                        {t(labelKey)}
                      </Label>
                      <Switch
                        id={id}
                        checked={prefs[prefKey]}
                        onCheckedChange={(v) =>
                          syncPrefs({ ...prefs, [prefKey]: v })
                        }
                      />
                    </div>
                  ))}
                  <div className="space-y-2 pt-2">
                    <Label>{t("digestLabel")}</Label>
                    <select
                      value={prefs.digest}
                      onChange={(e) =>
                        syncPrefs({
                          ...prefs,
                          digest: e.target.value as Prefs["digest"],
                        })
                      }
                      className={selectClassName}
                    >
                      <option value="never">{t("digestNever")}</option>
                      <option value="daily">{t("digestDaily")}</option>
                      <option value="weekly">{t("digestWeekly")}</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="privacy" className="mt-0 outline-none">
              <Card className={settingsCardClass}>
                <CardHeader className={settingsCardHeaderClass}>
                  <div>
                    <CardTitle>{t("privacyTitle")}</CardTitle>
                    <CardDescription className="mt-1.5 max-w-prose">
                      {t("privacyDesc")}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label>{t("whoSeeProfile")}</Label>
                    <select
                      value={prefs.profileVisibility}
                      onChange={(e) =>
                        syncPrefs({
                          ...prefs,
                          profileVisibility: e.target.value as Prefs["profileVisibility"],
                        })
                      }
                      className={cn(selectClassName, "max-w-md")}
                    >
                      <option value="all">{t("visibilityAll")}</option>
                      <option value="admins">{t("visibilityAdmins")}</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-muted/20 px-4 py-3.5 transition-colors hover:bg-muted/35">
                    <Label htmlFor="pr-on" className="cursor-pointer text-sm font-medium leading-snug">
                      {t("showOnline")}
                    </Label>
                    <Switch
                      id="pr-on"
                      checked={prefs.showOnline}
                      onCheckedChange={(v) =>
                        syncPrefs({ ...prefs, showOnline: v })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
