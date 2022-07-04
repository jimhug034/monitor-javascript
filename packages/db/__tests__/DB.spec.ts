import { DB as Database } from '../lib'

describe('Database', function () {
  beforeAll(() => {
    jest.clearAllMocks()
  })
  beforeEach(() => jest.clearAllMocks())

  /**
   * @jest-environment jsdom
   */
  it('should throw Unsupported environment: mocked', () => {
    global.window = Object.create(window)
    Object.defineProperty(window, 'indexedDB', {
      value: {
        open: () => new Error('Unsupported environment')
      }
    })
    new Database({
      version: 1,
      name: `Test-db-000`,
      tables: [
        {
          name: 'users',
          primaryKey: {
            name: 'username',
            autoIncrement: false,
            unique: true
          },
          initData: [
            { username: 'n1md7', password: 'passwd' },
            { username: 'admin', password: 'admin123' }
          ],
          indexes: {
            username: { unique: true, multiEntry: false },
            password: { unique: false, multiEntry: false }
          }
        }
      ]
    })
      .connect()
      .catch(err => {
        expect(err).toBeInstanceOf(Error)
        expect(err.message).toBe('Unsupported environment')
      })
  })
})
