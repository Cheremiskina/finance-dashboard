import { db } from '@/db/database'

const APP_ID = 'finance-dashboard'
const BACKUP_VERSION = 1

function pad(value) {
  return String(value).padStart(2, '0')
}

function createFileName(date = new Date()) {
  return [
    'finance-backup',
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}-${pad(date.getMinutes())}`,
  ].join('_') + '.json'
}

function requireArray(data, key) {
  const value = data[key]

  if (value === undefined || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new Error(`Раздел «${key}» в резервной копии поврежден.`)
  }

  return value
}

function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Файл не является резервной копией приложения.')
  }

  if (parsed.meta?.app !== APP_ID) {
    throw new Error('Этот файл создан другим приложением.')
  }

  const version = Number(parsed.meta?.version)

  if (!Number.isFinite(version) || version < 1) {
    throw new Error('Не удалось определить версию резервной копии.')
  }

  if (version > BACKUP_VERSION) {
    throw new Error(
      'Резервная копия создана более новой версией приложения.',
    )
  }

  if (!parsed.data || typeof parsed.data !== 'object') {
    throw new Error('В резервной копии отсутствуют данные.')
  }

  return {
    accounts: requireArray(parsed.data, 'accounts'),
    transactions: requireArray(parsed.data, 'transactions'),
    allocationSettings: requireArray(
      parsed.data,
      'allocationSettings',
    ),
    allocationRuns: requireArray(
      parsed.data,
      'allocationRuns',
    ),
  }
}

export async function exportBackup() {
  const [
    accounts,
    transactions,
    allocationSettings,
    allocationRuns,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.allocationSettings.toArray(),
    db.allocationRuns.toArray(),
  ])

  const backup = {
    meta: {
      app: APP_ID,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
    },

    data: {
      accounts,
      transactions,
      allocationSettings,
      allocationRuns,
    },
  }

  const json = JSON.stringify(backup, null, 2)
  const fileName = createFileName()

  const file = new File([json], fileName, {
    type: 'application/json',
  })

  let canShareFile = false

  try {
    canShareFile = Boolean(
      navigator.share &&
        navigator.canShare?.({
          files: [file],
        }),
    )
  } catch {
    canShareFile = false
  }

  if (canShareFile) {
    try {
      await navigator.share({
        title: 'Резервная копия финансов',
        text: 'Сохраните файл в надежном месте.',
        files: [file],
      })

      return {
        cancelled: false,
        method: 'share',
        fileName,
        accounts: accounts.length,
        transactions: transactions.length,
      }
    } catch (shareError) {
    if (shareError?.name === 'AbortError') {
        return {
        cancelled: true,
        }
    }

    console.warn(
        'Системное меню недоступно. Используем обычное скачивание.',
        shareError,
    )
    }
  }

  const fileUrl = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = fileUrl
  link.download = fileName
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(fileUrl)
  }, 1000)

  return {
    cancelled: false,
    method: 'download',
    fileName,
    accounts: accounts.length,
    transactions: transactions.length,
  }
}

export async function importBackup(file) {
  if (!file) {
    throw new Error('Файл не выбран.')
  }

  let parsed

  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('Не удалось прочитать JSON-файл.')
  }

  const data = validateBackup(parsed)

  await db.transaction(
    'rw',
    db.accounts,
    db.transactions,
    db.allocationSettings,
    db.allocationRuns,
    async () => {
      await db.accounts.clear()
      await db.transactions.clear()
      await db.allocationSettings.clear()
      await db.allocationRuns.clear()

      if (data.accounts.length) {
        await db.accounts.bulkPut(data.accounts)
      }

      if (data.transactions.length) {
        await db.transactions.bulkPut(data.transactions)
      }

      if (data.allocationSettings.length) {
        await db.allocationSettings.bulkPut(
          data.allocationSettings,
        )
      }

      if (data.allocationRuns.length) {
        await db.allocationRuns.bulkPut(
          data.allocationRuns,
        )
      }
    },
  )

  return {
    accounts: data.accounts.length,
    transactions: data.transactions.length,
    allocationRuns: data.allocationRuns.length,
  }
}