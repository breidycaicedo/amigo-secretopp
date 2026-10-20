"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import type { ActionState } from "@/types/domain";
import { getParticipantByCode } from "@/lib/data";
import { adminCode, adminPassword } from "@/lib/env";
import { ERRORS } from "@/lib/errors";
import { field } from "@/lib/form";
import { clearFailures, isRateLimited, recordFailure } from "@/lib/rate-limit";
import { endSession, startSession } from "@/lib/session";
import { cleanStudentCode, isValidStudentCode } from "@/lib/validation";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Comparación de igual duración para no filtrar la longitud.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = cleanStudentCode(field(formData, "studentCode"));
  if (!isValidStudentCode(code)) {
    return { ok: false, fieldErrors: { studentCode: ERRORS.INVALID_CODE } };
  }
  try {
    if (await isRateLimited("participant")) {
      return { ok: false, message: ERRORS.TOO_MANY_ATTEMPTS };
    }
    const participant = await getParticipantByCode(code);
    if (participant === null) {
      await recordFailure("participant");
      return { ok: false, fieldErrors: { studentCode: ERRORS.PARTICIPANT_NOT_FOUND } };
    }
    await clearFailures("participant");
    await startSession({ role: "participant", participantId: participant.id });
  } catch {
    return { ok: false, message: ERRORS.DATABASE };
  }
  redirect("/mi-cuenta");
}

export async function adminLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = cleanStudentCode(field(formData, "adminCode"));
  if (!isValidStudentCode(code)) {
    return { ok: false, fieldErrors: { adminCode: ERRORS.INVALID_CODE } };
  }
  try {
    if (await isRateLimited("admin")) {
      return { ok: false, message: ERRORS.TOO_MANY_ATTEMPTS };
    }
    const expectedPassword = adminPassword();
    const codeOk = safeEqual(code, adminCode());
    const passwordOk = expectedPassword.length === 0 || safeEqual(field(formData, "adminPassword"), expectedPassword);
    if (!codeOk || !passwordOk) {
      await recordFailure("admin");
      return { ok: false, message: ERRORS.ADMIN_INVALID };
    }
    await clearFailures("admin");
    await startSession({ role: "admin" });
  } catch {
    return { ok: false, message: ERRORS.DATABASE };
  }
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}
