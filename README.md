# SPORFORMATION — plateforme interne

Intranet moderne pour une école supérieure en alternance : direction, professeurs principaux et équipe pédagogique. Design system rouge / orange / noir, thème clair & sombre (`next-themes`), animations discrètes (Framer Motion, utilitaires Tailwind), **i18n complet** `fr` ↔ `en` via `next-intl` (`locales/fr.json`, `locales/en.json`).

> **État actuel** : l’UI, la navigation, les règles métier côté React et les données de **démonstration** sont en place. Les appels **Supabase**, la **messagerie temps réel**, le **stockage cloud** et les **emails Resend** sont câblés en points d’extension (helpers, variables d’environnement, schéma SQL) — branchez votre projet pour activer le mode production décrit ci-dessous.

## Prérequis

- Node.js 20+
- Un compte [Supabase](https://supabase.com) et un projet Postgres
- (Optionnel) [Resend](https://resend.com) pour les emails transactionnels
- (Optionnel) Compte Vercel pour le déploiement

## Installation locale

```bash
cd sporformation
cp .env.example .env.local
# Renseigner NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, etc.

npm install
npm run dev
```

Ouvrez `http://localhost:3000` — vous serez redirigé vers **`/fr/login`** (routing localisé `always`, donc préfixe de langue).

## Connexion développement (à retirer en prod)

La page **Connexion** propose trois boutons (Directeur, Professeur principal, Professeur) qui appellent une **server action** et posent un cookie HTTP-only **`spo-session`** encodé en base64.  
**Ce mécanisme est volontairement simple** pour valider UX et permissions sans configurer tout de suite Supabase Auth — remplacez-le par OTP / invitations / magic link lorsque `auth.users` sera la source de vérité.

## Variables d’environnement

Voir `.env.example` :

| Variable | Usage |
|---------|--------|
| `NEXT_PUBLIC_SUPABASE_*` | Client navigateur (`lib/supabase/client.ts`) et serveur SSR (`lib/supabase/server.ts`) |
| `RESEND_API_KEY` | Envoi mails (sanctions PDF, invitations, digest) via `lib/email/sanction.ts` |
| `EMAIL_FROM`, `DIRECTOR_EMAIL` | Expéditeur et boîte de réception officielle |

## Base de données & RLS

Le fichier **`supabase/schema.sql`** propose les tables principales (`profiles`, `classes`, `students`, `sanctions`, `files`, `messages`, `announcements`, `calendar_events`, `custom_roles`…) ainsi qu’un exemple minimal de policies RLS. Adaptez les policies aux rôles métier décrits dans `types/index.ts` et `lib/permissions.ts`.

Buckets Storage recommandés : bucket `documents` avec limite ~50 Mo et filtrage MIME côté application (PDF, Office, images).

## Fonctionnalités livrées (maquette fonctionnelle)

- **Dashboard** différencié (directeur / prof principal / professeur).
- **Annonces** (fil + badges d’urgence).
- **Cloud** explorateur avec onglets (classe · matière · intervenant · dossiers libres) et pages dossier type.
- **Messagerie** liste + détail stylé Slack-like (historique fictif jusqu’à branchement DB / Realtime).
- **Classes** liste + détail (élèves, sanctions de classe).
- **Profil étudiant** : informations, liste des sanctions, formulaire « nouvelle sanction » (server action + **PDF `@react-pdf/renderer`** + email Resend si clé configurée), retrait sanction selon règles, téléchargement PDF pour direction / PP.
- **Calendrier** : squelette vues jour/semaine/mois + événements démo.
- **Administration** (direction uniquement `notFound()` pour les autres) : hub, **rôles + organigramme drag-and-drop** (`@dnd-kit`), comptes, classes.
- **Profil intervenant**, **Paramètres** avec cartes de thème.
- **API** `/api/pdf/sanction` — génération PDF (Node runtime).

Les textes utilisateur sont traduits dans **`locales/*.json`** ; les PDF officiels utilisent un composant **`lib/pdf/sanction-official.tsx`** avec texte FR/EN selon le paramètre `locale`.

## Déploiement Vercel

1. Pousser le dépôt sur GitHub/GitLab.
2. Importer dans Vercel, renseigner les variables d’environnement production.
3. Vérifier la région Postgres Supabase pour la latence Europe.
4. Activer HTTPS par défaut (Vercel) et ajuster `middleware` pour domaines finaux si besoin.

## Structure utile du dépôt

```
app/[locale]/          Routes localisées (auth + dashboard segmentés)
components/ui/         primitives type shadcn
components/layout/     Shell, sidebar, header
components/cloud/      Explorateur
components/sanctions/  Formulaire sanction client
components/admin/      Organigramme DnD
i18n/                  routing + navigation next-intl
lib/permissions.ts   Matrice de la spec
locales/fr.json …     Traductions
supabase/schema.sql    DDL exemple
types/index.ts        Modèles TypeScript
```

## Prochaines étapes techniques recommandées

1. Implémenter **Supabase Auth** (invitations, reset mot de passe) et synchroniser **`profiles`** après `auth.users`.
2. Remplacer les mocks (`lib/mock-data.ts`) par requêtes serveur ou React Query selon vos préférences.
3. Activer **Realtime** pour messagerie & présence « en ligne ».
4. Durcir le **middleware** (JWT Supabase ou session serveur signée au lieu du cookie démo).

---

Plateforme **SPORFORMATION** — préparée pour équipe réduite mais ambitieuse sur l’expérience SaaS quotidienne.
