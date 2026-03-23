import * as sqliteSchema from "./sqlite_schema.js";
import * as pgSchema from "./pg_schema.js";

const schema = process.env.DATABASE_URL ? pgSchema : sqliteSchema;

export default schema;
