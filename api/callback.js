import axios from "axios";

export default async function handler(req, res) {
  const { code, realmId, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${error}`);
  }

  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const credentials = Buffer.from(
      `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
    ).toString("base64");

    const response = await axios.post(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.QB_REDIRECT_URI,
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token } = response.data;

    return res.redirect(
      `/?access_token=${access_token}&realm_id=${realmId}`
    );
  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.redirect("/?error=oauth_failed");
  }
}
