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

const routes: RouteDefinition = {
  '/login': Login,
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
