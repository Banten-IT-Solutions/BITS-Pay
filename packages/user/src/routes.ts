import type { RouteDefinition } from 'svelte-spa-router';
import Login from './routes/Login.svelte';
import Overview from './routes/Overview.svelte';
import Workspaces from './routes/Workspaces.svelte';
import WorkspaceDetail from './routes/WorkspaceDetail.svelte';
import Apps from './routes/Apps.svelte';
import Payments from './routes/Payments.svelte';
import PaymentDetail from './routes/PaymentDetail.svelte';
import Subscription from './routes/Subscription.svelte';
import Invoices from './routes/Invoices.svelte';
import OAuthCallback from './routes/OAuthCallback.svelte';
import VerifyEmail from './routes/VerifyEmail.svelte';
import ResetPassword from './routes/ResetPassword.svelte';
import ForgotPassword from './routes/ForgotPassword.svelte';

const routes: RouteDefinition = {
  '/login': Login,
  '/auth/callback': OAuthCallback,
  '/verify-email': VerifyEmail,
  '/reset-password': ResetPassword,
  '/forgot-password': ForgotPassword,
  '/': Overview,
  '/workspaces': Workspaces,
  '/workspaces/:id': WorkspaceDetail,
  '/apps': Apps,
  '/payments': Payments,
  '/payments/:id': PaymentDetail,
  '/subscription': Subscription,
  '/invoices': Invoices,
};

export default routes;
