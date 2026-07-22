import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/db/database'
import { useAccountsStore } from '@/stores/accounts'

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref([])
  const isLoading = ref(false)
  const error = ref('')

  const currentMonthKey = computed(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')

    return `${year}-${month}`
  })

  const currentMonthTransactions = computed(() =>
    transactions.value.filter((transaction) =>
      transaction.date.startsWith(currentMonthKey.value),
    ),
  )

  const monthlyIncome = computed(() =>
    currentMonthTransactions.value
      .filter((transaction) => transaction.type === 'income')
      .reduce(
        (total, transaction) =>
          total + Number(transaction.amount || 0),
        0,
      ),
  )

  const monthlyExpense = computed(() =>
    currentMonthTransactions.value
      .filter((transaction) => transaction.type === 'expense')
      .reduce(
        (total, transaction) =>
          total + Number(transaction.amount || 0),
        0,
      ),
  )

  const monthlyResult = computed(
    () => monthlyIncome.value - monthlyExpense.value,
  )

  async function loadTransactions() {
    isLoading.value = true
    error.value = ''

    try {
      const savedTransactions = await db.transactions.toArray()

      transactions.value = savedTransactions.sort((first, second) => {
        const firstValue = `${first.date}-${first.createdAt}`
        const secondValue = `${second.date}-${second.createdAt}`

        return secondValue.localeCompare(firstValue)
      })
    } catch (loadError) {
      console.error(loadError)
      error.value = 'Не удалось загрузить операции.'
    } finally {
      isLoading.value = false
    }
  }

  async function addTransaction(payload) {
    error.value = ''

    const accountsStore = useAccountsStore()
    const amount = Number(payload.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Сумма операции должна быть больше нуля.')
    }

    const transaction = {
      type: payload.type,
      amount,
      date: payload.date,
      category:
        payload.type === 'transfer'
          ? 'Перевод'
          : payload.category,
      note: payload.note?.trim() || '',
      accountId:
        payload.type === 'income' || payload.type === 'expense'
          ? Number(payload.accountId)
          : null,
      fromAccountId:
        payload.type === 'transfer'
          ? Number(payload.fromAccountId)
          : null,
      toAccountId:
        payload.type === 'transfer'
          ? Number(payload.toAccountId)
          : null,
      createdAt: new Date().toISOString(),
    }

    try {
      await db.transaction(
        'rw',
        db.accounts,
        db.transactions,
        async () => {
          if (transaction.type === 'income') {
            const account = await db.accounts.get(transaction.accountId)

            if (!account) {
              throw new Error('Счет не найден.')
            }

            await db.accounts.update(account.id, {
              balance: Number(account.balance || 0) + amount,
            })
          }

          if (transaction.type === 'expense') {
            const account = await db.accounts.get(transaction.accountId)

            if (!account) {
              throw new Error('Счет не найден.')
            }

            await db.accounts.update(account.id, {
              balance: Number(account.balance || 0) - amount,
            })
          }

          if (transaction.type === 'transfer') {
            if (
              transaction.fromAccountId === transaction.toAccountId
            ) {
              throw new Error(
                'Счета отправления и получения должны различаться.',
              )
            }

            const fromAccount = await db.accounts.get(
              transaction.fromAccountId,
            )

            const toAccount = await db.accounts.get(
              transaction.toAccountId,
            )

            if (!fromAccount || !toAccount) {
              throw new Error('Один из счетов не найден.')
            }

            await db.accounts.update(fromAccount.id, {
              balance: Number(fromAccount.balance || 0) - amount,
            })

            await db.accounts.update(toAccount.id, {
              balance: Number(toAccount.balance || 0) + amount,
            })
          }

          await db.transactions.add(transaction)
        },
      )

      await Promise.all([
        loadTransactions(),
        accountsStore.loadAccounts(),
      ])
    } catch (addError) {
      console.error(addError)
      error.value =
        addError instanceof Error
          ? addError.message
          : 'Не удалось сохранить операцию.'

      throw addError
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
  }
})