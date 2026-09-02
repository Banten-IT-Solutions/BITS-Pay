import type { RouteDefinition } from 'svelte-spa-router';
import Login from './routes/Login.svelte';
import Overview from './routes/Overview.svelte';
import Payments from './routes/Payments.svelte';
import ReviewQueue from './routes/ReviewQueue.svelte';
import PaymentDetail from './routes/PaymentDetail.svelte';
import Users from './routes/Users.svelte';

const routes: RouteDefinition = {
  '/login': Login,
  '/': Overview,
  '/payments': Payments,
  '/payments/:id': PaymentDetail,
  '/review': ReviewQueue,
  '/users': Users,
};

export default routes;
