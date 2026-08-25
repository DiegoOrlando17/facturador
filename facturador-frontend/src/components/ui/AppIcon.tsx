import {
  AlertTriangle,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileCheck2,
  FileText,
  Filter,
  Headphones,
  HelpCircle,
  Home,
  Lock,
  LogOut,
  Mail,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  User,
  UserPlus,
  Users,
} from "lucide-react";

export type AppIconName =
  | "account"
  | "admins"
  | "alert"
  | "bell"
  | "check"
  | "check-circle"
  | "clients"
  | "clock"
  | "credit-card"
  | "download"
  | "filter"
  | "help"
  | "home"
  | "integrations"
  | "invoice"
  | "lock"
  | "logout"
  | "mail"
  | "onboarding"
  | "payments"
  | "refresh"
  | "reports"
  | "search"
  | "settings"
  | "shield"
  | "tax";

const icons = {
  account: User,
  admins: Users,
  alert: AlertTriangle,
  bell: Bell,
  check: Check,
  "check-circle": CheckCircle2,
  clients: Users,
  clock: Clock,
  "credit-card": CreditCard,
  download: Download,
  filter: Filter,
  help: HelpCircle,
  home: Home,
  integrations: ShieldCheck,
  invoice: FileText,
  lock: Lock,
  logout: LogOut,
  mail: Mail,
  onboarding: UserPlus,
  payments: CreditCard,
  refresh: RefreshCcw,
  reports: BarChart3,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
  tax: FileCheck2,
} satisfies Record<AppIconName, typeof Home>;

export function AppIcon({ name }: { name: AppIconName }) {
  const Icon = icons[name] ?? Headphones;

  return <Icon aria-hidden="true" />;
}
