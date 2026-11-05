<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Referral codes and credits live in protected referral tables; enrollment triggers authoritatively quote discounts, reserve credits and issue idempotent rewards after payment, so client input cannot grant discounts or rewards.
- Teacher assignments remain admin-written settings checked by the database is_teacher function; classIds and explicit allClasses share the same meaning in UI and RLS to avoid mismatched access.
- Public teacher identity exposes only name, ID and photo path through a narrow RPC; photos stay in private storage with signed read URLs to respect workspace storage policy.
- Password recovery callbacks are preserved and sent to the public reset page before ordinary post-login navigation; one root identity subscriber owns recovery events.
- Referral settings default to zero discount with inviter rewards disabled until the administrator chooses amounts, avoiding unapproved financial commitments.
- Referral codes apply once per invited account and never to their owner; credits are reserved by pending enrollments and released when rejected to prevent concurrent double spending.
- Class and subject deletion is guarded in PostgreSQL to preserve enrollment history and prevent orphaned classes; empty classes may be permanently deleted with their sessions and recordings.
- Session publication is enforced by RLS on sessions and recordings; admin queries retain access to drafts while student views only receive published sessions.
- Payment proofs use unique private storage paths and an ownership-validating submit RPC; admin deletion removes the file then conditionally clears its matching pointer, never payment status or history. Shared proof controls prefetch a Blob for previews and activation-safe downloads.
- Payment uploads are staged privately before confirmation; only the explicit confirmation action creates the enrollment and attaches its proof through the existing ownership-validating RPC.
- Account signup and old-password changes use shared client/server schemas and isolated publishable auth clients; password changes authenticate the supplied credentials without replacing the browser session.
- Signup metadata populates profile contact fields through the existing auth lifecycle trigger so unconfirmed accounts retain their registration details.
