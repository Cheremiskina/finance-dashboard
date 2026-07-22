const LAST_BACKUP_KEY =
  'finance-dashboard:last-backup-at'

export function recordBackupCreated(
  date = new Date(),
) {
  try {
    localStorage.setItem(
      LAST_BACKUP_KEY,
      date.toISOString(),
    )
  } catch (error) {
    console.warn(
      'Не удалось сохранить дату резервной копии.',
      error,
    )
  }
}

export function getLastBackupAt() {
  try {
    const savedValue =
      localStorage.getItem(
        LAST_BACKUP_KEY,
      )

    if (!savedValue) {
      return null
    }

    const date = new Date(savedValue)

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return null
    }

    return date.toISOString()
  } catch {
    return null
  }
}

export async function getStorageHealth() {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage
  ) {
    return {
      supported: false,
      persistent: null,
      usage: null,
      quota: null,
    }
  }

  let persistent = null
  let usage = null
  let quota = null

  if (
    typeof navigator.storage.persisted ===
    'function'
  ) {
    try {
      persistent =
        await navigator.storage.persisted()
    } catch (error) {
      console.warn(
        'Не удалось проверить постоянное хранилище.',
        error,
      )
    }
  }

  if (
    typeof navigator.storage.estimate ===
    'function'
  ) {
    try {
      const estimate =
        await navigator.storage.estimate()

      usage =
        Number.isFinite(estimate.usage)
          ? estimate.usage
          : null

      quota =
        Number.isFinite(estimate.quota)
          ? estimate.quota
          : null
    } catch (error) {
      console.warn(
        'Не удалось оценить хранилище.',
        error,
      )
    }
  }

  return {
    supported:
      typeof navigator.storage.persist ===
        'function' ||
      typeof navigator.storage.persisted ===
        'function',

    persistent,
    usage,
    quota,
  }
}

export async function requestPersistentStorage() {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.storage?.persist !==
      'function'
  ) {
    return {
      supported: false,
      granted: false,
    }
  }

  try {
    const granted =
      await navigator.storage.persist()

    return {
      supported: true,
      granted,
    }
  } catch (error) {
    console.error(error)

    return {
      supported: true,
      granted: false,
    }
  }
}