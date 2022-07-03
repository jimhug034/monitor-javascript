import 'reflect-metadata'

type TableDecoratorOptions = {
  name: string
  timestamps: boolean
  initialData: Record<string, IDBValidKey | IDBKeyRange>[]
}
type IndexedPropertyType = Partial<{
  unique: boolean
  multiEntry: boolean
}>
type PrimaryKeyType = Partial<{
  autoIncrement: boolean
  name: string
  unique: boolean
}>
type ColumnDecoratorOptions = Partial<{
  required: boolean
  optional: boolean
  indexed: IndexedPropertyType
  primaryKey: Omit<PrimaryKeyType, 'name'>
  default: any
}>
type PropertyType = string
type ColumnMetadataOptions = {
  [property: PropertyType]: ColumnDecoratorOptions
}

const PROPERTY_ATTRIBUTE_OPTIONS = Symbol('PROPERTY_ATTRIBUTE_OPTIONS')
const TABLE_CLASS_OPTIONS = Symbol('TABLE_CLASS_OPTIONS')

export const Table =
  (options?: Partial<TableDecoratorOptions>) => (target: any) => {
    const defaultOptions: TableDecoratorOptions = {
      name: target.name,
      timestamps: false,
      initialData: []
    }
    const assignOptions: TableDecoratorOptions = {
      ...defaultOptions,
      ...options
    }

    Reflect.defineMetadata(TABLE_CLASS_OPTIONS, assignOptions, target)
  }

function PropertyDecorator(options: ColumnDecoratorOptions = {}) {
  return (target: any, propertyName: PropertyType) => {
    const newMetadata: ColumnMetadataOptions = {
      [propertyName]: options
    }
    const existingMetadata = Reflect.getMetadata(
      PROPERTY_ATTRIBUTE_OPTIONS,
      target?.constructor
    )
    if (existingMetadata) {
      if (Reflect.has(existingMetadata, propertyName)) {
        existingMetadata[propertyName] = {
          ...existingMetadata[propertyName],
          ...newMetadata[propertyName]
        }
        return Reflect.defineMetadata(
          PROPERTY_ATTRIBUTE_OPTIONS,
          existingMetadata,
          target.constructor
        )
      }

      existingMetadata[propertyName] = newMetadata[propertyName]
      return Reflect.defineMetadata(
        PROPERTY_ATTRIBUTE_OPTIONS,
        existingMetadata,
        target.constructor
      )
    }

    Reflect.defineMetadata(
      PROPERTY_ATTRIBUTE_OPTIONS,
      newMetadata,
      target?.constructor
    )
  }
}

/**
 * Get property metadata for the class.
 *
 * @param {Function} target
 */
export function getPropertyMetadata(target: Function): ColumnMetadataOptions {
  return Reflect.getMetadata(PROPERTY_ATTRIBUTE_OPTIONS, target)
}

/**
 * Get class metadata
 *
 * @param {Function} target
 */
export function getClassMetadata(target: Function): TableDecoratorOptions {
  return Reflect.getMetadata(TABLE_CLASS_OPTIONS, target)
}

export const PrimaryKey = (options: Omit<PrimaryKeyType, 'name'> = {}) => {
  const defaults = {
    autoIncrement: true,
    unique: true
  }
  const primaryKey = {
    ...defaults,
    ...options
  }
  return PropertyDecorator({ primaryKey })
}
/**
 * Decorator for a property that is indexed.
 * When indexed is not set for the field .selectByIndex is not possible to use.
 *
 * Default {unique}: false.
 * Default {multiEntry}: true.
 */
export const Indexed = (options: IndexedPropertyType = {}) => {
  const defaults = {
    unique: false,
    multiEntry: true
  }
  const indexed = {
    ...defaults,
    ...options
  }

  return PropertyDecorator({ indexed })
}

export const getPrimaryKey = (target: Function): string | undefined => {
  const properties = getPropertyMetadata(target)
  const propertyEntries = Object.entries(properties)
  for (const [propertyName, property] of propertyEntries) {
    if (property.primaryKey) return propertyName
  }
}
