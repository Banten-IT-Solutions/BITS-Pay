// ————————————————————————————————————————————————————————————
// BITS Pay — Shared Type Definitions
// Berdasarkan docs/DATABASE.md & docs/API.md
// ————————————————————————————————————————————————————————————

// ============================================================
// USER
// ============================================================
export type UserStatus = 'active' | 'suspended' | 'banned';
export type UserTier = 'free' | 'premium';

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  status: UserStatus;
  tier: UserTier;
  tier_expires_at: string | null;
  email_verified: number; // 0 | 1
  phone_verified: number; // 0 | 1
  google_id: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export type UserPublic = Pick<User, 'id' | 'email' | 'name' | 'avatar_url' | 'tier' | 'status'>;

export interface UserSignupInput {
  email: string;
  password: string;
  name: string;
}

export interface UserLoginInput {
  email: string;
  password: string;
}

// ============================================================
// EMAIL VERIFICATION
// ============================================================
export interface EmailVerification {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used: number; // 0 | 1
  created_at: string;
}

// ============================================================
// OAUTH STATE
// ============================================================
export interface OAuthState {
  id: string;
  state: string;
  redirect_to: string | null;
  expires_at: string;
  used: number; // 0 | 1
  created_at: string;
}

// ============================================================
// WORKSPACE
// ============================================================
export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: number; // 0 | 1
  created_at: string;
  updated_at: string;
}

export type MemberRole = 'owner' | 'admin' | 'member';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface WorkspaceWithMemberCount extends Workspace {
  member_count: number;
  app_count: number;
}

export interface WorkspaceCreateInput {
  name: string;
  slug: string;
  description?: string;
}

// ============================================================
// APP
// ============================================================
export interface App {
  id: string;
  workspace_id: string;
  name: string;
  api_key_hash: string;
  api_key_prefix: string;
  callback_url: string | null;
  is_active: number; // 0 | 1
  created_at: string;
  updated_at: string;
}

export interface AppPublic extends Omit<App, 'api_key_hash'> {
  api_key?: string; // hanya muncul saat create/rotate
}

export interface AppCreateInput {
  name: string;
  callback_url?: string;
}

// ============================================================
// PAYMENT
// ============================================================
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'expired' | 'pending_review';
export type PaymentType = 'payment' | 'invoice';
export type MatchResult =
  'auto_confirm' | 'low_confidence' | 'mismatch' | 'manual_confirm' | 'manual_reject';

export interface Payment {
  id: string;
  workspace_id: string;
  app_id: string | null;
  user_id: string | null;
  order_id: string | null;
  type: PaymentType;
  amount: number;
  amount_due: number;
  unique_code: number;
  currency: string;
  status: PaymentStatus;
  qris_dynamic: string | null;
  qr_image: string | null;
  proof_hash: string | null;
  proof_path: string | null;
  proof_mime: string | null;
  user_input_amount: number | null;
  ocr_amount: number | null;
  ocr_confidence: number | null;
  ocr_merchant: string | null;
  ocr_raw_text: string | null;
  ocr_provider: string | null;
  match_result: MatchResult | null;
  metadata: string | null;
  description: string | null;
  created_at: string;
  paid_at: string | null;
  expired_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  updated_at: string;
}

export interface ChargeCreateInput {
  app_id: string;
  order_id: string;
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ChargeCreateResponse {
  id: string;
  amount: number;
  amount_due: number;
  unique_code: number;
  currency: string;
  status: PaymentStatus;
  qr_image: string;
  qris_dynamic: string;
  expired_at: string;
  created_at: string;
}

export interface PaymentConfirmInput {
  amount: number;
}
// proof_image dikirim sebagai multipart/form-data field, dibaca route handler
// via c.req.parseBody() (bukan JSON) — tidak ada di type ini.

export interface PaymentConfirmResponse {
  id: string;
  status: PaymentStatus;
  match_result: MatchResult;
  ocr_amount: number | null;
  ocr_confidence: number | null;
  paid_at: string | null;
  message?: string;
}

// ============================================================
// CALLBACK
// ============================================================
export type CallbackEvent = 'payment.success' | 'payment.failed' | 'payment.expired';
export type CallbackStatus = 'pending' | 'success' | 'failed' | 'dead';

export interface Callback {
  id: string;
  payment_id: string;
  app_id: string | null;
  url: string;
  event: CallbackEvent;
  payload: string;
  response_code: number | null;
  response_body: string | null;
  status: CallbackStatus;
  attempt: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface CallbackPayload {
  event: CallbackEvent;
  transaction: {
    id: string;
    order_id: string | null;
    amount: number;
    amount_due: number;
    status: PaymentStatus;
    paid_at: string | null;
  };
}

// ============================================================
// SUBSCRIPTION
// ============================================================
export type SubscriptionTier = 'premium_monthly' | 'premium_yearly';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'pending';

export interface Subscription {
  id: string;
  user_id: string;
  workspace_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  amount: number;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpgradeInput {
  tier: 'premium_monthly' | 'premium_yearly';
  workspace_id: string;
}

// ============================================================
// INVOICE
// ============================================================
export type InvoiceStatus = 'pending' | 'paid' | 'expired' | 'failed';

export interface Invoice {
  id: string;
  subscription_id: string | null;
  user_id: string;
  payment_id: string | null;
  amount: number;
  amount_due: number;
  unique_code: number;
  status: InvoiceStatus;
  tier: SubscriptionTier;
  period_start: string;
  period_end: string;
  qris_dynamic: string | null;
  qr_image: string | null;
  due_at: string;
  paid_at: string | null;
  expired_at: string | null;
  reminder_sent_3: number; // 0 | 1
  reminder_sent_1: number; // 0 | 1
  created_at: string;
}

// ============================================================
// CONFIG
// ============================================================
export interface Config {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
}

export interface OcrConfig {
  ocr_provider: 'workers-ai' | 'tesseract-vps';
  vps_ocr_url?: string;
  vps_ocr_api_key?: string;
}

// ============================================================
// AUDIT LOG
// ============================================================
export interface AuditLog {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
}

// ============================================================
// TIER FEATURES
// ============================================================
export interface TierFeatures {
  tier: UserTier;
  max_workspaces: number;
  max_apps: number;
  max_transactions_month: number;
  max_transactions_per_day: number;
  api_rate_limit: number;
  callback_allowed: number; // 0 | 1
  callback_retry_count: number;
  report_export: number; // 0 | 1
  priority_review: number; // 0 | 1
  max_team_members: number;
}

// ============================================================
// NOTIFICATION
// ============================================================
export type NotificationChannel = 'email' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  channel: NotificationChannel;
  subject: string | null;
  message: string;
  status: NotificationStatus;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

// ============================================================
// API RESPONSE WRAPPERS
// ============================================================
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================
// PAGINATION
// ============================================================
export interface PaginationParams {
  page?: number;
  per_page?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaymentFilterParams extends PaginationParams {
  status?: PaymentStatus;
  workspace_id?: string;
  app_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

// ============================================================
// ADMIN
// ============================================================
export interface AdminOverview {
  total_users: number;
  total_payments: number;
  total_revenue: number;
  pending_review_count: number;
  today_payments: number;
  today_revenue: number;
  active_subscriptions: number;
  user_growth: number; // percentage
}

export interface AdminPaymentConfirmInput {
  action: 'confirm' | 'reject';
  note?: string;
}

// ============================================================
// WEBHOOK (external → BITS Pay)
// ============================================================
export interface WebhookReceiveInput {
  event: string;
  transaction_id: string;
  status: string;
  amount: number;
  signature?: string;
}
