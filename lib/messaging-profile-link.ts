import type { MessagingParticipant } from "@/lib/data/messaging";
import {
  canViewStaffDirectoryProfiles,
  canViewStudentDossierPage,
} from "@/lib/roles";
import type { SessionUser } from "@/types";

/** Lien exploitable depuis une discussion **hors groupe** vers la fiche de l’interlocuteur. */
export function messagingDirectPeerProfileHref(
  viewer: SessionUser,
  isGroup: boolean,
  participants: MessagingParticipant[],
): string | null {
  if (isGroup) return null;
  const other = participants.find((p) => p.profileId !== viewer.id);
  if (!other) return null;

  if (other.studentRowId && canViewStudentDossierPage(viewer)) {
    return `/etudiants/${other.studentRowId}`;
  }

  if (
    canViewStaffDirectoryProfiles(viewer) &&
    other.baseRole &&
    other.baseRole !== "ELEVE"
  ) {
    return `/profil/${other.profileId}`;
  }

  return null;
}
