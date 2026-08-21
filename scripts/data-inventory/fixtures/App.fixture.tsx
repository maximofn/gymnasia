// Fixture del escáner del inventario de datos (GYM-190).
//
// No es código de la app: existe para que los tests puedan ejercitar el escaneo
// sin leer el App.tsx real, que pesa 1 MB y cambia constantemente. Contiene a
// propósito una clave y un host que el inventario NO declara, más el literal
// "gymnasia" a secas, que no es una clave y no debe capturarse.

const STORAGE_KEY = "gymnasia.mobile.fixture.v1";
const TRACE_KEY = "gymnasia_fixture_traces";
const BACKUP_APP_ID = "gymnasia";

const FIXTURE_ENDPOINT = "https://fixture.example.com/v1/things";
const KNOWN_ENDPOINT = "https://api.openai.com/v1/models";

export { STORAGE_KEY, TRACE_KEY, BACKUP_APP_ID, FIXTURE_ENDPOINT, KNOWN_ENDPOINT };
