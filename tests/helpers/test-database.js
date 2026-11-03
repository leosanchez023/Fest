export async function assertTestDatabase(db) {
  const { rows: [database] } = await db.query("SELECT current_database() AS name");
  if (!database?.name?.toLowerCase().endsWith("_test")) {
    throw new Error(
      `Integrações exigem um banco isolado com nome terminado em _test; banco atual: ${database?.name || "desconhecido"}.`
    );
  }
}
