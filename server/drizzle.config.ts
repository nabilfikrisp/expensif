/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL is not defined in your .env file");
}

export default defineConfig({
  out: "./src/pkg/db/migrations",
  schema: "./src/pkg/db/schema.ts",
  dialect: "sqlite",
  // this part is only for drizzle kit migrate and studio
  dbCredentials: {
    url: dbUrl,
  },
});
