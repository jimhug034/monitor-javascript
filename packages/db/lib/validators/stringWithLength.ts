export const stringWithLength = (value: string): boolean => {
  return typeof value === 'string' && !!value.length
}
