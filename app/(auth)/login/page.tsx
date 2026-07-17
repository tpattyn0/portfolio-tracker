"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const registered = searchParams.get("registered") === "true";

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember: true,
    },
  });

  const rememberMe = watch("remember");

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-[420px]">
        <div className="text-center pb-5" style={{ borderBottom: "3px double var(--foreground)" }}>
          <div className="text-[10px] uppercase tracking-[0.16em] text-mut">
            Est. 2026 · European edition
          </div>
          <div className="mt-2 font-serif text-[38px] font-medium">Meridian</div>
        </div>

        <div className="mt-8 rounded-lg border border-border bg-card p-9">
          <div className="text-center font-serif text-[26px] font-medium">Welcome back</div>
          <p className="mb-7 mt-2 text-center font-serif text-[14.5px] italic text-mut">
            Sign in to your account to continue.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[22px]">
            {registered && (
              <div className="rounded-md border border-up/40 bg-fill p-3 text-sm text-up">
                Account created successfully! Please sign in.
              </div>
            )}

            {error && (
              <div className="rounded-md border border-dn/40 bg-fill p-3 text-sm text-dn">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-[10.5px] uppercase tracking-[0.12em] text-mut">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                disabled={isLoading}
                className="h-10 w-full rounded-md border border-border bg-background px-3.5 text-sm text-foreground outline-none disabled:opacity-50"
              />
              {errors.email && <p className="mt-1 text-sm text-dn">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-[10.5px] uppercase tracking-[0.12em] text-mut">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
                disabled={isLoading}
                className="h-10 w-full rounded-md border border-border bg-background px-3.5 text-sm text-foreground outline-none disabled:opacity-50"
              />
              {errors.password && <p className="mt-1 text-sm text-dn">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between text-[12.5px] text-sub">
              <label htmlFor="remember" className="flex cursor-pointer items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setValue("remember", e.target.checked)}
                  disabled={isLoading}
                  style={{ accentColor: "var(--foreground)" }}
                />
                Remember me
              </label>
              <Link href="/forgot-password" className="border-b border-border">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-btnbg text-[13.5px] font-medium text-btnfg disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="text-center text-[12.5px] text-mut">
              Don&rsquo;t have an account?{" "}
              <Link href="/register" className="border-b border-border text-foreground">
                Create account
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
