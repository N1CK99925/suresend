# User onboarding plan

Per the original idea doc's roadmap: don't go broad. Find one diaspora
community with one real school back home willing to pilot, and get
10–20 real families using it — that's worth more than a landing page
with a thousand signups.

## Recruiting the pilot group

1. Identify one diaspora community group (WhatsApp/Facebook group,
   local mosque/temple/church community board, or a remittance
   agent's existing customer base) tied to one specific school.
2. Get the school itself to agree to be the pilot merchant — this is
   the hard prerequisite; the product doesn't mean anything without a
   real redemption point.
3. Recruit 10–20 sending families through that community, not cold
   outreach.

## Onboarding script (what to walk each family through)

1. Install a Stellar wallet (Freighter browser extension, or
   whichever the pilot standardizes on) and fund it with a small
   amount of testnet/pilot stablecoin.
2. Walk them through one real "Send" flow end to end: category ->
   merchant -> amount -> fallback -> sign.
3. Show them the Recipient view on their family member's device (or
   your screen) so they see what "earmarked, redeemable at X" looks
   like from the other side.
4. Ask them to fill out the in-app feedback widget right after.

## Proof-of-usage for the submission checklist

For each participant, capture:
- Wallet address used
- Screenshot or tx hash of at least one `create_lock` (and ideally
  one `claim`) they performed
- Their feedback widget submission (aggregated automatically under
  the "Pilot stats" tab in the app)

Track these in a simple table (see `docs/FEEDBACK_TEMPLATE.md` for a
ready-made one) — that table plus screenshots is what satisfies
"Proof of 10+ user wallet interactions."

## What this scaffold cannot do for you

Recruiting real families, getting a real school to agree to be a
pilot merchant, and collecting their actual usage are outside what
can be generated — they require you to actually run the pilot. This
doc, the feedback widget, and the pilot-stats view are the tooling to
make that pilot easy to run and easy to document, not a substitute
for running it.
