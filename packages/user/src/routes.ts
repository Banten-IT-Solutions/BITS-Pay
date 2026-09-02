import type { RouteDefinition } from 'svelte-spa-router';
import Login from './routes/Login.svelte';
import Overview from './routes/Overview.svelte';
import Workspaces from './routes/Workspaces.svelte';
import WorkspaceDetail from './routes/WorkspaceDetail.svelte';
import Apps from './routes/Apps.svelte';
import Payments from './routes/Payments.svelte';
import PaymentDetail from './routes/PaymentDetail.svelte';

const routes: RouteDefinition = {
  '/login': Login,
  '/': Overview,
  '/workspaces': Workspaces,
  '/workspaces/:id': WorkspaceDetail,
  '/apps': Apps,
  '/payments': Payments,
  '/payments/:id': PaymentDetail,
};

export default routes;
