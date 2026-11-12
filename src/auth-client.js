
import { createAuthClient } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";

export const authClient = createAuthClient(
  `${window.location.origin}/api/auth`,
  {
    adapter: BetterAuthReactAdapter({
      fetchOptions: {
        credentials: "include"
      }
    })
  }
);
