import { stringWithLength } from './validators'

export interface ConfigSchemaType {
  [key: string]: {
    defaultValue: Function
    message: string
    validate: (val: any) => boolean
  }
}

export const configSchema: ConfigSchemaType = {
  name: {
    defaultValue: () => '__idb__',
    message: 'Database name',
    validate: stringWithLength
  },
  version: {
    defaultValue: () => 1,
    message: 'Database version, should be > 0',
    validate: (value: number) => typeof value === 'number' && value > 0
  },

  tables: {
    defaultValue: () => [],
    message: 'should be an array',
    validate: (value: any) => Array.isArray(value)
  }
}
