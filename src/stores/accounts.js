import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/db/database'

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref([])
  const isLoading = ref(false)
  const error = ref('')

  const activeAccounts = computed(() =>
    accounts.value.filter((account) => !account.isArchived),
  )

  const totalBalance = computed(() =>
    activeAccounts.value.reduce(
      (total, account) => total + Number(account.balance || 0),
      0,
    ),
  )

  async function loadAccounts() {
    isLoading.value = true
    error.value = ''

    try {
      const savedAccounts = await db.accounts.toArray()

      accounts.value = savedAccounts.sort((first, second) =>
        first.createdAt.localeCompare(second.createdAt),
      )
    } catch (loadError) {
      console.error(loadError)
      error.value = 'Не удалось загрузить счета.'
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
      error.value = 'Не удалось сохранить счет.'
      throw addError
    }
  }

  async function deleteAccount(id) {
    error.value = ''

    try {
      await db.accounts.delete(id)

      accounts.value = accounts.value.filter(
        (account) => account.id !== id,
      )
    } catch (deleteError) {
      console.error(deleteError)
      error.value = 'Не удалось удалить счет.'
      throw deleteError
    }
  }

  return {
    accounts,
    activeAccounts,
    totalBalance,
    isLoading,
    error,
    loadAccounts,
    addAccount,
    deleteAccount,
  }
})