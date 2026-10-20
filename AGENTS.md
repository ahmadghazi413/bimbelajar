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
- Referral settings default to zero discount with inviter rewards disabled until the administrator chooses amounts, avoiding unapproved financial commitments.
- Referral codes apply once per invited account and never to their owner; credits are reserved by pending enrollments and released when rejected to prevent concurrent double spending.
- Class and subject deletion is guarded in PostgreSQL to preserve enrollment history and prevent orphaned classes; empty classes may be permanently deleted with their sessions and recordings.
- Session publication is enforced by RLS on sessions and recordings; admin queries retain access to drafts while student views only receive published sessions.
