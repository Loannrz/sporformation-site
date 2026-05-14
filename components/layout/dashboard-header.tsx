"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOutAction } from "@/app/actions/auth";
import { isStudentUser } from "@/lib/roles";
import type { SessionUser } from "@/types";
import { ChevronDown, Search, Settings, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CommandPalette } from "@/components/layout/command-palette";

type Props = { user: SessionUser };

export function DashboardHeader({ user }: Props) {
  const locale = useLocale();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`;

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-30 flex min-h-[4.25rem] items-center justify-between gap-4 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl lg:px-8">
        <div className="min-w-0 flex-1" />
        <div className="flex items-center gap-2">
          <CommandPalette
            user={user}
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label={tCommon("commandMenuLabel")}
                onClick={() => setPaletteOpen(true)}
              >
                <Search className="h-[1rem] w-[1rem]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {tCommon("commandMenuTooltip")}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="rounded-full px-3 pl-3 pr-2"
              >
                <Avatar className="mr-2 h-8 w-8 border-0">
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                    {initials || "SF"}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[140px] truncate text-sm font-medium">
                  {user.firstName}
                </span>
                <ChevronDown className="ml-1 h-4 w-4 opacity-55" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                {user.firstName} {user.lastName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href={
                    isStudentUser(user)
                      ? "/parametres"
                      : `/profil/${user.id}`
                  }
                  className="flex cursor-pointer items-center gap-2"
                >
                  <UserRound className="h-4 w-4" /> {tNav("profile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/parametres"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Settings className="h-4 w-4" /> {tNav("settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="p-0">
                <form action={signOutAction} className="w-full">
                  <input type="hidden" name="locale" value={locale} />
                  <button
                    type="submit"
                    className="w-full px-2 py-2 text-left text-sm"
                  >
                    {tAuth("logout")}
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  );
}
