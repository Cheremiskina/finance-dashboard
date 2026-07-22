import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/db/database'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function createDefaultCategories() {
  return [
    {
      id: createId(),
      name: 'Продукты',
      amount: 12000,
    },
    {
      id: createId(),
      name: 'Обеды на работе',
      amount: 4000,
    },
    {
      id: createId(),
      name: 'Транспорт',
      amount: 3000,
    },
    {
      id: createId(),
      name: 'Красота',
      amount: 3000,
    },
    {
      id: createId(),
      name: 'Развлечения',
      amount: 5000,
    },
    {
      id: createId(),
      name: 'Дом и быт',
      amount: 3000,
    },
    {
      id: createId(),
      name: 'Прочее',
      amount: 5000,
    },
  ]
}

function createDefaultSettings() {
  return {
    id: 'main',
    sourceAccountId: null,

    salaryDayFirst: 5,
    salaryAmountFirst: 0,

    salaryDaySecond: 20,
    salaryAmountSecond: 0,

    minimumBalance: 0,
    categories: createDefaultCategories(),
    rules: [],
    updatedAt: null,
  }
}

function normalizeSalaryDay(value, fallback) {
  const day = Math.trunc(Number(value))

  if (
    !Number.isFinite(day) ||
    day < 1 ||
    day > 28
  ) {
    return fallback
  }

  return day
}

function normalizeSettings(savedSettings) {
  const defaults = createDefaultSettings()

  if (!savedSettings) {
    return defaults
  }

  const salaryDayFirst = normalizeSalaryDay(
    savedSettings.salaryDayFirst,
    defaults.salaryDayFirst,
  )

  const salaryDaySecond = normalizeSalaryDay(
    savedSettings.salaryDaySecond,
    defaults.salaryDaySecond,
  )

  return {
    id: 'main',

    sourceAccountId:
      savedSettings.sourceAccountId === null ||
      savedSettings.sourceAccountId === undefined
        ? null
        : Number(savedSettings.sourceAccountId),

    salaryDayFirst,
    salaryAmountFirst: Math.max(
      0,
      Number(savedSettings.salaryAmountFirst || 0),
    ),

    salaryDaySecond,
    salaryAmountSecond: Math.max(
      0,
      Number(savedSettings.salaryAmountSecond || 0),
    ),

    minimumBalance: Number(
      savedSettings.minimumBalance || 0,
    ),

    categories:
      Array.isArray(savedSettings.categories) &&
      savedSettings.categories.length
        ? savedSettings.categories.map((category) => ({
            id: category.id || createId(),
            name: String(category.name || ''),
            amount: Number(category.amount || 0),
          }))
        : defaults.categories,

    rules: Array.isArray(savedSettings.rules)
      ? savedSettings.rules.map((rule) => ({
          targetAccountId: Number(
            rule.targetAccountId,
          ),

          percentage: Number(
            rule.percentage || 0,
          ),
        }))
      : [],

    updatedAt: savedSettings.updatedAt || null,
  }
}

function calculateLifeBudget(settings) {
  return settings.categories.reduce(
    (total, category) =>
      total + Number(category.amount || 0),
    0,
  )
}

function calculatePercentage(settings) {
  return settings.rules.reduce(
    (total, rule) =>
      total + Number(rule.percentage || 0),
    0,
  )
}

function parseReferenceDate(value) {
  if (value instanceof Date) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      12,
      0,
      0,
      0,
    )
  }

  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const [year, month, day] = value
      .split('-')
      .map(Number)

    return new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0,
    )
  }

  const now = new Date()

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
    0,
  )
}

