import { cache } from "react";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  fetchOpenVoluntaryRecipientsPendingForUser,
  fetchVoluntaryRecipientsInvalidatedForUser,
} from "@/lib/data/teacher-voluntary-documents";

/** Une seule requête par rendu serveur (layout + page dashboard). */
export const getCachedOpenVoluntaryRecipientsPending = cache(
  async (teacherProfileId: string) => {
    const admin = createAdminSupabase();
    if (!admin) return [];
    return fetchOpenVoluntaryRecipientsPendingForUser(admin, teacherProfileId);
  },
);

export const getCachedVoluntaryRecipientsInvalidated = cache(
  async (teacherProfileId: string) => {
    const admin = createAdminSupabase();
    if (!admin) return [];
    return fetchVoluntaryRecipientsInvalidatedForUser(admin, teacherProfileId);
  },
);
