import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const BRAND_RED = "#E63946";
const BRAND_ORANGE = "#F4A261";
const INK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const SOFT_BG = "#F8FAFC";
const ACCENT_BG = "#FFF1F2";

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 60,
    paddingHorizontal: 0,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: INK,
    lineHeight: 1.4,
  },
  headerBand: {
    backgroundColor: INK,
    paddingTop: 26,
    paddingBottom: 22,
    paddingHorizontal: 42,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandWordmark: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 1.4,
  },
  brandKicker: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: BRAND_ORANGE,
    letterSpacing: 2,
    marginTop: 2,
  },
  refBadge: {
    borderWidth: 1,
    borderColor: BRAND_ORANGE,
    borderStyle: "solid",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  refBadgeLabel: {
    color: BRAND_ORANGE,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.6,
  },
  refBadgeValue: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
  },
  accentStripe: {
    height: 6,
    backgroundColor: BRAND_RED,
  },
  body: {
    paddingHorizontal: 42,
    paddingTop: 28,
  },
  titleBlock: {
    marginBottom: 22,
  },
  titleKicker: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BRAND_RED,
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 10,
    color: MUTED,
    maxWidth: 460,
  },
  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "solid",
    borderRadius: 6,
    padding: 16,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  cardSoft: {
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "solid",
    borderRadius: 6,
    padding: 16,
    marginBottom: 14,
    backgroundColor: SOFT_BG,
  },
  fieldGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  fieldCell: {
    width: "50%",
    paddingRight: 12,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: INK,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  typePill: {
    backgroundColor: ACCENT_BG,
    borderLeftWidth: 4,
    borderLeftColor: BRAND_RED,
    borderLeftStyle: "solid",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    flexGrow: 1,
  },
  typePillKicker: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND_RED,
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  typePillValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: INK,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 6,
  },
  sectionBullet: {
    width: 4,
    height: 14,
    backgroundColor: BRAND_RED,
    marginRight: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: INK,
    letterSpacing: 0.4,
  },
  description: {
    fontSize: 11,
    color: INK,
    lineHeight: 1.55,
  },
  signatureGrid: {
    flexDirection: "row",
    marginTop: 18,
  },
  signatureCell: {
    flex: 1,
    marginRight: 12,
  },
  signatureCellLast: {
    flex: 1,
  },
  signatureLine: {
    height: 1,
    backgroundColor: INK,
    marginTop: 32,
    marginBottom: 6,
  },
  signatureLabel: {
    fontSize: 8.5,
    color: MUTED,
  },
  signatureName: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginTop: 1,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 42,
    right: 42,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: "solid",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: MUTED,
  },
  pageNumber: {
    fontSize: 8,
    color: MUTED,
  },
});

type Locale = "fr" | "en";

type Props = {
  locale: Locale;
  schoolName: string;
  studentFirst: string;
  studentLast: string;
  classNameLabel: string;
  sanctionTypeLabel: string;
  dateLabel: string;
  description: string;
  authorName: string;
};

const copy: Record<
  Locale,
  {
    kicker: string;
    title: string;
    subtitle: string;
    student: string;
    clazz: string;
    type: string;
    date: string;
    detail: string;
    signatureAuthor: string;
    signatureDirection: string;
    signatureLabel: string;
    refLabel: string;
    footerLeft: string;
    footerRight: (n: number, t: number) => string;
  }
> = {
  fr: {
    kicker: "Acte disciplinaire",
    title: "Avis disciplinaire officiel",
    subtitle:
      "Document généré automatiquement par la plateforme interne SPORFORMATION. Conservation obligatoire au dossier de l’étudiant.",
    student: "Étudiant·e",
    clazz: "Classe",
    type: "Motif de la sanction",
    date: "Horodatage",
    detail: "Synthèse factuelle",
    signatureAuthor: "Signature — référent pédagogique",
    signatureDirection: "Visa direction",
    signatureLabel: "Signature manuscrite",
    refLabel: "Émis le",
    footerLeft:
      "SPORFORMATION — Document interne · Reproduction restreinte à la procédure administrative.",
    footerRight: (n, t) => `Page ${n} / ${t}`,
  },
  en: {
    kicker: "Disciplinary record",
    title: "Official disciplinary notice",
    subtitle:
      "Automatically generated by the SPORFORMATION internal platform. Must be filed in the learner's record.",
    student: "Learner",
    clazz: "Class",
    type: "Sanction category",
    date: "Timestamp",
    detail: "Structured summary",
    signatureAuthor: "Signature — responsible staff",
    signatureDirection: "Leadership endorsement",
    signatureLabel: "Handwritten signature",
    refLabel: "Issued on",
    footerLeft:
      "SPORFORMATION — Internal document · Reproduction restricted to compliance workflow.",
    footerRight: (n, t) => `Page ${n} / ${t}`,
  },
};

function emittedToday(locale: Locale): string {
  return new Date().toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function SanctionOfficialPdf(props: Props) {
  const L = copy[props.locale];
  const fullName = `${props.studentFirst} ${props.studentLast}`.trim() || "—";

  return (
    <Document title={`${L.title} — ${fullName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand} fixed>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.brandWordmark}>{props.schoolName}</Text>
              <Text style={styles.brandKicker}>{L.kicker.toUpperCase()}</Text>
            </View>
            <View style={styles.refBadge}>
              <Text style={styles.refBadgeLabel}>{L.refLabel.toUpperCase()}</Text>
              <Text style={styles.refBadgeValue}>{emittedToday(props.locale)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.accentStripe} fixed />

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <Text style={styles.titleKicker}>{L.kicker.toUpperCase()}</Text>
            <Text style={styles.title}>{L.title}</Text>
            <Text style={styles.subtitle}>{L.subtitle}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldGrid}>
              <View style={styles.fieldCell}>
                <Text style={styles.fieldLabel}>{L.student.toUpperCase()}</Text>
                <Text style={styles.fieldValue}>{fullName}</Text>
              </View>
              <View style={styles.fieldCell}>
                <Text style={styles.fieldLabel}>{L.clazz.toUpperCase()}</Text>
                <Text style={styles.fieldValue}>{props.classNameLabel}</Text>
              </View>
              <View style={styles.fieldCell}>
                <Text style={styles.fieldLabel}>{L.date.toUpperCase()}</Text>
                <Text style={styles.fieldValue}>{props.dateLabel}</Text>
              </View>
              <View style={styles.fieldCell}>
                <Text style={styles.fieldLabel}>
                  {L.signatureAuthor.toUpperCase()}
                </Text>
                <Text style={styles.fieldValue}>{props.authorName || "—"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.typeRow}>
            <View style={styles.typePill}>
              <Text style={styles.typePillKicker}>{L.type.toUpperCase()}</Text>
              <Text style={styles.typePillValue}>{props.sanctionTypeLabel}</Text>
            </View>
          </View>

          <View style={styles.cardSoft}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBullet} />
              <Text style={styles.sectionLabel}>{L.detail}</Text>
            </View>
            <Text style={styles.description}>{props.description}</Text>
          </View>

          <View style={styles.signatureGrid}>
            <View style={styles.signatureCell}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>{L.signatureAuthor}</Text>
              <Text style={styles.signatureName}>{props.authorName || "—"}</Text>
            </View>
            <View style={styles.signatureCellLast}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>{L.signatureDirection}</Text>
              <Text style={styles.signatureName}>{props.schoolName}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{L.footerLeft}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              L.footerRight(pageNumber, totalPages)
            }
          />
        </View>
      </Page>
    </Document>
  );
}
