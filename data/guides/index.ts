// Static registry of published guides (no runtime fs). Add one import per guide.
import github from "./github.json";
import gmail from "./gmail.json";
import instagram from "./instagram.json";
import notion from "./notion.json";
import slack from "./slack.json";

export const rawGuides: unknown[] = [github, notion, slack, gmail, instagram];
