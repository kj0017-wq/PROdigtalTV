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
