import type { ReactNode } from "react";
import talmeLogo from "../assets/talme-logo.png";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <header className="mb-8 text-center">
          <img
            className="mx-auto h-36 w-auto object-contain"
            src={talmeLogo}
            alt="Talme Technologies Pvt Ltd"
          />
          <h1 className="mt-5 text-2xl font-bold text-slate-950">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </header>
        {children}
      </section>
    </main>
  );
}
