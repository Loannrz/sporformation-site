-- Champs étendus pour la fiche élève (alignés avec l'import Excel "Liste promo").
-- Toutes les colonnes sont optionnelles ; seul nom + prénom restent obligatoires côté schéma.

alter table public.students
  add column if not exists njs text,
  add column if not exists promo text,
  add column if not exists of_name text,
  add column if not exists formation_number text,
  add column if not exists diploma text,
  add column if not exists tep text,
  add column if not exists birth_country text,
  add column if not exists birth_department text,
  add column if not exists phone text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text,
  add column if not exists address_city text,
  add column if not exists address_country text,
  add column if not exists employment_status text,
  add column if not exists parcoursup text,
  add column if not exists validation_status text,
  add column if not exists uc1_status text,
  add column if not exists uc2_status text,
  add column if not exists uc3_status text,
  add column if not exists uc4_status text;

comment on column public.students.njs is 'Numéro NJS (identifiant national, ex. NJS00506953F)';
comment on column public.students.promo is 'Code promotion (ex. CBV)';
comment on column public.students.of_name is 'Nom de l’organisme de formation';
comment on column public.students.formation_number is 'Numéro de la formation';
comment on column public.students.diploma is 'Intitulé du diplôme préparé';
comment on column public.students.tep is 'Statut TEP (texte libre, ex. Validé)';
comment on column public.students.employment_status is 'Statut d’emploi (texte libre : Salarié, Apprenti, etc.)';
comment on column public.students.parcoursup is 'Entrée Parcoursup (texte libre : Oui / Non)';
comment on column public.students.validation_status is 'État de validation (texte libre : Proposé, etc.)';
comment on column public.students.uc1_status is 'BC1/UC1 (texte libre, ex. Dispensé / Non Dispensé)';
comment on column public.students.uc2_status is 'BC2/UC2 (texte libre)';
comment on column public.students.uc3_status is 'BC3/UC3 (texte libre)';
comment on column public.students.uc4_status is 'BC4/UC4 (texte libre)';
