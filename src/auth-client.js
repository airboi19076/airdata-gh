import { createAuthClient } from "@neondatabase/auth";

export const authClient = createAuthClient({
  baseURL: "https://ep-crimson-cloud-bfxxocl4.neonauth.c-5.us-west-2.aws.neon.tech/neondb/auth"
});
