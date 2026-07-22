import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/db/database'
import { useAccountsStore } from '@/stores/accounts'

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

function isProtectedTransaction(transaction) {
  return (
    transaction.category === 'Распределение дохода' ||
    transaction.note === 'Автоматическое распределение'
  )
}

function createTransaction(payload, existingTransaction = null) {
  const type = payload.type
  const amount = Number(payload.amount)

  if (!['income', 'expense', 'transfer'].includes(type)) {
    throw new Error('Неизвестный тип операции.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Сумма операции должна быть больше нуля.')
  }

  const transaction = {
    type,
    amount: roundMoney(amount),
    date: payload.date,
    category:
      type === 'transfer'
        ? 'Перевод'
        : String(payload.category || 'Другое'),
    note: payload.note?.trim() || '',

    accountId:
      type === 'income' || type === 'expense'
        ? Number(payload.accountId)
        : null,

    fromAccountId:
      type === 'transfer'
        ? Number(payload.fromAccountId)
        : null,

    toAccountId:
      type === 'transfer'
        ? Number(payload.toAccountId)
        : null,

    createdAt:
      existingTransaction?.createdAt ??
      new Date().toISOString(),

    updatedAt:
      existingTransaction
        ? new Date().toISOString()
        : null,
  }

  if (
    (type === 'income' || type === 'expense') &&
    !transaction.accountId
  ) {
    throw new Error('Выберите счет.')
  }

  if (type === 'transfer') {
    if (
      !transaction.fromAccountId ||
      !transaction.toAccountId
    ) {
      throw new Error('Выберите оба счета.')
    }

    if (
      transaction.fromAccountId ===
      transaction.toAccountId
    ) {
      throw new Error(
        'Счета отправления и получения должны различаться.',
      )
    }
  }

  return transaction
}

export const useTransactionsStore = defineStore(
  'transactions',
  () => {
    const transactions = ref([])
    const isLoading = ref(false)
    const error = ref('')

    const currentMonthKey = computed(() => {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(
        now.getMonth() + 1,
      ).padStart(2, '0')

      return `${year}-${month}`
    })

    const currentMonthTransactions = computed(() =>
      transactions.value.filter((transaction) =>
        transaction.date.startsWith(
          currentMonthKey.value,
        ),
      ),
    )

    const monthlyIncome = computed(() =>
      currentMonthTransactions.value
        .filter(
          (transaction) =>
            transaction.type === 'income',
        )
        .reduce(
          (total, transaction) =>
            total + Number(transaction.amount || 0),
          0,
        ),
    )

    const monthlyExpense = computed(() =>
      currentMonthTransactions.value
        .filter(
          (transaction) =>
            transaction.type === 'expense',
        )
        .reduce(
          (total, transaction) =>
            total + Number(transaction.amount || 0),
          0,
        ),
    )

    const monthlyResult = computed(
      () =>
        monthlyIncome.value -
        monthlyExpense.value,
    )

    async function updateAccountBalance(
      accountId,
      difference,
    ) {
      const account = await db.accounts.get(
        Number(accountId),
      )

      if (!account) {
        throw new Error(
          'Счет операции не найден.',
        )
      }

      await db.accounts.update(account.id, {
        balance: roundMoney(
          Number(account.balance || 0) +
            Number(difference),
        ),
      })
    }

    async function applyTransactionEffect(
      transaction,
      direction = 1,
    ) {
      const amount =
        Number(transaction.amount) *
        Number(direction)

      if (transaction.type === 'income') {
        await updateAccountBalance(
          transaction.accountId,
          amount,
        )
      }

      if (transaction.type === 'expense') {
        await updateAccountBalance(
          transaction.accountId,
          -amount,
        )
      }

      if (transaction.type === 'transfer') {
        await updateAccountBalance(
          transaction.fromAccountId,
          -amount,
        )

        await updateAccountBalance(
          transaction.toAccountId,
          amount,
        )
      }
    }

    async function refreshStores() {
      const accountsStore = useAccountsStore()

      await Promise.all([
        loadTransactions(),
        accountsStore.loadAccounts(),
      ])
    }

    async function loadTransactions() {
      isLoading.value = true
      error.value = ''

      try {
        const savedTransactions =
          await db.transactions.toArray()

        transactions.value =
          savedTransactions.sort(
            (first, second) => {
              const firstValue =
                `${first.date}-${first.createdAt}`

              const secondValue =
                `${second.date}-${second.createdAt}`

              return secondValue.localeCompare(
                firstValue,
              )
            },
          )
      } catch (loadError) {
        console.error(loadError)

        error.value =
          'Не удалось загрузить операции.'
      } finally {
        isLoading.value = false
      }
    }

    async function addTransaction(payload) {
      error.value = ''

      const transaction =
        createTransaction(payload)

      try {
        await db.transaction(
          'rw',
          db.accounts,
          db.transactions,
          async () => {
            await applyTransactionEffect(
              transaction,
              1,
            )

            await db.transactions.add(
              transaction,
            )
          },
        )

        await refreshStores()
      } catch (addError) {
        console.error(addError)

        error.value =
          addError instanceof Error
            ? addError.message
            : 'Не удалось сохранить операцию.'

        throw addError
      }
    }

    async function updateTransaction(
      transactionId,
      payload,
    ) {
      error.value = ''

      try {
        await db.transaction(
          'rw',
          db.accounts,
          db.transactions,
          async () => {
            const existingTransaction =
              await db.transactions.get(
                Number(transactionId),
              )

            if (!existingTransaction) {
              throw new Error(
                'Операция не найдена.',
              )
            }

            if (
              isProtectedTransaction(
                existingTransaction,
              )
            ) {
              throw new Error(
                'Автоматическое распределение нельзя изменить как обычную операцию.',
              )
            }

            const updatedTransaction =
              createTransaction(
                payload,
                existingTransaction,
              )

            // Отменяем старое влияние на балансы.
            await applyTransactionEffect(
              existingTransaction,
              -1,
            )

            // Применяем новую версию операции.
            await applyTransactionEffect(
              updatedTransaction,
              1,
            )

            await db.transactions.put({
              ...updatedTransaction,
              id: existingTransaction.id,
            })
          },
        )

        await refreshStores()
      } catch (updateError) {
        console.error(updateError)

        error.value =
          updateError instanceof Error
            ? updateError.message
            : 'Не удалось изменить операцию.'

        throw updateError
      }
    }

    async function deleteTransaction(
      transactionId,
    ) {
      error.value = ''

      try {
        await db.transaction(
          'rw',
          db.accounts,
          db.transactions,
          async () => {
            const existingTransaction =
              await db.transactions.get(
                Number(transactionId),
              )

            if (!existingTransaction) {
              throw new Error(
                'Операция не найдена.',
              )
            }

            if (
              isProtectedTransaction(
                existingTransaction,
              )
            ) {
              throw new Error(
                'Автоматическое распределение нельзя удалить отдельно.',
              )
            }

            // Возвращаем балансы к состоянию
            // до создания операции.
            await applyTransactionEffect(
              existingTransaction,
              -1,
            )

            await db.transactions.delete(
              existingTransaction.id,
            )
          },
        )

        await refreshStores()
      } catch (deleteError) {
        console.error(deleteError)

        error.value =
          deleteError instanceof Error
            ? deleteError.message
            : 'Не удалось удалить операцию.'

        throw deleteError
      }
    }

    return {
      transactions,
      currentMonthTransactions,
      monthlyIncome,
      monthlyExpense,
      monthlyResult,
      isLoading,
      error,
      loadTransactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      isProtectedTransaction,
    }
  },
)