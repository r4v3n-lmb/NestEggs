import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
};

export default function SectionCard({ title, subtitle, right, children }: Props) {
  return (
    <section className="section-card">
      <header className="section-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </header>
      {children}
    </section>
  );
}
