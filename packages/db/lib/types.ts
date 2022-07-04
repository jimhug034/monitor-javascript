export type TimeStampsType = {
  createdAt: number
  updatedAt: number
}

export interface IDBConfig {
  name: string
  version: number
  tables: IDBTables[]
}

export interface IDBTables {
  name: string
  primaryKey?: {
    name: string
    autoIncrement: boolean
    unique: boolean
  }
  indexes: {
    [key: string]: {
      unique?: boolean
      multiEntry?: boolean
    }
  }
  initData?: {
    [key: string]: IDBValidKey | IDBKeyRange
  }[]
  timestamps?: boolean
}

export type ValueOf<T> = T[keyof T]
export interface SchemaResult {
  errors: {
    [key in keyof IDBConfig]: ValueOf<IDBConfig>
  }
  config: {
    [key in keyof IDBConfig]: ValueOf<IDBConfig>
  }
}
export type OptionsWhereAsCallback<I> = (list: I[]) => Partial<I>[]
export type OptionsWhereAsObject<T extends keyof any = any> = {
  [key in T]: IDBValidKey | IDBKeyRange
}

export type OptionsType<I, U extends keyof any = any> = {
  where?: OptionsWhereAsObject<U> | OptionsWhereAsCallback<I>
  limit?: number
  orderByDESC?: boolean
  sortBy?: keyof I | keyof I[]
}
