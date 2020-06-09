import { GitHub, context } from '@actions/github';
import * as axios from 'axios';
import { Status } from './status';

const statusColorPalette: { [key in Status]: string } = {
  success: "#2cbe4e",
  cancelled: "#ffc107",
  failure: "#ff0000"
};

const statusText: { [key in Status]: string } = {
  success: "Succeeded",
  cancelled: "Cancelled",
  failure: "Failed"
};

const textButton = (text: string, url: string) => ({
  textButton: {
    text,
    onClick: { openLink: { url } }
  }
});

export async function notify(name: string, url: string, status: Status) {
  // Get owner and repo from context of payload that triggered the action
  const { owner, repo } = context.repo;
  const { eventName, sha, ref } = context;
  const { number } = context.issue;
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const eventPath = eventName === 'pull_request' ? `/pull/${number}` : `/commit/${sha}`;
  const checksUrl = `${repoUrl}${eventPath}/checks`;

  const github = new GitHub(process.env['GITHUB_TOKEN'] || '');
  // Get the tag name from the triggered action
  const tagName = context.ref;
  // This removes the 'refs/tags' portion of the string, i.e. from 'refs/tags/v1.10.15' to 'v1.10.15'
  const tag = tagName.replace("refs/tags/", "");

  // Get a release from the tag name
  // API Documentation: https://developer.github.com/v3/repos/releases/#create-a-release
  // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-create-release
  const getReleaseResponse = await github.repos.getReleaseByTag({
    owner,
    repo,
    tag
  });
  const desc = getReleaseResponse.data.body;
  const releaseUrl = getReleaseResponse.data.html_url;
  const websiteUrl = process.env['WEBSITE'] || ''

  const body = {
    text: "<users/all>",
    cards: [{
      sections: [
        {
          widgets: [{
            textParagraph: {
              text: `<b>${name} <font color="${statusColorPalette[status]}">${statusText[status]}</font></b>`
            }
          }]
        },
        {
          widgets: [
            {
              keyValue: {
                topLabel: "repo",
                content: `${owner}/<b>${repo}</b>`,
                contentMultiline: true,
                button: textButton("VIEW REPO", repoUrl)
              }
            },
            {
              keyValue: { 
                topLabel: "version", 
                content: tag,
                contentMultiline: true,
                button: textButton("VIEW RELEASE", releaseUrl)
              }
            },
            {
              keyValue: { topLabel: "desc", content: desc }
            }
          ]
        },
        {
          widgets: [{
            buttons: [
              textButton("VIEW CHECKS", checksUrl),
              textButton("OPEN WEBSITE", websiteUrl)
            ]
          }]
        }
      ]
    }]
  };

  const response = await axios.default.post(url, body);
  if (response.status !== 200) {
    throw new Error(`Google Chat notification failed. response status=${response.status}`);
  }
}