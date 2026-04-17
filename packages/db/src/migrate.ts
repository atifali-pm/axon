import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

dotenvExpand.expand(dotenv.config({ path: "../../.env" }));

const { migrate } = await import("drizzle-orm/postgres-js/migrator");
const { db, pg } = await import("./client");

async function main() {
  console.log("running migrations from ./drizzle");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("migrations complete");
  await pg.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
