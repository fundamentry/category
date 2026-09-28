import { type Done } from './Done.js';
import { type Pending } from './Pending.js';

export type Step<R> = Done<R> | Pending<R>;
