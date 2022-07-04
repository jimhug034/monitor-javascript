import { DBError } from './error'
import { configSchema } from './schema'
import { IDBConfig, IDBTables, SchemaResult, ValueOf } from './types'

const generateSchemaErrorMessage = (
  errors: ValueOf<Pick<SchemaResult, 'errors'>>,
  rawInput: IDBConfig
) => {
  const keys = Object.keys(errors) as (keyof IDBConfig)[]
  return `Invalid configuration\n${keys
    .map(
      key => `  - ${key} ${errors[key]}, got ${JSON.stringify(rawInput[key])}`
    )
    .join('\n\n')}`
}
export class DB {
  config: IDBConfig

  tablesName: string[]

  databaseName: string

  databaseVersion: number

  private _db: IDBDatabase | undefined = undefined

  constructor(protected readonly schema: IDBConfig) {
    if (Array.isArray(schema)) {
      throw new DBError('Config must be an Object')
    }

    if (!Array.isArray(schema?.tables)) {
      throw new DBError('Config.tables has to be an Array')
    }

    this.config = this._configure(schema)
    this.tablesName = this.config.tables.map(table => table.name)
    this.databaseName = this.config.name
    this.databaseVersion = this.config.version
  }

  _configure(schema: IDBConfig) {
    const schemaKeys = Object.keys(schema) as (keyof IDBConfig)[]
    const { errors, config } = schemaKeys.reduce(
      (accum, key): SchemaResult => {
        const defaultValue = configSchema[key].defaultValue()
        if (schema[key]) {
          const valid = configSchema[key].validate(schema[key])
          if (!valid) {
            accum.errors[key] = configSchema[key].message
            accum.config[key] = defaultValue
          } else {
            accum.config[key] = schema[key]
          }
        } else {
          accum.config[key] = defaultValue
        }
        return accum
      },
      { errors: {}, config: {} } as SchemaResult
    )

    if (Object.keys(errors).length) {
      throw new DBError(generateSchemaErrorMessage(errors, schema))
    }
    return config as IDBConfig
  }

  public connect(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!this.isSupportedIndexDB()) {
        return reject('Unsupported environment')
      }

      const dbRequest = window.indexedDB.open(
        this.databaseName,
        this.databaseVersion
      )

      dbRequest.onerror = () => reject(dbRequest.error)
      dbRequest.onblocked = () => {
        dbRequest.result.close()
        console.error(
          `[${this.databaseName}]: ${dbRequest.error || 'Database blocked'}`
        )
      }
      dbRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        DB.onUpgradeNeeded(dbRequest.result, this.config, event.oldVersion)
      }

      dbRequest.onsuccess = () => {
        this._db = dbRequest.result
        // when a database structure change
        this._db.onversionchange = () => {
          console.info(`[${this.databaseName}]: Database version changed.`)
          console.info(`[${this.databaseName}]: Connected closed.`)
          this._db!.close()
        }
        return resolve(this._db)
      }
    })
  }

  public get configuration() {
    return this.config
  }

  public get connection() {
    return this._db
  }

  public static removeDatabase(name: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(name)
      request.onblocked = () => {
        console.log(
          `[${name}]: Couldn't delete database due to the operation being blocked`
        )
      }
      request.onerror = () =>
        reject(request.error || "Couldn't remove database")
      request.onsuccess = () => resolve('Database has been removed')
    })
  }

  public isSupportedIndexDB(): boolean {
    if (!('indexedDB' in window)) {
      console.warn("This env doesn't support IndexedDB!")
      return false
    }
    return true
  }

  private static async onUpgradeNeeded(
    db: IDBDatabase,
    schema: IDBConfig,
    oldVersion: number
  ) {
    const { tables, version } = schema
    for await (const table of tables) {
      if (
        (oldVersion && oldVersion < version) ||
        db.objectStoreNames.contains(table.name)
      ) {
        db.deleteObjectStore(table.name)
        console.info(
          `[${schema.name}]: DB version changed, removing table: ${table.name} for the fresh start`
        )
      }

      const store = db.createObjectStore(table.name, {
        keyPath: table.primaryKey?.name || 'id',
        autoIncrement: table.primaryKey?.autoIncrement || true
      })

      DB.createIndexes(store, table.indexes)
      DB.insertInitialValues(store, table)
    }
  }

  private static createIndexes(
    store: IDBObjectStore,
    indexes: IDBTables['indexes']
  ): void {
    for (const key in indexes) {
      if (key in indexes) {
        store.createIndex(key, key, {
          unique: !!indexes[key].unique,
          multiEntry: !!indexes[key].multiEntry
        })
      }
    }
  }

  private static insertInitialValues(
    store: IDBObjectStore,
    table: IDBTables
  ): void {
    const _table = (table.initData || []).map(item => ({
      ...item,
      ...(table.timestamps && {
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    }))

    for (const data of _table) {
      store.add(DB.verifyDataTable(data, [table]))
    }
  }

  public static verifyDataTable<T extends Object>(
    data: T,
    tables: IDBTables[]
  ): T {
    const [firstTable = undefined] = tables
    if (!firstTable) {
      throw new Error('Tables should not be empty/undefined')
    }

    const keys = Object.keys(data)
    tables.forEach(table => {
      if (!table.primaryKey?.autoIncrement) {
        if (!table.primaryKey?.name || !keys.includes(table.primaryKey?.name)) {
          throw new Error(
            'Either include primary key as well or set {autoincrement: true}.'
          )
        }
      }
    })
    return data
  }

  // public useModel(target: new () => )
}
