/**
 * Component contract for a future React migration. The live ES-module view in
 * cmsPages.js uses the same setupService operations without a framework runtime.
 */
import {
  checkFirebaseConnection,
  checkFirestoreStructure,
  initializeDatabase,
  createDemoData
} from "../firebase/setupService.js";

export function SystemSetupPage({ user, status, onResult }) {
  if (user?.role !== "admin") return null;
  const actions = {
    connection: checkFirebaseConnection,
    structure: checkFirestoreStructure,
    initialize: initializeDatabase,
    demo: createDemoData
  };
  const execute = async (key) => onResult(await actions[key]());
  return (
    <section className="panel">
      <h1>Firebase Setup-Assistent</h1>
      <p>Installationsstatus: {status?.installed ? "Installiert" : "Nicht installiert"}</p>
      <button onClick={() => execute("connection")}>Verbindung testen</button>
      <button onClick={() => execute("structure")}>Struktur pruefen</button>
      <button onClick={() => execute("initialize")}>Basisdaten anlegen</button>
      <button onClick={() => execute("demo")}>Demo-Daten anlegen</button>
    </section>
  );
}
