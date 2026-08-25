import { AppIcon } from "@/components/ui/AppIcon";

type MetricCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  icon?: "clients" | "clock" | "bell";
};

function MetricIcon({ icon }: { icon?: MetricCardProps["icon"] }) {
  return icon ? <AppIcon name={icon} /> : null;
}

export function MetricCard({ label, value, detail, tone = "neutral", icon }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      {icon ? <span className="metric-card__icon"><MetricIcon icon={icon} /></span> : null}
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </article>
  );
}
