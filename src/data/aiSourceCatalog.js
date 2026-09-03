const now = "2026-06-02T00:00:00";

function utf8Text(value = "") {
  return String(value || "")
    .replace(/\bfuer\b/g, "für")
    .replace(/\bFuer\b/g, "Für")
    .replace(/\bOeffentlich/g, "Öffentlich")
    .replace(/\boeffentlich/g, "öffentlich")
    .replace(/\bPrimaer/g, "Primär")
    .replace(/\bprimaer/g, "primär")
    .replace(/\bBehoerde/g, "Behörde")
    .replace(/\bFoerder/g, "Förder")
    .replace(/\bfoerder/g, "förder")
    .replace(/\bGeraete/g, "Geräte")
    .replace(/\bGeraet/g, "Gerät")
    .replace(/\bInteroperabilitaet/g, "Interoperabilität")
    .replace(/\bAktivitaeten/g, "Aktivitäten");
}

function source(id, name, domain, url, sourceType, trustScore, categories, notes = "") {
  return {
    id: `ai-source-${id}`,
    name: utf8Text(name),
    domain,
    url,
    source_type: utf8Text(sourceType),
    source_status: trustScore >= 90 ? "bevorzugt" : "erlaubt",
    category: utf8Text(categories[0] || "Medienbranche"),
    trust_score: trustScore,
    language: "de/en",
    country: "international",
    notes: utf8Text(notes),
    priority: trustScore >= 90 ? 1 : 2,
    default_for_categories: categories.map(utf8Text),
    created_at: now,
    updated_at: now,
    checked_at: now,
    checked_by: "System"
  };
}

function sourceDe(id, name, domain, url, sourceType, trustScore, categories, notes = "") {
  return {
    ...source(id, name, domain, url, sourceType, trustScore, categories, notes),
    language: "de",
    country: "Deutschland"
  };
}

