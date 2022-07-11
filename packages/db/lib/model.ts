import { Optional } from 'utility-types'
import { DB } from './Database'
import { IDBTables, OptionsType, TimeStampsType } from './types'
import ArraySorter from './array-sorter'

export default class Model<T extends Optional<TimeStampsType>> {
  constructor(
    private readonly db: IDBDatabase,
    private readonly table: IDBTables
  ) {}

  async insert(data: Partial<T>): Promise<Partial<T>> {
    return new Promise((resolve, reject) => {
      try {
        const verifiedInsertData: Partial<T> = {
          ...DB.verifyDataTable<Partial<T>>(data, [this.table]),
          ...(this.table.timestamps && {
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
        }

        const request = this.db
          .transaction(this.table.name, 'readwrite')
          .objectStore(this.table.name)
          .add(verifiedInsertData)

        request.onerror = () =>
          reject(request.error || 'Unable to add data. Check the unique values')
        request.onsuccess = () => resolve(this.resolveValue(data) as T)
      } catch (error) {
        return reject(error)
      }
    })
  }

  public async selectByPk(pKey: IDBValidKey | IDBKeyRange): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.table.name, 'readonly')
      const objectStore = transaction.objectStore(this.table.name)
      const request = objectStore.get(pKey)
      request.onerror = () =>
        reject(request.error || `Unable to retrieve data from the model`)
      request.onsuccess = () => resolve(this.resolveValue(request.result) as T)
    })
  }

  async selectByIndex(indexName: string, value: IDBValidKey | IDBKeyRange) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.table.name, 'readonly')
      const objectStore = transaction.objectStore(this.table.name)
      const request = objectStore.index(indexName).get(value)
      request.onerror = () =>
        reject(
          request.error ||
            `Unable to retrieve data from the model by ${indexName}`
        )
      request.onsuccess = () => resolve(this.resolveValue(request.result))
    })
  }

  selectAll(): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const objectStore = this.db
        .transaction(this.table.name, 'readonly')
        .objectStore(this.table.name)
      const request: IDBRequest<T[]> = objectStore.getAll()
      request.onsuccess = () =>
        resolve(this.resolveValue(request.result) as T[])
      request.onerror = () =>
        reject(request.error || "Can't get data from database")
    })
  }

  openCursor() {
    return new Promise((resolve, reject) => {
      const objectStore = this.db
        .transaction(this.table.name, 'readonly')
        .objectStore(this.table.name)
      const request = objectStore.openCursor()
      request.onerror = () =>
        reject(request.error || `Can't get data from database`)
      request.onsuccess = () => resolve(request)
    })
  }

  /**
   * @description This method is used to update data in the table by primary key.
   * It combines original and updateData and the same keys will be overridden.
   */
  updateByPk<T>(
    pKey: IDBValidKey | IDBKeyRange,
    dataToUpdate: Partial<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.selectByPk(pKey).then(fetchedData => {
        const transaction = this.db.transaction(this.table.name, 'readwrite')
        const store = transaction.objectStore(this.table.name)
        const data = Object.assign(fetchedData, dataToUpdate)

        if (this.table.timestamps) data.createdAt = Date.now()
        const save = store.put(data)
        save.onerror = () => reject(save.error || `Couldn't update data`)
        save.onsuccess = () => {
          resolve(this.resolveValue(data) as T)
        }
      })
    })
  }

  deleteByPk(
    pKey: IDBValidKey | IDBKeyRange
  ): Promise<IDBValidKey | IDBKeyRange> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(this.table.name, 'readwrite')
      const request = transaction.objectStore(this.table.name).delete(pKey)
      request.onsuccess = () => resolve(pKey)
      request.onerror = () => reject(request.error || `Couldn't remove an item`)
    })
  }
  /**
   * @description This method is used to select data from the table.
   */
  async select(options: OptionsType<T>) {
    const data = await this.selectAll()
    let result: any[] = []
    if (Reflect.has(options, 'where') && options.where) {
      if (!data) return []

      if (typeof options.where === 'function') {
        result = options.where(data)
      } else {
        const whereKeys = Object.keys(options.where)
        result = data.filter(item => {
          const dataKeys = Object.keys(item)
          for (const key of whereKeys) {
            if (
              dataKeys.includes(key) &&
              // eslint-disable-next-line @typescript-eslint/ban-types
              (item as any)[key] === (options.where as any)[key]
            )
              return true
            return false
          }
        })
      }
    }

    if (Reflect.has(options, 'sortBy') && options.sortBy) {
      result = new ArraySorter<T>(result).sortBy({
        desc: Reflect.has(options, 'orderByDESC') && options.orderByDESC,
        keys: [options.sortBy as string]
      })
    }

    if (Reflect.has(options, 'limit') && options.limit) {
      result = result.slice(0, +options.limit)
    }

    return result
  }

  private resolveValue(
    value: Partial<T> | Partial<T>[]
  ): Partial<T> | Partial<T>[] {
    return value
  }
}
