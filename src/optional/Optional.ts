import { type Result } from '@fundamentry/coproduct';

import { FallibleMorphism, Morphism } from '#project/morphism';
import { compose, convert, kind, Optic } from '#project/optic';

export class Optional<in out S, in out A, out E> extends Optic<
  'optional',
  S,
  A,
  E
> {
  readonly [kind] = 'optional';

  readonly #preview: FallibleMorphism<S, A, E>;

  readonly #modify: Morphism<Morphism<A, A>, Morphism<S, S>>;

  private constructor(
    preview: FallibleMorphism<S, A, E>,
    modify: Morphism<Morphism<A, A>, Morphism<S, S>>
  ) {
    super();

    this.#preview = preview;
    this.#modify = modify;
  }

  static of<S, A, E>(
    preview: FallibleMorphism<S, A, E>,
    modify: Morphism<Morphism<A, A>, Morphism<S, S>>
  ): Optional<S, A, E> {
    return new Optional(preview, modify);
  }

  static id<S>(): Optional<S, S, never> {
    return new Optional(FallibleMorphism.id(), Morphism.id());
  }

  preview(s: S): Result<A, E> {
    return this.#preview.apply(s);
  }

  set(s: S, a: A): S {
    return this.#modify.apply(Morphism.of(() => a)).apply(s);
  }

  modify(morphism: Morphism<A, A>): Morphism<S, S> {
    return this.#modify.apply(morphism);
  }

  mapError<F>(morphism: Morphism<E, F>): Optional<S, A, F> {
    return new Optional(this.#preview.mapError(morphism), this.#modify);
  }

  [convert](): this {
    return this;
  }

  [compose]<B, F>(next: Optional<A, B, F>): Optional<S, B, E | F> {
    return new Optional(
      this.#preview.andThen(next.#preview),
      next.#modify.andThen(this.#modify)
    );
  }
}
