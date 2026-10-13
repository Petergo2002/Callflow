import { expect, it } from "vitest";
import { makeLead } from "../src/lib/model";
import {
  exactPhoneMatch,
  matchesLead,
  searchLeads,
} from "../src/lib/lead-search";
const lead = (companyName: string, phone: string) =>
  makeLead({
    companyName,
    phone,
    website: "",
    city: "Göteborg",
    industry: "Bygg",
    contactName: "Anna",
    notes: "",
    status: "Inget svar",
  });
it("finds Swedish callback numbers across formats and partial numbers", () => {
  const company = lead("Björk AB", "070-123 45 67");
  for (const query of [
    "0701234567",
    "+46 70 123 45 67",
    "0046701234567",
    "+46 (0)70 1234567",
    " 070-123 45 67 ",
  ]) {
    expect(matchesLead(company, query)).toBe(true);
    expect(exactPhoneMatch(company, query)).toBe(true);
  }
  for (const query of [
    "070123",
    "1234567",
    "Björk",
    "anna",
    "göteborg",
    "Bygg",
  ])
    expect(matchesLead(company, query)).toBe(true);
  expect(matchesLead(company, "0709999999")).toBe(false);
  expect(matchesLead(company, "   ")).toBe(true);
});
it("ranks exact numbers before partial matches and keeps multiple companies visible", () => {
  const exact = lead("Öster AB", "0701234567");
  const another = lead("Återringning AB", "+46701234567");
  const partial = lead("A AB", "07012345678");
  expect(
    searchLeads([partial, exact, another], "0701234567").map((l) => l.id),
  ).toEqual([another.id, exact.id, partial.id]);
});
