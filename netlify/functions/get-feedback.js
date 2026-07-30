const fetch = require('node-fetch');

const REPO = process.env.GITHUB_REPO; // e.g. owner/repo
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH = process.env.FEEDBACK_FILE_PATH || 'pilot-feedback.json';
const TOKEN = process.env.GITHUB_TOKEN;

async function getFile() {
  const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub get file failed: ${res.status}`);
  return res.json();
}

exports.handler = async function (event) {
  try {
    if (!REPO || !TOKEN) {
      return { statusCode: 500, body: 'Server not configured (missing GITHUB_TOKEN or GITHUB_REPO)' };
    }

    const file = await getFile();
    if (!file) return { statusCode: 200, body: JSON.stringify([]) };
    const decoded = Buffer.from(file.content, 'base64').toString('utf8');
    const data = JSON.parse(decoded || '[]');
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    console.error('get-feedback error', err);
    return { statusCode: 500, body: String(err.message || err) };
  }
};
