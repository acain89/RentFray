# Partial-return reconciliation exceptions

A verified Stripe event can describe a partial return of a payment containing both tenant principal and a platform fee. The application cannot establish their allocation from that aggregate amount. It deliberately rolls back its financial transaction and returns HTTP 503.

## Durable evidence

The existing `AuditLog` receives an immutable marker after rollback:

- Action: `STRIPE_PARTIAL_RETURN_RECONCILIATION_REQUIRED`.
- ID: `stripe-partial-return:<Stripe event ID>`. Redelivery of the same event does not create another marker.
- Property and Payment links come from the validated stored payment, not refund metadata.
- Metadata contains only the event ID/type, verified Intent ID, and fixed reason code. No raw provider object, customer information, banking details, or inferred allocation is stored.

The marker is evidence, not an event-success acknowledgement or a financial adjustment. HTTP 503 remains unchanged even when recording fails. Failed persistence logs a fixed diagnostic and permits subsequent delivery to retry. This change does not backfill earlier events or alter existing payments, ledger entries, refunds, transfers, or reconciliation rules.

## Operator recovery procedure

1. Assign an operator to review these markers through existing authorized database access. The current manager audit-log endpoint does not expose them. No worker, alert, scheduled job, or new UI is added.
2. Use a read-only query such as the following. This document does not authorize a database connection or any writes:

   ```sql
   SELECT "id", "createdAt", "propertyId", "targetId", "metadataJson"
   FROM "AuditLog"
   WHERE "action" = 'STRIPE_PARTIAL_RETURN_RECONCILIATION_REQUIRED'
   ORDER BY "createdAt" DESC;
   ```

3. Group related events by Payment. Review the existing immutable quote and authorized provider evidence, including refunds and disputes. Do not derive principal allocation from refund size, fee percentages, event order, or an assumption that the fee is refunded first/last.
4. If current provider evidence later becomes unambiguous, an authorized operator may redeliver the original event through the existing signed-webhook mechanism. The unchanged financial handler re-reads provider state and performs its existing reconciliation. This implementation task does not authorize a production replay or provider operation.
5. If allocation remains ambiguous, leave the financial records unchanged and escalate for a separately approved, evidence-backed reconciliation procedure. Do not issue another refund or reverse a transfer merely to clear an exception.
6. Verify the latest handler result, current payment/ledger facts, and existing `PAYMENT_RECONCILED` evidence before considering recovery complete. A historical success audit alone does not prove that a later exception was resolved. Retain the exception marker as history; it is not an automatically maintained open/closed work queue.

Operational ownership and review frequency must be established before relying on this safeguard. Provider retries are not a substitute for reviewing durable exceptions. Production persistence, earlier exceptions, and live provider delivery were not inspected during implementation.
