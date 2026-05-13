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
import {
  updateMyProfileAction,
  changeMyPasswordAction,
  updateProfileLocaleAction,
} from "@/app/actions/profile-settings";
import { toast } from "sonner";
import { routing } from "@/i18n/routing";

const PREFS_KEY = "sporformation-prefs-v1";

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

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const applyFontScale = (v: "normal" | "large") => {
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
        email,
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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="profile" className="w-full space-y-6">
        <TabsList className="flex w-full flex-wrap gap-1">
          <TabsTrigger value="profile">{t("tabProfile")}</TabsTrigger>
          <TabsTrigger value="security">{t("tabSecurity")}</TabsTrigger>
          <TabsTrigger value="appearance">{t("tabAppearance")}</TabsTrigger>
          <TabsTrigger value="language">{t("tabLanguage")}</TabsTrigger>
          <TabsTrigger value="notifications">{t("tabNotifications")}</TabsTrigger>
          <TabsTrigger value="privacy">{t("tabPrivacy")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t("profileTitle")}</CardTitle>
              <CardDescription>{t("profileDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sf-fn">{t("firstName")} *</Label>
                  <Input
                    id="sf-fn"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sf-ln">{t("lastName")} *</Label>
                  <Input
                    id="sf-ln"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="sf-em">{t("email")} *</Label>
                  <Input
                    id="sf-em"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="sf-ph">{t("phone")}</Label>
                  <Input
                    id="sf-ph"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("phonePlaceholder")}
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
                  />
                </div>
              </div>
              <Button type="button" onClick={onSaveProfile} disabled={pending}>
                {pending ? t("saving") : t("save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>{t("securityTitle")}</CardTitle>
              <CardDescription>{t("securityDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 sm:max-w-md">
                <Label htmlFor="sf-cp">{t("currentPassword")}</Label>
                <Input
                  id="sf-cp"
                  type="password"
                  value={curPw}
                  onChange={(e) => setCurPw(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2 sm:max-w-md">
                <Label htmlFor="sf-np">{t("newPassword")}</Label>
                <Input
                  id="sf-np"
                  type="password"
                  value={nextPw}
                  onChange={(e) => setNextPw(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2 sm:max-w-md">
                <Label htmlFor="sf-np2">{t("confirmPassword")}</Label>
                <Input
                  id="sf-np2"
                  type="password"
                  value={nextPw2}
                  onChange={(e) => setNextPw2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="button" onClick={onChangePassword} disabled={pending}>
                {t("updatePassword")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("sessionsHint")}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <ThemeToggleCards />
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t("accentTitle")}</CardTitle>
              <CardDescription>{t("accentDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(["default", "ocean", "violet", "amber"] as const).map((a) => (
                <Button
                  key={a}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyAccent(a)}
                >
                  {t(`accent.${a}`)}
                </Button>
              ))}
            </CardContent>
          </Card>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t("fontTitle")}</CardTitle>
              <CardDescription>{t("fontDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => applyFontScale("normal")}
              >
                {t("fontNormal")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => applyFontScale("large")}
              >
                {t("fontLarge")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="language">
          <Card>
            <CardHeader>
              <CardTitle>{t("languageTitle")}</CardTitle>
              <CardDescription>{t("languageDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("siteLanguage")}</Label>
                <select
                  value={activeLocale}
                  onChange={(e) => onLocaleChange(e.target.value as "fr" | "en")}
                  className="flex h-10 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {routing.locales.map((l) => (
                    <option key={l} value={l}>
                      {l === "fr" ? "Français" : "English"}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">{t("dateFormatHint")}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{t("notifTitle")}</CardTitle>
              <CardDescription>{t("notifDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="nf-em">{t("notifEmail")}</Label>
                <Switch
                  id="nf-em"
                  checked={prefs.emailNotif}
                  onCheckedChange={(v) => syncPrefs({ ...prefs, emailNotif: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="nf-ab">{t("notifAbs")}</Label>
                <Switch
                  id="nf-ab"
                  checked={prefs.absNotif}
                  onCheckedChange={(v) => syncPrefs({ ...prefs, absNotif: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="nf-doc">{t("notifDoc")}</Label>
                <Switch
                  id="nf-doc"
                  checked={prefs.docNotif}
                  onCheckedChange={(v) => syncPrefs({ ...prefs, docNotif: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="nf-msg">{t("notifMsg")}</Label>
                <Switch
                  id="nf-msg"
                  checked={prefs.msgNotif}
                  onCheckedChange={(v) => syncPrefs({ ...prefs, msgNotif: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("digestLabel")}</Label>
                <select
                  value={prefs.digest}
                  onChange={(e) =>
                    syncPrefs({
                      ...prefs,
                      digest: e.target.value as Prefs["digest"],
                    })
                  }
                  className="flex h-10 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="never">{t("digestNever")}</option>
                  <option value="daily">{t("digestDaily")}</option>
                  <option value="weekly">{t("digestWeekly")}</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>{t("privacyTitle")}</CardTitle>
              <CardDescription>{t("privacyDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                  className="flex h-10 max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">{t("visibilityAll")}</option>
                  <option value="admins">{t("visibilityAdmins")}</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="pr-on">{t("showOnline")}</Label>
                <Switch
                  id="pr-on"
                  checked={prefs.showOnline}
                  onCheckedChange={(v) => syncPrefs({ ...prefs, showOnline: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
