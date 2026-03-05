import { Hono } from "hono";
import { loadProjectClaudeSkills } from "../skills/loader";

function getRepoRoot(): string {
  // In dev, server runs with cwd = {repoRoot}/packages/server.
  // In prod, it also runs from the server package directory.
  // Going up two levels yields the repo root.
  return new URL("../../", `file://${process.cwd()}/`).pathname.replace(/\/$/, "");
}

export function skillsRoutes() {
  const routes = new Hono();

  routes.get("/", (c) => {
    const skills = loadProjectClaudeSkills(getRepoRoot());
    return c.json({ skills });
  });

  return routes;
}
