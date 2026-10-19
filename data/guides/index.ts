// Static registry of published guides (no runtime fs). Add one import per guide.
import github from "./github.json";
import notion from "./notion.json";

export const rawGuides: unknown[] = [github, notion];
