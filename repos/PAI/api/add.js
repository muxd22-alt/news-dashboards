export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO = process.env.GITHUB_REPO; // e.g., "Muxd21/daily-intel"

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return res.status(500).json({ error: "Server Configuration Error: Missing GitHub Credentials." });
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-Serverless-Function'
      },
      body: JSON.stringify({
        title: url,
        labels: ['raw-link']
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: 'GitHub API Error', details: errorData });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, message: "Link sent to the engine!", issueUrl: data.html_url });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}
