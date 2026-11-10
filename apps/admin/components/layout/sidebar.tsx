"use client";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";
import { LogoMark } from "@/components/ui/logo";
import { siteConfig } from "@/config/site";
import { useShell } from "./shell-context";
import { ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

interface NavLinkProps {
  item: NavItem;
  collapsed: boolean;
  onNavigate: () => void;
}

function NavLink({ item, collapsed, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const childActive = children.some((child) => child.href === pathname);
  // null = follow the active route; a boolean means the user toggled it
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? childActive;
  const Icon = item.icon;
  const active = hasChildren ? childActive : isRouteActive(pathname, item.href);

  const itemClass = cn(
    "flex w-full items-center gap-3 rounded-md px-3 py-[7px] text-left text-[13px] font-medium transition-colors duration-150",
    active
      ? "bg-primary/8 text-primary"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
    collapsed && "justify-center px-2",
  );

  const content = (
    <>
      {Icon && <Icon className={cn("h-[16px] w-[16px] shrink-0", active && "text-primary")} />}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.title}</span>
          {item.badge && (
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-2xs font-semibold text-primary">
              {item.badge}
            </span>
          )}
          {hasChildren && (
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          )}
        </>
      )}
    </>
  );

  // Collapsed groups can't show their submenu, so they jump to the first child instead
  if (hasChildren && !collapsed) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setManualOpen(!open)}
          aria-expanded={open}
          className={itemClass}
        >
          {content}
        </button>

        {open && (
          <div className="ml-[26px] mt-0.5 space-y-0.5 border-l border-border pl-3">
            {children.map((child) => {
              const isChildActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={isChildActive ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-[6px] text-xs font-medium transition-colors duration-150",
                    isChildActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {child.title}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={hasChildren ? children[0].href : item.href}
      onClick={onNavigate}
      title={collapsed ? item.title : undefined}
      aria-label={collapsed ? item.title : undefined}
      aria-current={active && !hasChildren ? "page" : undefined}
      className={itemClass}
    >
      {content}
    </Link>
  );
}

export function Sidebar() {
  const { isOpen, isCollapsed, setOpen, navigation } = useShell();
  // Only has a visible effect below lg, where the sidebar is an overlay drawer
  const closeMobile = () => setOpen(false);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
          "lg:relative lg:z-auto",
          isCollapsed ? "w-[60px]" : "w-[252px]",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="flex h-[68px] items-center justify-between border-b border-sidebar-border px-4">
          {!isCollapsed && (
            <Link href="/dashboard" aria-label={`${siteConfig.name} dashboard`} onClick={closeMobile}>
              <LogoMark />
            </Link>
          )}
          {isCollapsed && (
            <Link
              href="/dashboard"
              aria-label={`${siteConfig.name} dashboard`}
              className="mx-auto"
              onClick={closeMobile}
            >
              <LogoMark showWordmark={false} />
            </Link>
          )}
          <button
            onClick={closeMobile}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          <div className="space-y-6">
            {navigation.map((group) => (
              <div key={group.label}>
                {!isCollapsed && (
                  <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      collapsed={isCollapsed}
                      onNavigate={closeMobile}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}
