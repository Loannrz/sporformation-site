/** Rôles métier livrés en base ; les rôles custom sont des chaînes additionnelles. */
export type UserRole =
  | "DIRECTEUR"
  | "ADMINISTRATEUR"
  | "PROF_PRINCIPAL"
  | "PROFESSEUR";

/** Statut d’affectation (fiche enseignant). */
export type TeacherEmploymentStatus =
  | "ACTIVE_AT_SCHOOL"
  | "NEW_TO_SCHOOL"
  | "FORMER_INACTIVE";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string;
  bio?: string;
  subjects?: string[];
  joinedAt?: string;
  principalClassIds?: string[];
  /** Compte créé par la direction : l’utilisateur doit choisir un mot de passe après première connexion (OTP). */
  mustSetPassword?: boolean;
  teacherEmploymentStatus?: TeacherEmploymentStatus;
}

export interface SchoolClass {
  id: string;
  name: string;
  description?: string | null;
  /** Année de début du cycle (ex. 2025 pour « 2025–2027 »). */
  academicYearStart?: number | null;
  academicYearEnd?: number | null;
  principalId?: string;
  studentIds: string[];
}

export interface StudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  photoUrl?: string;
  classId: string;
  entryDate?: string;
}

export type SanctionType = "retard" | "absence" | "comportement" | "autre";

export type SanctionStatus = "active" | "retired";

export interface SanctionAttachment {
  id: string;
  url: string;
  name?: string;
}

export interface Sanction {
  id: string;
  studentId: string;
  type: SanctionType;
  date: string;
  description: string;
  authorId: string;
  authorName: string;
  status: SanctionStatus;
  retiredAt?: string;
  retiredById?: string;
  retiredByName?: string;
  attachments: SanctionAttachment[];
  pdfUrl?: string;
}

export type AnnouncementImportance = "normal" | "urgent";

export interface Announcement {
  id: string;
  title: string;
  /** HTML léger depuis l’éditeur (pour maquette locale) ; en prod, contenu validé/stocké. */
  html: string;
  createdAt: string;
  importance: AnnouncementImportance;
  authorId: string;
}

export type CalendarEventType = "course" | "meeting" | "school_event" | "deadline";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: CalendarEventType;
  classId?: string;
  teacherId?: string;
}

/** Clés alignées avec le tableau fonctionnel dans la spec SPORFORMATION. */
export type PermissionKey =
  | "CREATE_TEACHER_ACCOUNTS"
  | "CREATE_STUDENT_PROFILES"
  | "DELETE_ACCOUNTS"
  | "MANAGE_ROLES"
  | "MANAGE_CLASSES"
  | "ASSIGN_CLASS_PRINCIPAL"
  | "UPLOAD_FILES"
  | "DELETE_OWN_FILES"
  | "DELETE_ALL_FILES"
  | "ADD_SANCTION"
  | "REMOVE_ANY_SANCTION"
  | "REMOVE_OWN_CLASS_SANCTION"
  | "VIEW_SANCTIONS"
  | "VIEW_FULL_SANCTION_HISTORY"
  | "SEND_MESSAGES"
  | "CREATE_ANNOUNCEMENTS"
  | "VIEW_DIRECTOR_DASHBOARD"
  | "MANAGE_CALENDAR"
  | "VIEW_CALENDAR";

export interface CustomSchoolRole {
  id: string;
  nameFr: string;
  nameEn: string;
  parentRoleId?: string | null;
  permissions: Partial<Record<PermissionKey, boolean>>;
}

export interface Conversation {
  id: string;
  name?: string;
  isGroup: boolean;
  participantIds: string[];
  lastMessageSnippet?: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  sentAt: string;
}
