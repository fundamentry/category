import { type Result } from '@fundamentry/coproduct';

import { type Iso } from '#project/iso';
import { FallibleMorphism, Morphism } from '#project/morphism';
import { type Prism } from '#project/prism';

export class PartialIso<in out A, in out B, out E, out F> {
  readonly #to: FallibleMorphism<A, B, E>;

  readonly #from: FallibleMorphism<B, A, F>;

  private constructor(
    to: FallibleMorphism<A, B, E>,
    from: FallibleMorphism<B, A, F>
  ) {
    this.#to = to;
    this.#from = from;
  }

  static of<A, B, E, F>(
    to: FallibleMorphism<A, B, E>,
    from: FallibleMorphism<B, A, F>
  ): PartialIso<A, B, E, F>;

  static of<A, B, E, F>(
    to: (a: A) => Result<B, E>,
    from: (b: B) => Result<A, F>
  ): PartialIso<A, B, E, F>;

  static of<A, B, E, F>(
    to: FallibleMorphism<A, B, E> | ((a: A) => Result<B, E>),
    from: FallibleMorphism<B, A, F> | ((b: B) => Result<A, F>)
  ): PartialIso<A, B, E, F> {
    return new PartialIso(
      to instanceof FallibleMorphism ? to : FallibleMorphism.of(to),
      from instanceof FallibleMorphism ? from : FallibleMorphism.of(from)
    );
  }

  static fromIso<A, B>(iso: Iso<A, B>): PartialIso<A, B, never, never> {
    return new PartialIso(
      FallibleMorphism.from(Morphism.of((a: A) => iso.to(a))),
      FallibleMorphism.from(Morphism.of((b: B) => iso.from(b)))
    );
  }

  static fromPrism<S, A, E>(prism: Prism<S, A, E>): PartialIso<S, A, E, never> {
    return new PartialIso(
      FallibleMorphism.of((s: S) => prism.preview(s)),
      FallibleMorphism.from(Morphism.of((a: A) => prism.review(a)))
    );
  }

  static id<A>(): PartialIso<A, A, never, never> {
    return new PartialIso(FallibleMorphism.id(), FallibleMorphism.id());
  }

  to(a: A): Result<B, E> {
    return this.#to.apply(a);
  }

  from(b: B): Result<A, F> {
    return this.#from.apply(b);
  }

  inverse(): PartialIso<B, A, F, E> {
    return new PartialIso(this.#from, this.#to);
  }

  andThen<C, G, H>(
    next: PartialIso<B, C, G, H>
  ): PartialIso<A, C, E | G, F | H> {
    return new PartialIso(
      this.#to.andThen(next.#to),
      next.#from.andThen(this.#from)
    );
  }
}
