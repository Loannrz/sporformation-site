import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 42,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#0A0A0A",
    lineHeight: 1.35,
  },
  brand: {
    fontSize: 20,
    fontWeight: 700,
    color: "#E63946",
    marginBottom: 4,
  },
  tag: {
    fontSize: 12,
    fontWeight: 600,
    marginTop: 12,
    marginBottom: 4,
    color: "#F4A261",
  },
  muted: { color: "#525252", marginBottom: 2 },
  seal: {
    marginTop: 32,
    padding: 14,
    borderWidth: 2,
    borderColor: "#E63946",
    borderStyle: "solid",
    alignItems: "center",
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
    title: string;
    student: string;
    clazz: string;
    type: string;
    date: string;
    detail: string;
    author: string;
    seal: string;
  }
> = {
  fr: {
    title: "Avis disciplinaire officiel",
    student: "Étudiant · étudiante",
    clazz: "Classe",
    type: "Motif",
    date: "Horodatage",
    detail: "Synthèse factuelle",
    author: "Référent pédagogique",
    seal: "Cachet officiel SPORFORMATION — reproduction interdite hors procédure administrative",
  },
  en: {
    title: "Official disciplinary notice",
    student: "Learner",
    clazz: "Class",
    type: "Category",
    date: "Timestamp",
    detail: "Structured summary",
    author: "Responsible staff member",
    seal: "Official SPORFORMATION seal — copying prohibited outside compliance workflow",
  },
};

export function SanctionOfficialPdf(props: Props) {
  const L = copy[props.locale];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>{props.schoolName}</Text>
        <Text style={{ fontSize: 14, marginBottom: 16, fontWeight: 600 }}>
          {L.title}
        </Text>
        <Field label={`${L.student}`} value={`${props.studentFirst} ${props.studentLast}`} />
        <Field label={`${L.clazz}`} value={props.classNameLabel} />
        <Field label={`${L.type}`} value={props.sanctionTypeLabel} />
        <Field label={`${L.date}`} value={props.dateLabel} />
        <Text style={styles.tag}>{L.detail}</Text>
        <Text style={{ marginBottom: 8 }}>{props.description}</Text>
        <Field label={L.author} value={props.authorName} />
        <View style={styles.seal}>
          <Text style={{ fontSize: 10, textAlign: "center" }}>
            {L.seal}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ ...styles.muted }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: 600 }}>{value}</Text>
    </View>
  );
}
