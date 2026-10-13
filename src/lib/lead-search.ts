import { Lead, normalizePhone, leadPhones } from "./model";

function phoneQuery(query: string) {
  const value = query.trim();
  return /^[+\d\s()./-]+$/.test(value) && value.replace(/\D/g, "").length >= 3
    ? normalizePhone(value).replace(/\D/g, "")
    : "";
}
export function exactPhoneMatch(lead: Lead, query: string) {
  const phone = phoneQuery(query);
  return (
    !!phone && leadPhones(lead).some((p) => phone === p.replace(/\D/g, ""))
  );
}
export function matchesLead(lead: Lead, query: string) {
  const text = query.trim().toLocaleLowerCase("sv");
  if (!text) return true;
  if (
    [
      lead.companyName,
      lead.phone,
      lead.city,
      lead.contactName,
      lead.industry,
      ...(lead.alternateNames || []),
    ].some((v) => v.toLocaleLowerCase("sv").includes(text))
  )
    return true;
  const phone = phoneQuery(query);
  return (
    !!phone &&
    leadPhones(lead).some((p) => p.replace(/\D/g, "").includes(phone))
  );
}
export function searchLeads(leads: Lead[], query: string) {
  return leads
    .filter((l) => matchesLead(l, query))
    .sort(
      (a, b) =>
        Number(exactPhoneMatch(b, query)) - Number(exactPhoneMatch(a, query)) ||
        a.companyName.localeCompare(b.companyName, "sv"),
    );
}
