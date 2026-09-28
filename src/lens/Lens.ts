import { FallibleMorphism, Morphism } from '#project/morphism';
import { compose, convert, kind, Optic } from '#project/optic';
import { Optional } from '#project/optional';

export class Lens<in out S, in out A> extends Optic<'lens', S, A, never> {
  readonly [kind] = 'lens';

  readonly #get: Morphism<S, A>;

  readonly #modify: Morphism<Morphism<A, A>, Morphism<S, S>>;

  private constructor(
    get: Morphism<S, A>,
    modify: Morphism<Morphism<A, A>, Morphism<S, S>>
  ) {
    super();

    this.#get = get;
    this.#modify = modify;
  }

  static of<S, A>(
    get: Morphism<S, A>,
    set: Morphism<readonly [S, A], S>
  ): Lens<S, A> {
    return new Lens(
      get,
      Morphism.of((morphism: Morphism<A, A>) =>
        Morphism.id<S>().fanout(get.andThen(morphism)).andThen(set)
      )
    );
  }

  static id<S>(): Lens<S, S> {
    return new Lens(Morphism.id(), Morphism.id());
  }

  get(s: S): A {
    return this.#get.apply(s);
  }

  set(s: S, a: A): S {
    return this.#optional().set(s, a);
  }

  modify(morphism: Morphism<A, A>): Morphism<S, S> {
    return this.#optional().modify(morphism);
  }

  [convert](target: 'lens' | 'optional'): Optic.Any {
    return target === 'lens' ? this : this.#optional();
  }

  [compose]<B>(next: Lens<A, B>): Lens<S, B> {
    return new Lens(
      this.#get.andThen(next.#get),
      next.#modify.andThen(this.#modify)
    );
  }

  #optional(): Optional<S, A, never> {
    return Optional.of(FallibleMorphism.from(this.#get), this.#modify);
  }
}