export const aiSourceCatalog = [
  source("runway", "Runway Research & Blog", "runwayml.com", "https://runwayml.com/research", "KI-Tool / Kreativworkflow", 78, ["KI & kreative Medienarbeit", "Tools & Workflows", "Produktion / Postproduktion", "Medieninnovation & Formate"], "Praxisnahe Quelle fuer GenAI-Video, kreative KI-Workflows und neue Produktionsweisen."),
  source("adobe-firefly", "Adobe Firefly & Creative Cloud News", "adobe.com", "https://blog.adobe.com", "Tool- und Herstellerquelle", 76, ["KI & kreative Medienarbeit", "Tools & Workflows", "Produktion / Postproduktion", "Recht, Deepfakes & Content Authenticity"], "Herstellerquelle zu KI-Funktionen, Content Credentials und Kreativ-Workflows; immer mit unabhaengiger Einordnung kombinieren."),
  source("blackmagic-design", "Blackmagic Design News", "blackmagicdesign.com", "https://www.blackmagicdesign.com/media", "Tool- und Herstellerquelle", 74, ["Tools & Workflows", "Produktion / Postproduktion", "Medieninnovation & Formate"], "Quelle fuer DaVinci Resolve, Kamera-, Schnitt- und Postproduktions-Workflows."),
  source("youtube-creators", "YouTube Creators", "youtube.com", "https://www.youtube.com/creators", "Plattform / Creator-Quelle", 76, ["Creator Economy", "Social Video & Plattformen", "Jobs, Skills & Karriere"], "Plattformquelle fuer Creator-Programme, Formatentwicklung, Monetarisierung und neue YouTube-Funktionen."),
  source("tiktok-newsroom", "TikTok Newsroom", "newsroom.tiktok.com", "https://newsroom.tiktok.com", "Plattform / Creator-Quelle", 72, ["Social Video & Plattformen", "Creator Economy", "Medieninnovation & Formate"], "Plattformquelle fuer Social-Video-Trends und Creator-Funktionen; redaktionell gegenpruefen."),
  source("instagram-creators", "Instagram Creators", "creators.instagram.com", "https://creators.instagram.com", "Plattform / Creator-Quelle", 72, ["Social Video & Plattformen", "Creator Economy", "Tools & Workflows"], "Quelle zu Creator-Workflows, Reels, Plattformlogik und Community-Aufbau."),
  source("twitch-blog", "Twitch Blog", "blog.twitch.tv", "https://blog.twitch.tv", "Plattform / Creator-Quelle", 70, ["Creator Economy", "Social Video & Plattformen", "Medieninnovation & Formate"], "Quelle fuer Live-Streaming, Community-Formate und Monetarisierungsmodelle."),
  source("tubefilter", "Tubefilter", "tubefilter.com", "https://www.tubefilter.com", "Creator Economy Fachmedium", 76, ["Creator Economy", "Social Video & Plattformen", "Jobs, Skills & Karriere"], "Fachmedium fuer Creator Economy, Plattformen, Formate und junge Medienunternehmen."),
  source("the-verge-creators", "The Verge Creators & AI", "theverge.com", "https://www.theverge.com/creators", "Internationales Fachmedium", 90, ["KI & kreative Medienarbeit", "Creator Economy", "Social Video & Plattformen", "Tools & Workflows", "Recht, Deepfakes & Content Authenticity"], "Bevorzugte redaktionelle Quelle fuer Plattformen, Creator Economy, KI-Video, Authentizitaet und Publikumsreaktionen."),
  source("reuters-media-tech", "Reuters Media & Telecom", "reuters.com", "https://www.reuters.com/business/media-telecom/", "Nachrichtenagentur", 94, ["Creator Economy", "Social Video & Plattformen", "Streaming & Distribution", "Medieninnovation & Formate", "KI & kreative Medienarbeit"], "Bevorzugte belastbare Quelle fuer internationale Medienwirtschaft, YouTube/Hollywood, Streaming, Microdramas und Plattformverschiebungen."),
  source("reuters-technology", "Reuters Technology", "reuters.com", "https://www.reuters.com/technology/", "Nachrichtenagentur", 92, ["KI & kreative Medienarbeit", "Tools & Workflows", "Social Video & Plattformen", "Recht, Deepfakes & Content Authenticity"], "Bevorzugte belastbare Quelle fuer KI, Plattformen, Technologie und Marktreaktionen."),
  source("business-insider-creators", "Business Insider Creator Economy", "businessinsider.com", "https://www.businessinsider.com/creator-economy", "Wirtschaftsmedium", 78, ["Creator Economy", "Förderung & Gründung", "Jobs, Skills & Karriere"], "Ergaenzende Quelle fuer Creator-Finanzierung, Investments, Monetarisierung und neue Erlösmodelle."),
  source("axios-media-trends", "Axios Media Trends", "axios.com", "https://www.axios.com/media-trends", "Wirtschafts- und Medienmedium", 78, ["Social Video & Plattformen", "Creator Economy", "Streaming & Distribution", "Medieninnovation & Formate"], "Ergaenzende Quelle fuer US-Medienstrategien, Live-/Videoausbau und Plattformtrends."),
  source("trippy-pictures-ai-video", "Trippy Pictures AI Video Blog", "trippy.pictures", "https://trippy.pictures/blog", "Studio-/Praxisblog", 70, ["KI & kreative Medienarbeit", "Tools & Workflows", "Produktion / Postproduktion", "Medieninnovation & Formate"], "Ergaenzende Praxisquelle fuer AI-native Video-Produktion in Europa; nicht alleinige Belegquelle fuer fertige Artikel."),
  source("studiolist-ai-video", "StudioList AI Video Studios", "studiolist.co", "https://studiolist.co/best-ai-video-studios/", "Studio-Uebersicht", 70, ["KI & kreative Medienarbeit", "Produktion / Postproduktion", "Medieninnovation & Formate"], "Ergaenzende Marktuebersicht zu AI-Video-Studios und Produktionsmodellen; als Recherchesignal, nicht als alleinige Hauptquelle."),
  source("kinovela-ai-workflow", "Kinovela AI Video Workflow", "kinovela.com", "https://kinovela.com/insights/producer-led-ai-video-workflow", "Studio-/Workflowquelle", 70, ["KI & kreative Medienarbeit", "Tools & Workflows", "Produktion / Postproduktion", "Jobs, Skills & Karriere"], "Ergaenzende Praxisquelle zu producer-geführten AI-Video-Workflows; mit belastbarer Zweitquelle kombinieren."),
  source("graphrs-genai-video-producer", "Graphrs GenAI Video Producer", "graphrs.com", "https://www.graphrs.com/careers/genai-video-producer", "Jobprofil / Berufssignal", 70, ["Jobs, Skills & Karriere", "KI & kreative Medienarbeit", "Tools & Workflows"], "Signalquelle fuer neue Berufsbilder wie GenAI Video Producer; Jobprofile nur als Indikator fuer Skills nutzen."),
  source("nvidia-studio", "NVIDIA Studio", "nvidia.com", "https://www.nvidia.com/studio/", "Herstellerquelle / Hardware", 72, ["Tools & Workflows", "KI & kreative Medienarbeit", "Produktion / Postproduktion"], "Herstellerquelle fuer KI-gestuetzte Kreativ-Hardware und Workflows; redaktionell gegenpruefen."),
  source("asus-proart", "ASUS ProArt", "asus.com", "https://www.asus.com/proart/", "Herstellerquelle / Hardware", 70, ["Tools & Workflows", "Produktion / Postproduktion", "KI & kreative Medienarbeit"], "Ergaenzende Herstellerquelle fuer Produktionshardware und Kreativ-Workflows; nicht alleinige Belegquelle."),
  source("rest-of-world", "Rest of World", "restofworld.org", "https://restofworld.org", "Internationales Fachmedium", 78, ["Creator Economy", "Social Video & Plattformen", "Medieninnovation & Formate"], "Internationale Perspektive auf Plattformarbeit, Creator Economy und digitale Medienkulturen."),
  source("nieman-lab", "Nieman Lab", "niemanlab.org", "https://www.niemanlab.org", "Journalismus-Innovation", 82, ["KI & kreative Medienarbeit", "Medieninnovation & Formate", "Jobs, Skills & Karriere"], "Quelle fuer Journalismusinnovation, Newsroom-Workflows und KI im redaktionellen Alltag."),
  sourceDe("journalist", "journalist", "journalist.de", "https://www.journalist.de", "Fachmedium / Karriere", 74, ["Jobs, Skills & Karriere", "KI & kreative Medienarbeit", "Medieninnovation & Formate"], "Deutschsprachige Quelle fuer journalistische Praxis, Berufsbild, Tools und Nachwuchsthemen."),
  sourceDe("medieninsider", "Medieninsider", "medieninsider.com", "https://medieninsider.com", "Fachmedium", 72, ["Jobs, Skills & Karriere", "Medieninnovation & Formate", "KI & kreative Medienarbeit"], "Quelle fuer Medienjobs, Strategien und Veraenderungen in Redaktionen und Medienhaeusern."),
  sourceDe("dasauge", "dasauge Jobs", "dasauge.de", "https://dasauge.de/jobs/", "Job- und Kreativportal", 70, ["Jobs, Skills & Karriere", "Tools & Workflows", "Creator Economy"], "Signalquelle fuer nachgefragte Rollen, Skills und Kreativjobs."),
  sourceDe("crew-united", "Crew United", "crew-united.com", "https://www.crew-united.com", "Branchen- und Jobplattform", 74, ["Jobs, Skills & Karriere", "Produktion / Postproduktion", "Ausbildung, Labs & Wettbewerbe"], "Quelle fuer Film-, TV- und Produktionsjobs, Nachwuchsprofile und Branchenpraxis."),
  sourceDe("medienboard-talent", "Medienboard Talent & Foerderung", "medienboard.de", "https://www.medienboard.de", "Foerderinstitution", 78, ["Förderung & Gründung", "Ausbildung, Labs & Wettbewerbe", "Produktion / Postproduktion"], "Foerder-, Talent- und Lab-Signale fuer audiovisuelle Kreative."),
  sourceDe("mfg", "MFG Baden-Württemberg", "mfg.de", "https://www.mfg.de", "Foerder- und Kreativwirtschaft", 76, ["Förderung & Gründung", "Ausbildung, Labs & Wettbewerbe", "Medieninnovation & Formate"], "Quelle fuer Kreativwirtschaft, Innovation, Games, Medien und Nachwuchsfoerderung."),
  sourceDe("nextmedia-hamburg", "nextMedia.Hamburg", "nextmedia-hamburg.de", "https://www.nextmedia-hamburg.de", "Medieninnovation / Netzwerk", 78, ["Medieninnovation & Formate", "Ausbildung, Labs & Wettbewerbe", "Förderung & Gründung", "KI & kreative Medienarbeit"], "Hamburger Quelle fuer Medieninnovation, Labs, Events, Startups und Nachwuchsformate."),
  sourceDe("media-lab-bayern", "Media Lab Bayern", "media-lab.de", "https://www.media-lab.de", "Media Lab / Foerderung", 78, ["Förderung & Gründung", "Ausbildung, Labs & Wettbewerbe", "Medieninnovation & Formate", "KI & kreative Medienarbeit"], "Quelle fuer Medienstartups, Innovation, Stipendien, Labs und junge Mediengruender."),
  sourceDe("grimme-institut", "Grimme-Institut", "grimme-institut.de", "https://www.grimme-institut.de", "Preis / Medienkompetenz", 74, ["Ausbildung, Labs & Wettbewerbe", "Medieninnovation & Formate", "Social Video & Plattformen"], "Quelle fuer digitale Formate, Wettbewerbe, Medienqualitaet und Nachwuchsimpulse."),
  sourceDe("filmuniversitaet", "Filmuniversität Babelsberg KONRAD WOLF", "filmuniversitaet.de", "https://www.filmuniversitaet.de", "Hochschule", 72, ["Ausbildung, Labs & Wettbewerbe", "Produktion / Postproduktion", "KI & kreative Medienarbeit"], "Signalquelle fuer Forschung, Ausbildung und Nachwuchsprojekte in Film und Medien."),
  sourceDe("hamburg-media-school", "Hamburg Media School", "hamburgmediaschool.com", "https://www.hamburgmediaschool.com", "Hochschule", 72, ["Ausbildung, Labs & Wettbewerbe", "Jobs, Skills & Karriere", "Medieninnovation & Formate"], "Quelle fuer Ausbildung, Nachwuchs, Medienmanagement und innovative Formate."),
  source("eu-commission-digital", "EU-Kommission Digital Strategy", "commission.europa.eu", "https://commission.europa.eu/strategy-and-policy/priorities-2019-2024/europe-fit-digital-age_en", "Behoerde", 95, ["Plattformregulierung", "Medienrecht / Verwertungsrecht", "KI in Redaktion und Produktion", "Barrierefreiheit"], "EU-Primaerquelle zu Digitalpolitik und Regulierung."),
  source("eur-lex", "EUR-Lex", "eur-lex.europa.eu", "https://eur-lex.europa.eu", "Rechtsquelle", 98, ["Medienrecht / Verwertungsrecht", "Plattformregulierung", "Barrierefreiheit", "Werbung / Vermarktung"], "Amtliche EU-Rechtsakte und Gesetzesstaende."),
  source("bundesregierung-kultur", "Beauftragte der Bundesregierung fuer Kultur und Medien", "kulturstaatsminister.de", "https://www.kulturstaatsminister.de", "Behoerde", 92, ["Medienrecht / Verwertungsrecht", "Lokale und regionale Medien", "Produktion / Postproduktion"], "Bundespolitische Quelle fuer Medien- und Kulturpolitik."),
  source("bmj", "Bundesministerium der Justiz", "bmj.de", "https://www.bmj.de", "Behoerde", 92, ["Medienrecht / Verwertungsrecht", "KI in der Synchronbranche", "Werbung / Vermarktung"], "Quelle fuer Gesetzgebung und rechtliche Einordnung."),
  source("die-medienanstalten", "Die Medienanstalten", "die-medienanstalten.de", "https://www.die-medienanstalten.de", "Regulierung", 91, ["Plattformregulierung", "Werbung / Vermarktung", "Lokale und regionale Medien", "Smart-TV / HbbTV"], "Zentrale Quelle der Landesmedienanstalten."),
  source("bnetza", "Bundesnetzagentur", "bundesnetzagentur.de", "https://www.bundesnetzagentur.de", "Behoerde", 90, ["OTT / Distribution", "Technik", "Plattformregulierung"], "Infrastruktur, Netz- und Plattformthemen."),
  source("w3c", "W3C", "w3.org", "https://www.w3.org", "Technischer Standard", 96, ["Streaming-Technologie", "Barrierefreiheit", "Technik", "Smart-TV / HbbTV"], "Web-, Accessibility- und Medienstandards."),
  source("hbbtv", "HbbTV Association", "hbbtv.org", "https://www.hbbtv.org", "Technischer Standard", 94, ["Smart-TV / HbbTV", "Streaming-Technologie", "Technik"], "Primaerquelle fuer HbbTV-Standards."),
  source("dvb", "DVB Project", "dvb.org", "https://dvb.org", "Technischer Standard", 93, ["Technik", "OTT / Distribution", "Streaming-Technologie", "FAST-Channels"], "Standards fuer digitale TV-Distribution."),
  source("dash-if", "DASH Industry Forum", "dashif.org", "https://dashif.org", "Technischer Standard", 91, ["Streaming-Technologie", "OTT / Distribution", "FAST-Channels"], "Quelle zu MPEG-DASH und Streaming-Interoperabilitaet."),
  source("ietf", "IETF", "ietf.org", "https://www.ietf.org", "Technischer Standard", 92, ["Technik", "Streaming-Technologie", "OTT / Distribution"], "Internetprotokolle und technische RFCs."),
  source("etsi", "ETSI", "etsi.org", "https://www.etsi.org", "Technischer Standard", 90, ["Technik", "Smart-TV / HbbTV", "OTT / Distribution"], "Europaeische technische Standards."),
  source("ebu", "European Broadcasting Union", "ebu.ch", "https://www.ebu.ch", "Branchenverband", 88, ["Produktion / Postproduktion", "Technik", "Streaming-Technologie", "Lokale und regionale Medien"], "Fachquelle fuer Broadcasting, Produktion und Distribution."),
  source("smpte", "SMPTE", "smpte.org", "https://www.smpte.org", "Technischer Standard", 88, ["Produktion / Postproduktion", "Technik", "Streaming-Technologie"], "Standards fuer Medienproduktion und Broadcast-Technik."),
  source("fraunhofer-fokus", "Fraunhofer FOKUS", "fokus.fraunhofer.de", "https://www.fokus.fraunhofer.de", "Forschungsinstitut", 86, ["Streaming-Technologie", "Smart-TV / HbbTV", "KI in Redaktion und Produktion", "Technik"], "Forschung zu Medien, Plattformen und digitalen Technologien."),
  source("fraunhofer-iis", "Fraunhofer IIS", "iis.fraunhofer.de", "https://www.iis.fraunhofer.de", "Forschungsinstitut", 86, ["Produktion / Postproduktion", "Barrierefreiheit", "KI in der Synchronbranche", "Technik"], "Audio-, Medien- und Produktionstechnologien."),
  source("bitkom", "Bitkom", "bitkom.org", "https://www.bitkom.org", "Branchenverband", 82, ["KI in Redaktion und Produktion", "Technik", "Plattformregulierung", "Werbung / Vermarktung"], "Fachquelle fuer Digitalwirtschaft und KI-Trends."),
  source("vaunet", "VAUNET", "vau.net", "https://www.vau.net", "Branchenverband", 84, ["Lokale und regionale Medien", "Werbung / Vermarktung", "Plattformregulierung", "FAST-Channels"], "Verband privater Audio- und audiovisueller Medien."),
  source("anga", "ANGA", "anga.de", "https://anga.de", "Branchenverband", 82, ["OTT / Distribution", "Technik", "Streaming-Technologie"], "Quelle fuer Breitband-, Kabel- und Distributionsthemen."),
  source("agf", "AGF Videoforschung", "agf.de", "https://www.agf.de", "Messanbieter", 84, ["Werbung / Vermarktung", "FAST-Channels", "Lokale und regionale Medien"], "Quelle fuer Bewegtbild- und Reichweitenmessung."),
  source("agma", "agma", "agma-mmc.de", "https://www.agma-mmc.de", "Messanbieter", 78, ["Werbung / Vermarktung", "Lokale und regionale Medien"], "Arbeitsgemeinschaft Media-Analyse."),
  source("iabeurope", "IAB Europe", "iabeurope.eu", "https://iabeurope.eu", "Branchenverband", 78, ["Werbung / Vermarktung", "Plattformregulierung"], "Digitale Werbung und europaeische Marktstandards."),
  source("gema", "GEMA", "gema.de", "https://www.gema.de", "Verwertungsgesellschaft", 88, ["Medienrecht / Verwertungsrecht", "KI in der Synchronbranche", "Produktion / Postproduktion"], "Musikrechte und Verguetung."),
  source("vg-wort", "VG Wort", "vgwort.de", "https://www.vgwort.de", "Verwertungsgesellschaft", 86, ["Medienrecht / Verwertungsrecht", "KI in Redaktion und Produktion"], "Urheber- und Verwertungsrecht fuer Texte."),
  source("dpma", "Deutsches Patent- und Markenamt", "dpma.de", "https://www.dpma.de", "Behoerde", 86, ["Medienrecht / Verwertungsrecht", "KI in der Synchronbranche"], "Amtliche Informationen zu Schutzrechten."),
  source("bpb-medien", "Bundeszentrale fuer politische Bildung", "bpb.de", "https://www.bpb.de", "Oeffentliche Fachquelle", 78, ["Lokale und regionale Medien", "Plattformregulierung", "Medienrecht / Verwertungsrecht"], "Einordnung von Medienpolitik und Oe-ffentlichkeit."),
  source("edps", "European Data Protection Supervisor", "edps.europa.eu", "https://www.edps.europa.eu", "Behoerde", 88, ["KI in Redaktion und Produktion", "Plattformregulierung", "Medienrecht / Verwertungsrecht"], "Datenschutz- und KI-Regulierung auf EU-Ebene."),
  source("bsi", "Bundesamt fuer Sicherheit in der Informationstechnik", "bsi.bund.de", "https://www.bsi.bund.de", "Behoerde", 90, ["Technik", "Streaming-Technologie", "OTT / Distribution"], "IT-Sicherheit und technische Mindeststandards."),
  source("wipo", "WIPO", "wipo.int", "https://www.wipo.int", "Internationale Organisation", 86, ["Medienrecht / Verwertungsrecht", "KI in der Synchronbranche", "KI in Redaktion und Produktion"], "Internationale Quelle zu Urheberrecht und KI."),
  source("ofcom", "Ofcom", "ofcom.org.uk", "https://www.ofcom.org.uk", "Regulierung", 84, ["Plattformregulierung", "Lokale und regionale Medien", "Smart-TV / HbbTV"], "Regulierungs- und Marktdaten fuer UK-Medienmarkt."),
  source("arcom", "Arcom", "arcom.fr", "https://www.arcom.fr", "Regulierung", 82, ["Plattformregulierung", "Medienrecht / Verwertungsrecht"], "Franzoesische Medienaufsicht."),
  source("nielsen", "Nielsen", "nielsen.com", "https://www.nielsen.com", "Marktforschung", 76, ["Werbung / Vermarktung", "FAST-Channels", "Streaming-Technologie"], "Markt- und Reichweitenanalysen."),
  source("barc", "Broadcasting Audience Research Council", "barcindia.co.in", "https://www.barcindia.co.in", "Messanbieter", 72, ["Werbung / Vermarktung", "FAST-Channels"], "Internationale Quelle zu TV-Reichweitenmessung."),
  source("gmd", "Global Media Distribution", "globalmediadistribution.org", "https://globalmediadistribution.org", "Branchenquelle", 70, ["FAST-Channels", "OTT / Distribution"], "Distribution und internationale Medienmaerkte."),
  source("iab-tech-lab", "IAB Tech Lab", "iabtechlab.com", "https://iabtechlab.com", "Technischer Standard", 80, ["Werbung / Vermarktung", "FAST-Channels", "OTT / Distribution"], "Technische Standards fuer digitale Werbung."),
  source("cta", "Consumer Technology Association", "cta.tech", "https://www.cta.tech", "Branchenverband", 74, ["Smart-TV / HbbTV", "Technik"], "Consumer-Tech und Geraeteentwicklung."),
  source("access-board", "U.S. Access Board", "access-board.gov", "https://www.access-board.gov", "Behoerde", 82, ["Barrierefreiheit", "Technik"], "Internationale Accessibility-Orientierung."),
  source("w3c-wai", "W3C WAI", "w3.org", "https://www.w3.org/WAI/", "Technischer Standard", 96, ["Barrierefreiheit", "Untertitel", "Technik"], "Web Accessibility Initiative."),
  source("mdn-accessibility", "MDN Accessibility", "developer.mozilla.org", "https://developer.mozilla.org/en-US/docs/Web/Accessibility", "Technische Dokumentation", 76, ["Barrierefreiheit", "Technik"], "Praxisnahe technische Accessibility-Dokumentation."),
  source("ai-act", "EU AI Act", "digital-strategy.ec.europa.eu", "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai", "Behoerde", 95, ["KI in Redaktion und Produktion", "KI in der Synchronbranche", "Plattformregulierung"], "EU-Primaerquelle zum KI-Regelwerk."),
  source("openai-policies", "OpenAI Policies", "openai.com", "https://openai.com/policies", "Unternehmensquelle", 70, ["KI in Redaktion und Produktion", "KI in der Synchronbranche"], "Nur als Hersteller-/Policyquelle verwenden, nicht als unabhaengige Faktenquelle."),
  source("adobe-content-authenticity", "Content Authenticity Initiative", "contentauthenticity.org", "https://contentauthenticity.org", "Brancheninitiative", 76, ["KI in Redaktion und Produktion", "Produktion / Postproduktion"], "Content Credentials und Herkunftsnachweise."),
  source("c2pa", "C2PA", "c2pa.org", "https://c2pa.org", "Technischer Standard", 84, ["KI in Redaktion und Produktion", "Produktion / Postproduktion", "Technik"], "Standards fuer Content Provenance."),
  source("creative-europe", "Creative Europe MEDIA", "culture.ec.europa.eu", "https://culture.ec.europa.eu/creative-europe/creative-europe-media-strand", "Foerderprogramm", 86, ["Produktion / Postproduktion", "Lokale und regionale Medien"], "EU-Foerderinformationen fuer audiovisuelle Medien."),
  source("filmfoerderung", "FFA", "ffa.de", "https://www.ffa.de", "Foerderinstitution", 84, ["Produktion / Postproduktion", "Lokale und regionale Medien"], "Filmfoerderung und Marktdaten in Deutschland."),
  source("mdf", "Medienboard Berlin-Brandenburg", "medienboard.de", "https://www.medienboard.de", "Foerderinstitution", 76, ["Produktion / Postproduktion", "Lokale und regionale Medien"], "Regionale Foerder- und Branchendaten."),
  source("ebu-tech", "EBU Technology & Innovation", "tech.ebu.ch", "https://tech.ebu.ch", "Technische Fachquelle", 88, ["Technik", "Streaming-Technologie", "Produktion / Postproduktion"], "Technische Broadcast- und Medienstandards."),
  source("streaming-video-alliance", "Streaming Video Alliance", "streamingvideoalliance.org", "https://www.streamingvideoalliance.org", "Branchenverband", 78, ["Streaming-Technologie", "OTT / Distribution", "FAST-Channels"], "Fachquelle fuer Streaming-Workflows und Distribution."),
  source("cta-wave", "CTA WAVE", "cta.tech", "https://www.cta.tech", "Branchenstandard", 74, ["Streaming-Technologie", "Smart-TV / HbbTV"], "Consumer-Streaming und Geraeteinteroperabilitaet."),
  source("ard", "ARD", "ard.de", "https://www.ard.de", "Oeffentlich-rechtlicher Sender", 82, ["Lokale und regionale Medien", "Streaming-Technologie", "Smart-TV / HbbTV", "Produktion / Postproduktion"], "Branchen- und Unternehmensquelle fuer ARD-Angebote."),
  source("zdf", "ZDF", "zdf.de", "https://www.zdf.de", "Oeffentlich-rechtlicher Sender", 82, ["Lokale und regionale Medien", "Streaming-Technologie", "Smart-TV / HbbTV", "Produktion / Postproduktion"], "Branchen- und Unternehmensquelle fuer ZDF-Angebote."),
  source("deutschlandradio", "Deutschlandradio", "deutschlandradio.de", "https://www.deutschlandradio.de", "Oeffentlich-rechtlicher Sender", 78, ["Lokale und regionale Medien", "Produktion / Postproduktion"], "Quelle fuer Audio, Medienpolitik und digitale Angebote."),
  source("prosiebensat1", "ProSiebenSat.1 Media", "prosiebensat1.com", "https://www.prosiebensat1.com", "Privater Sender / Mediengruppe", 78, ["Werbung / Vermarktung", "Streaming-Technologie", "FAST-Channels", "Produktion / Postproduktion"], "Unternehmensquelle fuer private TV- und Streamingangebote."),
  source("seven-one", "Seven.One Entertainment Group", "seven.one", "https://www.seven.one", "Privater Sender / Mediengruppe", 76, ["Werbung / Vermarktung", "Streaming-Technologie", "FAST-Channels"], "Unternehmensquelle fuer Entertainment, Streaming und Vermarktung."),
  source("sky-deutschland", "Sky Deutschland", "sky.de", "https://www.sky.de", "Pay-TV / Streaminganbieter", 76, ["Streaming-Technologie", "OTT / Distribution", "Werbung / Vermarktung"], "Unternehmensquelle fuer Pay-TV und Streaming."),
  source("deutsche-telekom", "Deutsche Telekom / MagentaTV", "telekom.com", "https://www.telekom.com", "Plattform / Telekommunikation", 78, ["OTT / Distribution", "Streaming-Technologie", "Smart-TV / HbbTV"], "Unternehmensquelle fuer Distribution und Plattformangebote."),
  source("vodafone", "Vodafone Deutschland", "vodafone.de", "https://www.vodafone.de", "Plattform / Telekommunikation", 76, ["OTT / Distribution", "Streaming-Technologie", "Technik"], "Unternehmensquelle fuer Kabel, IPTV und Distribution."),
  source("waipu", "waipu.tv", "waipu.tv", "https://www.waipu.tv", "OTT-Plattform", 74, ["OTT / Distribution", "Streaming-Technologie", "FAST-Channels"], "Unternehmensquelle fuer OTT-TV und Streaming."),
  source("zattoo", "Zattoo", "zattoo.com", "https://zattoo.com", "OTT-Plattform", 74, ["OTT / Distribution", "Streaming-Technologie", "FAST-Channels", "Smart-TV / HbbTV"], "Unternehmensquelle fuer TV-Streaming und Distribution."),
  source("joyn", "Joyn", "joyn.de", "https://www.joyn.de", "Streamingplattform", 72, ["Streaming-Technologie", "OTT / Distribution", "FAST-Channels", "Werbung / Vermarktung"], "Unternehmensquelle fuer Streamingangebote."),
  source("netflix", "Netflix", "netflix.com", "https://www.netflix.com", "Streamingplattform", 72, ["Streaming-Technologie", "OTT / Distribution", "Produktion / Postproduktion"], "Unternehmensquelle fuer Streaming und Produktion."),
  source("amazon-prime-video", "Amazon Prime Video", "aboutamazon.com", "https://www.aboutamazon.com", "Streamingplattform", 72, ["Streaming-Technologie", "OTT / Distribution", "Produktion / Postproduktion"], "Unternehmensquelle fuer Streaming und Plattformstrategie."),
  source("disney-plus", "Disney+", "thewaltdisneycompany.com", "https://thewaltdisneycompany.com", "Streamingplattform", 72, ["Streaming-Technologie", "OTT / Distribution", "Produktion / Postproduktion"], "Unternehmensquelle fuer Streaming und Medienstrategie."),
  source("axel-springer", "Axel Springer", "axelspringer.com", "https://www.axelspringer.com", "Verlag / Medienhaus", 74, ["Lokale und regionale Medien", "KI in Redaktion und Produktion", "Werbung / Vermarktung"], "Unternehmensquelle fuer Verlag, Digitaljournalismus und Medienstrategie."),
  source("bertelsmann", "Bertelsmann", "bertelsmann.com", "https://www.bertelsmann.com", "Verlag / Mediengruppe", 76, ["Produktion / Postproduktion", "Werbung / Vermarktung", "KI in Redaktion und Produktion"], "Unternehmensquelle fuer internationale Medien- und Produktionsaktivitaeten."),
  source("burda", "Hubert Burda Media", "burda.com", "https://www.burda.com", "Verlag / Medienhaus", 72, ["Lokale und regionale Medien", "Werbung / Vermarktung", "KI in Redaktion und Produktion"], "Unternehmensquelle fuer Digitalmedien und Verlagsthemen."),
  source("funke", "FUNKE Mediengruppe", "funkemedien.de", "https://www.funkemedien.de", "Verlag / Medienhaus", 72, ["Lokale und regionale Medien", "KI in Redaktion und Produktion", "Werbung / Vermarktung"], "Unternehmensquelle fuer regionale Medien und digitale Transformation."),
  source("spiegel", "DER SPIEGEL", "spiegelgruppe.de", "https://www.spiegelgruppe.de", "Verlag / Medienhaus", 72, ["Lokale und regionale Medien", "KI in Redaktion und Produktion", "Werbung / Vermarktung"], "Unternehmensquelle fuer digitalen Journalismus."),
  source("zeit", "ZEIT Verlagsgruppe", "zeit-verlagsgruppe.de", "https://www.zeit-verlagsgruppe.de", "Verlag / Medienhaus", 72, ["Lokale und regionale Medien", "KI in Redaktion und Produktion", "Werbung / Vermarktung"], "Unternehmensquelle fuer Verlag und digitale Medienangebote."),
  sourceDe("dwdl", "DWDL", "dwdl.de", "https://www.dwdl.de", "Fachmedium", 82, ["Lokale und regionale Medien", "Werbung / Vermarktung", "Streaming-Technologie", "Produktion / Postproduktion"], "Deutschsprachiges Fachmedium fuer TV, Streaming, Medienwirtschaft und Programmstrategie."),
  sourceDe("meedia", "MEEDIA", "meedia.de", "https://www.meedia.de", "Fachmedium", 78, ["Werbung / Vermarktung", "Lokale und regionale Medien", "KI in Redaktion und Produktion"], "Deutschsprachiges Fachmedium fuer Medien, Digitalwirtschaft und Vermarktung."),
  sourceDe("horizont", "HORIZONT", "horizont.net", "https://www.horizont.net", "Fachmedium", 78, ["Werbung / Vermarktung", "Plattformregulierung", "Lokale und regionale Medien"], "Deutschsprachiges Fachmedium fuer Marketing, Medien und Kommunikation."),
  sourceDe("wuv", "W&V", "wuv.de", "https://www.wuv.de", "Fachmedium", 76, ["Werbung / Vermarktung", "KI in Redaktion und Produktion", "Lokale und regionale Medien"], "Deutschsprachiges Fachmedium fuer Werbung, Medien und digitale Vermarktung."),
  sourceDe("kress", "kress", "kress.de", "https://kress.de", "Fachmedium", 76, ["Lokale und regionale Medien", "Werbung / Vermarktung", "KI in Redaktion und Produktion"], "Deutschsprachiges Fachmedium fuer Medienmanagement und Personalien der Medienbranche."),
  sourceDe("turi2", "turi2", "turi2.de", "https://www.turi2.de", "Fachmedium", 72, ["Lokale und regionale Medien", "Werbung / Vermarktung", "KI in Redaktion und Produktion"], "Deutschsprachiger Branchendienst fuer Medien und Kommunikation."),
  sourceDe("medienpolitik", "medienpolitik.net", "medienpolitik.net", "https://www.medienpolitik.net", "Fachmedium", 82, ["Medienrecht / Verwertungsrecht", "Plattformregulierung", "Lokale und regionale Medien"], "Deutschsprachige Quelle fuer Medienpolitik, Regulierung und Rundfunkordnung."),
  sourceDe("medienkorrespondenz", "Medienkorrespondenz", "medienkorrespondenz.de", "https://www.medienkorrespondenz.de", "Fachmedium", 78, ["Lokale und regionale Medien", "Medienrecht / Verwertungsrecht", "Plattformregulierung"], "Deutschsprachiges Fachmedium fuer Rundfunk, Medienpolitik und Programmfragen."),
  sourceDe("digitalfernsehen", "DIGITAL FERNSEHEN", "digitalfernsehen.de", "https://www.digitalfernsehen.de", "Fachmedium", 74, ["Smart-TV / HbbTV", "OTT / Distribution", "Streaming-Technologie", "Technik"], "Deutschsprachiges Fachmedium fuer TV-Empfang, Streaming, Plattformen und Technik."),
  sourceDe("infosat", "INFOSAT", "infosat.de", "https://www.infosat.de", "Fachmedium", 72, ["OTT / Distribution", "Technik", "Smart-TV / HbbTV"], "Deutschsprachiges Fachmedium fuer Satellit, TV-Verbreitung und Empfangstechnik."),
  sourceDe("heise", "heise online", "heise.de", "https://www.heise.de", "Fachmedium", 78, ["Technik", "KI in Redaktion und Produktion", "Plattformregulierung", "Streaming-Technologie"], "Deutschsprachiges Fachmedium fuer IT, Regulierung und digitale Technologien."),
  sourceDe("golem", "Golem.de", "golem.de", "https://www.golem.de", "Fachmedium", 74, ["Technik", "KI in Redaktion und Produktion", "Streaming-Technologie"], "Deutschsprachiges Fachmedium fuer IT, Digitalwirtschaft und Technologie."),
  sourceDe("netzpolitik", "netzpolitik.org", "netzpolitik.org", "https://netzpolitik.org", "Fachmedium", 78, ["Plattformregulierung", "Medienrecht / Verwertungsrecht", "KI in Redaktion und Produktion"], "Deutschsprachiges Fachmedium fuer digitale Grundrechte, Plattformpolitik und Regulierung."),
  sourceDe("adzine", "ADZINE", "adzine.de", "https://www.adzine.de", "Fachmedium", 74, ["Werbung / Vermarktung", "Streaming-Technologie", "Plattformregulierung"], "Deutschsprachiges Fachmedium fuer digitale Werbung, Adtech und Vermarktung."),
  sourceDe("produzentenallianz", "Produzentenallianz", "produzentenallianz.de", "https://www.produzentenallianz.de", "Branchenverband", 80, ["Produktion / Postproduktion", "Medienrecht / Verwertungsrecht", "Lokale und regionale Medien"], "Branchenverband fuer Film-, Fernseh- und audiovisuelle Produktion in Deutschland.")
];

