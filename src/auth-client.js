

import { createAuthClient } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";

export const authClient = createAuthClient(
  "https://ep-crimson-cloud-bfxxocl4.neonauth.c-5.us-west-2.aws.neon.tech/neondb/auth",
  {
    adapter: BetterAuthReactAdapter({
      fetchOptions: {
        credentials: "include"
      }
    })
  }
);
