import { type Iso } from '#project/iso';
import { type Lens } from '#project/lens';
import { type Optional } from '#project/optional';
import { type Prism } from '#project/prism';

const joins = {
  iso: { iso: 'iso', lens: 'lens', prism: 'prism', optional: 'optional' },
  lens: { iso: 'lens', lens: 'lens', prism: 'optional', optional: 'optional' },
  prism: {
    iso: 'prism',
    lens: 'optional',
    prism: 'prism',
    optional: 'optional',
  },
  optional: {
    iso: 'optional',
    lens: 'optional',
    prism: 'optional',
    optional: 'optional',
  },
} as const;

export const kind: unique symbol = Symbol('kind');

export const convert: unique symbol = Symbol('convert');

export const compose: unique symbol = Symbol('compose');

declare const types: unique symbol;

export namespace Optic {
  export type Kind = keyof typeof joins;

  export type Joins = typeof joins;

  export interface Kinds<S, A, E> {
    iso: Iso<S, A>;
    lens: Lens<S, A>;
    prism: Prism<S, A, E>;
    optional: Optional<S, A, E>;
  }

  export interface Any {
    readonly [kind]: Kind;
    [convert](target: Kind): Any;
    [compose](next: Any): Any;
  }
}

export abstract class Optic<
  out K extends Optic.Kind,
  in out S,
  in out A,
  out E,
> {
  declare readonly [types]?: {
    readonly source: (s: S) => S;
    readonly focus: A;
    readonly error: E;
  };

  abstract readonly [kind]: K;

  abstract [convert](target: Optic.Kind): Optic.Any;

  abstract [compose](next: never): Optic.Any;

  andThen<L extends Optic.Kind, B, F>(
    next: Optic<L, A, B, F>
  ): Optic.Kinds<S, B, E | F>[Optic.Joins[K][L]] {
    const target = joins[this[kind]][next[kind]];

    return this[convert](target)[compose](next[convert](target)) as Optic.Kinds<
      S,
      B,
      E | F
    >[Optic.Joins[K][L]];
  }
}
