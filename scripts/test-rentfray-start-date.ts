import { getRentDateSummary } from "../lib/rentDates";

function date(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function assert(
  name: string,
  condition: boolean,
  detail: string
): void {
  if (!condition) {
    console.error(`FAIL: ${name}`);
    console.error(`      ${detail}`);
    process.exitCode = 1;
    return;
  }

  console.log(`PASS: ${name}`);
}

const common = {
  dueDay: 1,
  gracePeriodDays: 5,
  lateFeeEnabled: true,
  lateFeeInitialCents: 7500,
  lateFeeDailyCents: 1000,
  maxLateFeeDays: 5,
  rentFrayStartDate: date("2026-09-01"),
};

// Test 1: Existing tenant activates before RentFray starts.
const beforeStart = getRentDateSummary({
  ...common,
  now: date("2026-08-15"),
});

assert(
  "Before start date: RentFray has not started",
  beforeStart.hasStarted === false,
  JSON.stringify(beforeStart, null, 2)
);

assert(
  "Before start date: first due date remains 09/01/2026",
  beforeStart.dueDate === "2026-09-01",
  JSON.stringify(beforeStart, null, 2)
);

assert(
  "Before start date: September is the first cycle",
  beforeStart.billingCycle === "2026-09",
  JSON.stringify(beforeStart, null, 2)
);

// Test 2: Start date arrives.
const onStart = getRentDateSummary({
  ...common,
  now: date("2026-09-01"),
});

assert(
  "On 09/01: RentFray has started",
  onStart.hasStarted === true,
  JSON.stringify(onStart, null, 2)
);

assert(
  "On 09/01: current due date is 09/01/2026",
  onStart.dueDate === "2026-09-01",
  JSON.stringify(onStart, null, 2)
);

assert(
  "On 09/01: next due date is 10/01/2026",
  onStart.nextDueDate === "2026-10-01",
  JSON.stringify(onStart, null, 2)
);

// Test 3: Grace and late-fee dates.
const afterGrace = getRentDateSummary({
  ...common,
  now: date("2026-09-07"),
});

assert(
  "Five-day grace period ends 09/05/2026",
  afterGrace.graceEndsOn === "2026-09-05",
  JSON.stringify(afterGrace, null, 2)
);

assert(
  "Initial late fee date is 09/06/2026",
  afterGrace.initialLateFeeDate === "2026-09-06",
  JSON.stringify(afterGrace, null, 2)
);

assert(
  "On 09/07: account is past grace",
  afterGrace.isDelinquent === true,
  JSON.stringify(afterGrace, null, 2)
);

// Test 4: Move-in assumption.
const septemberDueDate = date(onStart.dueDate);
const septemberMoveIn = date("2026-09-14");
const octoberMoveIn = date("2026-08-28");

assert(
  "09/14 move-in skips September",
  septemberMoveIn > septemberDueDate,
  `Move-in: ${septemberMoveIn}; due: ${septemberDueDate}`
);

assert(
  "08/28 move-in owes September",
  octoberMoveIn <= septemberDueDate,
  `Move-in: ${octoberMoveIn}; due: ${septemberDueDate}`
);

console.log("");
console.log("Calculated date authority:");
console.log(JSON.stringify({
  beforeStart,
  onStart,
  afterGrace,
}, null, 2));

if (!process.exitCode) {
  console.log("");
  console.log("ALL RENTFRAY START-DATE AUTHORITY TESTS PASSED");
}

