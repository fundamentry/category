import { type Step } from './Step.js';

export const next: unique symbol = Symbol('next');

export abstract class Pending<out R> {
  abstract [next](): Step<R>;
}
