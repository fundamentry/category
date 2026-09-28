export const value: unique symbol = Symbol('value');

export class Done<out R> {
  readonly #value: R;

  constructor(result: R) {
    this.#value = result;
  }

  [value](): R {
    return this.#value;
  }
}
