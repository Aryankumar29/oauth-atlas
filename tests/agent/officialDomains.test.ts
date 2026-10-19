import { describe, expect, it } from "vitest";

import { isOfficialUrl, officialDomainsFor, registrable } from "@/lib/agent/validate";

const miro = officialDomainsFor({ slug: "miro", website: "https://miro.com", docsUrl: "https://developers.miro.com/docs/x" });

describe("QA-7: user-generated hosts are never official", () => {
  it.each([
    ["https://community.miro.com/t/oauth", miro],
    ["https://community.calendly.com/x", officialDomainsFor({ slug: "calendly", website: "https://calendly.com" })],
    ["https://forum.miro.com/x", miro],
    ["https://answers.microsoft.com/x", officialDomainsFor({ slug: "microsoft", website: "https://microsoft.com" })],
    ["https://techcommunity.microsoft.com/x", officialDomainsFor({ slug: "outlook", website: "https://outlook.com" })],
    ["https://groups.google.com/g/x", officialDomainsFor({ slug: "gmail", website: "https://gmail.com" })],
    ["https://sites.google.com/view/x", officialDomainsFor({ slug: "google", website: "https://workspace.google.com" })],
    ["https://storage.googleapis.com/bucket/doc.html", officialDomainsFor({ slug: "google", website: "https://workspace.google.com" })],
    ["https://randomteam.slack.com/archives/C1", officialDomainsFor({ slug: "slack", website: "https://slack.com" })],
  ])("%s", (url, domains) => {
    expect(isOfficialUrl(url, domains)).toBe(false);
  });

  it("keeps Slack's own hosts official", () => {
    const d = officialDomainsFor({ slug: "slack", website: "https://slack.com" });
    for (const u of ["https://slack.com/apps", "https://api.slack.com/authentication", "https://docs.slack.com/x", "https://docs.slack.dev/x"]) {
      expect(isOfficialUrl(u, d)).toBe(true);
    }
  });

  it("GitHub: user repos are not official; docs.github.com, GitHub pages and the app's own org are", () => {
    const gh = officialDomainsFor({ slug: "github", website: "https://github.com", docsUrl: "https://docs.github.com/en/apps/oauth-apps" });
    expect(isOfficialUrl("https://docs.github.com/en/apps", gh)).toBe(true);
    expect(isOfficialUrl("https://github.com/settings/developers", gh)).toBe(true);
    expect(isOfficialUrl("https://github.com/github/docs/blob/main/x.md", gh)).toBe(true);
    expect(isOfficialUrl("https://github.com/someuser/oauth-notes", gh)).toBe(false);
    expect(isOfficialUrl("https://raw.githubusercontent.com/someuser/x/main/README.md", gh)).toBe(false);

    expect(isOfficialUrl("https://github.com/miro/api-clients", miro)).toBe(true);
    expect(isOfficialUrl("https://github.com/randomdev/miro-oauth", miro)).toBe(false);

    const hosted = officialDomainsFor({ slug: "acme", website: "https://acme.com", docsUrl: "https://github.com/acme-inc/api-docs" });
    expect(isOfficialUrl("https://github.com/acme-inc/api-docs/wiki", hosted)).toBe(true);
    expect(isOfficialUrl("https://github.com/other/api-docs", hosted)).toBe(false);
  });
});

describe("QA-7: registrable domains", () => {
  it("keeps 3 labels for 2-level public suffixes", () => {
    expect(registrable("developer.acme.co.uk")).toBe("acme.co.uk");
    expect(registrable("api.acme.com.au")).toBe("acme.com.au");
    expect(registrable("developers.miro.com")).toBe("miro.com");
  });

  it("treats shared hosting platforms as full-host only", () => {
    expect(registrable("acme.github.io")).toBe("acme.github.io");
    expect(registrable("acme.vercel.app")).toBe("acme.vercel.app");
    const d = officialDomainsFor({ slug: "acme", website: "https://acme.netlify.app" });
    expect(isOfficialUrl("https://acme.netlify.app/docs", d)).toBe(true);
    expect(isOfficialUrl("https://evil.netlify.app/docs", d)).toBe(false);
  });

  it("does not trust a co.uk sibling", () => {
    const d = officialDomainsFor({ slug: "acme", website: "https://www.acme.co.uk" });
    expect(isOfficialUrl("https://docs.acme.co.uk/x", d)).toBe(true);
    expect(isOfficialUrl("https://other.co.uk/x", d)).toBe(false);
  });
});

describe("QA-7: guessed websites", () => {
  it("does not add a guessed website domain", () => {
    const d = officialDomainsFor({ slug: "foo", website: "https://foo.com", websiteGuessed: true });
    expect(isOfficialUrl("https://foo.com/docs", d)).toBe(false);
    const withDocs = officialDomainsFor({ slug: "foo", website: "https://foo.com", websiteGuessed: true, docsUrl: "https://dev.foo.io/oauth" });
    expect(isOfficialUrl("https://dev.foo.io/oauth/scopes", withDocs)).toBe(true);
  });
});

describe("QA-8: provider table", () => {
  it.each([
    ["youtube", "https://youtube.com", "https://developers.google.com/youtube/v3/guides/authentication"],
    ["outlook", "https://outlook.com", "https://learn.microsoft.com/en-us/graph/auth"],
    ["one-drive", "https://onedrive.com", "https://learn.microsoft.com/x"],
    ["onenote", "https://onenote.com", "https://learn.microsoft.com/x"],
    ["microsoft-todo", "https://todo.microsoft.com", "https://learn.microsoft.com/x"],
    ["microsoft-teams", "https://teams.microsoft.com", "https://learn.microsoft.com/x"],
    ["linkedin", "https://linkedin.com", "https://learn.microsoft.com/en-us/linkedin/shared/authentication"],
    ["bitbucket", "https://bitbucket.org", "https://developer.atlassian.com/cloud/bitbucket/oauth-2"],
    ["trello", "https://trello.com", "https://developer.atlassian.com/cloud/trello"],
    ["jira", "https://www.atlassian.com/software/jira", "https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps"],
    ["confluence", "https://www.atlassian.com/software/confluence", "https://developer.atlassian.com/cloud/confluence"],
  ])("%s accepts %s docs at %s", (slug, website, url) => {
    expect(isOfficialUrl(url, officialDomainsFor({ slug, website }))).toBe(true);
  });
});
