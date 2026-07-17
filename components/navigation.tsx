"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Settings, LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { formatDateline } from "@/lib/utils/dateline";

const navItems = [
  { href: "/dashboard", label: "Portfolio" },
  { href: "/portfolio/closed-positions", label: "Closed" },
  { href: "/wishlist", label: "Watchlist" },
  { href: "/research", label: "Research" },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const dateline = formatDateline(new Date());

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = query.trim().toUpperCase();
    if (symbol) {
      router.push(`/research/${encodeURIComponent(symbol)}`);
      setQuery("");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-8">
        {/* Top row */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-border py-3.5">
          <div className="truncate text-[10.5px] uppercase tracking-[0.12em] text-mut">
            {dateline}
          </div>

          <Link
            href="/dashboard"
            className="text-center font-serif text-[30px] font-medium tracking-[0.01em] text-foreground"
          >
            Meridian
          </Link>

          <div className="flex items-center justify-end gap-3">
            <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
              <Search
                className="pointer-events-none absolute left-[13px] top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-mut"
                strokeWidth={2}
              />
              <input
                type="search"
                placeholder="Search stocks…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-[34px] w-[200px] rounded-full border border-border bg-card pl-[34px] pr-3.5 text-[12.5px] text-foreground outline-none placeholder:text-mut"
              />
            </form>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Account"
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border text-muted-foreground"
                >
                  <User className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session?.user?.name || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-dn"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Nav row */}
        <nav className="flex justify-center gap-[52px] pt-3.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/dashboard" &&
                pathname.startsWith("/portfolio") &&
                !pathname.includes("closed-positions"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "cursor-pointer border-b-2 pb-[13px] text-[11.5px] uppercase tracking-[0.16em]",
                  isActive
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent font-normal text-mut"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
