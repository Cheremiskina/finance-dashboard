<script setup>
import {
  computed,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { RouterLink } from 'vue-router'
import DataHealthCard from '@/components/DataHealthCard.vue'
import {
  exportBackup,
  importBackup,
} from '@/services/backup'
import {
  recordBackupCreated,
} from '@/services/dataHealth'
import { useAccountsStore } from '@/stores/accounts'
import { useAllocationStore } from '@/stores/allocation'

const accountsStore = useAccountsStore()
const allocationStore = useAllocationStore()

const formError = ref('')
const successMessage = ref('')

const backupFileInput = ref(null)
const backupMessage = ref('')
const backupError = ref('')
const isExportingBackup = ref(false)
const isImportingBackup = ref(false)

const form = reactive({
  sourceAccountId: '',

  salaryDayFirst: '5',
  salaryAmountFirst: '0',

  salaryDaySecond: '20',
  salaryAmountSecond: '0',

  minimumBalance: '0',
  categories: [],
  rules: [],
})

const accountTypes = {
  card: {
    label: 'Банковская карта',
    icon: '💳',
  },

  cash: {
    label: 'Наличные',
    icon: '💵',
  },

  savings: {
    label: 'Накопительный счет',
    icon: '🏦',
  },

  deposit: {
    label: 'Вклад',
    icon: '🔒',
  },

  broker: {
    label: 'Брокерский счет',
    icon: '📈',
  },
}

const totalLifeBudget = computed(() =>
  form.categories.reduce(
    (total, category) =>
      total + parseNumber(category.amount),
    0,
  ),
)

const minimumBalance = computed(() =>
  parseNumber(form.minimumBalance),
)

const totalToKeep = computed(
  () =>
    totalLifeBudget.value +
    minimumBalance.value,
)

const totalPercentage = computed(() =>
  form.rules.reduce(
    (total, rule) =>
      total + parseNumber(rule.percentage),
    0,
  ),
)

const percentageIsValid = computed(
  () =>
    Math.abs(
      totalPercentage.value - 100,
    ) < 0.001,
)

const expectedMonthlyIncome = computed(
  () =>
    parseNumber(form.salaryAmountFirst) +
    parseNumber(form.salaryAmountSecond),
)

onMounted(async () => {
  await Promise.all([
    accountsStore.loadAccounts(),
    allocationStore.loadSettings(),
  ])

  hydrateForm()
})

watch(
  () => form.sourceAccountId,
  () => {
    syncRules()
    successMessage.value = ''
  },
)

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseNumber(value) {
  const normalized = String(value ?? '')
    .replace(/\s/g, '')
    .replace(',', '.')

  const result = Number(normalized)

  return Number.isFinite(result)
    ? result
    : 0
}

function hydrateForm() {
  const saved = allocationStore.settings

  form.sourceAccountId =
    saved.sourceAccountId ?? ''

  form.salaryDayFirst = String(
    saved.salaryDayFirst ?? 5,
  )

  form.salaryAmountFirst = String(
    saved.salaryAmountFirst ?? 0,
  )

  form.salaryDaySecond = String(
    saved.salaryDaySecond ?? 20,
  )

  form.salaryAmountSecond = String(
    saved.salaryAmountSecond ?? 0,
  )

  form.minimumBalance = String(
    saved.minimumBalance ?? 0,
  )

  form.categories = saved.categories.map(
    (category) => ({
      id: category.id,
      name: category.name,
      amount: String(category.amount),
    }),
  )

  form.rules = saved.rules.map(
    (rule) => ({
      targetAccountId: Number(
        rule.targetAccountId,
      ),

      percentage: String(
        rule.percentage,
      ),
    }),
  )

  if (
    !form.sourceAccountId &&
    accountsStore.activeAccounts.length
  ) {
    const preferredSource =
      accountsStore.activeAccounts.find(
        (account) =>
          account.type === 'card',
      ) ??
      accountsStore.activeAccounts[0]

    form.sourceAccountId =
      preferredSource.id
  }

  syncRules()
}

function syncRules() {
  const sourceId = Number(
    form.sourceAccountId,
  )

  const existingRules = new Map(
    form.rules.map((rule) => [
      Number(rule.targetAccountId),
      rule,
    ]),
  )

  form.rules = accountsStore.activeAccounts
    .filter(
      (account) =>
        account.id !== sourceId,
    )
    .map((account) => {
      const existingRule =
        existingRules.get(account.id)

      return {
        targetAccountId: account.id,

        percentage:
          existingRule?.percentage ?? '0',
      }
    })
}

function getAccount(accountId) {
  return accountsStore.activeAccounts.find(
    (account) =>
      account.id === Number(accountId),
  )
}

function getAccountType(type) {
  return (
    accountTypes[type] ?? {
      label: 'Другой счет',
      icon: '💰',
    }
  )
}

function formatMoney(value) {
  return new Intl.NumberFormat(
    'ru-RU',
    {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    },
  ).format(Number(value || 0))
}

function addCategory() {
  form.categories.push({
    id: createId(),
    name: '',
    amount: '',
  })

  successMessage.value = ''
}

function removeCategory(categoryId) {
  form.categories =
    form.categories.filter(
      (category) =>
        category.id !== categoryId,
    )

  successMessage.value = ''
}

async function handleSave() {
  formError.value = ''
  successMessage.value = ''

  const sourceAccountId = Number(
    form.sourceAccountId,
  )

  const salaryDayFirst = Math.trunc(
    parseNumber(form.salaryDayFirst),
  )

  const salaryDaySecond = Math.trunc(
    parseNumber(form.salaryDaySecond),
  )

  const salaryAmountFirst = parseNumber(
    form.salaryAmountFirst,
  )

  const salaryAmountSecond = parseNumber(
    form.salaryAmountSecond,
  )

  if (!sourceAccountId) {
    formError.value =
      'Выберите счет, на который поступает доход.'

    return
  }

  if (
    salaryDayFirst < 1 ||
    salaryDayFirst > 28 ||
    salaryDaySecond < 1 ||
    salaryDaySecond > 28
  ) {
    formError.value =
      'Дни выплаты должны быть от 1 до 28.'

    return
  }

  if (
    salaryDayFirst >=
    salaryDaySecond
  ) {
    formError.value =
      'Первая выплата должна быть раньше второй.'

    return
  }

  if (
    salaryAmountFirst < 0 ||
    salaryAmountSecond < 0
  ) {
    formError.value =
      'Ожидаемая сумма зарплаты не может быть отрицательной.'

    return
  }

  if (minimumBalance.value < 0) {
    formError.value =
      'Неснижаемый остаток не может быть отрицательным.'

    return
  }

  if (!form.categories.length) {
    formError.value =
      'Добавьте хотя бы одну категорию бюджета.'

    return
  }

  for (const category of form.categories) {
    if (!category.name.trim()) {
      formError.value =
        'У каждой категории должно быть название.'

      return
    }

    if (
      parseNumber(category.amount) < 0
    ) {
      formError.value =
        'Сумма категории не может быть отрицательной.'

      return
    }
  }

  const activeRules = form.rules
    .map((rule) => ({
      targetAccountId: Number(
        rule.targetAccountId,
      ),

      percentage: parseNumber(
        rule.percentage,
      ),
    }))
    .filter(
      (rule) =>
        rule.percentage > 0,
    )

  if (!activeRules.length) {
    formError.value =
      'Укажите хотя бы одно направление распределения.'

    return
  }

  if (!percentageIsValid.value) {
    formError.value =
      'Сумма процентов распределения должна быть равна 100%.'

    return
  }

  try {
    await allocationStore.saveSettings({
      id: 'main',
      sourceAccountId,

      salaryDayFirst,
      salaryAmountFirst,

      salaryDaySecond,
      salaryAmountSecond,

      minimumBalance:
        minimumBalance.value,

      categories:
        form.categories.map(
          (category) => ({
            id: category.id,

            name:
              category.name.trim(),

            amount:
              parseNumber(
                category.amount,
              ),
          }),
        ),

      rules: activeRules,
    })

    successMessage.value =
      'Настройки сохранены.'
  } catch {
    formError.value =
      'Не удалось сохранить настройки.'
  }
}

async function handleExportBackup() {
  backupMessage.value = ''
  backupError.value = ''
  isExportingBackup.value = true

  try {
    const result =
      await exportBackup()

    if (result.cancelled) {
      return
    }

    recordBackupCreated()

    window.dispatchEvent(
      new Event(
        'finance-backup-created',
      ),
    )

    backupMessage.value =
      `Резервная копия создана: ` +
      `${result.accounts} счетов, ` +
      `${result.transactions} операций.`
  } catch (exportError) {
    console.error(exportError)

    backupError.value =
      exportError instanceof Error
        ? `${exportError.name}: ${exportError.message}`
        : 'Не удалось создать резервную копию.'
  } finally {
    isExportingBackup.value = false
  }
}

function openBackupFilePicker() {
  backupMessage.value = ''
  backupError.value = ''

  backupFileInput.value?.click()
}

async function handleBackupFile(event) {
  const file =
    event.target.files?.[0]

  event.target.value = ''

  if (!file) {
    return
  }

  const shouldImport =
    window.confirm(
      'Импорт полностью заменит текущие счета, операции и настройки. Продолжить?',
    )

  if (!shouldImport) {
    return
  }

  backupMessage.value = ''
  backupError.value = ''
  isImportingBackup.value = true

  try {
    const result =
      await importBackup(file)

    await Promise.all([
      accountsStore.loadAccounts(),
      allocationStore.loadSettings(),
      allocationStore.loadRuns(),
    ])

    hydrateForm()

    backupMessage.value =
      `Данные восстановлены: ` +
      `${result.accounts} счетов, ` +
      `${result.transactions} операций.`
  } catch (importError) {
    console.error(importError)

    backupError.value =
      importError instanceof Error
        ? importError.message
        : 'Не удалось восстановить данные.'
  } finally {
    isImportingBackup.value = false
  }
}
</script>

<template>
  <section class="screen settings-screen">
    <header class="topbar">
      <div>
        <span class="topbar-label">
          Планирование денег
        </span>

        <h1 class="screen-title">
          Настройки
        </h1>
      </div>
    </header>

    <div
      v-if="
        accountsStore.isLoading ||
        allocationStore.isLoading
      "
      class="surface-card"
    >
      Загружаем настройки…
    </div>

    <div
      v-else-if="
        !accountsStore.activeAccounts.length
      "
      class="empty-card"
    >
      <div class="empty-card__icon">
        💳
      </div>

      <strong>
        Сначала добавьте счета
      </strong>

      <p>
        Для распределения нужен счет поступления
        и хотя бы один счет для накоплений.
      </p>

      <RouterLink
        to="/accounts"
        class="primary-button"
      >
        Перейти к счетам
      </RouterLink>
    </div>

    <form
      v-else
      class="settings-form"
      @submit.prevent="handleSave"
    >
      <section class="settings-card">
        <div class="settings-card__heading">
          <div
            class="settings-card__icon settings-card__icon--blue"
          >
            💳
          </div>

          <div>
            <h2>
              Счет поступления
            </h2>

            <p>
              Счет, на который обычно приходит зарплата.
            </p>
          </div>
        </div>

        <label class="field">
          <span class="field-label">
            Основной счет
          </span>

          <select
            v-model.number="
              form.sourceAccountId
            "
            class="text-input"
          >
            <option
              v-for="
                account in
                accountsStore.activeAccounts
              "
              :key="account.id"
              :value="account.id"
            >
              {{ account.name }} —
              {{
                formatMoney(
                  account.balance,
                )
              }}
            </option>
          </select>
        </label>
      </section>

      <section class="settings-card">
        <div class="settings-card__heading">
          <div
            class="settings-card__icon settings-card__icon--salary"
          >
            📅
          </div>

          <div>
            <h2>
              График зарплаты
            </h2>

            <p>
              Укажите даты и примерные суммы двух выплат.
              Распределение всё равно считается по реальному
              балансу счета.
            </p>
          </div>
        </div>

        <div class="salary-schedule-grid">
          <article class="salary-payment-card">
            <strong>
              Первая выплата
            </strong>

            <div class="salary-payment-fields">
              <label class="field">
                <span class="field-label">
                  День месяца
                </span>

                <input
                  v-model="
                    form.salaryDayFirst
                  "
                  class="text-input"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="28"
                />
              </label>

              <label class="field">
                <span class="field-label">
                  Ожидаемая сумма
                </span>

                <div class="money-input">
                  <input
                    v-model="
                      form.salaryAmountFirst
                    "
                    type="text"
                    inputmode="decimal"
                    placeholder="0"
                    autocomplete="off"
                  />

                  <span>₽</span>
                </div>
              </label>
            </div>
          </article>

          <article class="salary-payment-card">
            <strong>
              Вторая выплата
            </strong>

            <div class="salary-payment-fields">
              <label class="field">
                <span class="field-label">
                  День месяца
                </span>

                <input
                  v-model="
                    form.salaryDaySecond
                  "
                  class="text-input"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="28"
                />
              </label>

              <label class="field">
                <span class="field-label">
                  Ожидаемая сумма
                </span>

                <div class="money-input">
                  <input
                    v-model="
                      form.salaryAmountSecond
                    "
                    type="text"
                    inputmode="decimal"
                    placeholder="0"
                    autocomplete="off"
                  />

                  <span>₽</span>
                </div>
              </label>
            </div>
          </article>
        </div>

        <div class="settings-total">
          <span>
            Ожидаемый доход за месяц
          </span>

          <strong>
            {{
              formatMoney(
                expectedMonthlyIncome,
              )
            }}
          </strong>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card__heading">
          <div
            class="settings-card__icon settings-card__icon--green"
          >
            🛒
          </div>

          <div>
            <h2>
              Бюджет до следующей зарплаты
            </h2>

            <p>
              Эти категории используются только для расчета
              суммы, которую нужно оставить.
            </p>
          </div>
        </div>

        <div class="budget-categories">
          <div
            v-for="
              category in
              form.categories
            "
            :key="category.id"
            class="budget-category-row"
          >
            <input
              v-model="
                category.name
              "
              class="budget-category-name"
              type="text"
              maxlength="40"
              placeholder="Название категории"
              autocomplete="off"
            />

            <div class="money-input">
              <input
                v-model="
                  category.amount
                "
                type="text"
                inputmode="decimal"
                placeholder="0"
                autocomplete="off"
              />

              <span>₽</span>
            </div>

            <button
              class="category-remove-button"
              type="button"
              aria-label="Удалить категорию"
              @click="
                removeCategory(
                  category.id,
                )
              "
            >
              ×
            </button>
          </div>
        </div>

        <button
          class="add-row-button"
          type="button"
          @click="addCategory"
        >
          + Добавить категорию
        </button>

        <div class="settings-total">
          <span>
            Всего до следующей выплаты
          </span>

          <strong>
            {{
              formatMoney(
                totalLifeBudget,
              )
            }}
          </strong>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card__heading">
          <div
            class="settings-card__icon settings-card__icon--yellow"
          >
            🛟
          </div>

          <div>
            <h2>
              Неснижаемый остаток
            </h2>

            <p>
              Дополнительный запас, который всегда остается
              на основном счете.
            </p>
          </div>
        </div>

        <label class="field">
          <span class="field-label">
            Резерв на основном счете
          </span>

          <div class="large-money-input">
            <input
              v-model="
                form.minimumBalance
              "
              type="text"
              inputmode="decimal"
              placeholder="0"
              autocomplete="off"
            />

            <span>₽</span>
          </div>
        </label>

        <div class="keep-summary">
          <span>
            Всего нужно оставить
          </span>

          <strong>
            {{
              formatMoney(
                totalToKeep,
              )
            }}
          </strong>

          <small>
            Бюджет до следующей зарплаты
            + неснижаемый остаток
          </small>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card__heading">
          <div
            class="settings-card__icon settings-card__icon--violet"
          >
            %
          </div>

          <div>
            <h2>
              Распределение накоплений
            </h2>

            <p>
              Укажите, какая доля свободных денег должна
              поступать на каждый счет.
            </p>
          </div>
        </div>

        <div
          v-if="form.rules.length"
          class="allocation-rules"
        >
          <div
            v-for="
              rule in form.rules
            "
            :key="
              rule.targetAccountId
            "
            class="allocation-rule"
          >
            <template
              v-if="
                getAccount(
                  rule.targetAccountId,
                )
              "
            >
              <div class="allocation-rule__account">
                <div
                  class="account-avatar"
                  :class="
                    `account-avatar--${
                      getAccount(
                        rule.targetAccountId,
                      ).type
                    }`
                  "
                >
                  {{
                    getAccountType(
                      getAccount(
                        rule.targetAccountId,
                      ).type,
                    ).icon
                  }}
                </div>

                <div class="allocation-rule__copy">
                  <strong>
                    {{
                      getAccount(
                        rule.targetAccountId,
                      ).name
                    }}
                  </strong>

                  <span>
                    {{
                      getAccountType(
                        getAccount(
                          rule.targetAccountId,
                        ).type,
                      ).label
                    }}
                  </span>
                </div>
              </div>

              <div class="percentage-input">
                <input
                  v-model="
                    rule.percentage
                  "
                  type="text"
                  inputmode="decimal"
                  placeholder="0"
                  autocomplete="off"
                />

                <span>%</span>
              </div>
            </template>
          </div>
        </div>

        <div
          v-else
          class="settings-inline-warning"
        >
          Добавьте хотя бы еще один счет для распределения.
        </div>

        <div
          class="percentage-summary"
          :class="{
            'percentage-summary--valid':
              percentageIsValid,

            'percentage-summary--invalid':
              !percentageIsValid,
          }"
        >
          <span>
            Всего распределено
          </span>

          <strong>
            {{ totalPercentage }}%
          </strong>
        </div>
      </section>

      <p
        v-if="
          formError ||
          allocationStore.error
        "
        class="error-message settings-message"
      >
        {{
          formError ||
          allocationStore.error
        }}
      </p>

      <p
        v-if="successMessage"
        class="success-message settings-message"
      >
        {{ successMessage }}
      </p>

      <button
        class="primary-button settings-save-button"
        type="submit"
        :disabled="
          allocationStore.isSaving ||
          !form.rules.length
        "
      >
        {{
          allocationStore.isSaving
            ? 'Сохраняем…'
            : 'Сохранить настройки'
        }}
      </button>
    </form>

    <section
      v-if="
        !accountsStore.isLoading &&
        !allocationStore.isLoading
      "
      class="settings-card backup-card"
    >
      <div class="settings-card__heading">
        <div
          class="settings-card__icon settings-card__icon--backup"
        >
          ☁️
        </div>

        <div>
          <h2>
            Резервная копия
          </h2>

          <p>
            Сохраните счета, операции и настройки в файл.
            Он понадобится для переноса на другое устройство
            или восстановления данных.
          </p>
        </div>
      </div>

      <div class="backup-actions">
        <button
          class="backup-action backup-action--export"
          type="button"
          :disabled="
            isExportingBackup ||
            isImportingBackup
          "
          @click="
            handleExportBackup
          "
        >
          <span class="backup-action__icon">
            ↑
          </span>

          <span class="backup-action__copy">
            <strong>
              {{
                isExportingBackup
                  ? 'Создаем файл…'
                  : 'Экспортировать'
              }}
            </strong>

            <small>
              Сохранить резервную копию
            </small>
          </span>
        </button>

        <button
          class="backup-action"
          type="button"
          :disabled="
            isImportingBackup ||
            isExportingBackup
          "
          @click="
            openBackupFilePicker
          "
        >
          <span class="backup-action__icon">
            ↓
          </span>

          <span class="backup-action__copy">
            <strong>
              {{
                isImportingBackup
                  ? 'Восстанавливаем…'
                  : 'Импортировать'
              }}
            </strong>

            <small>
              Загрузить данные из файла
            </small>
          </span>
        </button>
      </div>

      <input
        ref="backupFileInput"
        hidden
        type="file"
        accept=".json,application/json"
        @change="
          handleBackupFile
        "
      />

      <p
        v-if="backupError"
        class="error-message"
      >
        {{ backupError }}
      </p>

      <p
        v-if="backupMessage"
        class="success-message"
      >
        {{ backupMessage }}
      </p>

      <div class="backup-warning">
        <strong>
          Важно
        </strong>

        <span>
          При импорте текущие данные приложения будут
          заменены содержимым выбранного файла.
        </span>
      </div>
    </section>

    <DataHealthCard />
  </section>
</template>