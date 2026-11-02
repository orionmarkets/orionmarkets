// Stops the localhost stack. Pass --volumes to also delete the database.
import { compose } from "./lib.mjs";

const volumes = process.argv.includes("--volumes");
const result = compose(["down", ...(volumes ? ["-v"] : [])], { stdio: "inherit" });
process.exit(result.status ?? 0);
