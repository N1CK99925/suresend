const fetch = require('node-fetch');

const REPO = process.env.GITHUB_REPO; // e.g. owner/repo
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = process.env.FEEDBACK_FILE_PATH || 'pilot-feedback.json';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN || !REPO) {
  console.warn('submit-feedback: GITHUB_TOKEN or GITHUB_REPO not set');
}

async function getFile() {
  const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub get file failed: ${res.status}`);
  return res.json();
}

async function putFile(content, sha, message) {
  const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
  const body = {
    message,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub put file failed: ${res.status}`);
  return res.json();
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  if (!TOKEN || !REPO) {
    return { statusCode: 500, body: 'Server not configured (missing GITHUB_TOKEN or GITHUB_REPO)' };
  }

  try {
    const entry = JSON.parse(event.body);

    const file = await getFile();
    let current = [];
    let sha = null;
    if (file) {
      sha = file.sha;
      const decoded = Buffer.from(file.content, 'base64').toString('utf8');
      current = JSON.parse(decoded || '[]');
    }

    current.push({ ...entry, received_at: new Date().toISOString() });

    await putFile(current, sha, 'Add pilot feedback');

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('submit-feedback error', err);
    return { statusCode: 500, body: String(err.message || err) };
  }
};
