import { Lens } from '#project/lens';
import { FallibleMorphism, Morphism } from '#project/morphism';
import { compose, convert, kind, Optic } from '#project/optic';
import { Prism } from '#project/prism';

export class Iso<in out A, in out B> extends Optic<'iso', A, B, never> {
  readonly [kind] = 'iso';

  readonly #to: Morphism<A, B>;

  readonly #from: Morphism<B, A>;

  private constructor(to: Morphism<A, B>, from: Morphism<B, A>) {
    super();

    this.#to = to;
    this.#from = from;
  }

  static of<A, B>(to: Morphism<A, B>, from: Morphism<B, A>): Iso<A, B>;

  static of<A, B>(to: (a: A) => B, from: (b: B) => A): Iso<A, B>;

  static of<A, B>(
    to: Morphism<A, B> | ((a: A) => B),
    from: Morphism<B, A> | ((b: B) => A)
  ): Iso<A, B> {
    return new Iso(
      to instanceof Morphism ? to : Morphism.of(to),
      from instanceof Morphism ? from : Morphism.of(from)
    );
  }

  static id<A>(): Iso<A, A> {
    return new Iso(Morphism.id(), Morphism.id());
  }

  to(a: A): B {
    return this.#to.apply(a);
  }

  from(b: B): A {
    return this.#from.apply(b);
  }

  inverse(): Iso<B, A> {
    return new Iso(this.#from, this.#to);
  }

  [convert](target: Optic.Kind): Optic.Any {
    if (target === 'iso') return this;

    if (target === 'prism')
      return Prism.of(FallibleMorphism.from(this.#to), this.#from);

    const lens = Lens.of(
      this.#to,
      Morphism.of(([, b]: readonly [A, B]) => b).andThen(this.#from)
    );

    return target === 'lens' ? lens : lens[convert](target);
  }

  [compose]<C>(next: Iso<B, C>): Iso<A, C> {
    return new Iso(this.#to.andThen(next.#to), next.#from.andThen(this.#from));
  }
}
