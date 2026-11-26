# Regression restoration: accepted historical deltas

These exceptions are fixed historical objects, never a blanket acceptance of HEAD.

- `58cd0911d3e85e24e5eb99e8da8dff76132c7b1a`: webhook partial-return reconciliation evidence. Preserves financial facts, retains retryable ambiguity and durable audit evidence. Covered by partial-refund-exceptions tests.
- `8fd17bb4bcfe39be3444a354f80f71b380094a3e`: Checkout provider error redaction. Preserves authorization, amounts and status handling while suppressing raw provider details. Covered by checkout-error-redaction tests.
- `4f0133e257c875f57c9fad2076b5b634f6ce6d28`: redirect obsolete tenant payment page to the authenticated dashboard, without creating a payment. Covered by tenant-pay-redirect tests.
- `4107472279e3f5cb4e095bf6e867a494479342ff`: admit only static /terms and /privacy pages. Existing private and lookalike route protections remain covered by public-legal-page-access tests.

The original protected-file lists, exact comparisons and negative mutation assertions remain required. The strict retention loader now supplies the real production grace-period module; all 337 existing focused retention assertions pass before any application changes.
