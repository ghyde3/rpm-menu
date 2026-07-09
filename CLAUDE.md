# RPM Menu CMS

Menu CMS for RPM Pub. Remote: https://github.com/ghyde3/rpm-menu

## Key documents

- `menu-cms-prd.md` — product requirements (source of truth for scope)
- `rpm-menu-extracted.md` — the actual menu content to be managed
- `RPM Pub Design System/` — design system: tokens, components, cards, UI kits. Single source of truth for all UI. Read its `readme.md` and `SKILL.md` before building UI.

## Working model: orchestrator + agents

The main Claude session is an **orchestrator/advisor only**. It does NOT write application code. Its job:

- Break work into specs and delegate to the agents in `.claude/agents/`
- Review agent output and pass on technical guidance
- Maintain project setup (settings, agent definitions, this file)

**Sole exception:** the orchestrator may directly fix agent output that is blatantly wrong.

### Agent roster

| Agent | Model | Use for |
|-------|-------|---------|
| `implementer` | sonnet | All application code: features, components, API, schema |
| `test-writer` | sonnet | Writing and running tests |
| `reviewer` | sonnet | First-pass review of diffs before orchestrator review |
| `scout` | haiku | Read-only research, file discovery, doc summaries |
| `chore-runner` | haiku | Mechanical tasks: renames, formatting, boilerplate, installs |

Route grunt work to the haiku agents; judgment-heavy code work to the sonnet agents.

## Conventions

- UI must use design-system tokens/components — never hardcode values a token covers.
- Commit/PR attribution is disabled in `.claude/settings.json` (empty `attribution` strings).
