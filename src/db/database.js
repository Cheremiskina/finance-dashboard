import Dexie from 'dexie'

export const db = new Dexie('financeDashboard')

db.version(1).stores({
  accounts: '++id, type, isArchived, createdAt',
})

db.version(2).stores({
  accounts: '++id, type, isArchived, createdAt',
  transactions:
    '++id, type, date, accountId, fromAccountId, toAccountId, category, createdAt',
})

db.version(3).stores({
  accounts: '++id, type, isArchived, createdAt',
  transactions:
    '++id, type, date, accountId, fromAccountId, toAccountId, category, createdAt',
  allocationSettings: '&id',
})

db.version(4).stores({
  accounts: '++id, type, isArchived, createdAt',
  transactions:
    '++id, type, date, accountId, fromAccountId, toAccountId, category, createdAt',
  allocationSettings: '&id',
  allocationRuns:
    '++id, date, sourceAccountId, status, createdAt',
})