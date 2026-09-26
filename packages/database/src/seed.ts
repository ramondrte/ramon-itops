import { config } from "dotenv";
import { createDatabase } from "./index.js";
config({ path: new URL("../../../.env", import.meta.url), quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL obrigatória");
const db = createDatabase(process.env.DATABASE_URL);
try {
  await db.query(`INSERT INTO technicians(id, name) VALUES
    ('00000000-0000-4000-8000-000000000001', 'Técnico Demo — Suporte'),
    ('00000000-0000-4000-8000-000000000002', 'Técnico Demo — Infraestrutura')
    ON CONFLICT (id) DO NOTHING`);
  console.log("Técnicos fictícios disponíveis. Nenhum chamado foi criado.");
} finally {
  await db.close();
}
