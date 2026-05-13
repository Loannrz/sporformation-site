import type {
  Announcement,
  Conversation,
  CustomSchoolRole,
  SchoolClass,
  Sanction,
  SessionUser,
  StudentProfile,
} from "@/types";

const director: SessionUser = {
  id: "u-directeur",
  email: "direction@sporformation.fr",
  firstName: "Camille",
  lastName: "Renard",
  role: "DIRECTEUR",
  subjects: [],
  bio: "Direction pédagogique et administrative.",
  joinedAt: "2018-09-01",
  avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Renard",
};

const profPrincipal: SessionUser = {
  id: "u-principal",
  email: "principal@sporformation.fr",
  firstName: "Mehdi",
  lastName: "Lafont",
  role: "PROF_PRINCIPAL",
  subjects: ["Sciences"],
  bio: "Professeur principal & sciences.",
  joinedAt: "2020-01-10",
  principalClassIds: ["class-3"],
  avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Lafont",
};

const professeur: SessionUser = {
  id: "u-prof",
  email: "prof@sporformation.fr",
  firstName: "Élodie",
  lastName: "Marchand",
  role: "PROFESSEUR",
  subjects: ["Sport", "Physique"],
  bio: "Enseignement sportif.",
  joinedAt: "2021-08-15",
  avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Marchand",
};

export function getPresetUser(role: SessionUser["role"]): SessionUser {
  switch (role) {
    case "DIRECTEUR":
      return director;
    case "PROF_PRINCIPAL":
      return profPrincipal;
    default:
      return professeur;
  }
}

export const allStaff: SessionUser[] = [director, profPrincipal, professeur];

export const MOCK_CLASSES: SchoolClass[] = Array.from({ length: 15 }).map(
  (_, i) => {
    const n = i + 1;
    return {
      id: `class-${n}`,
      name: `Classe ${n}`,
      principalId: n === 3 ? profPrincipal.id : undefined,
      studentIds: n <= 5 ? [`stu-${n}-a`, `stu-${n}-b`] : [`stu-${n}-a`],
    };
  },
);

export const MOCK_STUDENTS: StudentProfile[] = MOCK_CLASSES.flatMap((c, idx) =>
  c.studentIds.map((sid, j) => ({
    id: sid,
    firstName: idx % 2 === 0 ? "Lucas" : "Inès",
    lastName: j === 0 ? "Bernard" : "Petit",
    email: `${sid}@etudiant.sporformation.fr`,
    classId: c.id,
    photoUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${sid}`,
    entryDate: `202${4 + (idx % 2)}-09-${(j % 27) + 1}`,
  })),
);

export let MOCK_SANCTIONS: Sanction[] = [
  {
    id: "san-1",
    studentId: "stu-3-a",
    type: "retard",
    date: new Date().toISOString(),
    description:
      "Retard répété à la rentrée de l’après-midi sans justification envoyée avant 24h.",
    authorId: professeur.id,
    authorName: `${professeur.firstName} ${professeur.lastName}`,
    status: "active",
    attachments: [],
  },
  {
    id: "san-2",
    studentId: "stu-1-b",
    type: "comportement",
    date: new Date(Date.now() - 86400000 * 12).toISOString(),
    description: "Incident verbal en groupe en présence des élèves de 1ère année.",
    authorId: profPrincipal.id,
    authorName: `${profPrincipal.firstName} ${profPrincipal.lastName}`,
    status: "retired",
    retiredAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    retiredById: director.id,
    retiredByName: `${director.firstName} ${director.lastName}`,
    attachments: [],
  },
];

export function pushMockSanction(s: Sanction) {
  MOCK_SANCTIONS = [s, ...MOCK_SANCTIONS];
}

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-urgent",
    title: "Conseil pédagogique exceptionnel jeudi matin",
    html: "<p>Présence obligatoire dans l’auditorium à <strong>8h30</strong>.</p>",
    createdAt: new Date().toISOString(),
    importance: "urgent",
    authorId: director.id,
    audience: "CLASSROOM_TEACHERS",
    logoKey: "calendar",
    accentKey: "sky",
  },
  {
    id: "ann-1",
    title: "Ouverture billetterie Olympiades internes",
    html: "<p>Les équipes peuvent s’enregistrer jusqu’à vendredi midi.</p>",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    importance: "normal",
    authorId: director.id,
    audience: "ALL_STAFF",
    logoKey: "megaphone",
    accentKey: "emerald",
  },
];

export let MOCK_CUSTOM_ROLES: CustomSchoolRole[] = [
  {
    id: "role-va",
    nameFr: "Responsable vie associative",
    nameEn: "Student life lead",
    parentRoleId: null,
    permissions: {
      SEND_MESSAGES: true,
      VIEW_CALENDAR: true,
      UPLOAD_FILES: true,
      ADD_SANCTION: true,
      VIEW_SANCTIONS: true,
    },
  },
  {
    id: "role-st",
    nameFr: "Coach sportif",
    nameEn: "Sports coach",
    parentRoleId: "role-va",
    permissions: {
      VIEW_CALENDAR: true,
      UPLOAD_FILES: true,
      SEND_MESSAGES: true,
    },
  },
];

export function reorderCustomRoles(idsInOrder: string[]) {
  const map = new Map(MOCK_CUSTOM_ROLES.map((r) => [r.id, r]));
  MOCK_CUSTOM_ROLES = idsInOrder
    .map((id) => map.get(id))
    .filter(Boolean) as CustomSchoolRole[];
}

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-direct",
    isGroup: false,
    participantIds: [professeur.id, director.id],
    lastMessageSnippet:
      "Peux-tu valider les présences du jeudi après-midi ?",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "conv-group-coach",
    name: "Coaches & direction",
    isGroup: true,
    participantIds: [director.id, profPrincipal.id, professeur.id],
    lastMessageSnippet: "Nouvelle consigne vestiaires zone B.",
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function fileStats() {
  return {
    total: 128,
    lastUploadLabel: new Date(Date.now() - 7200000).toISOString(),
  };
}
