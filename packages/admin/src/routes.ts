import type { RouteDefinition } from 'svelte-spa-router';
import Login from './routes/Login.svelte';
import Overview from './routes/Overview.svelte';
import Payments from './routes/Payments.svelte';
import ReviewQueue from './routes/ReviewQueue.svelte';
import PaymentDetail from './routes/PaymentDetail.svelte';
import Users from './routes/Users.svelte';
import Callbacks from './routes/Callbacks.svelte';
import Settings from './routes/Settings.svelte';
import AuditLogs from './routes/AuditLogs.svelte';
import Reports from './routes/Reports.svelte';
import TierFeatures from './routes/TierFeatures.svelte';

const routes: RouteDefinition = {
  '/login': Login,
  '/': Overview,
  '/payments': Payments,
  '/payments/:id': PaymentDetail,
  '/review': ReviewQueue,
  '/users': Users,
  '/callbacks': Callbacks,
  '/settings': Settings,
  '/audit-logs': AuditLogs,
  '/reports': Reports,
  '/tier-features': TierFeatures,
};

export default routes;
