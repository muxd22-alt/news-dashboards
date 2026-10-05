export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO = process.env.GITHUB_REPO; 

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return res.status(500).json({ error: "Server Configuration Error: Missing GitHub Credentials." });
  }

  try {
    const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/data.json`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-Serverless-Function'
      }
    });

    if (!getRes.ok) {
      return res.status(500).json({ error: 'Failed to access repository data file.' });
    }

    const fileData = await getRes.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf8');
    let jsonData = JSON.parse(content);
    
    const initialLength = jsonData.links.length;
    jsonData.links = jsonData.links.filter(link => link.url !== url);

    if (jsonData.links.length === initialLength) {
        return res.status(404).json({ error: "Link not found in data." });
    }

    const updatedContent = Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64');

    const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/data.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-Serverless-Function'
      },
      body: JSON.stringify({
        message: `Delete extract: ${url}`,
        content: updatedContent,
        sha: fileData.sha,
        branch: 'main'
      })
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      return res.status(500).json({ error: 'Failed to update remote data file.', details: err });
    }

    // === UPDATE gaps.json ===
    try {
      const getGapsRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/gaps.json`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Vercel-Serverless-Function' }
      });
      if (getGapsRes.ok) {
        const gapsFileData = await getGapsRes.json();
        const gapsContent = Buffer.from(gapsFileData.content, 'base64').toString('utf8');
        let gapsData = JSON.parse(gapsContent);
        
        gapsData.gaps = gapsData.gaps.filter(gap => gap.url !== url);
        const updatedGapsContent = Buffer.from(JSON.stringify(gapsData, null, 2)).toString('base64');
        
        await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/gaps.json`, {
          method: 'PUT',
          headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Vercel-Serverless-Function' },
          body: JSON.stringify({
            message: `Delete corresponding gap for: ${url}`,
            content: updatedGapsContent,
            sha: gapsFileData.sha,
            branch: 'main'
          })
        });
      }
    } catch(err) {
      console.log("Failed to process gaps.json deletion:", err);
    }

    // === TRIGGER WORKFLOW TO REBUILD DIGEST ===
    try {
      await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Vercel-Serverless-Function'
        },
        body: JSON.stringify({
          event_type: 'update-digest'
        })
      });
    } catch(err) {
      console.log("Failed to trigger digest workflow:", err);
    }

    return res.status(200).json({ success: true, message: "Extract and gap successfully deleted. Master Digest rebuild triggered." });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
}
