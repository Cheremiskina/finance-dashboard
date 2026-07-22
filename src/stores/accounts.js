import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/db/database'

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function validateAccountName(value) {
  const name = String(value || '').trim()

  if (!name) {
    throw new Error('Введите название счета.')
  }

  if (name.length > 50) {
    throw new Error(
      'Название не должно быть длиннее 50 символов.',
    )
  }

  return name
}

export const useAccountsStore = defineStore(
  'accounts',
  () => {
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

      try {
        const name = validateAccountName(
          payload.name,
        )

        const balance = Number(payload.balance)

        if (!Number.isFinite(balance)) {
          throw new Error(
            'Введите корректный баланс.',
          )
        }

        const account = {
          name,
          type: payload.type,
          balance: roundMoney(balance),
          isArchived: false,
          archivedAt: null,
          balanceAdjustedAt: null,
          balanceBeforeAdjustment: null,
          createdAt: new Date().toISOString(),
          updatedAt: null,
        }

        const id =
          await db.accounts.add(account)

        accounts.value.push({
          ...account,
          id,
        })
      } catch (addError) {
        console.error(addError)

        error.value =
          addError instanceof Error
            ? addError.message
            : 'Не удалось сохранить счет.'

        throw addError
      }
    }

    async function updateAccount(
      id,
      payload,
    ) {
      error.value = ''

      try {
        const accountId = Number(id)
        const name = validateAccountName(
          payload.name,
        )

        const balance = Number(
          payload.balance,
        )

        if (!Number.isFinite(balance)) {
          throw new Error(
            'Введите корректный баланс.',
          )
        }

        const account =
          await db.accounts.get(accountId)

        if (!account) {
          throw new Error(
            'Счет не найден.',
          )
        }

        const currentBalance = roundMoney(
          account.balance,
        )

        const nextBalance = roundMoney(
          balance,
        )

        const balanceChanged =
          Math.abs(
            nextBalance - currentBalance,
          ) >= 0.01

        if (
          account.isArchived &&
          balanceChanged
        ) {
          throw new Error(
            'Сначала восстановите счет. Баланс закрытого счета изменять нельзя.',
          )
        }

        const updatedAt =
          new Date().toISOString()

        const changes = {
          name,
          updatedAt,
        }

        if (!account.isArchived) {
          changes.balance = nextBalance

          if (balanceChanged) {
            changes.balanceBeforeAdjustment =
              currentBalance

            changes.balanceAdjustedAt =
              updatedAt
          }
        }

        await db.accounts.update(
          accountId,
          changes,
        )

        await loadAccounts()
      } catch (updateError) {
        console.error(updateError)

        error.value =
          updateError instanceof Error
            ? updateError.message
            : 'Не удалось изменить счет.'

        throw updateError
      }
    }

    async function renameAccount(
      id,
      newName,
    ) {
      const account =
        await db.accounts.get(Number(id))

      if (!account) {
        throw new Error(
          'Счет не найден.',
        )
      }

      return updateAccount(id, {
        name: newName,
        balance: account.balance,
      })
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
              throw new Error(
                'Счет не найден.',
              )
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

            await db.accounts.update(
              accountId,
              {
                isArchived: true,
                archivedAt:
                  new Date().toISOString(),
                updatedAt:
                  new Date().toISOString(),
              },
            )

            const settings =
              await db.allocationSettings.get(
                'main',
              )

            if (settings) {
              const sourceWasArchived =
                Number(
                  settings.sourceAccountId,
                ) === accountId

              const updatedRules =
                Array.isArray(
                  settings.rules,
                )
                  ? settings.rules.filter(
                      (rule) =>
                        Number(
                          rule.targetAccountId,
                        ) !== accountId,
                    )
                  : []

              await db.allocationSettings.put({
                ...settings,

                sourceAccountId:
                  sourceWasArchived
                    ? null
                    : settings.sourceAccountId,

                rules: updatedRules,

                updatedAt:
                  new Date().toISOString(),
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
          throw new Error(
            'Счет не найден.',
          )
        }

        await db.accounts.update(
          accountId,
          {
            isArchived: false,
            archivedAt: null,
            updatedAt:
              new Date().toISOString(),
          },
        )

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
      updateAccount,
      renameAccount,
      archiveAccount,
      restoreAccount,
    }
  },
)