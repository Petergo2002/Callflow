"use client";
import { useEffect, useMemo, useState } from "react";
import { Data, Lead } from "@/lib/model";
import { workNow, nextStepText, attemptLabel } from "@/lib/lead-intelligence";
import { Button } from "./ui/button";
import { StatusBadge } from "./shared";

export function WorkNow({
  data,
  onOpen,
}: {
  data: Data;
  onOpen: (lead: Lead) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [limit, setLimit] = useState(5);
  const [filter, setFilter] = useState("all");
  const items = useMemo(() => workNow(data, new Date(now)), [data, now]);
  const visible = items.filter(
    (item) => filter === "all" || item.action === filter,
  );
  return (
    <section className="panel mt-6" aria-label="Gör detta nu">
      <div className="panel-header">
        <div>
          <h2>Gör detta nu</h2>
          <p>
            Förfallna löften först, sedan leads utan nästa steg och nya
            kontakter.
          </p>
        </div>
        <span className="key">{items.length}</span>
      </div>
      <div className="panel-body">
        <div
          className="flex flex-wrap mb-3"
          role="group"
          aria-label="Välj typ av nästa åtgärd"
        >
          {[
            ["all", "Alla"],
            ["plan", "Saknar nästa steg"],
            ["call", "Ring"],
            ["offer", "Offert"],
            ["wait", "Kontrollera svar"],
          ].map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "secondary"}
              onClick={() => {
                setFilter(value);
                setLimit(5);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        {visible.slice(0, limit).map((item) => (
          <button
            className="priority-row w-full"
            key={item.lead.id}
            onClick={() => onOpen(item.lead)}
          >
            <div className="priority-text">
              <strong>{item.lead.companyName}</strong>
              <p>
                {item.reason} ·{" "}
                {item.action === "call"
                  ? item.lead.phone
                  : nextStepText(item.lead)}
              </p>
              <p>{attemptLabel(data, item.lead.id)}</p>
            </div>
            <StatusBadge status={item.lead.status} />
            <span className="table-link">
              {item.action === "plan" ? "Planera" : "Öppna"}
            </span>
          </button>
        ))}
        {!visible.length && (
          <p className="footnote">
            Inget att göra just nu i det här urvalet. Framtida steg visas när
            tiden infaller.
          </p>
        )}
        {visible.length > limit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLimit(limit + 10)}
          >
            Visa fler ({visible.length - limit} kvar)
          </Button>
        )}
      </div>
    </section>
  );
}
