import { env } from "../env.mjs";
// Pons surfaces (menu, links, /markets/pons) appear only on a network with a configured Pons deployment.
export const PONS_VISIBLE = env.PONS_DEPLOYMENT_JSON !== null;
