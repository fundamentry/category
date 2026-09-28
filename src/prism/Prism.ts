import { type Either, Left, type Result, Right } from '@fundamentry/coproduct';

import { FallibleMorphism, Morphism } from '#project/morphism';
import { compose, convert, kind, Optic } from '#project/optic';
import { Optional } from '#project/optional';

export class Prism<in out S, in out A, out E> extends Optic<'prism', S, A, E> {
  readonly [kind] = 'prism';

  readonly #preview: FallibleMorphism<S, A, E>;

  readonly #review: Morphism<A, S>;

  private constructor(
    preview: FallibleMorphism<S, A, E>,
    review: Morphism<A, S>
  ) {
    super();

    this.#preview = preview;
    this.#review = review;
  }

  static of<S, A, E>(
    preview: FallibleMorphism<S, A, E>,
    review: Morphism<A, S>
  ): Prism<S, A, E>;

  static of<S, A, E>(
    preview: (s: S) => Result<A, E>,
    review: (a: A) => S
  ): Prism<S, A, E>;

  static of<S, A, E>(
    preview: FallibleMorphism<S, A, E> | ((s: S) => Result<A, E>),
    review: Morphism<A, S> | ((a: A) => S)
  ): Prism<S, A, E> {
    return new Prism(
      preview instanceof FallibleMorphism
        ? preview
        : FallibleMorphism.of(preview),
      review instanceof Morphism ? review : Morphism.of(review)
    );
  }

  static fromPredicate<S, A extends S, E>(
    predicate: (s: S) => s is A,
    error: (s: S) => E
  ): Prism<S, A, E>;

  static fromPredicate<S, E>(
    predicate: (s: S) => boolean,
    error: (s: S) => E
  ): Prism<S, S, E>;

  static fromPredicate<S, E>(
    predicate: (s: S) => boolean,
    error: (s: S) => E
  ): Prism<S, S, E> {
    return new Prism(
      FallibleMorphism.fromPredicate(predicate, error),
      Morphism.id()
    );
  }

  static id<S>(): Prism<S, S, never> {
    return new Prism(FallibleMorphism.id(), Morphism.id());
  }

  preview(s: S): Result<A, E> {
    return this.#preview.apply(s);
  }

  review(a: A): S {
    return this.#review.apply(a);
  }

  modify(morphism: Morphism<A, A>): Morphism<S, S> {
    return Morphism.of((s: S) =>
      this.#preview.apply(s).match<Either<S, A>>({
        onSuccess: a => new Right(a),
        onFailure: () => new Left(s),
      })
    ).andThen(Morphism.id<S>().fanin(morphism.andThen(this.#review)));
  }

  mapError<F>(morphism: Morphism<E, F>): Prism<S, A, F> {
    return new Prism(this.#preview.mapError(morphism), this.#review);
  }

  [convert](target: 'prism' | 'optional'): Optic.Any {
    return target === 'prism'
      ? this
      : Optional.of(
          this.#preview,
          Morphism.of((morphism: Morphism<A, A>) => this.modify(morphism))
        );
  }

  [compose]<B, F>(next: Prism<A, B, F>): Prism<S, B, E | F> {
    return new Prism(
      this.#preview.andThen(next.#preview),
      next.#review.andThen(this.#review)
    );
  }
}
