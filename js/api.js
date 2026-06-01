// js/api.js
// GitHub Contents API wrapper. Reads and writes JSON data files.
// CONFIG must be loaded before this module.

const _shas = {}; // cache: path -> sha

async function readFile(path) {
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${CONFIG.pat}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) throw new Error(`readFile ${path}: ${res.status}`);
  const json = await res.json();
  _shas[path] = json.sha;
  return JSON.parse(atob(json.content));
}

async function writeFile(path, data) {
  if (!_shas[path]) await readFile(path); // ensure sha is cached
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${CONFIG.pat}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `data: update ${path}`,
      content,
      sha: _shas[path],
      branch: CONFIG.branch
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`writeFile ${path}: ${res.status} ${err.message}`);
  }
  const json = await res.json();
  _shas[path] = json.content.sha; // update cached sha
}
