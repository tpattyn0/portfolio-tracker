"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  name: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Registration failed");
      }

      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.error) {
        throw new Error("Registration successful but login failed. Please log in manually.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Registration failed");
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
          <div className="text-center font-serif text-[26px] font-medium">Create an account</div>
          <p className="mb-7 mt-2 text-center font-serif text-[14.5px] italic text-mut">
            Enter your details to start tracking your investments.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[22px]">
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
              <label htmlFor="name" className="mb-2 block text-[10.5px] uppercase tracking-[0.12em] text-mut">
                Name (optional)
              </label>
              <input
                id="name"
                placeholder="Jane Doe"
                {...register("name")}
                disabled={isLoading}
                className="h-10 w-full rounded-md border border-border bg-background px-3.5 text-sm text-foreground outline-none disabled:opacity-50"
              />
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
              <p className="mt-1.5 font-serif text-[11px] italic text-mut">
                Must be at least 8 characters with uppercase, number, and special character
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-btnbg text-[13.5px] font-medium text-btnfg disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>

            <div className="text-center text-[12.5px] text-mut">
              Already have an account?{" "}
              <Link href="/login" className="border-b border-border text-foreground">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
