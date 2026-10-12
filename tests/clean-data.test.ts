import { it, expect } from "vitest";
import { emptyData, makeLead } from "../src/lib/model";
import { withoutDemo } from "../src/lib/clean-data";
import { demoData } from "../src/lib/demo";
it("removes marked demo history and XP while preserving real leads, calls and settings", () => {
  const original = demoData();
  const real = makeLead({
    companyName: "Mitt riktiga företag",
    phone: "0701234567",
    website: "",
    industry: "",
    city: "",
    contactName: "",
    notes: "Behåll mig",
    status: "Kund",
  });
  original.leads.push(real);
  const call = {
    id: "real-call",
    leadId: real.id,
    outcome: "Kund" as const,
    notes: "Egen historik",
    createdAt: new Date().toISOString(),
  };
  original.calls.push(call);
  const xp = {
    id: "real-xp",
    sourceEventId: call.id,
    type: "customer" as const,
    points: 100,
    createdAt: call.createdAt,
  };
  original.xp.push(xp);
  const cleaned = withoutDemo(original);
  expect(cleaned.leads).toEqual([real]);
  expect(cleaned.calls).toEqual([call]);
  expect(cleaned.xp).toEqual([xp]);
  expect(cleaned.followUps).toEqual([]);
  expect(cleaned.batches).toEqual([]);
  expect(cleaned.settings).toEqual(original.settings);
  expect(original.leads.length).toBeGreaterThan(1);
});
it("leaves an existing real workspace and an empty workspace untouched", () => {
  const empty = emptyData();
  expect(withoutDemo(empty)).toBe(empty);
});
