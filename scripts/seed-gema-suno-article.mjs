import { initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function editorialThumbDataUrl(title = "", label = "", context = "") {
  const esc = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#071f3f"/>
        <stop offset=".58" stop-color="#123866"/>
        <stop offset="1" stop-color="#e30613"/>
      </linearGradient>
      <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".96"/>
        <stop offset="1" stop-color="#eaf2fb" stop-opacity=".88"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#bg)"/>
    <path d="M0 485 C260 380 350 520 560 425 C775 326 840 180 1200 240 L1200 675 L0 675 Z" fill="#ffffff" opacity=".12"/>
    <path d="M140 128 H486 V486 H140 Z" rx="28" fill="url(#panel)"/>
    <path d="M730 128 H1070 V486 H730 Z" rx="28" fill="#081a33" opacity=".72"/>
    <path d="M285 276 h58 v-72 h46 v72 h58 v42 h-58 v72 h-46 v-72 h-58z" fill="#e30613"/>
    <path d="M805 342 C850 260 954 260 999 342" fill="none" stroke="#ffffff" stroke-width="22" stroke-linecap="round"/>
    <path d="M815 380 C885 328 930 328 990 380" fill="none" stroke="#e30613" stroke-width="18" stroke-linecap="round"/>
    <path d="M557 205 h86 v270 h-86z" fill="#ffffff" opacity=".92"/>
    <path d="M508 475 h184" stroke="#ffffff" stroke-width="20" stroke-linecap="round"/>
    <path d="M526 255 h148" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>
    <path d="M526 255 l-62 128 h124z" fill="none" stroke="#ffffff" stroke-width="14" stroke-linejoin="round"/>
    <path d="M674 255 l-62 128 h124z" fill="none" stroke="#ffffff" stroke-width="14" stroke-linejoin="round"/>
    <text x="80" y="82" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" letter-spacing="3">${esc(label)}</text>
    <text x="80" y="592" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="900">${esc(title)}</text>
    <text x="82" y="632" fill="#dce8f7" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${esc(context)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const article = {
  id: "news-gema-suno-ki-musik-urheberrecht",
  title: "GEMA gegen Suno: KI-Musik wird zum Grundsatzfall für die Kreativwirtschaft",
  headline: "GEMA gegen Suno: KI-Musik wird zum Grundsatzfall für die Kreativwirtschaft",
  subtitle: "Vor dem Landgericht München geht es um die Frage, ob KI-Musik mit geschützten Werken trainiert wurde. Der Fall könnte wichtige Standards für Vergütung, Lizenzen und kreative Rechte setzen.",
  subline: "Vor dem Landgericht München geht es um die Frage, ob KI-Musik mit geschützten Werken trainiert wurde. Der Fall könnte wichtige Standards für Vergütung, Lizenzen und kreative Rechte setzen.",
  shortText: "Der Streit zwischen GEMA und Suno könnte zum europäischen Musterfall für KI-Musik werden.",
  bodyText: [
    "Der Rechtsstreit zwischen der GEMA und dem US-Unternehmen Suno gehört zu den wichtigsten Verfahren rund um generative KI in der Musikbranche. Suno bietet ein KI-Tool an, mit dem Nutzer per Texteingabe vollständige Songs erzeugen können. Die GEMA wirft dem Unternehmen vor, geschützte Werke aus ihrem Repertoire ohne Lizenz für das Training des Systems genutzt zu haben. Außerdem sollen erzeugte KI-Songs bekannten Titeln teilweise so stark ähneln, dass Urheberrechte verletzt sein könnten.",
    "Die Klage wurde am 21. Januar 2025 beim Landgericht München eingereicht. Am 9. März 2026 wurde der Fall dort verhandelt. Nach Einschätzung der GEMA handelt es sich um das erste europäische Verfahren, das sich direkt mit der Nutzung von Audioinhalten durch KI-Unternehmen befasst. Ein Urteil steht noch aus; ein Copyright-Tracker von Taylor Wessing nennt den 12. Juni 2026 als erwarteten Entscheidungstermin.",
    "Im Kern geht es um eine zentrale Frage für die digitale Medien- und Kreativwirtschaft: Darf ein KI-System mit urheberrechtlich geschützter Musik trainiert werden, ohne dass die Komponisten, Textautoren und Musikverlage zustimmen oder vergütet werden? Die GEMA argumentiert, dass der wirtschaftliche Erfolg solcher KI-Systeme auf menschlicher Kreativität beruht und die Rechteinhaber deshalb an der Nutzung beteiligt werden müssen.",
    "Für die Medienbranche ist der Fall weit über Musik hinaus relevant. Wenn Gerichte klarstellen, dass KI-Training mit geschützten Inhalten lizenzpflichtig ist, hätte das Folgen für viele Bereiche: Musikproduktion, TV, Streaming, Werbung, Archivnutzung, Synchronisation, Voice-Cloning, Trailer-Produktion und automatisierte Content-Erstellung. Besonders betroffen wären Geschäftsmodelle, bei denen KI neue Inhalte erzeugt, die auf bestehenden Werken, Stimmen, Stilen oder Produktionen beruhen.",
    "Gleichzeitig zeigt der internationale Markt, dass sich die Branche bereits neu sortiert. In den USA haben große Musikunternehmen Verfahren gegen KI-Musikdienste wie Suno und Udio geführt oder teilweise beigelegt. Reuters berichtete Anfang Juni 2026 zudem über eine neue Klage der US-Musikergewerkschaft gegen Warner und Universal, weil deren KI-Lizenzvereinbarungen aus Sicht der Musiker nicht ausreichend kompensieren.",
    "Der Fall GEMA gegen Suno ist deshalb mehr als ein einzelner Urheberrechtsstreit. Er steht für die Frage, ob KI-Anbieter kreative Leistungen einfach als Trainingsmaterial nutzen dürfen oder ob dafür klare Lizenzmodelle entstehen müssen. Für Kreative, Rechteinhaber, Medienhäuser und Plattformbetreiber geht es um nicht weniger als die wirtschaftliche Grundlage professioneller Inhalteproduktion im KI-Zeitalter.",
    "Kurzfazit: Der Streit zwischen GEMA und Suno könnte zum europäischen Musterfall für KI-Musik werden. Entscheidend wird sein, ob Gerichte das Training und die Ausgabe KI-generierter Musik als lizenzpflichtige Nutzung geschützter Werke bewerten."
  ].join("\n\n"),
  page: "news",
  section: "news",
  category: "KI / Musikrechte / Medienrecht / Digitale Medien",
  tags: ["GEMA", "Suno", "KI-Musik", "Urheberrecht", "generative KI", "Musikrechte", "Lizenzierung", "Medienrecht", "Kreativwirtschaft", "AI Act"],
  imageUrl: editorialThumbDataUrl("GEMA vs. Suno", "KI-Musik", "Urheberrecht und faire Vergütung"),
  thumbnail_url: editorialThumbDataUrl("GEMA vs. Suno", "KI-Musik", "Urheberrecht und faire Vergütung"),
  thumbnail_alt: "Redaktionelles Thumb zu GEMA gegen Suno mit Studio, KI-Musik und Rechtssymbol.",
  source_snapshot_json: [
    { title: "GEMA klagt gegen Suno: Landgericht München verhandelt erstes Verfahren im Bereich Audio-KI", publisher: "GEMA", url: "https://www.gema.de/de/w/gema-klagt-gegen-suno-2026", source_type: "Verwertungsgesellschaft" },
    { title: "Suno AI und Open AI: GEMA klagt für faire Vergütung", publisher: "GEMA", url: "https://www.gema.de/de/aktuelles/ki-und-musik/ki-klage", source_type: "Verwertungsgesellschaft" },
    { title: "Musicians union sues record labels over AI licensing", publisher: "Reuters", url: "https://www.reuters.com/legal/litigation/musicians-union-sues-record-labels-over-ai-licensing-2026-06-05/", source_type: "Nachrichtenagentur" }
  ],
  publishDate: "2026-06-07",
  validFrom: "2026-06-07",
  status: "published",
  visibility: "public",
  visible: true,
  editorialManaged: true,
  createdAt: "2026-06-07T10:00:00.000Z"
};

initializeApp({
  credential: applicationDefault(),
  projectId: "prodigitaltv-da47b"
});

const db = getFirestore();
await db.collection("editorialContent").doc(article.id).set({ ...article, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
console.log(`Saved editorialContent/${article.id}`);
