"use client";

import { cn } from "@/lib/utils";
import { Maximize2, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { GlobalSearch } from "./global-search";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { useTheme } from "next-themes";
import { useShell } from "./shell-context";

// DropX header: sidebar toggle, global search (Ctrl K), fullscreen, notifications, theme, user.
export function Header() {
  const { isCollapsed, setOpen, toggleCollapsed } = useShell();
  const { resolvedTheme, setTheme } = useTheme();

  const actionButton =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground shadow-card transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary";

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:px-5">
      <div className="flex h-[68px] items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className={cn(actionButton, "lg:hidden")}
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          onClick={toggleCollapsed}
          className={cn(actionButton, "hidden lg:flex")}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

        <div className="flex min-w-0 flex-1">
          <GlobalSearch />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!document.fullscreenElement) document.documentElement.requestFullscreen();
              else document.exitFullscreen();
            }}
            className={cn(actionButton, "hidden md:flex")}
            aria-label="Toggle fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <NotificationBell className={actionButton} />

          {/* Both icons render on the server; CSS picks one so markup matches on hydration */}
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className={actionButton}
            aria-label="Toggle theme"
          >
            <Sun className="hidden h-4 w-4 dark:block" />
            <Moon className="h-4 w-4 dark:hidden" />
          </button>

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
