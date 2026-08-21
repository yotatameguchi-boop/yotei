export type GoogleUserProfile = {
  sub: string;
  email?: string;
  name?: string;
};

export async function fetchGoogleUserProfile(
  accessToken: string,
): Promise<GoogleUserProfile | null> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      sub?: string;
      email?: string;
      name?: string;
    };

    if (!data.sub) {
      return null;
    }

    return {
      sub: data.sub,
      email: data.email,
      name: data.name,
    };
  } catch {
    return null;
  }
}
