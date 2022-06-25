export class DBError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'IDBValidationError'
  }

  public static is(error: Error) {
    return error.name === 'IDBValidationError'
  }
}
