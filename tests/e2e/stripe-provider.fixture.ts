import { expect } from "@playwright/test";
import type Stripe from "stripe";
import { requiredMapValue } from "../fixture-assertions";
export type CheckoutParams = Omit<Stripe.Checkout.SessionCreateParams, "metadata" | "line_items"> & {
 metadata: Record<string, string>;
 line_items: (Omit<Stripe.Checkout.SessionCreateParams.LineItem, "price_data"> & {
  price_data: Omit<Stripe.Checkout.SessionCreateParams.LineItem.PriceData, "unit_amount"> & { unit_amount: number };
 })[];
};
type Session = Pick<Stripe.Checkout.Session, "id" | "status" | "url" | "payment_intent" | "amount_total"> & { metadata: Record<string, string> };
type Intent = Pick<Stripe.PaymentIntent, "id" | "status" | "amount" | "amount_received" | "currency"> & {
 metadata: Record<string, string>; payment_method_types: string[]; latest_charge: string;
 on_behalf_of: string; transfer_data: { destination: string }; last_payment_error: (Omit<Partial<Stripe.PaymentIntent.LastPaymentError>, "code"> & { code?: string }) | null;
};
export type EventObject = Partial<Intent> & { id: string; payment_intent?: string; charge?: string };
type Refund = Partial<Stripe.Refund> & Pick<Stripe.Refund, "id" | "charge" | "currency" | "amount">;
type Dispute = Omit<Partial<Stripe.Dispute>, "balance_transactions"> & Pick<Stripe.Dispute, "id" | "charge"> & {
 balance_transactions: (Partial<Stripe.BalanceTransaction> & Pick<Stripe.BalanceTransaction, "id" | "currency" | "amount">)[];
};
export function stripeProvider(fee: number, metadata: Record<string, string>) {
 const constructEvent: (body:string, signature:string, secret:string)=>unknown = (body:string):unknown=>JSON.parse(body);
 const intent: Intent = { id: "pi", status: "succeeded", amount: 150000 + fee, amount_received: 150000 + fee,
  currency: "usd", metadata, payment_method_types: ["us_bank_account"], latest_charge: "ch", on_behalf_of: "acct",
  transfer_data: { destination: "acct" }, last_payment_error: null };
 const refunds: Refund[] = [], disputes: Dispute[] = [], sessions = new Map<string, Session>();
 const creations: { params: CheckoutParams; key: string }[] = [], keys = new Map<string, { params: CheckoutParams; session: Session }>();
 let timeoutOnce = false;
 const iterable = <Row>(rows: Row[]) => ({ async *[Symbol.asyncIterator]() { for (const row of rows) yield structuredClone(row); } });
 const stripe = {
  webhooks: { constructEvent },
  paymentIntents: { retrieve: async () => structuredClone(intent) },
  charges: { retrieve: async () => ({ id: "ch", payment_intent: "pi", currency: "usd", amount: intent.amount, payment_method_details: { type: "us_bank_account" } }) },
  refunds: { list: () => iterable(refunds) },
  disputes: { list: () => iterable(disputes), retrieve: async (id: string) => structuredClone(disputes.find(dispute => dispute.id === id)) },
  checkout: { sessions: {
   retrieve: async (id: string) => { if (!sessions.has(id)) throw new Error("Unknown Checkout"); return structuredClone(requiredMapValue(sessions, id)); },
   create: async (params: CheckoutParams, options: { idempotencyKey: string }) => {
    const key = options.idempotencyKey; creations.push({ params: structuredClone(params), key });
    if (keys.has(key)) { const previous = requiredMapValue(keys, key); expect(params).toEqual(previous.params); return structuredClone(previous.session); }
    const session: Session = { id: "checkout-" + keys.size, status: "open", url: "https://isolated.invalid/pay", payment_intent: null,
     metadata: structuredClone(params.metadata), amount_total: params.line_items.reduce((sum, item) => sum + item.price_data.unit_amount, 0) };
    keys.set(key, { params: structuredClone(params), session }); sessions.set(session.id, session);
    if (timeoutOnce) { timeoutOnce = false; throw new Error("Ambiguous timeout AFTER Stripe created Session"); }
    return structuredClone(session);
   },
  } },
 };
 return { stripe, intent, refunds, disputes, sessions, creations, timeout: () => { timeoutOnce = true; } };
}
