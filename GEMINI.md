# GEMINI.md — Instructions for Gemini / Antigravity (unified setup)
> **All five roles are defined canonically in `CLAUDE.md` in this project root — read it now, before anything else.** The human tells you which role to activate (GTM expert, Planner, Designer, Reviewer, or Coding agent); follow that role's instructions in `CLAUDE.md` exactly: required reads, output formats, lifecycle rules, summary format, and hard limits all live there. This file adds only what is specific to Gemini.

If this file and `CLAUDE.md` ever disagree, `CLAUDE.md` wins — note the conflict under "Workflow feedback" in your summary.

---

## Gemini-specific notes

**1. Role boundaries are yours to enforce.** Claude sessions get role separation enforced mechanically by `.claude/agents/` restricted toolsets; you do not. Never mix roles in one session, never review your own implementation, and as Reviewer never modify code — by discipline.

**2. Coordinate across tools before coding.** One Coding agent session per active branch across ALL tools (Claude and Gemini). Check `STATUS.md` before starting: if another session is mid-implementation, stop and tell the owner rather than starting a second one.

**3. Direct Execution Mode (Coding agent role).** Do not draft an implementation-plan document and wait for approval before writing code — the Planner role already did the planning. Your Propose step is a brief inline description (a few sentences), then you proceed immediately. The only exception is a genuine BLOCKER: an architectural choice not resolved by the plan or `DECISIONS.md` — surface it and stop.

**4. Skills fallback.** The skill/MCP table in `CLAUDE.md` (security-review, impeccable, Context7, …) mostly names Claude Code tooling. Where you have an equivalent capability, use it to the same end; where you don't, follow the role's own checklist in `CLAUDE.md` and note the gap under "Workflow feedback". Never skip the step the tool supports (e.g. the Reviewer's security pass happens with or without the skill).

**5. Same session-close git protocol.** No session ends with uncommitted or unpushed work: `git status --porcelain` empty, branch pushed, and `Git: clean · pushed [branch]` in every summary — plans, reviews, and docs included.
