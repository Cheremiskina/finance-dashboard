import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/db/database'

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref([])
  const isLoading = ref(false)
  const error = ref('')

  const activeAccounts = computed(() =>
    accounts.value.filter(
      (account) => !account.isArchived,
    ),
  )

  const archivedAccounts = computed(() =>
    accounts.value.filter(
      (account) => account.isArchived,
    ),
  )

  const totalBalance = computed(() =>
    activeAccounts.value.reduce(
      (total, account) =>
        total + Number(account.balance || 0),
      0,
    ),
  )

  async function loadAccounts() {
    isLoading.value = true
    error.value = ''

    try {
      const savedAccounts =
        await db.accounts.toArray()

      accounts.value = savedAccounts.sort(
        (first, second) =>
          String(first.createdAt).localeCompare(
            String(second.createdAt),
          ),
      )
    } catch (loadError) {
      console.error(loadError)

      error.value =
        'Не удалось загрузить счета.'
    } finally {
      isLoading.value = false
    }
  }

  async function addAccount(payload) {
    error.value = ''

    const account = {
      name: payload.name.trim(),
      type: payload.type,
      balance: Number(payload.balance),
      isArchived: false,
      archivedAt: null,
      createdAt: new Date().toISOString(),
    }

    try {
      const id = await db.accounts.add(account)

      accounts.value.push({
        ...account,
        id,
      })
    } catch (addError) {
      console.error(addError)

      error.value =
        'Не удалось сохранить счет.'

      throw addError
    }
  }

  async function renameAccount(id, newName) {
    error.value = ''

    const accountId = Number(id)
    const name = String(newName || '').trim()

    if (!name) {
        const renameError = new Error(
        'Введите новое название счета.',
        )

        error.value = renameError.message
        throw renameError
    }

    if (name.length > 50) {
        const renameError = new Error(
        'Название не должно быть длиннее 50 символов.',
        )

        error.value = renameError.message
        throw renameError
    }

    try {
        const account = await db.accounts.get(accountId)

        if (!account) {
        throw new Error('Счет не найден.')
        }

        await db.accounts.update(accountId, {
        name,
        updatedAt: new Date().toISOString(),
        })

        await loadAccounts()
    } catch (renameError) {
        console.error(renameError)

        error.value =
        renameError instanceof Error
            ? renameError.message
            : 'Не удалось изменить название счета.'

        throw renameError
    }
  }

  async function archiveAccount(id) {
    error.value = ''

    try {
      const accountId = Number(id)

      await db.transaction(
        'rw',
        db.accounts,
        db.allocationSettings,
        async () => {
          const account =
            await db.accounts.get(accountId)

          if (!account) {
            throw new Error('Счет не найден.')
          }

          if (account.isArchived) {
            return
          }

          if (
            Math.abs(
              Number(account.balance || 0),
            ) >= 0.01
          ) {
            throw new Error(
              'Сначала переведите остаток со счета. Закрыть можно только счет с нулевым балансом.',
            )
          }

          await db.accounts.update(accountId, {
            isArchived: true,
            archivedAt: new Date().toISOString(),
          })

          const settings =
            await db.allocationSettings.get('main')

          if (settings) {
            const sourceWasArchived =
              Number(settings.sourceAccountId) ===
              accountId

            const updatedRules = Array.isArray(
              settings.rules,
            )
              ? settings.rules.filter(
                  (rule) =>
                    Number(rule.targetAccountId) !==
                    accountId,
                )
              : []

            await db.allocationSettings.put({
              ...settings,

              sourceAccountId:
                sourceWasArchived
                  ? null
                  : settings.sourceAccountId,

              rules: updatedRules,
              updatedAt: new Date().toISOString(),
            })
          }
        },
      )

      await loadAccounts()
    } catch (archiveError) {
      console.error(archiveError)

      error.value =
        archiveError instanceof Error
          ? archiveError.message
          : 'Не удалось закрыть счет.'

      throw archiveError
    }
  }

  async function restoreAccount(id) {
    error.value = ''

    try {
      const accountId = Number(id)
      const account =
        await db.accounts.get(accountId)

      if (!account) {
        throw new Error('Счет не найден.')
      }

      await db.accounts.update(accountId, {
        isArchived: false,
        archivedAt: null,
      })

      await loadAccounts()
    } catch (restoreError) {
      console.error(restoreError)

      error.value =
        restoreError instanceof Error
          ? restoreError.message
          : 'Не удалось восстановить счет.'

      throw restoreError
    }
  }

  return {
    accounts,
    activeAccounts,
    archivedAccounts,
    totalBalance,
    isLoading,
    error,
    loadAccounts,
    addAccount,
    renameAccount,
    archiveAccount,
    restoreAccount,
  }
})