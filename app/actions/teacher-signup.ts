"use server";

import { redirect } from "@/i18n/navigation";
import {
  finalizeTeacherAccountFromPendingInvite,
  type PendingTeacherInviteRow,
} from "@/app/actions/staff-admin";
import type { AppLocale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import {
  initialTeacherSignupState,
  type TeacherSignupFormState,
} from "@/lib/teacher-signup-state";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

function isAuthEmailTakenError(err: { message?: string } | null | undefined): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already exists") ||
    (m.includes("email") && m.includes("already"))
  );
}

export async function teacherSelfSignupAction(
  _prev: TeacherSignupFormState,
  formData: FormData,
): Promise<TeacherSignupFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const localeRaw = formData.get("locale") as string;
  const locale: AppLocale = routing.locales.includes(localeRaw as AppLocale)
    ? (localeRaw as AppLocale)
    : routing.defaultLocale;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { errorCode: "INVALID_EMAIL_FORMAT", devDetail: null };
  }
  if (password.length < 8) {
    return { errorCode: "PASSWORD_TOO_SHORT", devDetail: null };
  }
  if (password !== confirm) {
    return { errorCode: "PASSWORD_MISMATCH", devDetail: null };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return { errorCode: "CONFIG", devDetail: null };
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    return { errorCode: "ALREADY_REGISTERED", devDetail: null };
  }

  const { data: invite, error: invErr } = await admin
    .from("teacher_pending_signups")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (invErr) {
    return {
      errorCode: "GENERIC",
      devDetail:
        process.env.NODE_ENV === "development" ? invErr.message : null,
    };
  }

  if (!invite) {
    return { errorCode: "INVITE_REQUIRED", devDetail: null };
  }

  if (invite.teacher_employment_status === "FORMER_INACTIVE") {
    return { errorCode: "INVITE_INVALID", devDetail: null };
  }

  const invitation: PendingTeacherInviteRow = {
    email: invite.email as string,
    first_name: invite.first_name as string,
    last_name: invite.last_name as string,
    base_role: invite.base_role as PendingTeacherInviteRow["base_role"],
    teacher_employment_status:
      invite.teacher_employment_status as PendingTeacherInviteRow["teacher_employment_status"],
    joined_at: invite.joined_at as string | null,
    left_establishment_on: invite.left_establishment_on as string | null,
    bio: invite.bio as string | null,
    subjects: (invite.subjects as string[] | null) ?? [],
    principal_class_ids: (invite.principal_class_ids as string[] | null) ?? [],
  };

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  const newId = created?.user?.id;

  if (!newId || cErr) {
    if (isAuthEmailTakenError(cErr)) {
      return { errorCode: "ALREADY_REGISTERED", devDetail: null };
    }
    return {
      errorCode: "AUTH_CREATE_FAILED",
      devDetail:
        process.env.NODE_ENV === "development"
          ? (cErr?.message ?? String(cErr))
          : null,
    };
  }

  const fin = await finalizeTeacherAccountFromPendingInvite(admin, {
    userId: newId,
    email,
    invitation,
  });

  if (!fin.ok) {
    await admin.auth.admin.deleteUser(newId);
    return {
      errorCode: "PROFILE_CREATE_FAILED",
      devDetail:
        process.env.NODE_ENV === "development" ? fin.error : null,
    };
  }

  const serverSb = await createServerSupabase();
  if (!serverSb) {
    return { errorCode: "CONFIG", devDetail: null };
  }

  const { error: signErr } = await serverSb.auth.signInWithPassword({
    email,
    password,
  });

  if (signErr) {
    return {
      errorCode: "SIGNIN_AFTER_SIGNUP_FAILED",
      devDetail:
        process.env.NODE_ENV === "development" ? signErr.message : null,
    };
  }

  redirect({ href: "/dashboard", locale });
  return initialTeacherSignupState;
}
