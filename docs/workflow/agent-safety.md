# Agent safety

- **Do not give broad repo access** beyond what the task needs. Use role lanes (subagent-*) so agents only touch allowed paths.
- **Background agents** have internet and can run terminal commands automatically. Use them for well-scoped, isolated tasks (one issue, one slice). Do not let them deploy to production or change prod configs unless explicitly requested.
- **Never put production secrets** in prompts, issues, or PR descriptions. Use .env.example for placeholders only; document required env vars in docs or handoff, not the actual values.
- **Never let agents deploy to production** automatically. Deployment and production config changes require explicit human or org approval.
- **If a task is ambiguous or crosses boundaries**, stop and ask; do not guess. Prefer a short implementation plan (plan-issue) before coding.
