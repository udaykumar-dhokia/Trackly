import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  signInReturnToPath: "/dashboard",
  beforeSessionSaved: async (session, idToken) => {
    const { user } = session;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      let response = await fetch(
        `${apiUrl}/api/v1/users/me?auth0_id=${encodeURIComponent(user.sub)}&profile_photo=${encodeURIComponent(user.picture || "")}`,
      );

      if (response.status === 404) {
        response = await fetch(`${apiUrl}/api/v1/users/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auth0_id: user.sub,
            email: user.email,
            name: user.name || user.nickname || "User",
            profile_photo: user.picture,
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to sync user with backend:", errorText);
      } else {
        const data = await response.json();

        session.user.app_user_id = data.id;
        if (data.org_id) {
          session.user.org_id = data.org_id;
        }
      }
    } catch (error) {
      console.error("Error syncing user with backend:", error);
    }

    return session;
  },
});
