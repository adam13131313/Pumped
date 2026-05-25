# Commitment definition for the extraction spike

The ground-truth definition the spike scores against. **Keep in sync with the system prompt in the extraction harness.**

## A commitment is

An actionable obligation a person now holds. It must be:

1. **Actionable** — something a human can do, not a state of affairs
2. **Owned by someone** — the recipient of the email, the sender, or a named third party
3. **Forward-looking** — not yet done

It can arrive any of these ways:

- **Implicitly accepted by me** — "Yes, I'll send the draft Friday"
- **Explicitly asked of me** — "Can you send the draft Friday?" sent to me, with reasonable expectation I'll act
- **Tracked as owed to me** — "Sarah will send the draft Friday"
- **System-routed to me** — assigned task from Jira / Linear / Asana / ERP webhook (not in scope for THIS spike — bypasses LLM extraction)

## Not commitments

- Questions without an action ("What do you think?")
- FYIs / status updates
- Past tense / already-completed work
- Social pleasantries ("Looking forward to it")
- Conditional intentions without acceptance ("We could maybe do X if Y")
- Calendar invites (handled by calendar integration, not extraction)
- Automated digests, newsletters, system mail

## Edge cases (to align on during ground-truth labeling)

- **Reminders** ("Don't forget X") — count as commitment IF the recipient hasn't already done it
- **Multi-step requests** — split into separate commitments only if each step is independently actionable
- **Vague requests** ("Let's catch up") — not a commitment unless tied to a specific action
- **CC'd asks** — only a commitment for the To: recipient unless the sender explicitly addresses the CC'd person
- **Forwarded chains** — extract from the most recent message only, use earlier messages as context

## What good extraction looks like

For each commitment:
- **task**: starts with a verb, specific enough to act on
- **owner**: me / sender name / third-party name (the spike uses "me" vs "other" for simplicity)
- **dueDate**: ISO date if a deadline is mentioned (relative dates like "Friday" resolved to absolute)
- **priority**: high (urgent/blocking), medium (default), low (nice-to-have)
- **source_quote**: the exact phrase from the email that produced this commitment (for traceability)
