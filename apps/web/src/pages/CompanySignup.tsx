import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { supabase } from "../lib/supabase";
import { Field } from "../components/ui";
import { AmbientBackground } from "../components/ambient";

const schema = z.object({
  company_name: z.string().min(2), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  admin_name: z.string().min(2), admin_email: z.string().email(),
  password: z.string().min(8), confirm: z.string().min(8),
}).refine((v) => v.password === v.confirm, { message: "Passwords must match", path: ["confirm"] });

export function CompanySignup() {
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (v: z.infer<typeof schema>) => {
    setErr(""); setOk("");
    const { data, error } = await supabase.functions.invoke("register-company", {
      body: { company_name: v.company_name, slug: v.slug.toLowerCase(), timezone: "Asia/Kolkata", admin_name: v.admin_name, admin_email: v.admin_email, password: v.password, redirect_to: window.location.origin + "/login" },
    });
    if (error) { setErr(error.message); return; }
    if ((data as { error?: string })?.error) { setErr((data as { error: string }).error); return; }
    // Auto-login admin for smoother onboarding. When email confirmation is enforced,
    // sign-in only works after the admin clicks the confirmation link.
    const { error: se } = await supabase.auth.signInWithPassword({ email: v.admin_email, password: v.password });
    if (se) {
      if ((se.message ?? "").toLowerCase().includes("confirm")) {
        setOk("Company created! Check your inbox to confirm your email, then log in.");
      } else {
        setErr(`Company created, but auto-login failed (${se.message}). Try logging in manually.`);
      }
      return;
    }
    nav("/admin/dashboard");
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 relative overflow-hidden">
      <AmbientBackground />
      <motion.form
        className="glass p-6 w-full max-w-md grid gap-3 relative"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={handleSubmit(onSubmit)}>
        <h1 className="font-bold text-lg">Create company</h1>
        <p className="text-sm" style={{ color: "var(--vx-text-secondary)" }}>Create the company and its first Admin account.</p>
        <Field label="Company name"><input className="input" {...register("company_name")} />{errors.company_name && <div className="text-xs" style={{ color: "var(--vx-danger)" }}>Required</div>}</Field>
        <Field label="Slug" hint="lowercase letters, numbers, hyphens"><input className="input mono" {...register("slug")} />{errors.slug && <div className="text-xs" style={{ color: "var(--vx-danger)" }}>Invalid slug</div>}</Field>
        <Field label="Admin full name"><input className="input" {...register("admin_name")} /></Field>
        <Field label="Work email"><input className="input" {...register("admin_email")} /></Field>
        <Field label="Password"><input className="input" type="password" {...register("password")} /></Field>
        <Field label="Confirm password"><input className="input" type="password" {...register("confirm")} />{errors.confirm && <div className="text-xs" style={{ color: "var(--vx-danger)" }}>{errors.confirm.message}</div>}</Field>
        {err && <div className="text-sm" style={{ color: "var(--vx-danger)" }}>{err}</div>}
        {ok && <div className="text-sm" style={{ color: "var(--vx-success)" }}>{ok}</div>}
        <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? "Creating…" : "Create company"}</button>
        <Link className="text-xs underline opacity-70" to="/login">Already have access? Sign in</Link>
      </motion.form>
    </div>
  );
}