function formatDateKey(date) {
  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')

  const day = String(
    date.getDate(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function daysBetween(firstDate, secondDate) {
  const firstUtc = Date.UTC(
    firstDate.getFullYear(),
    firstDate.getMonth(),
    firstDate.getDate(),
  )

  const secondUtc = Date.UTC(
    secondDate.getFullYear(),
    secondDate.getMonth(),
    secondDate.getDate(),
  )

  return Math.round(
    (secondUtc - firstUtc) /
      DAY_IN_MILLISECONDS,
  )
}

function createSalaryOccurrences(
  settings,
  referenceDate,
) {
  const occurrences = []

  for (
    let monthOffset = -2;
    monthOffset <= 2;
    monthOffset += 1
  ) {
    const monthStart = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + monthOffset,
      1,
      12,
      0,
      0,
      0,
    )

    occurrences.push({
      slot: 'first',
      day: settings.salaryDayFirst,
      amount: Number(
        settings.salaryAmountFirst || 0,
      ),

      date: new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        settings.salaryDayFirst,
        12,
        0,
        0,
        0,
      ),
    })

    occurrences.push({
      slot: 'second',
      day: settings.salaryDaySecond,
      amount: Number(
        settings.salaryAmountSecond || 0,
      ),

      date: new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        settings.salaryDaySecond,
        12,
        0,
        0,
        0,
      ),
    })
  }

  return occurrences.sort(
    (first, second) =>
      first.date.getTime() -
      second.date.getTime(),
  )
}

function calculateSalarySchedule(
  settings,
  referenceValue,
) {
  const referenceDate =
    parseReferenceDate(referenceValue)

  const occurrences =
    createSalaryOccurrences(
      settings,
      referenceDate,
    )

  const currentPayment = [
    ...occurrences,
  ]
    .reverse()
    .find(
      (occurrence) =>
        occurrence.date.getTime() <=
        referenceDate.getTime(),
    )

  const upcomingPayment =
    occurrences.find(
      (occurrence) =>
        occurrence.date.getTime() >=
        referenceDate.getTime(),
    )

  const periodEnd =
    occurrences.find(
      (occurrence) =>
        occurrence.date.getTime() >
        currentPayment.date.getTime(),
    )

  const isPayday =
    upcomingPayment.date.getTime() ===
    referenceDate.getTime()

  return {
    date: formatDateKey(referenceDate),
    isPayday,

    currentPeriodStart:
      formatDateKey(currentPayment.date),

    currentPeriodEnd:
      formatDateKey(periodEnd.date),

    currentPaymentDay:
      currentPayment.day,

    currentExpectedAmount:
      currentPayment.amount,

    nextPaymentDate:
      formatDateKey(upcomingPayment.date),

    nextPaymentDay:
      upcomingPayment.day,

    nextExpectedAmount:
      upcomingPayment.amount,

    daysUntilNextPayment:
      daysBetween(
        referenceDate,
        upcomingPayment.date,
      ),

    daysRemainingInPeriod:
      daysBetween(
        referenceDate,
        periodEnd.date,
      ),

    periodLengthDays:
      daysBetween(
        currentPayment.date,
        periodEnd.date,
      ),
  }
}

function calculateDistributionResult(
  settings,
  sourceBalance,
) {
  const balance = Number(sourceBalance || 0)

  const lifeBudget =
    calculateLifeBudget(settings)

  const minimumBalance = Number(
    settings.minimumBalance || 0,
  )

  const amountToKeep =
    lifeBudget + minimumBalance

  const amountToDistribute = Math.max(
    0,
    balance - amountToKeep,
  )

  const activeRules = settings.rules.filter(
    (rule) =>
      Number(rule.percentage) > 0,
  )

  const totalPercentage =
    activeRules.reduce(
      (total, rule) =>
        total +
        Number(rule.percentage || 0),
      0,
    )

  const isValid =
    activeRules.length > 0 &&
    Math.abs(
      totalPercentage - 100,
    ) < 0.001

  if (
    !isValid ||
    amountToDistribute <= 0
  ) {
    return {
      sourceBalance: balance,
      lifeBudget,
      minimumBalance,
      amountToKeep,
      amountToDistribute,
      totalPercentage,
      isValid,

      items: activeRules.map((rule) => ({
        targetAccountId:
          rule.targetAccountId,

        percentage:
          rule.percentage,

        amount: 0,
      })),
    }
  }

  const totalCents = Math.round(
    amountToDistribute * 100,
  )

  let allocatedCents = 0

  const items = activeRules.map(
    (rule, index) => {
      let amountCents

      if (
        index ===
        activeRules.length - 1
      ) {
        amountCents =
          totalCents - allocatedCents
      } else {
        amountCents = Math.floor(
          totalCents *
            (
              Number(
                rule.percentage,
              ) / 100
            ),
        )

        allocatedCents += amountCents
      }

      return {
        targetAccountId: Number(
          rule.targetAccountId,
        ),

        percentage: Number(
          rule.percentage,
        ),

        amount: amountCents / 100,
      }
    },
  )

  return {
    sourceBalance: balance,
    lifeBudget,
    minimumBalance,
    amountToKeep,

    amountToDistribute:
      totalCents / 100,

    totalPercentage,
    isValid,
    items,
  }
}

