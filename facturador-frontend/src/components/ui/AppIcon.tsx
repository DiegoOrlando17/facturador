import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleX,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  Filter,
  HelpCircle,
  Home,
  Inbox,
  Info,
  Lock,
  LogOut,
  Mail,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  SearchX,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";

export type AppIconName =
  | "account"
  | "admins"
  | "alert"
  | "alert-circle"
  | "arrow-right"
  | "bell"
  | "check"
  | "check-circle"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "clients"
  | "clock"
  | "close"
  | "copy"
  | "credit-card"
  | "download"
  | "error"
  | "external"
  | "eye"
  | "eye-off"
  | "filter"
  | "help"
  | "home"
  | "inbox"
  | "info"
  | "integrations"
  | "invoice"
  | "lock"
  | "logout"
  | "mail"
  | "money"
  | "onboarding"
  | "payments"
  | "plus"
  | "receipt"
  | "refresh"
  | "reports"
  | "search"
  | "search-empty"
  | "settings"
  | "shield"
  | "tax"
  | "trash";

const icons = {
  account: User,
  admins: Users,
  alert: AlertTriangle,
  "alert-circle": CircleAlert,
  "arrow-right": ArrowRight,
  bell: Bell,
  check: Check,
  "check-circle": CheckCircle2,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  clients: Users,
  clock: Clock,
  close: X,
  copy: Copy,
  "credit-card": CreditCard,
  download: Download,
  error: CircleX,
  external: ExternalLink,
  eye: Eye,
  "eye-off": EyeOff,
  filter: Filter,
  help: HelpCircle,
  home: Home,
  inbox: Inbox,
  info: Info,
  integrations: ShieldCheck,
  invoice: FileText,
  lock: Lock,
  logout: LogOut,
  mail: Mail,
  money: Wallet,
  onboarding: UserPlus,
  payments: CreditCard,
  plus: Plus,
  receipt: Receipt,
  refresh: RefreshCcw,
  reports: BarChart3,
  search: Search,
  "search-empty": SearchX,
  settings: Settings,
  shield: ShieldCheck,
  tax: FileCheck2,
  trash: Trash2,
} satisfies Record<AppIconName, typeof Home>;

type AppIconProps = {
  name: AppIconName;
  className?: string;
  /** Tamaño en px. Sin valor, el tamaño lo define el CSS del contenedor. */
  size?: number;
};

export function AppIcon({ name, className, size }: AppIconProps) {
  const Icon = icons[name] ?? HelpCircle;

  return <Icon aria-hidden="true" focusable="false" className={className} size={size} />;
}
