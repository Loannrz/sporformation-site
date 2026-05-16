/** Rôles métier livrés en base ; les rôles custom sont des chaînes additionnelles. */
export type UserRole =
  | "DIRECTEUR"
  | "ADMINISTRATEUR"
  | "PROF_PRINCIPAL"
  | "PROFESSEUR"
  | "PEDAGO"
  | "ELEVE";

/** Statut d’affectation (fiche enseignant). */
export type TeacherEmploymentStatus =
  | "ACTIVE_AT_SCHOOL"
  | "NEW_TO_SCHOOL"
  | "FORMER_INACTIVE";

/** Drapeaux navigation (comptes pédago). */
export type PedagoNavFlagKey =
  | "dashboard"
  | "announcements"
  | "cloud"
  | "messaging"
  | "classes"
  | "calendar"
  | "sanctionsHub"
  | "disciplineWarning";

/** Drapeaux administration (comptes pédago). */
export type PedagoAdminFlagKey =
  | "adminClasses"
  | "adminTeacherAccounts"
  | "adminStudents"
  | "adminCalendar"
  | "adminAnnouncements"
  | "adminSanctions"
  | "adminLeadForms"
  | "adminHistory"
  | "adminStaffDirectory";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  /** Résolu pour `role === "PEDAGO"`. */
  pedagoNav?: Record<PedagoNavFlagKey, boolean>;
  /** Résolu pour `role === "PEDAGO"`. */
  pedagoAdmin?: Record<PedagoAdminFlagKey, boolean>;
  avatarUrl?: string;
  bio?: string;
  subjects?: string[];
  joinedAt?: string;
  principalClassIds?: string[];
  /** Classes où le professeur est affecté en enseignement (hors titularisations PP). */
  assignedClassIds?: string[];
  /** Anciens comptes : premier mot de passe imposé après OTP ; nouveaux flux : inscription « Créer mon compte ». */
  mustSetPassword?: boolean;
  teacherEmploymentStatus?: TeacherEmploymentStatus;
  /** Timestamps ISO (profil) — onboarding documents recrue. */
  teacherDocumentsApprovedAt?: string | null;
  teacherDocumentsBundleSubmittedAt?: string | null;
  /** Nombre de pièces demandées (lignes `teacher_document_requests`). */
  teacherDocumentRequestCount?: number;
  /** Pré-calculé : accès restreint à `/documents-a-fournir` (aligné middleware). */
  teacherDocumentsGateActive?: boolean;
  /** Si `role === "ELEVE"` : ligne `students` liée au compte (auth.users). */
  studentId?: string | null;
  /** Classe de l'élève (accès Cloud restreint). */
  studentClassId?: string | null;
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
  /** ISO date (YYYY-MM-DD). */
  birthDate?: string | null;
  sex?: string | null;
  birthPlace?: string | null;
  njs?: string | null;
  promo?: string | null;
  ofName?: string | null;
  formationNumber?: string | null;
  diploma?: string | null;
  tep?: string | null;
  birthCountry?: string | null;
  birthDepartment?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  addressCity?: string | null;
  addressCountry?: string | null;
  employmentStatus?: string | null;
  parcoursup?: string | null;
  validationStatus?: string | null;
  uc1Status?: string | null;
  uc2Status?: string | null;
  uc3Status?: string | null;
  uc4Status?: string | null;
}

export type SanctionType =
  | "avertissement"
  | "punition"
  | "sanction"
  | "retard"
  | "absence"
  | "comportement"
  | "autre";

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
  /** Titre court optionnel (sinon l’interface affiche surtout le type). */
  title?: string | null;
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

/** Public cible pour l’affichage sur le tableau de bord et la page Annonces. */
export type AnnouncementAudience =
  | "ALL_STAFF"
  | "DIRECTION_ONLY"
  | "HEAD_TEACHERS_ONLY"
  | "CLASSROOM_TEACHERS";

export interface Announcement {
  id: string;
  title: string;
  /** HTML léger depuis l’éditeur (pour maquette locale) ; en prod, contenu validé/stocké. */
  html: string;
  createdAt: string;
  importance: AnnouncementImportance;
  authorId: string;
  audience: AnnouncementAudience;
  /** Clé parmi les logos prédéfinis côté app. */
  logoKey: string;
  /** Teinte de carte : slate, emerald, rose, sky, amber, violet, orange. */
  accentKey: string;
}

export type CalendarEventType = "course" | "meeting" | "school_event" | "deadline";

/** Audience des événements partagés (aligné annonces + ciblage précis). */
export type CalendarSharedAudience =
  | "ALL_STAFF"
  | "CLASSROOM_TEACHERS"
  | "HEAD_TEACHERS_ONLY"
  | "DIRECTION_ONLY"
  | "SPECIFIC_TARGETS";

export interface CalendarEventTarget {
  type: "profile" | "class" | "student";
  id: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  /** ISO timestamps */
  start: string;
  end: string;
  type: CalendarEventType;
  personal: boolean;
  /** Qui a créé l’entrée */
  createdBy: string | null;
  audience: CalendarSharedAudience | null;
  classId?: string | null;
  teacherId?: string | null;
  targets?: CalendarEventTarget[];
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
  | "VIEW_CALENDAR"
  | "ACCESS_STUDENT_CLOUD";

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
