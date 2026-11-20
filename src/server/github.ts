import type { ScannableFile } from '../lib/scanner/engine.ts';

export interface GitHubRepoSummary {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  language: string;
  isPrivate: boolean;
  htmlUrl: string;
  updatedAt: string;
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Repo-Health-Platform',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function encodeGitHubPath(filePath: string): string {
  return filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export async function fetchGitHubUser(token: string) {
  const res = await fetch('https://api.github.com/user', {
    headers: buildHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`GitHub user lookup failed (${res.status})`);
  }
  return res.json() as Promise<{
    id: number;
    login: string;
    avatar_url: string;
    name?: string | null;
    email?: string | null;
  }>;
}

export async function listUserGitHubRepos(token: string): Promise<GitHubRepoSummary[]> {
  const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=40&affiliation=owner,collaborator,organization_member', {
    headers: buildHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to list GitHub repositories (${res.status})`);
  }
  const items = (await res.json()) as Array<{
    id: number;
    name: string;
    full_name: string;
    owner: { login: string };
    description: string | null;
    default_branch: string;
    language: string | null;
    private: boolean;
    html_url: string;
    updated_at: string;
  }>;
  return items.map((item) => ({
    id: String(item.id),
    owner: item.owner.login,
    name: item.name,
    fullName: item.full_name,
    description: item.description || '',
    defaultBranch: item.default_branch || 'main',
    language: item.language || 'Unknown',
    isPrivate: item.private,
    htmlUrl: item.html_url,
    updatedAt: item.updated_at,
  }));
}

export async function fetchGitHubRepoMetadata(
  fullName: string,
  token?: string
): Promise<GitHubRepoSummary> {
  const res = await fetch(`https://api.github.com/repos/${fullName}`, {
    headers: buildHeaders(token),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub repository lookup failed (${res.status}): ${body.slice(0, 140)}`);
  }
  const item = await res.json();
  return {
    id: String(item.id),
    owner: item.owner.login,
    name: item.name,
    fullName: item.full_name,
    description: item.description || '',
    defaultBranch: item.default_branch || 'main',
    language: item.language || 'Unknown',
    isPrivate: Boolean(item.private),
    htmlUrl: item.html_url,
    updatedAt: item.updated_at,
  };
}

export async function fetchGitHubBranches(fullName: string, token?: string) {
  const res = await fetch(`https://api.github.com/repos/${fullName}/branches?per_page=30`, {
    headers: buildHeaders(token),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ name: string; commit: { sha: string } }>;
  return data.map((b) => ({ name: b.name, commitSha: b.commit.sha }));
}

export async function fetchGitHubPullRequests(fullName: string, token?: string) {
  const res = await fetch(`https://api.github.com/repos/${fullName}/pulls?state=open&per_page=20`, {
    headers: buildHeaders(token),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    number: number;
    title: string;
    user: { login: string };
    head: { ref: string };
    state: string;
    updated_at: string;
    html_url: string;
  }>;
  return data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: pr.user?.login || 'unknown',
    branch: pr.head?.ref || 'unknown',
    state: pr.state,
    updatedAt: pr.updated_at,
    htmlUrl: pr.html_url,
  }));
}

export async function fetchGitHubCommits(fullName: string, branch: string, token?: string) {
  const res = await fetch(
    `https://api.github.com/repos/${fullName}/commits?sha=${encodeURIComponent(branch)}&per_page=15`,
    { headers: buildHeaders(token) }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
  }>;
  return data.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0],
    author: c.commit.author?.name || 'unknown',
    date: c.commit.author?.date || '',
  }));
}

const SKIP_DIRS = ['node_modules/', 'dist/', 'build/', '.git/', 'vendor/', '__pycache__/', '.next/'];
const ALLOWED_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|json|yml|yaml|md|sql|sh)$/i;

