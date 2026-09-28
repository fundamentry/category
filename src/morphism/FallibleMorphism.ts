import { Failure, type Result, Success } from '@fundamentry/coproduct';

import {
  Concat,
  FallibleSingle,
  Single,
  type Path,
} from '#project/morphism/path';

import { type Morphism, pathOf } from './Morphism.js';

export class FallibleMorphism<in A, out B, out E> {
  readonly #path: Path<A, B, Failure<E>>;

  readonly #apply: (a: A) => Result<B, E>;

  private constructor(
    path: Path<A, B, Failure<E>>,
    apply?: (a: A) => Result<B, E>
  ) {
    this.#path = path;
    this.#apply =
      apply ??
      (a => new Concat(path, new Single((b: B) => new Success(b))).apply(a));
  }

  static of<A, B, E>(fn: (a: A) => Result<B, E>): FallibleMorphism<A, B, E> {
    return new FallibleMorphism(new FallibleSingle(fn), fn);
  }

  static from<A, B>(morphism: Morphism<A, B>): FallibleMorphism<A, B, never> {
    return new FallibleMorphism(morphism[pathOf]);
  }

  static fromPredicate<A, B extends A, E>(
    predicate: (a: A) => a is B,
    error: (a: A) => E
  ): FallibleMorphism<A, B, E>;

  static fromPredicate<A, E>(
    predicate: (a: A) => boolean,
    error: (a: A) => E
  ): FallibleMorphism<A, A, E>;

  static fromPredicate<A, E>(
    predicate: (a: A) => boolean,
    error: (a: A) => E
  ): FallibleMorphism<A, A, E> {
    return FallibleMorphism.of(a =>
      predicate(a) ? new Success(a) : new Failure(error(a))
    );
  }

  static id<A>(): FallibleMorphism<A, A, never> {
    return new FallibleMorphism(new Single(a => a));
  }

  apply(a: A): Result<B, E> {
    return this.#apply(a);
  }

  andThen<C, F>(
    next: FallibleMorphism<B, C, F>
  ): FallibleMorphism<A, C, E | F> {
    return new FallibleMorphism(
      new Concat<A, B, C, Failure<E | F>>(this.#path, next.#path)
    );
  }

  map<C>(morphism: Morphism<B, C>): FallibleMorphism<A, C, E> {
    return this.andThen(FallibleMorphism.from(morphism));
  }

  mapError<F>(morphism: Morphism<E, F>): FallibleMorphism<A, B, F> {
    return FallibleMorphism.of((a: A) => {
      const result = this.apply(a);

      return result.ok() ? result : new Failure(morphism.apply(result.error()));
    });
  }
}