export const useAllocationStore = defineStore(
  'allocation',
  () => {
    const settings = ref(
      createDefaultSettings(),
    )

    const allocationRuns = ref([])

    const isLoading = ref(false)
    const isSaving = ref(false)
    const isExecuting = ref(false)
    const error = ref('')

    const lifeBudget = computed(() =>
      calculateLifeBudget(
        settings.value,
      ),
    )

    const totalPercentage = computed(() =>
      calculatePercentage(
        settings.value,
      ),
    )

    const expectedMonthlyIncome =
      computed(
        () =>
          Number(
            settings.value
              .salaryAmountFirst || 0,
          ) +
          Number(
            settings.value
              .salaryAmountSecond || 0,
          ),
      )

    async function loadSettings() {
      isLoading.value = true
      error.value = ''

      try {
        const savedSettings =
          await db.allocationSettings.get(
            'main',
          )

        settings.value =
          normalizeSettings(
            savedSettings,
          )
      } catch (loadError) {
        console.error(loadError)

        error.value =
          'Не удалось загрузить настройки распределения.'
      } finally {
        isLoading.value = false
      }
    }

    async function saveSettings(payload) {
      isSaving.value = true
      error.value = ''

      const normalizedSettings =
        normalizeSettings({
          ...payload,
          id: 'main',
          updatedAt:
            new Date().toISOString(),
        })

      try {
        await db.allocationSettings.put(
          normalizedSettings,
        )

        settings.value =
          normalizedSettings
      } catch (saveError) {
        console.error(saveError)

        error.value =
          'Не удалось сохранить настройки распределения.'

        throw saveError
      } finally {
        isSaving.value = false
      }
    }

    async function loadRuns() {
      try {
        const savedRuns =
          await db.allocationRuns.toArray()

        allocationRuns.value =
          savedRuns.sort(
            (first, second) =>
              String(
                second.createdAt,
              ).localeCompare(
                String(
                  first.createdAt,
                ),
              ),
          )
      } catch (loadError) {
        console.error(loadError)

        error.value =
          'Не удалось загрузить историю распределений.'
      }
    }

    function calculateDistribution(
      sourceBalance,
    ) {
      return calculateDistributionResult(
        settings.value,
        sourceBalance,
      )
    }

    function getSalaryScheduleInfo(
      referenceDate,
    ) {
      return calculateSalarySchedule(
        settings.value,
        referenceDate,
      )
    }

    async function executeDistribution(
      payload,
    ) {
      error.value = ''
      isExecuting.value = true

      const accountsStore =
        useAccountsStore()

      const transactionsStore =
        useTransactionsStore()

      try {
        const sourceAccountId =
          Number(
            settings.value
              .sourceAccountId,
          )

        if (!sourceAccountId) {
          throw new Error(
            'Не выбран счет поступления дохода.',
          )
        }

        let createdRunId = null

        await db.transaction(
          'rw',
          db.accounts,
          db.transactions,
          db.allocationRuns,
          async () => {
            const sourceAccount =
              await db.accounts.get(
                sourceAccountId,
              )

            if (
              !sourceAccount ||
              sourceAccount.isArchived
            ) {
              throw new Error(
                'Основной счет не найден или закрыт.',
              )
            }

            const calculation =
              calculateDistributionResult(
                settings.value,
                sourceAccount.balance,
              )

            const salarySchedule =
              calculateSalarySchedule(
                settings.value,
                payload.date,
              )

            if (!calculation.isValid) {
              throw new Error(
                'Проверьте проценты распределения в настройках.',
              )
            }

            if (
              calculation
                .amountToDistribute <= 0
            ) {
              throw new Error(
                'Сейчас нет свободных денег для распределения.',
              )
            }

            const targetAccounts =
              new Map()

            for (
              const item of
              calculation.items
            ) {
              const targetAccount =
                await db.accounts.get(
                  item.targetAccountId,
                )

              if (
                !targetAccount ||
                targetAccount.isArchived
              ) {
                throw new Error(
                  'Один из счетов распределения не найден или закрыт. Обновите настройки.',
                )
              }

              if (
                targetAccount.id ===
                sourceAccountId
              ) {
                throw new Error(
                  'Основной счет не может быть счетом накопления.',
                )
              }

              targetAccounts.set(
                targetAccount.id,
                targetAccount,
              )
            }

            await db.accounts.update(
              sourceAccountId,
              {
                balance: roundMoney(
                  Number(
                    sourceAccount.balance,
                  ) -
                    calculation
                      .amountToDistribute,
                ),
              },
            )

            for (
              const item of
              calculation.items
            ) {
              const targetAccount =
                targetAccounts.get(
                  item.targetAccountId,
                )

              await db.accounts.update(
                targetAccount.id,
                {
                  balance:
                    roundMoney(
                      Number(
                        targetAccount.balance ||
                          0,
                      ) +
                        Number(
                          item.amount,
                        ),
                    ),
                },
              )
            }

            const createdAt =
              new Date().toISOString()

            const createdAtBase =
              Date.now()

            await db.transactions.bulkAdd(
              calculation.items.map(
                (item, index) => ({
                  type: 'transfer',
                  amount: item.amount,
                  date: payload.date,

                  category:
                    'Распределение дохода',

                  note:
                    salarySchedule.isPayday
                      ? 'Распределение после зарплаты'
                      : 'Повторное распределение остатка',

                  accountId: null,

                  fromAccountId:
                    sourceAccountId,

                  toAccountId:
                    item.targetAccountId,

                  createdAt: new Date(
                    createdAtBase + index,
                  ).toISOString(),
                }),
              ),
            )

            createdRunId =
              await db.allocationRuns.add({
                date: payload.date,
                sourceAccountId,

                sourceBalanceBefore:
                  calculation.sourceBalance,

                lifeBudget:
                  calculation.lifeBudget,

                minimumBalance:
                  calculation.minimumBalance,

                amountToKeep:
                  calculation.amountToKeep,

                amountDistributed:
                  calculation
                    .amountToDistribute,

                salaryPeriodStart:
                  salarySchedule
                    .currentPeriodStart,

                salaryPeriodEnd:
                  salarySchedule
                    .currentPeriodEnd,

                salaryExpectedAmount:
                  salarySchedule
                    .currentExpectedAmount,

                distributionKind:
                  salarySchedule.isPayday
                    ? 'salary'
                    : 'remainder',

                items:
                  calculation.items.map(
                    (item) => ({
                      targetAccountId:
                        item.targetAccountId,

                      percentage:
                        item.percentage,

                      amount:
                        item.amount,
                    }),
                  ),

                status: 'completed',
                createdAt,
              })
          },
        )

        await Promise.all([
          accountsStore.loadAccounts(),
          transactionsStore
            .loadTransactions(),
          loadRuns(),
        ])

        return createdRunId
      } catch (executeError) {
        console.error(executeError)

        error.value =
          executeError instanceof Error
            ? executeError.message
            : 'Не удалось выполнить распределение.'

        throw executeError
      } finally {
        isExecuting.value = false
      }
    }

    return {
      settings,
      allocationRuns,

      lifeBudget,
      totalPercentage,
      expectedMonthlyIncome,

      isLoading,
      isSaving,
      isExecuting,
      error,

      loadSettings,
      saveSettings,
      loadRuns,
      calculateDistribution,
      getSalaryScheduleInfo,
      executeDistribution,
    }
  },
)