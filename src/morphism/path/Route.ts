import { type Path } from './Path.js';
import { Pending } from './Pending.js';

export const unpack: unique symbol = Symbol('unpack');

export abstract class Route<out B, out X> extends Pending<B | X> {
  abstract [unpack]<R>(
    continuation: <V>(value: V, path: Path<V, B, X>) => R
  ): R;
}
