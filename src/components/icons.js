import {
  AlertCircle, AlertTriangle, ArrowLeft, Award, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, ClipboardCheck, Clock3, Download,
  Edit3, Eye, FileClock, FileText, Gavel, History, Home, Info, LayoutDashboard,
  ListChecks, LockKeyhole, LogOut, MapPin, Menu, Minus, MoreHorizontal, Plus, Radio,
  RefreshCw, Save, Search, Settings, ShieldAlert, Sparkles, Trophy, UserCog, Users,
  WifiOff, X, XCircle,
  createIcons,
} from 'lucide';

const icons = {
  AlertCircle, AlertTriangle, ArrowLeft, Award, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, ClipboardCheck, Clock3, Download,
  Edit3, Eye, FileClock, FileText, Gavel, History, Home, Info, LayoutDashboard,
  ListChecks, LockKeyhole, LogOut, MapPin, Menu, Minus, MoreHorizontal, Plus, Radio,
  RefreshCw, Save, Search, Settings, ShieldAlert, Sparkles, Trophy, UserCog, Users,
  WifiOff, X, XCircle,
};

export function refreshIcons(root = document) {
  createIcons({ icons, attrs: { 'aria-hidden': 'true', 'stroke-width': 1.8 }, root });
}
