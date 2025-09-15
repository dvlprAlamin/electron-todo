import fetch from 'cross-fetch';

interface RepoInfo {
  owner: string;
  repo: string;
}

const getLatestReleaseTagName = async ({
  owner,
  repo,
}: RepoInfo): Promise<string | null> => {
  const githubApiReleasesApi = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const response = await fetch(githubApiReleasesApi);
  const json = await response.json();
  return json.tag_name || null;
};

export const getGithubFeedURL = async ({
  owner,
  repo,
}: RepoInfo): Promise<string | null> => {
  let githubFeedURL: string | null;

  try {
    const latestReleaseTagName = await getLatestReleaseTagName({ owner, repo });
    githubFeedURL = latestReleaseTagName
      ? `https://github.com/${owner}/${repo}/releases/download/${latestReleaseTagName}/`
      : null;
  } catch (error) {
    githubFeedURL = null;
  }
  return githubFeedURL;
};