export async function fetchGitHubRepositoryFiles(
  fullName: string,
  branch: string,
  token?: string,
  maxFiles = 45
): Promise<{ files: ScannableFile[]; commitSha: string; skippedReason?: string }> {
  const treeRes = await fetch(
    `https://api.github.com/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: buildHeaders(token) }
  );
  if (!treeRes.ok) {
    throw new Error(`Unable to fetch GitHub repository tree (${treeRes.status})`);
  }
  const treeData = (await treeRes.json()) as {
    sha: string;
    truncated?: boolean;
    tree: Array<{ path: string; type: string; size?: number }>;
  };

  const candidates = (treeData.tree || [])
    .filter((node) => node.type === 'blob')
    .filter((node) => !SKIP_DIRS.some((dir) => node.path.startsWith(dir) || node.path.includes(`/${dir}`)))
    .filter((node) => (node.size || 0) <= 120_000)
    .filter(
      (node) =>
        ALLOWED_EXT.test(node.path) ||
        node.path.endsWith('.env.example') ||
        node.path.endsWith('requirements.txt') ||
        node.path.endsWith('Dockerfile')
    )
    .slice(0, maxFiles);

  const files: ScannableFile[] = [];
  // Fetch in bounded batches of 6
  for (let i = 0; i < candidates.length; i += 6) {
    const batch = candidates.slice(i, i + 6);
    const loaded = await Promise.all(
      batch.map(async (entry) => {
        const contentRes = await fetch(
          `https://api.github.com/repos/${fullName}/contents/${encodeGitHubPath(entry.path)}?ref=${encodeURIComponent(branch)}`,
          { headers: buildHeaders(token) }
        );
        if (!contentRes.ok) return null;
        const json = (await contentRes.json()) as { content?: string; encoding?: string };
        if (json.encoding === 'base64' && json.content) {
          const decoded = Buffer.from(json.content, 'base64').toString('utf8');
          return { path: entry.path, content: decoded };
        }
        return null;
      })
    );
    for (const f of loaded) {
      if (f) files.push(f);
    }
  }

  return {
    files,
    commitSha: (treeData.sha || branch).slice(0, 12),
    skippedReason: treeData.truncated
      ? `Repository tree exceeded GitHub recursive API limit; scanned first ${files.length} prioritized source files.`
      : undefined,
  };
}

export async function fetchGitHubFileContent(
  fullName: string,
  branch: string,
  filePath: string,
  token?: string
): Promise<{ content: string; sha: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${fullName}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(branch)}`,
    { headers: buildHeaders(token) }
  );
  if (!res.ok) {
    throw new Error(`Could not fetch file ${filePath} from GitHub (${res.status})`);
  }
  const data = (await res.json()) as { content: string; encoding: string; sha: string };
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { content, sha: data.sha };
}

export async function createGitHubPullRequestForPatch(params: {
  fullName: string;
  baseBranch: string;
  newBranch: string;
  filePath: string;
  newContent: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  token: string;
}): Promise<{ prUrl: string; prNumber: number; branchName: string }> {
  const headers = { ...buildHeaders(params.token), 'Content-Type': 'application/json' };

  // 1. Get base branch SHA
  const refRes = await fetch(
    `https://api.github.com/repos/${params.fullName}/git/ref/heads/${encodeURIComponent(params.baseBranch)}`,
    { headers }
  );
  if (!refRes.ok) {
    throw new Error(`Unable to read base branch ${params.baseBranch} (${refRes.status})`);
  }
  const refJson = (await refRes.json()) as { object: { sha: string } };

  // 2. Create branch
  const createRefRes = await fetch(`https://api.github.com/repos/${params.fullName}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: `refs/heads/${params.newBranch}`,
      sha: refJson.object.sha,
    }),
  });
  if (!createRefRes.ok && createRefRes.status !== 422) {
    throw new Error(`Unable to create branch ${params.newBranch} (${createRefRes.status})`);
  }

  // 3. Get current file SHA on newBranch
  const existing = await fetchGitHubFileContent(
    params.fullName,
    params.newBranch,
    params.filePath,
    params.token
  );

  // 4. Commit updated file
  const putRes = await fetch(
    `https://api.github.com/repos/${params.fullName}/contents/${encodeGitHubPath(params.filePath)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: params.commitMessage,
        content: Buffer.from(params.newContent, 'utf8').toString('base64'),
        sha: existing.sha,
        branch: params.newBranch,
      }),
    }
  );
  if (!putRes.ok) {
    throw new Error(`Failed to commit patch to ${params.filePath} (${putRes.status})`);
  }

  // 5. Open Pull Request
  const prRes = await fetch(`https://api.github.com/repos/${params.fullName}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: params.prTitle,
      head: params.newBranch,
      base: params.baseBranch,
      body: params.prBody,
    }),
  });
  if (!prRes.ok) {
    throw new Error(`Failed to create Pull Request (${prRes.status})`);
  }
  const prData = (await prRes.json()) as { html_url: string; number: number };
  return {
    prUrl: prData.html_url,
    prNumber: prData.number,
    branchName: params.newBranch,
  };
}
