import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn";
  helper?: ReactNode;
};

export default function KpiCard({ label, value, tone = "default", helper }: Props) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {helper ? <p className="kpi-helper">{helper}</p> : null}
    </article>
  );
}
